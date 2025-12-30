# Billing System Quick Start Guide

## ✅ What's Been Implemented

### 1. Core Infrastructure (100% Complete)
- ✅ Billing utilities (`utils/billing.ts`)
- ✅ Translation keys (English & Spanish)
- ✅ Medications now have pricing

### 2. How to Complete the System

#### Step 1: Add Pricing to Remaining Resources (Pattern Established)

The medication pricing implementation serves as the template. For each admin page, follow this pattern:

**BedsPage.tsx** - Add daily rate:
```typescript
// 1. Add to imports
import { getPriceFromResource, setPriceOnResource } from '../../utils/billing';

// 2. Add to formData interface
interface BedFormData {
  // ... existing fields
  dailyRate: number;
}

// 3. In handleOpenModal, extract price:
dailyRate: getPriceFromResource(bed) || 0,

// 4. In handleSave, set price:
const bedWithPrice = setPriceOnResource(bedData, formData.dailyRate);
await createBed(medplum, bedWithPrice);

// 5. Add NumberInput to form:
<NumberInput
  label={t('billing.dailyRate')}
  value={formData.dailyRate}
  onChange={(value) => setFormData({ ...formData, dailyRate: Number(value) || 0 })}
  min={0}
  decimalScale={2}
  prefix="$"
/>

// 6. Display in table:
<Table.Td>${(getPriceFromResource(bed) || 0).toFixed(2)}</Table.Td>
```

**Apply same pattern to:**
- LabTestsPage.tsx (test price)
- ImagingTestsPage.tsx (test price)  
- AppointmentTypesPage.tsx (visit fee)

#### Step 2: Automatic Charge Creation

When services are provided, create charges:

**AdministerMedicationModal.tsx:**
```typescript
import { createMedicationCharge, getPriceFromResource } from '../../utils/billing';

// After successful administration:
const medication = await medplum.readResource('Medication', medicationId);
const price = getPriceFromResource(medication);
if (price && price > 0) {
  await createMedicationCharge(
    medplum,
    patient.id!,
    encounter.id!,
    medicationName,
    quantity,
    price,
    medicationRequestId
  );
}
```

**OrderDiagnosticModal.tsx:**
```typescript
// After creating ServiceRequest:
const test = await medplum.readResource('ActivityDefinition', testId);
const price = getPriceFromResource(test);
if (price && price > 0) {
  if (orderType === 'lab') {
    await createLabCharge(medplum, patientId, encounterId, testName, price, serviceRequestId);
  } else {
    await createImagingCharge(medplum, patientId, encounterId, testName, price, serviceRequestId);
  }
}
```

**NewEncounterModal.tsx:**
```typescript
// After creating encounter:
// 1. Create visit charge if appointment type has fee
// 2. If inpatient && bed assigned, create initial bed charge

const appointmentType = ... // get from form or schedule
const visitFee = getPriceFromResource(appointmentType);
if (visitFee && visitFee > 0) {
  await createVisitCharge(medplum, patientId, created.id!, visitType, visitFee);
}

if (formData.encounterClass === 'inpatient' && formData.bedId) {
  const bed = await medplum.readResource('Location', formData.bedId);
  const dailyRate = getPriceFromResource(bed);
  if (dailyRate && dailyRate > 0) {
    await createBedCharge(medplum, patientId, created.id!, bedName, 1, dailyRate, formData.bedId);
  }
}
```

**EncounterHeader.tsx (when releasing bed):**
```typescript
// Calculate total days and create final bed charge if needed
const assignedDate = encounter.location?.find(l => l.location.reference === `Location/${bedId}`)?.period?.start;
if (assignedDate) {
  const days = Math.ceil((new Date().getTime() - new Date(assignedDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days > 1) {
    // Create charge for additional days (first day already charged)
    const bed = await medplum.readResource('Location', bedId);
    const dailyRate = getPriceFromResource(bed);
    if (dailyRate) {
      await createBedCharge(medplum, patientId, encounterId, bedName, days - 1, dailyRate, bedId);
    }
  }
}
```

