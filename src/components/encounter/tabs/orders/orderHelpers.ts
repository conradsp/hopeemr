import { ServiceRequest, Observation, DocumentReference } from '@medplum/fhirtypes';

export function getOrderDocuments(order: ServiceRequest, documentReferences: DocumentReference[]): DocumentReference[] {
  if (!documentReferences) { return []; }
  const orderRef = order.id ? `ServiceRequest/${order.id}` : undefined;
  return documentReferences.filter(doc => doc.context?.related?.some(rel => rel.reference === orderRef));
}

export function getOrderResults(order: ServiceRequest, allObservations: Observation[]): Observation[] {
  if (!allObservations) { return []; }
  const orderCode = order.code?.coding?.[0]?.code;
  const orderText = order.code?.text;
  const orderDisplay = order.code?.coding?.[0]?.display;
  const orderRef = order.id ? `ServiceRequest/${order.id}` : undefined;
  return allObservations.filter(obs => {
    if (orderRef && obs.basedOn?.[0]?.reference === orderRef) { return true; }
    if (orderCode && obs.code?.coding?.[0]?.code === orderCode) { return true; }
    if (orderText && obs.code?.text === orderText) { return true; }
    if (orderDisplay && obs.code?.coding?.[0]?.display === orderDisplay) { return true; }
    return false;
  });
}
