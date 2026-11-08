import { describe, it, expect } from 'vitest';
import type { DocumentReference, ServiceRequest } from '@medplum/fhirtypes';
import { getOrderDocuments } from './orderHelpers';

const order: ServiceRequest = { resourceType: 'ServiceRequest', id: 'sr1', status: 'active', intent: 'order', subject: { reference: 'Patient/p1' } };

function doc(id: string, status: DocumentReference['status'], related = 'ServiceRequest/sr1'): DocumentReference {
  return { resourceType: 'DocumentReference', id, status, content: [], context: { related: [{ reference: related }] } };
}

describe('getOrderDocuments', () => {
  it('returns documents linked to the order', () => {
    expect(getOrderDocuments(order, [doc('a', 'current'), doc('b', 'current', 'ServiceRequest/other')]).map(d => d.id)).toEqual(['a']);
  });

  it('hides documents marked entered-in-error', () => {
    expect(getOrderDocuments(order, [doc('a', 'current'), doc('b', 'entered-in-error')]).map(d => d.id)).toEqual(['a']);
  });
});