## Testing the System

### 1. Set Up Pricing
```bash
# As Admin
1. Go to Medications → Edit Amoxicillin → Set price $0.50
2. Go to Beds → Edit Bed 101A → Set daily rate $500
3. Go to Lab Tests → Edit CBC → Set price $75
```

### 2. Provide Services
```bash
# As Provider
1. Create inpatient encounter → Assign bed 101A
   Expected: $500 charge created

2. Prescribe & administer Amoxicillin (30 tablets)
   Expected: $15 charge created (30 × $0.50)

3. Order CBC lab test
   Expected: $75 charge created
```

### 3. Record Payment
```bash
# As Billing Staff
1. Go to Billing page
2. Search for patient
3. Select encounter
4. View charges: $590 total
5. Click "Add Payment"
6. Enter $200 cash payment
7. New balance: $390
```

## Quick Reference

### Utility Functions
```typescript
// Get price from any resource
const price = getPriceFromResource(resource);

// Set price on any resource
const withPrice = setPriceOnResource(resource, 25.00);

// Create charges
await createMedicationCharge(medplum, patientId, encounterId, name, qty, price, requestId);
await createLabCharge(medplum, patientId, encounterId, name, price, requestId);
await createImagingCharge(medplum, patientId, encounterId, name, price, requestId);
await createBedCharge(medplum, patientId, encounterId, name, days, rate, locationId);
await createVisitCharge(medplum, patientId, encounterId, type, price);

// Record payment
await recordPayment(medplum, patientId, encounterId, {
  amount: 100,
  method: 'cash',
  date: new Date().toISOString(),
  notes: 'Copay'
});

// Get billing summary
const summary = await getEncounterBillingSummary(medplum, encounterId, patientId);
// Returns: { totalCharges, totalPayments, balance, charges[], payments[] }
```

### Navigation
- Admin → Medication Catalog → [Edit] → Price field
- Admin → Bed Management → Beds → [Edit] → Daily Rate field  
- Billing → Patient Charges (main billing page)
- Encounter Page → [View Charges] button

## Key FHIR Resources

### ChargeItem - Individual Charges
```json
{
  "resourceType": "ChargeItem",
  "status": "billable",
  "code": { "text": "Medication: Amoxicillin 500mg" },
  "subject": { "reference": "Patient/123" },
  "context": { "reference": "Encounter/456" },
  "quantity": { "value": 30 },
  "priceOverride": { "value": 0.50, "currency": "USD" }
}
```

### Account - Payment History
```json
{
  "resourceType": "Account",
  "subject": [{ "reference": "Patient/123" }],
  "extension": [{
    "url": "http://example.org/.../payment",
    "extension": [
      { "url": "amount", "valueMoney": { "value": 100, "currency": "USD" } },
      { "url": "method", "valueString": "cash" },
      { "url": "date", "valueDateTime": "2025-10-31T14:00:00Z" }
    ]
  }]
}
```

## Common Issues & Solutions

**Q: Charges not appearing?**
- Check that price is set on the resource (medication, bed, etc.)
- Verify `getPriceFromResource()` returns a value > 0
- Check console for errors

**Q: Payment not reducing balance?**
- Ensure payment is linked to correct encounter
- Check `Account` resource has payment extension
- Verify payment amount is positive

**Q: Price field not showing?**
- Import `getPriceFromResource` and `setPriceOnResource`
- Add `NumberInput` component to form
- Update formData interface with price field

## Next Steps

1. Complete pricing fields on remaining admin pages (15 min each)
2. Add automatic charge creation to service modals (30 min each)
3. BillingPage and PaymentModal are being created next
4. Test end-to-end workflow
5. Train staff on new billing features

## Support

See full documentation in `BILLING_SYSTEM.md`

