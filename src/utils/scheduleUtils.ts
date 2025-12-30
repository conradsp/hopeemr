import { MedplumClient } from '@medplum/core';
import { Schedule, Slot, Practitioner, Reference } from '@medplum/fhirtypes';
import { logger } from './logger';
import { getAppointmentTypeByCode } from './appointmentTypes';

export interface ScheduleTemplate {
  practitioner: Reference<Practitioner>;
  startDate: string; // ISO date
  endDate: string; // ISO date
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  slotDuration: number; // minutes
  appointmentType?: string; // appointment type code
  breaks?: TimeRange[]; // lunch breaks, etc.
}

export interface TimeRange {
  start: string; // HH:mm
  end: string; // HH:mm
}

/**
 * Create a Schedule resource for a practitioner
 */
export async function createSchedule(
  medplum: MedplumClient,
  practitioner: Reference<Practitioner>,
  name: string,
  appointmentType?: string
): Promise<Schedule> {
  const schedule: Schedule = {
    resourceType: 'Schedule',
    active: true,
    actor: [practitioner],
    planningHorizon: {
      start: new Date().toISOString(),
    },
    comment: appointmentType ? `Schedule for ${appointmentType} appointments` : undefined,
  };

  // Add appointment type as serviceType if specified
  if (appointmentType) {
    const type = getAppointmentTypeByCode(appointmentType);
    schedule.serviceType = [
      {
        coding: [
          {
            system: 'http://medplum.com/appointment-types',
            code: appointmentType,
            display: type?.display || appointmentType,
          },
        ],
      },
    ];
  }

  return await medplum.createResource(schedule);
}

/**
 * Generate slots for a schedule based on template
 */
export async function generateSlots(
  medplum: MedplumClient,
  schedule: Schedule,
  template: ScheduleTemplate
): Promise<Slot[]> {
  const slots: Slot[] = [];
  
  // Parse dates and use UTC to avoid timezone issues
  const startDate = new Date(template.startDate + 'T00:00:00');
  const endDate = new Date(template.endDate + 'T23:59:59');
  
  // Iterate through each day in the range
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    
    // Skip if this day is not in the selected days
    if (template.daysOfWeek.includes(dayOfWeek)) {
      // Generate slots for this day
      const daySlots = await generateSlotsForDay(
        medplum,
        schedule,
        new Date(currentDate),
        template.startTime,
        template.endTime,
        template.slotDuration,
        template.breaks || []
      );

      slots.push(...daySlots);
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

/**
 * Generate slots for a single day
 */
async function generateSlotsForDay(
  medplum: MedplumClient,
  schedule: Schedule,
  date: Date,
  startTime: string,
  endTime: string,
  duration: number,
  breaks: TimeRange[]
): Promise<Slot[]> {
  const slots: Slot[] = [];
  
  // Parse start and end times
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  // Create datetime for start and end using local time
  const startDateTime = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    startHour,
    startMinute,
    0,
    0
  );
  
  const endDateTime = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    endHour,
    endMinute,
    0,
    0
  );
  
  // Generate slots
  let currentTime = new Date(startDateTime);
  
  while (currentTime < endDateTime) {
    const slotEnd = new Date(currentTime.getTime() + duration * 60000);
    
    // Check if this slot overlaps with any break
    const overlapsBreak = breaks.some(breakTime => {
      const [breakStartHour, breakStartMinute] = breakTime.start.split(':').map(Number);
      const [breakEndHour, breakEndMinute] = breakTime.end.split(':').map(Number);
      
      const breakStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        breakStartHour,
        breakStartMinute,
        0,
        0
      );
      
      const breakEnd = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        breakEndHour,
        breakEndMinute,
        0,
        0
      );
      
      // Check if slot overlaps with break
      return (
        (currentTime >= breakStart && currentTime < breakEnd) ||
        (slotEnd > breakStart && slotEnd <= breakEnd) ||
        (currentTime <= breakStart && slotEnd >= breakEnd)
      );
    });
    
    if (!overlapsBreak && slotEnd <= endDateTime) {
      const slot: Slot = {
        resourceType: 'Slot',
        schedule: {
          reference: `Schedule/${schedule.id}`,
        },
        status: 'free',
        start: currentTime.toISOString(),
        end: slotEnd.toISOString(),
        serviceType: schedule.serviceType,
      };
      
      try {
        const createdSlot = await medplum.createResource(slot);
        slots.push(createdSlot);
      } catch (error) {
        logger.error('Failed to create slot', error);
        throw error;
      }
    }
    
    currentTime = slotEnd;
  }
  
  return slots;
}

