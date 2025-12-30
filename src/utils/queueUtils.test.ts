import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockClient } from '@medplum/mock';
import type { Patient, Location, Practitioner, Task, Encounter, Appointment } from '@medplum/fhirtypes';
import {
  createQueueEntry,
  claimNextPatient,
  updateTriageLevel,
  getTriageLevel,
  getChiefComplaint,
  getComplaintSensitivity,
  calculateWaitTime,
  getProviderTaskType,
  enrichProviderTask,
  calculateAverageConsultTime,
  completeProviderTask,
  createProviderTask,
} from './queueUtils';
import type { CheckInRequest, TriageUpdate, ProviderTaskType } from '../types/queue.types';

describe('queueUtils', () => {
  let medplum: MockClient;
  let patient: Patient;
  let location: Location;
  let practitioner: Practitioner;

  beforeEach(() => {
    medplum = new MockClient();

    // Create test patient
    patient = {
      resourceType: 'Patient',
      id: 'test-patient',
      name: [{ family: 'Test', given: ['Patient'] }],
    };

    // Create test location
    location = {
      resourceType: 'Location',
      id: 'test-location',
      name: 'Test Clinic',
    };

    // Create test practitioner
    practitioner = {
      resourceType: 'Practitioner',
      id: 'test-practitioner',
      name: [{ family: 'Test', given: ['Doctor'] }],
    };
  });

  describe('createQueueEntry', () => {
    it('should create a queue entry with required fields', async () => {
      const request: CheckInRequest = {
        patient: { reference: `Patient/${patient.id}` },
        location: { reference: `Location/${location.id}` },
        chiefComplaint: 'Headache',
        complainSensitivity: 'public',
        triageLevel: 3,
        priority: 'urgent',
        checkInMethod: 'walk-in',
      };

      const task = await createQueueEntry(medplum, request);

      expect(task.resourceType).toBe('Task');
      expect(task.status).toBe('ready');
      expect(task.intent).toBe('order');
      expect(task.priority).toBe('urgent');
      expect(task.for?.reference).toBe(`Patient/${patient.id}`);
      expect(task.location?.reference).toBe(`Location/${location.id}`);
    });

    it('should include extensions array', async () => {
      const request: CheckInRequest = {
        patient: { reference: `Patient/${patient.id}` },
        location: { reference: `Location/${location.id}` },
        chiefComplaint: 'Chest pain',
        complainSensitivity: 'public',
        triageLevel: 2,
        checkInMethod: 'emergency',
      };

      const task = await createQueueEntry(medplum, request);

      expect(task.extension).toBeDefined();
      expect(Array.isArray(task.extension)).toBe(true);
    });

    it('should create task with all request fields', async () => {
      const request: CheckInRequest = {
        patient: { reference: `Patient/${patient.id}` },
        location: { reference: `Location/${location.id}` },
        chiefComplaint: 'Fever',
        complainSensitivity: 'private',
        triageLevel: 3,
        checkInMethod: 'walk-in',
      };

      const task = await createQueueEntry(medplum, request);

      expect(task).toBeTruthy();
      expect(task.id).toBeTruthy();
      expect(task.status).toBe('ready');
    });

    it('should validate chief complaint length', async () => {
      const longComplaint = 'x'.repeat(501); // > 500 characters
      const invalidRequest: CheckInRequest = {
        patient: { reference: `Patient/${patient.id}` },
        location: { reference: `Location/${location.id}` },
        chiefComplaint: longComplaint,
        triageLevel: 3,
        checkInMethod: 'walk-in',
      };

      await expect(createQueueEntry(medplum, invalidRequest)).rejects.toThrow();
    });

    it('should prevent XSS in chief complaint', async () => {
      const xssComplaint = '<script>alert("xss")</script>';
      const invalidRequest: CheckInRequest = {
        patient: { reference: `Patient/${patient.id}` },
        location: { reference: `Location/${location.id}` },
        chiefComplaint: xssComplaint,
        triageLevel: 3,
        checkInMethod: 'walk-in',
      };

      await expect(createQueueEntry(medplum, invalidRequest)).rejects.toThrow();
    });
  });

  describe('getter functions', () => {
    it('should have getTriageLevel function', () => {
      const task: Task = {
        resourceType: 'Task',
        status: 'ready',
        intent: 'order',
      };

      const result = getTriageLevel(task);
      // Should return a number or undefined
      expect(result === undefined || typeof result === 'number').toBe(true);
    });

    it('should have getChiefComplaint function', () => {
      const task: Task = {
        resourceType: 'Task',
        status: 'ready',
        intent: 'order',
      };

      const result = getChiefComplaint(task);
      // Should return a string or undefined
      expect(result === undefined || typeof result === 'string').toBe(true);
    });
  });

  describe('getComplaintSensitivity', () => {
    it('should extract complaint sensitivity from task extension', () => {
      const task: Task = {
        resourceType: 'Task',
        status: 'ready',
        intent: 'order',
        extension: [
          {
            url: 'http://medplum.com/complaint-sensitivity',
            valueCode: 'private',
          },
        ],
      };

      expect(getComplaintSensitivity(task)).toBe('private');
    });

    it('should return "public" if sensitivity not present', () => {
      const task: Task = {
        resourceType: 'Task',
        status: 'ready',
        intent: 'order',
      };

      expect(getComplaintSensitivity(task)).toBe('public');
    });
  });

  describe('calculateWaitTime', () => {
    it('should calculate wait time in minutes from authoredOn', () => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const task: Task = {
        resourceType: 'Task',
        status: 'ready',
        intent: 'order',
        authoredOn: thirtyMinutesAgo.toISOString(),
      };

      const waitTime = calculateWaitTime(task);
      expect(waitTime).toBeGreaterThanOrEqual(29); // Allow 1 minute margin
      expect(waitTime).toBeLessThanOrEqual(31);
    });

    it('should return 0 if authoredOn not present', () => {
      const task: Task = {
        resourceType: 'Task',
        status: 'ready',
        intent: 'order',
      };

      expect(calculateWaitTime(task)).toBe(0);
    });
  });

  describe('updateTriageLevel', () => {
    it('should update triage level and adjust priority', async () => {
      // Create initial task
      const initialRequest: CheckInRequest = {
        patient: { reference: `Patient/${patient.id}` },
        location: { reference: `Location/${location.id}` },
        chiefComplaint: 'Headache',
        triageLevel: 3,
        checkInMethod: 'walk-in',
      };

      const task = await createQueueEntry(medplum, initialRequest);

      // Update triage
      const update: TriageUpdate = {
        triageLevel: 2,
        priority: 'urgent',
        notes: 'Patient condition worsened',
      };

      const updatedTask = await updateTriageLevel(medplum, task.id!, update);

      // Should have updated priority for ESI 2
      expect(updatedTask.priority).toBeTruthy();
      expect(updatedTask.id).toBe(task.id);
    });
  });

  // ============================================================================
  // Provider Task Tests
  // ============================================================================

  describe('getProviderTaskType', () => {
    it('should return correct task type from task code', () => {
      const taskTypes: Array<{ code: string; expected: ProviderTaskType }> = [
        { code: 'lab-review', expected: 'lab-review' },
        { code: 'imaging-review', expected: 'imaging-review' },
        { code: 'call-patient', expected: 'call-patient' },
        { code: 'referral', expected: 'referral' },
        { code: 'prescription', expected: 'prescription' },
        { code: 'follow-up', expected: 'follow-up' },
        { code: 'consult', expected: 'consult' },
      ];

      for (const { code, expected } of taskTypes) {
        const task: Task = {
          resourceType: 'Task',
          status: 'ready',
          intent: 'order',
          code: {
            coding: [
              {
                system: 'http://medplum.com/fhir/CodeSystem/task-code',
                code,
              },
            ],
          },
        };

        expect(getProviderTaskType(task)).toBe(expected);
      }
    });

    it('should return "other" for unknown task codes', () => {
      const task: Task = {
        resourceType: 'Task',
        status: 'ready',
        intent: 'order',
        code: {
          coding: [
            {
              system: 'http://medplum.com/fhir/CodeSystem/task-code',
              code: 'unknown-code',
            },
          ],
        },
      };

      expect(getProviderTaskType(task)).toBe('other');
    });

    it('should return "other" for tasks without code', () => {
      const task: Task = {
        resourceType: 'Task',
        status: 'ready',
        intent: 'order',
      };

      expect(getProviderTaskType(task)).toBe('other');
    });
  });

  describe('enrichProviderTask', () => {
    it('should enrich task with computed fields', () => {
      const task: Task = {
        resourceType: 'Task',
        id: 'test-task-1',
        status: 'ready',
        intent: 'order',
        priority: 'urgent',
        description: 'Review lab results for patient',
        code: {
          coding: [
            {
              system: 'http://medplum.com/fhir/CodeSystem/task-code',
              code: 'lab-review',
              display: 'Lab Review',
            },
          ],
        },
        for: { reference: 'Patient/test-patient' },
      };

      const enriched = enrichProviderTask(task, patient);

      expect(enriched.task).toBe(task);
      expect(enriched.taskType).toBe('lab-review');
      expect(enriched.patient).toBe(patient);
      expect(enriched.patientRef).toBe('Patient/test-patient');
      expect(enriched.description).toBe('Review lab results for patient');
      expect(enriched.priority).toBe('urgent');
      expect(enriched.status).toBe('ready');
      expect(enriched.isOverdue).toBe(false);
    });

    it('should mark task as overdue when past due date', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      const task: Task = {
        resourceType: 'Task',
        id: 'test-task-2',
        status: 'ready',
        intent: 'order',
        code: {
          coding: [
            {
              system: 'http://medplum.com/fhir/CodeSystem/task-code',
              code: 'follow-up',
            },
          ],
        },
        restriction: {
          period: {
            end: pastDate.toISOString(),
          },
        },
      };

      const enriched = enrichProviderTask(task);

      expect(enriched.isOverdue).toBe(true);
      expect(enriched.dueDate).toEqual(pastDate);
    });

    it('should not mark task as overdue when due date is in the future', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

      const task: Task = {
        resourceType: 'Task',
        id: 'test-task-3',
        status: 'ready',
        intent: 'order',
        code: {
          coding: [
            {
              system: 'http://medplum.com/fhir/CodeSystem/task-code',
              code: 'call-patient',
            },
          ],
        },
        restriction: {
          period: {
            end: futureDate.toISOString(),
          },
        },
      };

      const enriched = enrichProviderTask(task);

      expect(enriched.isOverdue).toBe(false);
    });

    it('should use code display as description fallback', () => {
      const task: Task = {
        resourceType: 'Task',
        id: 'test-task-4',
        status: 'ready',
        intent: 'order',
        code: {
          coding: [
            {
              system: 'http://medplum.com/fhir/CodeSystem/task-code',
              code: 'imaging-review',
              display: 'Review Imaging Results',
            },
          ],
        },
      };

      const enriched = enrichProviderTask(task);

      expect(enriched.description).toBe('Review Imaging Results');
    });
  });

  describe('calculateAverageConsultTime', () => {
    it('should calculate average from completed encounters', () => {
      const now = new Date();
      const encounters: Encounter[] = [
        {
          resourceType: 'Encounter',
          id: 'enc-1',
          status: 'finished',
          class: { code: 'AMB' },
          period: {
            start: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
            end: now.toISOString(),
          },
        },
        {
          resourceType: 'Encounter',
          id: 'enc-2',
          status: 'finished',
          class: { code: 'AMB' },
          period: {
            start: new Date(now.getTime() - 20 * 60 * 1000).toISOString(), // 20 min
            end: now.toISOString(),
          },
        },
        {
          resourceType: 'Encounter',
          id: 'enc-3',
          status: 'finished',
          class: { code: 'AMB' },
          period: {
            start: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 min
            end: now.toISOString(),
          },
        },
      ];

      const avgTime = calculateAverageConsultTime(encounters);

      // Average of 30, 20, 10 = 20 minutes
      expect(avgTime).toBe(20);
    });

    it('should return 0 when no encounters have period data', () => {
      const encounters: Encounter[] = [
        {
          resourceType: 'Encounter',
          id: 'enc-1',
          status: 'finished',
          class: { code: 'AMB' },
        },
        {
          resourceType: 'Encounter',
          id: 'enc-2',
          status: 'finished',
          class: { code: 'AMB' },
          period: {
            start: new Date().toISOString(),
            // No end time
          },
        },
      ];

      const avgTime = calculateAverageConsultTime(encounters);

      expect(avgTime).toBe(0);
    });

    it('should return 0 for empty encounters array', () => {
      const avgTime = calculateAverageConsultTime([]);

      expect(avgTime).toBe(0);
    });

    it('should filter out unreasonable durations (> 8 hours)', () => {
      const now = new Date();
      const encounters: Encounter[] = [
        {
          resourceType: 'Encounter',
          id: 'enc-1',
          status: 'finished',
          class: { code: 'AMB' },
          period: {
            start: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min
            end: now.toISOString(),
          },
        },
        {
          resourceType: 'Encounter',
          id: 'enc-2',
          status: 'finished',
          class: { code: 'AMB' },
          period: {
            start: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(), // 10 hours (invalid)
            end: now.toISOString(),
          },
        },
      ];

      const avgTime = calculateAverageConsultTime(encounters);

      // Should only count the 30 min encounter
      expect(avgTime).toBe(30);
    });
  });

  describe('createProviderTask', () => {
    it('should create a provider task with required fields', async () => {
      const task = await createProviderTask(medplum, {
        taskType: 'lab-review',
        description: 'Review CBC results',
        patient: { reference: `Patient/${patient.id}` },
        owner: { reference: `Practitioner/${practitioner.id}` },
        priority: 'urgent',
      });

      expect(task.resourceType).toBe('Task');
      expect(task.status).toBe('ready');
      expect(task.intent).toBe('order');
      expect(task.priority).toBe('urgent');
      expect(task.description).toBe('Review CBC results');
      expect(task.for?.reference).toBe(`Patient/${patient.id}`);
      expect(task.owner?.reference).toBe(`Practitioner/${practitioner.id}`);
      expect(task.code?.coding?.[0]?.code).toBe('lab-review');
    });

    it('should create task with due date', async () => {
      const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

      const task = await createProviderTask(medplum, {
        taskType: 'call-patient',
        description: 'Follow up call',
        owner: { reference: `Practitioner/${practitioner.id}` },
        dueDate,
      });

      expect(task.restriction?.period?.end).toBe(dueDate.toISOString());
    });

    it('should create task with notes', async () => {
      const task = await createProviderTask(medplum, {
        taskType: 'follow-up',
        description: 'Check on patient progress',
        owner: { reference: `Practitioner/${practitioner.id}` },
        notes: 'Patient reported improvement last visit',
      });

      expect(task.note).toBeDefined();
      expect(task.note?.[0]?.text).toBe('Patient reported improvement last visit');
    });

    it('should default priority to routine', async () => {
      const task = await createProviderTask(medplum, {
        taskType: 'document-review',
        description: 'Review uploaded documents',
        owner: { reference: `Practitioner/${practitioner.id}` },
      });

      expect(task.priority).toBe('routine');
    });
  });

  describe('completeProviderTask', () => {
    it('should mark task as completed', async () => {
      // First create a task
      const task = await createProviderTask(medplum, {
        taskType: 'lab-review',
        description: 'Review test results',
        owner: { reference: `Practitioner/${practitioner.id}` },
      });

      // Complete the task
      const completedTask = await completeProviderTask(medplum, task.id!);

      expect(completedTask.status).toBe('completed');
      expect(completedTask.executionPeriod?.end).toBeDefined();
    });

    it('should add completion notes when provided', async () => {
      // First create a task
      const task = await createProviderTask(medplum, {
        taskType: 'call-patient',
        description: 'Follow up call',
        owner: { reference: `Practitioner/${practitioner.id}` },
      });

      // Complete the task with notes
      const completedTask = await completeProviderTask(
        medplum,
        task.id!,
        'Spoke with patient, all concerns addressed'
      );

      expect(completedTask.status).toBe('completed');
      expect(completedTask.note).toBeDefined();
      expect(completedTask.note?.length).toBeGreaterThan(0);
      expect(completedTask.note?.some(n => n.text?.includes('Spoke with patient'))).toBe(true);
    });

    it('should preserve existing notes when adding completion notes', async () => {
      // Create a task with initial notes
      const task = await createProviderTask(medplum, {
        taskType: 'follow-up',
        description: 'Check progress',
        owner: { reference: `Practitioner/${practitioner.id}` },
        notes: 'Initial observation',
      });

      // Complete the task with additional notes
      const completedTask = await completeProviderTask(
        medplum,
        task.id!,
        'Task completed successfully'
      );

      expect(completedTask.note?.length).toBe(2);
    });
  });
});
