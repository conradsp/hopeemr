# Scheduling System

## Overview

This EMR application includes a comprehensive scheduling system built on FHIR standards, leveraging [Medplum's Scheduling capabilities](https://www.medplum.com/products/scheduling). The system supports appointment types, provider schedules, slot generation, and booking workflows.

## Architecture

### Backend Storage (FHIR Resources)

The system uses three core FHIR resources for scheduling:

1. **Schedule** - Represents a provider's availability
   - Contains actor (practitioner), service type, planning horizon
   - Can be active or inactive
   - Supports filtering by appointment type

2. **Slot** - Individual bookable time slots
   - Belongs to a Schedule
   - Has status: `free`, `busy`, `busy-unavailable`, `busy-tentative`, `entered-in-error`
   - Contains start/end time and service type

3. **Appointment** - Booked appointments
   - References one or more Slots
   - Contains participants (patient, practitioner)
   - Has status: `proposed`, `pending`, `booked`, `arrived`, `fulfilled`, `cancelled`, `noshow`
   - Includes appointment type, reason, and notes

4. **ValueSet** - Appointment type definitions
   - Stores appointment type catalog with codes, names, durations, colors
   - Managed by administrators

### Workflow

```
1. Admin creates Appointment Types
2. Provider/Admin creates Schedule for a practitioner
3. System generates Slots for the schedule based on working hours
4. Staff searches for available Slots
5. Staff books Appointment and marks Slot as busy
6. Provider views their calendar
7. Patient checks in (status: arrived)
8. Appointment is completed (status: fulfilled)
```

## Components

### Admin Components

#### Appointment Types Management (`/admin/appointment-types`)
- **Purpose**: Define and manage appointment types
- **Features**:
  - Initialize 12 default appointment types
  - Create custom appointment types
  - Configure duration, description, and calendar color
  - Edit/delete appointment types
- **Default Types**:
  - New Patient Visit (60 min)
  - Follow-Up Visit (30 min)
  - Annual Physical Exam (45 min)
  - Wellness Check-Up (30 min)
  - Urgent Care (20 min)
  - Consultation (45 min)
  - Procedure (60 min)
  - Lab Work (15 min)
  - Immunization (15 min)
  - Telehealth Visit (30 min)
  - Pre-Operative Visit (45 min)
  - Post-Operative Follow-Up (30 min)

#### Schedule Management (`/scheduling/manage`)
- **Purpose**: Providers/admins manage their schedules
- **Features**:
  - Create schedules for practitioners
  - Set working days and hours
  - Configure lunch breaks and other interruptions
  - Specify appointment type (or allow all types)
  - Generate slots automatically
  - Activate/deactivate schedules
  - Delete future available slots

### Staff Components

#### Book Appointment (`/scheduling/book`)
- **Purpose**: Staff schedules appointments for patients
- **Features**:
  - Select patient (required)
  - Filter by provider (optional)
  - Filter by appointment type
  - Select date
  - View available time slots
  - Book appointments with reason and notes
  - Automatic slot status update

#### Provider Calendar (`/scheduling/calendar`)
- **Purpose**: View and manage daily appointments
- **Features**:
  - View appointments by provider and date
  - Navigate between dates
  - Check in patients (booked → arrived)
  - Complete appointments (arrived → fulfilled)
  - Mark no-shows
  - Cancel appointments with reason
  - Color-coded status badges

## Default Appointment Types

| Code | Display Name | Duration | Color | Description |
|------|-------------|----------|-------|-------------|
| `new-patient` | New Patient Visit | 60 min | Green | Initial visit for new patients |
| `follow-up` | Follow-Up Visit | 30 min | Blue | Follow-up for existing patients |
| `annual-physical` | Annual Physical Exam | 45 min | Purple | Yearly comprehensive physical |
| `wellness-checkup` | Wellness Check-Up | 30 min | Cyan | General wellness and preventive care |
| `urgent-care` | Urgent Care | 20 min | Red | Same-day urgent medical needs |
| `consultation` | Consultation | 45 min | Orange | Specialist consultation |
| `procedure` | Procedure | 60 min | Pink | In-office medical procedure |
| `lab-work` | Lab Work | 15 min | Gray | Laboratory tests |
| `immunization` | Immunization | 15 min | Light Green | Vaccine administration |
| `telehealth` | Telehealth Visit | 30 min | Indigo | Virtual video consultation |
| `pre-op` | Pre-Operative Visit | 45 min | Brown | Pre-surgical evaluation |
| `post-op` | Post-Operative Follow-Up | 30 min | Teal | Post-surgical follow-up |

## Usage Guide

### For Administrators

#### 1. Initialize Appointment Types
1. Navigate to **Admin → Appointment Types**
2. Click **"Initialize Default Types"**
3. Review and customize types as needed
4. Create additional custom types for your practice

#### 2. Set Up Provider Schedules
1. Navigate to **Scheduling → Manage Schedules**
2. Select a provider
3. Click **"Create Schedule"**
4. Configure:
   - Appointment type (or leave blank for all types)
   - Date range (e.g., next 3 months)
   - Working days (e.g., Monday-Friday)
   - Working hours (e.g., 9:00 AM - 5:00 PM)
   - Lunch break (e.g., 12:00 PM - 1:00 PM)
   - Slot duration (typically matches appointment type duration)
5. Click **"Create Schedule & Generate Slots"**

### For Staff

#### Booking an Appointment
1. Navigate to **Scheduling → Book Appointment**
2. Select the patient from the dropdown
3. (Optional) Filter by specific provider
4. Select appointment type
5. Choose date
6. Click **"Search Slots"**
7. Review available time slots
8. Click **"Book"** on desired slot
9. Enter reason for visit and any notes
10. Click **"Confirm Booking"**

### For Providers

#### Viewing Daily Schedule
1. Navigate to **Scheduling → Provider Calendar**
2. Select your name from the provider dropdown
3. View appointments for today (or navigate to another date)
4. Use action buttons to:
   - **Check In**: Mark patient as arrived
   - **Complete**: Mark appointment as fulfilled
   - **No Show**: Mark patient as no-show
   - **Cancel**: Cancel appointment with reason

## Technical Details

### FHIR Compliance

The implementation follows FHIR R4 standards:
- [Schedule Resource](https://www.hl7.org/fhir/schedule.html)
- [Slot Resource](https://www.hl7.org/fhir/slot.html)
- [Appointment Resource](https://www.hl7.org/fhir/appointment.html)
- [ValueSet Resource](https://www.hl7.org/fhir/valueset.html)

### Code Organization

```
examples/emr/src/
├── utils/
│   ├── appointmentTypes.ts      # Appointment type management
│   ├── scheduleUtils.ts         # Schedule and slot operations
│   └── appointmentUtils.ts      # Appointment booking and management
├── pages/
│   ├── AppointmentTypesPage.tsx # Admin: manage appointment types
│   ├── ScheduleManagementPage.tsx # Admin: manage schedules
│   ├── BookAppointmentPage.tsx    # Staff: book appointments
│   └── ProviderCalendarPage.tsx   # Provider: view calendar
└── components/
    ├── admin/
    │   └── EditAppointmentTypeModal.tsx  # Edit appointment type
    └── scheduling/
        └── CreateScheduleModal.tsx       # Create schedule with slots
```

### Key Algorithms

#### Slot Generation
When creating a schedule, the system:
1. Iterates through each day in the date range
2. Checks if day is in selected working days
3. Generates slots from start time to end time
4. Skips slots that overlap with breaks
5. Creates Slot resources with `status: free`

#### Appointment Booking
When booking an appointment:
1. Validates patient and slot selection
2. Updates Slot status to `busy`
3. Creates Appointment resource
4. Links appointment to patient and practitioner
5. Stores appointment type, reason, and notes

## Common Scenarios

### Scenario 1: Setting up a new provider
1. Admin creates provider account
2. Admin creates appointment types (if not already done)
3. Admin creates schedules for next 3 months
4. Staff can now book appointments

### Scenario 2: Provider vacation
1. Provider/admin goes to Schedule Management
2. Finds the schedule for vacation period
3. Clicks "Deactivate" (prevents new bookings)
4. Optionally deletes future available slots

### Scenario 3: Urgent same-day appointment
1. Staff goes to Book Appointment
2. Selects "Urgent Care" type
3. Selects today's date
4. Finds available 20-minute slot
5. Books appointment with urgency noted

### Scenario 4: Regular office hours
Provider wants Monday-Friday, 9 AM - 5 PM with 1-hour lunch:
- Days: [1, 2, 3, 4, 5] (Mon-Fri)
- Start: 09:00
- End: 17:00
- Break: 12:00 - 13:00
- Slot duration: 30 minutes
- Result: ~14 slots per day, ~70 slots per week

## Future Enhancements

Potential improvements:
- **Recurring appointments**: Support for series of appointments
- **Waitlist management**: Queue patients for cancelled slots
- **Automated reminders**: SMS/email reminders via bots
- **Online booking**: Patient self-scheduling
- **Resource scheduling**: Rooms, equipment scheduling
- **Double booking**: Overbooking/buffer time configuration
- **Appointment templates**: Quick booking for common scenarios
- **Reporting**: Utilization metrics, no-show rates
- **Telehealth integration**: Video conferencing links
- **Mobile app**: Native scheduling interface

## Troubleshooting

### No slots appearing
- **Check**: Is the schedule active?
- **Check**: Are slots generated for the selected date?
- **Check**: Is the provider correctly assigned?
- **Check**: Does the search filter match the schedule's service type?

### Can't book appointment
- **Check**: Is the slot status "free"?
- **Check**: Has the patient been selected?
- **Check**: Is the appointment type selected?

### Slots overlapping with breaks
- **Solution**: Regenerate schedule with correct break times
- **Delete**: Future slots and recreate schedule

## References

- [Medplum Scheduling Documentation](https://www.medplum.com/products/scheduling)
- [FHIR Scheduling Workflow](https://www.hl7.org/fhir/scheduling.html)
- [Medplum Scheduling Tutorial (YouTube)](https://www.youtube.com/watch?v=YOUR_VIDEO)
- [Medplum Sample Code](https://www.medplum.com/docs/tutorials/api/scheduling)