/**
 * Get all schedules for a practitioner
 */
export async function getPractitionerSchedules(
  medplum: MedplumClient,
  practitionerId: string
): Promise<Schedule[]> {
  try {
    const result = await medplum.search('Schedule', {
      actor: `Practitioner/${practitionerId}`,
      _count: '100',
      _sort: '-_lastUpdated',
    });
    
    return (result.entry?.map(e => e.resource as Schedule) || []);
  } catch (error) {
    logger.error('Failed to load schedules', error);
    return [];
  }
}

/**
 * Get slots for a schedule
 */
export async function getScheduleSlots(
  medplum: MedplumClient,
  scheduleId: string,
  startDate?: string,
  endDate?: string
): Promise<Slot[]> {
  try {
    // FHIR search requires full reference format, not just ID
    const scheduleReference = scheduleId.startsWith('Schedule/') ? scheduleId : `Schedule/${scheduleId}`;
    
    const searchParams: Record<string, string> = {
      schedule: scheduleReference,
      _count: '1000',
      _sort: 'start',
    };
    
    // Use single boundary and filter in code
    if (startDate) {
      searchParams['start'] = `ge${startDate}`;
    }
    
    const result = await medplum.search('Slot', searchParams);
    let slots = result.entry?.map(e => e.resource as Slot) || [];
    
    // Filter by end date in code if provided
    if (endDate) {
      const endDateTime = new Date(endDate).getTime();
      slots = slots.filter(slot => {
        const slotStart = new Date(slot.start as string).getTime();
        return slotStart < endDateTime;
      });
    }
    
    return slots;
  } catch (error) {
    logger.error('Failed to load slots', error);
    return [];
  }
}

/**
 * Update schedule status
 */
export async function updateScheduleStatus(
  medplum: MedplumClient,
  scheduleId: string,
  active: boolean
): Promise<Schedule> {
  const schedule = await medplum.readResource('Schedule', scheduleId);
  schedule.active = active;
  return await medplum.updateResource(schedule);
}

/**
 * Delete future slots for a schedule
 */
export async function deleteFutureSlots(
  medplum: MedplumClient,
  scheduleId: string
): Promise<void> {
  const now = new Date().toISOString();
  const slots = await getScheduleSlots(medplum, scheduleId, now);
  
  // Only delete free slots
  const freeSlots = slots.filter(slot => slot.status === 'free');
  
  for (const slot of freeSlots) {
    if (slot.id) {
      try {
        await medplum.deleteResource('Slot', slot.id);
      } catch (error) {
        logger.error(`Failed to delete slot ${slot.id}`, error);
      }
    }
  }
}

/**
 * Delete a schedule and all its slots
 */
export async function deleteSchedule(
  medplum: MedplumClient,
  scheduleId: string
): Promise<void> {
  // First delete all slots
  await deleteFutureSlots(medplum, scheduleId);
  
  // Also delete past slots
  const allSlots = await medplum.search('Slot', {
    schedule: scheduleId,
    _count: '1000',
  });
  
  const slots = allSlots.entry?.map(e => e.resource) || [];
  for (const slot of slots) {
    if (slot && slot.id) {
      try {
        await medplum.deleteResource('Slot', slot.id);
      } catch (error) {
        logger.error(`Failed to delete slot ${slot.id}`, error);
      }
    }
  }
  
  // Then delete the schedule itself
  await medplum.deleteResource('Schedule', scheduleId);
}

/**
 * Helper to get day name from number
 */
export function getDayName(dayNumber: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || '';
}

/**
 * Helper to format time range
 */
export function formatTimeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

