import { MedplumClient } from '@medplum/core';
import { Appointment, Slot, Patient, Reference } from '@medplum/fhirtypes';
import { logger } from './logger';
import { createAppointmentTypeCodeableConcept } from './appointmentTypes';

export interface BookAppointmentRequest {
  patient: Reference<Patient>;
  slot: Slot;
  appointmentType: string;
  reason?: string;
  note?: string;
}

/**
 * Book an appointment and mark slot as busy
 * @param medplum
 * @param request
 */
export async function bookAppointment(
  medplum: MedplumClient,
  request: BookAppointmentRequest
): Promise<Appointment> {
  // Check if this is a combined slot (multiple slots combined for longer appointments)
  const combinedSlotIds: string[] = [];
  const combinedExtension = request.slot.meta?.extension?.find(
    ext => ext.url === 'http://medplum.com/combined-slots'
  );
  
  if (combinedExtension?.valueString) {
    try {
      combinedSlotIds.push(...JSON.parse(combinedExtension.valueString));
    } catch (error) {
      logger.error('Failed to parse combined slot IDs', error);
    }
  }

  // Mark all slots as busy
  const slotReferences: any[] = [];
  
  if (combinedSlotIds.length > 0) {
    // Mark all combined slots as busy
    for (const slotId of combinedSlotIds) {
      try {
        const slot = await medplum.readResource('Slot', slotId);
        await medplum.updateResource({
          ...slot,
          status: 'busy',
        });
        slotReferences.push({ reference: `Slot/${slotId}` });
      } catch (error) {
        logger.error(`Failed to mark slot ${slotId} as busy`, error);
      }
    }
  } else if (request.slot.id) {
    // Single slot
    await medplum.updateResource({
      ...request.slot,
      status: 'busy',
    });
    slotReferences.push({ reference: `Slot/${request.slot.id}` });
  }

  // Create appointment
  const appointment: Appointment = {
    resourceType: 'Appointment',
    status: 'booked',
    serviceType: request.slot.serviceType,
    appointmentType: createAppointmentTypeCodeableConcept(request.appointmentType),
    reasonCode: request.reason ? [{
      text: request.reason,
    }] : undefined,
    description: request.note,
    start: request.slot.start,
    end: request.slot.end,
    slot: slotReferences.length > 0 ? slotReferences : undefined,
    participant: [
      {
        actor: request.patient,
        status: 'accepted',
        required: 'required',
      },
    ],
  };

  // Add practitioner from slot's schedule if available
  if (request.slot.schedule?.reference) {
    const scheduleId = request.slot.schedule.reference.split('/')[1];
    try {
      const schedule = await medplum.readResource('Schedule', scheduleId);
      if (schedule.actor?.[0]) {
        appointment.participant.push({
          actor: schedule.actor[0],
          status: 'accepted',
          required: 'required',
        });
      }
    } catch (error) {
      logger.error('Failed to load schedule', error);
    }
  }

  const resource = await medplum.createResource(appointment);
  return resource;
}

/**
 * Cancel an appointment and free the slot
 */
export async function cancelAppointment(
  medplum: MedplumClient,
  appointmentId: string,
  reason?: string
): Promise<Appointment> {
  const appointment = await medplum.readResource('Appointment', appointmentId);
  
  // Free the slot
  if (appointment.slot?.[0]?.reference) {
    const slotId = appointment.slot[0].reference.split('/')[1];
    try {
      const slot = await medplum.readResource('Slot', slotId);
      await medplum.updateResource({
        ...slot,
        status: 'free',
      });
    } catch (error) {
      logger.error('Failed to free slot', error);
    }
  }

  // Update appointment status
  appointment.status = 'cancelled';
  if (reason) {
    appointment.cancelationReason = {
      text: reason,
    };
  }

  const resource = await medplum.updateResource(appointment);

  return resource;
}

/**
 * Get appointments for a patient
 */
export async function getPatientAppointments(
  medplum: MedplumClient,
  patientId: string,
  status?: string
): Promise<Appointment[]> {
  try {
    const searchParams: Record<string, string> = {
      patient: patientId,
      _count: '100',
      _sort: '-date',
    };
    
    if (status) {
      searchParams['status'] = status;
    }
    
    const result = await medplum.search('Appointment', searchParams);
    return (result.entry?.map(e => e.resource as Appointment) || []);
  } catch (error) {
    logger.error('Failed to load appointments', error);
    return [];
  }
}

/**
 * Get appointments for a practitioner
 */
export async function getPractitionerAppointments(
  medplum: MedplumClient,
  practitionerId: string,
  date?: string
): Promise<Appointment[]> {
  try {
    const searchParams: Record<string, string> = {
      actor: `Practitioner/${practitionerId}`,
      _count: '100',
      _sort: 'date',
    };
    
    if (date) {
      searchParams['date'] = date;
    }
    
    const result = await medplum.search('Appointment', searchParams);
    return (result.entry?.map(e => e.resource as Appointment) || []);
  } catch (error) {
    logger.error('Failed to load appointments', error);
    return [];
  }
}

/**
 * Search for available slots
 */
export async function searchAvailableSlots(
  medplum: MedplumClient,
  scheduleId?: string,
  startDate?: string,
  endDate?: string,
  serviceType?: string
): Promise<Slot[]> {
  try {
    const searchParams: Record<string, string> = {
      status: 'free',
      _count: '100',
      _sort: 'start',
    };
    
    if (scheduleId) {
      searchParams['schedule'] = scheduleId;
    }
    
    // Use single boundary and filter in code
    if (startDate) {
      searchParams['start'] = `ge${startDate}`;
    }
    
    // Don't filter by service-type in the search, do it in code instead
    // This is because the FHIR search might not match the CodeableConcept correctly
    
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
    
    // Don't filter by service type - allow booking any appointment type in any slot
    // The appointment type is applied when booking, not when searching for slots
    
    return slots;
  } catch (error) {
    logger.error('Failed to search slots', error);
    return [];
  }
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(
  medplum: MedplumClient,
  appointmentId: string,
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist'
): Promise<Appointment> {
  const appointment = await medplum.readResource('Appointment', appointmentId);
  appointment.status = status;
  return await medplum.updateResource(appointment);
}

/**
 * Check in a patient for their appointment
 */
export async function checkInPatient(
  medplum: MedplumClient,
  appointmentId: string
): Promise<Appointment> {
  return await updateAppointmentStatus(medplum, appointmentId, 'arrived');
}

/**
 * Mark appointment as fulfilled (completed)
 */
export async function fulfillAppointment(
  medplum: MedplumClient,
  appointmentId: string
): Promise<Appointment> {
  return await updateAppointmentStatus(medplum, appointmentId, 'fulfilled');
}

/**
 * Mark appointment as no-show
 */
export async function markNoShow(
  medplum: MedplumClient,
  appointmentId: string
): Promise<Appointment> {
  return await updateAppointmentStatus(medplum, appointmentId, 'noshow');
}

