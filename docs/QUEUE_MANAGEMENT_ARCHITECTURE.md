# Queue Management System Architecture

## Executive Summary

This document outlines the architecture for implementing a FHIR-based Queue Management System for high-volume clinics (50-100+ patients/day) in low-resource settings.

## Research Findings

### Industry Research (December 2025)

**Key Findings from EMR Queue Management Research:**

1. **FHIR Task Resource Pattern** ([Medplum Documentation](https://www.medplum.com/docs/careplans/tasks))
   - FHIR Task resource is the industry standard for workflow management
   - Task.status maps to workflow lifecycle (ready, in-progress, completed)
   - Task.performerType enables role-based task assignment
   - Supports predictive algorithms and real-time queue management

2. **Modern Queue Management Trends 2025** ([1st Provider's Choice](https://1stproviderschoice.com/blog/top-emr-trends-2025/))
   - Event-driven updates trigger EHR hooks for pre-loading patient data
   - AI-powered triage routing based on acuity and provider availability
   - Real-time wait time predictions using traffic patterns
   - FHIR standardization improving interoperability

3. **Bahmni Implementation Patterns** ([Bahmni Wiki](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/3336896578))
   - IPD (In-Patient Department) workflow with Ward Dashboard
   - Nursing Dashboard for patient tracking
   - FHIR module integration for interoperability
   - Focus on low-resource healthcare settings

### Reference EMR Patterns

**HospitalRun:**
- Modern TypeScript/React architecture
- Offline-first using PouchDB/CouchDB
- Focus on resource-constrained environments
- Note: Repository archived (January 2023), but patterns remain valid

**Bahmni:**
- OpenMRS-based with strong FHIR support
- Patient queue module for high-volume clinics
- Integration with lab/radiology for complete workflow
- Ward and nursing dashboards for hospital workflows

**OpenMRS:**
- Modular architecture with queue management add-ons
- Concept dictionary for flexible terminology
- Multi-location support critical for clinic networks

## Architecture Design

### FHIR Resource Model

#### Core Resource: Task

We use FHIR Task resources to represent queue entries:

```typescript
interface QueueTask extends Task {
  resourceType: 'Task';
  status: 'ready' | 'in-progress' | 'completed' | 'cancelled';
  intent: 'order';
  code: {
    coding: [{
      system: 'http://example.org/queue-task-type';
      code: 'patient-visit';
      display: 'Patient Visit Queue Entry';
    }];
  };

  // Patient being queued
  for: Reference<Patient>;

  // Provider assignment (optional, for multi-provider clinics)
  owner?: Reference<Practitioner>;

  // Triage priority
  priority: 'routine' | 'urgent' | 'asap' | 'stat';

  // Check-in time
  authoredOn: string; // ISO datetime

  // Encounter created when patient is called
  focus?: Reference<Encounter>;

  // Queue position and status tracking
  businessStatus?: {
    text: 'waiting' | 'called' | 'in-consultation' | 'completed';
  };

  // Extensions for queue-specific data
  extension?: [
    {
      url: 'http://example.org/queue-arrival-time';
      valueDateTime: string;
    },
    {
      url: 'http://example.org/queue-estimated-wait';
      valueDuration: {
        value: number;
        unit: 'min';
      };
    },
    {
      url: 'http://example.org/queue-appointment-reference';
      valueReference: Reference<Appointment>;
    }
  ];
}
```

#### Supporting Resources

**Appointment:**
- Links scheduled patients to queue
- Check-in updates Task status
- Walk-ins bypass appointment, create Task directly

**Encounter:**
- Created when provider clicks "Next Patient"
- Linked to Task via Task.focus
- Task.status updated to 'in-progress' when Encounter starts

**Practitioner:**
- Task.owner for provider assignment
- PractitionerRole.availableTime for availability tracking

### Component Architecture

```
src/pages/queue/
├── CheckInPage.tsx              # Reception desk check-in station
├── QueueDashboardPage.tsx       # Waiting room queue display
└── ProviderQueuePage.tsx        # Provider's queue with "Next Patient"

src/components/queue/
├── CheckInStation.tsx           # Patient check-in form
├── QueueTable.tsx               # Display waiting patients
├── QueueMetrics.tsx             # Dashboard metrics
├── NextPatientButton.tsx        # Call next patient action
├── PriorityBadge.tsx            # Visual priority indicator
├── WaitTimeDisplay.tsx          # Estimated wait time
└── ProviderStatusIndicator.tsx  # Provider availability status

src/hooks/
├── useQueueTasks.ts             # Fetch and subscribe to queue tasks
├── useNextPatient.ts            # Logic for selecting next patient
├── useQueueMetrics.ts           # Calculate queue statistics
└── useProviderAvailability.ts   # Track provider status

src/utils/queue/
├── queueHelpers.ts              # Queue business logic
├── priorityCalculation.ts       # Priority sorting algorithm
└── waitTimeEstimation.ts        # Wait time prediction
```

### State Management

**Real-time Updates:**
- Use Medplum Subscriptions API for real-time queue updates
- Subscribe to Task resource changes filtered by status and date
- Update UI reactively when tasks are created/updated

**Data Flow:**
```
1. Patient Check-in:
   CheckInStation → Create Task (status: ready) → Queue appears on QueueDashboard

2. Provider Calls Next:
   NextPatientButton → Select highest priority Task → Update Task (status: in-progress)
   → Create Encounter → Navigate to EncounterPage

3. Encounter Completion:
   EncounterPage → Save encounter → Update Task (status: completed)
   → Remove from queue display
```

### Queue Selection Algorithm

**Priority Ordering:**
1. **Stat** (life-threatening) - immediate
2. **ASAP** (urgent) - within 15 minutes
3. **Urgent** - within 30 minutes
4. **Routine** - FIFO (first-in, first-out)

**Within Same Priority:**
- Sort by Task.authoredOn (check-in time)
- Older patients first (longest waiting)

**Provider Assignment:**
- If Task.owner specified, only that provider sees it
- If no owner, any available provider can take it
- Admin can reassign tasks between providers

### Wait Time Estimation

**Algorithm:**
```typescript
function estimateWaitTime(
  queuePosition: number,
  providerCount: number,
  avgConsultationTime: number
): number {
  // Simple estimation: position / providers * avg time
  // More sophisticated: Consider current encounter durations
  const baseWait = (queuePosition / providerCount) * avgConsultationTime;

  // Adjust for urgent patients ahead
  const urgentAdjustment = calculateUrgentImpact();

  return Math.max(0, baseWait + urgentAdjustment);
}
```

**Historical Data:**
- Track actual consultation times per provider
- Store in PractitionerRole.extension
- Update rolling average after each encounter

### Security Model

**Access Control:**

1. **Receptionist Role:**
   - Can create Tasks (check-in patients)
   - Can view queue (read Tasks)
   - Cannot update Task.status to in-progress (only providers)

2. **Provider Role:**
   - Can view assigned queue (read Tasks where owner = self)
   - Can update Task.status (call next patient)
   - Can create Encounters
   - Can view all Encounters

3. **Admin Role:**
   - Can view all queues
   - Can reassign tasks between providers
   - Can cancel tasks
   - Can view queue metrics/reports

**AccessPolicy Configuration:**
```typescript
{
  resourceType: 'AccessPolicy',
  name: 'Queue Receptionist Access',
  resource: [
    {
      resourceType: 'Task',
      criteria: 'Task?code=patient-visit',
      readonly: false
    },
    {
      resourceType: 'Patient',
      readonly: true  // Read-only patient access
    }
  ]
}
```

**PHI Protection:**
- Queue display shows minimal PHI (name, age, priority)
- Full patient details only visible to assigned provider
- Audit all queue access (AuditEvent resources)

**Audit Logging:**
```typescript
// Log every queue action
const auditQueueAction = async (
  action: 'check-in' | 'call-patient' | 'complete',
  task: Task,
  user: Practitioner | User
) => {
  const auditEvent: AuditEvent = {
    resourceType: 'AuditEvent',
    type: {
      system: 'http://terminology.hl7.org/CodeSystem/audit-event-type',
      code: 'rest'
    },
    action: 'U',
    recorded: new Date().toISOString(),
    agent: [{
      who: createReference(user),
      requestor: true
    }],
    entity: [{
      what: createReference(task),
      role: {
        system: 'http://terminology.hl7.org/CodeSystem/object-role',
        code: '4',
        display: 'Domain Resource'
      }
    }]
  };

  await medplum.createResource(auditEvent);
};
```

### Healthcare Compliance

**FHIR Compliance:**
- Use standard Task resource (no custom resources)
- Follow FHIR workflow patterns
- Support FHIR Subscriptions for real-time updates
- Enable FHIR export for queue analytics

**Clinical Workflow Validation:**
1. Patient must exist before check-in
2. Task creation = check-in event
3. Encounter creation when patient called
4. Task completion when encounter finished
5. Maintain audit trail for all actions

**Data Quality:**
- Validate Task.for references valid Patient
- Ensure Task.priority is from value set
- Require Task.authoredOn (check-in time)
- Clean up old completed tasks (archive after 24 hours)

## UI/UX Design

### Check-In Station (Receptionist)

**Layout:**
```
+--------------------------------------------------+
| 🏥 Patient Check-In Station                      |
+--------------------------------------------------+
| Search Patient: [_____________] [Search]         |
|                                                   |
| Selected: John Doe (Male, 45 years)              |
| MRN: 12345                                       |
|                                                   |
| Appointment: ✓ Scheduled for 9:00 AM             |
|                                                   |
| Priority:  ( ) Routine  ( ) Urgent  ( ) ASAP     |
|                                                   |
| Notes: [________________________]                |
|                                                   |
|         [Cancel]  [Check In Patient]             |
+--------------------------------------------------+
```

**Workflow:**
1. Search patient (existing) or create new (walk-in)
2. If appointment exists, pre-fill details
3. Select triage priority
4. Click "Check In Patient" → Create Task
5. Show confirmation with queue position

### Queue Dashboard (Waiting Room Display)

**Layout:**
```
+--------------------------------------------------------------+
| 🏥 Waiting Room - 15 Patients Waiting                         |
+--------------------------------------------------------------+
| Priority | Name          | Check-In | Wait Time | Status     |
|----------|---------------|----------|-----------|------------|
| 🔴 URGENT | Alice Smith   | 9:05 AM  | 45 min    | Waiting    |
| 🟡 Routine| Bob Johnson   | 9:10 AM  | 40 min    | Waiting    |
| 🟡 Routine| Carol White   | 9:15 AM  | 35 min    | Waiting    |
| 🟢 F/Up  | David Brown   | 9:20 AM  | 30 min    | Waiting    |
|----------|---------------|----------|-----------|------------|
| Avg Wait: 35 min | Longest Wait: 45 min | Providers: 3      |
+--------------------------------------------------------------+
```

**Features:**
- Real-time updates (WebSocket or polling)
- Color-coded priority (Red=Urgent, Yellow=Routine, Green=Follow-up)
- Auto-refresh every 10 seconds
- Large font for readability from distance

### Provider Queue (Provider Dashboard)

**Layout:**
```
+--------------------------------------------------------------+
| 👨‍⚕️ Dr. Smith's Queue - 8 Patients Waiting                    |
+--------------------------------------------------------------+
| Status: [✓ Available]  [On Break]  [Busy]                    |
|                                                               |
| Next Patient:                                                 |
| +----------------------------------------------------------+ |
| | 🔴 URGENT: Alice Smith (F, 35 years)                      | |
| | Check-In: 9:05 AM | Waiting: 45 min                       | |
| | Reason: Follow-up hypertension                            | |
| |                                                            | |
| |                    [▶ Call Next Patient]                  | |
| +----------------------------------------------------------+ |
|                                                               |
| Upcoming Queue (7):                                           |
| 🟡 Bob Johnson (M, 45) - Routine checkup - Wait: 40 min      |
| 🟡 Carol White (F, 28) - Routine - Wait: 35 min              |
| 🟢 David Brown (M, 62) - Follow-up diabetes - Wait: 30 min   |
|                                                               |
| Today's Stats:                                                |
| Patients Seen: 12 | Avg Time: 15 min | Pending: 8           |
+--------------------------------------------------------------+
```

**Workflow:**
1. Provider sees next patient (highest priority + longest wait)
2. Click "Call Next Patient" → Creates Encounter, opens EncounterPage
3. Complete encounter normally
4. On save, Task marked complete, next patient appears

## Implementation Plan

### Phase 1: Core Queue Infrastructure (Week 1)

**Tasks:**
1. Create Task-based queue data model
2. Implement queue helper functions
3. Build basic CheckInStation component
4. Build basic QueueTable component
5. Add routes to EMRApp

**Deliverables:**
- Patients can be checked in
- Queue displays waiting patients
- Basic priority sorting works

### Phase 2: Provider Workflow (Week 1-2)

**Tasks:**
1. Implement NextPatientButton logic
2. Create Encounter on patient call
3. Link Task to Encounter
4. Update Task status on encounter completion
5. Build ProviderQueuePage

**Deliverables:**
- Provider can call next patient
- Encounter creation integrated
- Queue updates when patient called

### Phase 3: Real-time Updates & Metrics (Week 2)

**Tasks:**
1. Implement Medplum Subscriptions for Task changes
2. Build QueueMetrics component
3. Implement wait time estimation
4. Add provider status tracking
5. Build QueueDashboard public view

**Deliverables:**
- Real-time queue updates
- Wait time estimates displayed
- Dashboard metrics working
- Provider availability tracking

### Phase 4: Security & Compliance (Week 2-3)

**Tasks:**
1. Configure AccessPolicy for roles
2. Implement audit logging (AuditEvent)
3. Validate FHIR compliance
4. Add PHI protection measures
5. Security testing

**Deliverables:**
- Role-based access control working
- All actions audited
- FHIR validation passing
- Security review complete

### Phase 5: Testing & Polish (Week 3)

**Tasks:**
1. Unit tests for queue logic
2. Integration tests for workflow
3. Permission tests for each role
4. UI/UX polish
5. Documentation

**Deliverables:**
- >80% test coverage
- All edge cases handled
- User documentation
- Admin guide

## Technical Specifications

### TypeScript Interfaces

```typescript
// Queue task creation
interface CreateQueueTaskInput {
  patient: Patient;
  appointment?: Appointment;
  priority: TaskPriority;
  assignedProvider?: Practitioner;
  notes?: string;
}

// Queue metrics
interface QueueMetrics {
  totalWaiting: number;
  avgWaitTime: number;  // minutes
  longestWaitTime: number;  // minutes
  patientsSeen: number;  // today
  providerCount: number;
  urgentCount: number;
}

// Provider status
interface ProviderStatus {
  practitioner: Reference<Practitioner>;
  status: 'available' | 'busy' | 'on-break';
  currentEncounter?: Reference<Encounter>;
  patientsSeenToday: number;
  avgConsultationTime: number;  // minutes
}
```

### API Endpoints (via MedplumClient)

```typescript
// Check in patient
POST /Task
{
  resourceType: 'Task',
  status: 'ready',
  intent: 'order',
  priority: 'routine',
  for: { reference: 'Patient/123' },
  authoredOn: '2024-01-15T09:00:00Z'
}

// Get waiting queue
GET /Task?status=ready&code=patient-visit&_sort=priority,-authored

// Call next patient (update task)
PUT /Task/456
{
  status: 'in-progress',
  owner: { reference: 'Practitioner/789' }
}

// Complete queue entry
PUT /Task/456
{
  status: 'completed'
}
```

### Database Queries

```typescript
// Active queue for provider
const queueTasks = await medplum.searchResources('Task', {
  code: 'patient-visit',
  status: 'ready',
  owner: `Practitioner/${providerId}`,
  _sort: 'priority,-authored',
  _include: 'Task:for'  // Include patient data
});

// Queue metrics for today
const todayTasks = await medplum.searchResources('Task', {
  code: 'patient-visit',
  authored: `ge${startOfToday}`,
  _summary: 'count'
});
```

## Success Metrics

**Performance Targets:**
- Check-in time: < 30 seconds
- Next patient call: < 2 seconds
- Queue refresh: < 2 seconds
- Wait time accuracy: ± 10 minutes

**Clinical Targets:**
- 100% of patients tracked in queue
- Zero missed urgent patients
- Complete audit trail for all actions
- <5% queue errors/day

**User Satisfaction:**
- Receptionist check-in: < 10 seconds per patient
- Provider satisfaction: "Next patient" workflow intuitive
- Patients: Wait time visibility reduces complaints

## Future Enhancements

**Phase 2 Features (Post-MVP):**
1. SMS notifications when patient is called
2. Patient self-check-in kiosk (tablet app)
3. Queue analytics dashboard (trends, bottlenecks)
4. Multi-location queue support
5. Integration with appointment scheduling
6. Queue forecasting (predict busy times)
7. Provider workload balancing

**Advanced Features:**
1. AI-based triage recommendation
2. Predictive wait time ML model
3. Queue optimization algorithms
4. Multi-language waiting room display
5. Patient portal queue visibility

## References

### Industry Sources
- [Medplum - Using Tasks to Manage Clinical Workflow](https://www.medplum.com/docs/careplans/tasks)
- [EMR Trends 2025: Queue Management](https://1stproviderschoice.com/blog/top-emr-trends-2025/)
- [FHIR Task Resource Specification](https://build.fhir.org/task.html)
- [Bahmni FHIR Implementation](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/6488066/)
- [Queue Management Systems in Hospitals](https://doctoplus.in/blog/queue-management-system-in-hospital/)

### Reference EMRs Studied
- **HospitalRun**: Modern React queue patterns
- **Bahmni**: High-volume clinic workflows
- **OpenMRS**: Queue management modules

### Standards & Compliance
- FHIR R4 Task Resource
- FHIR Workflow Patterns
- HL7 Terminology for queue status
- LOINC codes for triage observations

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Author:** Feature Orchestrator Agent
**Status:** Architecture Approved - Ready for Implementation
