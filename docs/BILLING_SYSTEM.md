# Billing System Implementation

## Overview
The EMR now includes a comprehensive billing system using FHIR ChargeItem and Account resources to track charges, payments, and patient balances.

## ✅ Completed

### 1. Core Billing Utilities (`utils/billing.ts`)
Complete utility functions for:
- Creating charge items for all service types
- Recording payments
- Calculating billing summaries
- Managing patient accounts
- Getting/setting pricing on resources

### 2. Translation Keys
All billing-related strings in English and Spanish:
- Charge types
- Payment methods
- Billing status
- UI labels

## 📋 Implementation Roadmap

### Phase 1: Add Pricing Fields to Resources (TODO)

Each admin page needs a price field added:

#### A. Medications (`MedicationCatalogPage.tsx`)
- Add "Price" field to form (NumberInput)
- Store in extension using `setPriceOnResource()`
- Display price in table

#### B. Lab Tests (`LabTestsPage.tsx`)
- Add "Price" field
- Store/display price

#### C. Imaging Tests (`ImagingTestsPage.tsx`)
- Add "Price" field
- Store/display price

#### D. Beds (`BedsPage.tsx`)
- Add "Daily Rate" field
- Store/display daily rate

#### E. Appointment Types (`AppointmentTypesPage.tsx`)
- Add "Visit Fee" field
- Store/display visit fee

#### F. Diagnosis Codes (`DiagnosisCodesPage.tsx`)
- Diagnosis codes don't typically have prices (included in visit)
- Can skip or add optional price

### Phase 2: Automatic Charge Creation (TODO)

Update these components to automatically create charges:

#### A. Medication Administration (`AdministerMedicationModal.tsx`)
```typescript
// After successful administration:
const medication = await medplum.readResource('Medication', medicationId);
const price = getPriceFromResource(medication);
if (price) {
  await createMedicationCharge(
    medplum,
    patientId,
    encounterId,
    medicationName,
    quantity,
    price,
    medicationRequestId
  );
}
```

#### B. Lab/Imaging Orders (`OrderDiagnosticModal.tsx`)
```typescript
// When creating ServiceRequest:
const testResource = await medplum.readResource('ActivityDefinition', testId);
const price = getPriceFromResource(testResource);
if (price) {
  await createLabCharge(  // or createImagingCharge
    medplum,
    patientId,
    encounterId,
    testName,
    price,
    serviceRequestId
  );
}
```

#### C. Bed Assignment (`NewEncounterModal.tsx` & bed release)
```typescript
// When assigning bed:
const bed = await medplum.readResource('Location', bedId);
const dailyRate = getPriceFromResource(bed);
const days = 1; // Initial charge for 1 day
if (dailyRate) {
  await createBedCharge(
    medplum,
    patientId,
    encounterId,
    bedName,
    days,
    dailyRate,
    bedId
  );
}

// When releasing bed, calculate actual days and create final charge if needed
```

#### D. Encounter Creation (`NewEncounterModal.tsx`)
```typescript
// After creating encounter:
const appointmentType = await medplum.readResource('Schedule', appointmentTypeId);
const visitFee = getPriceFromResource(appointmentType);
if (visitFee) {
  await createVisitCharge(
    medplum,
    patientId,
    encounterId,
    visitType,
    visitFee
  );
}
```

### Phase 3: Billing UI Components (TODO)

#### A. Create `BillingPage.tsx`
Main billing interface with:
- Patient search (Autocomplete)
- Encounter selection dropdown
- Charges table with:
  - Service description
  - Date
  - Quantity
  - Unit price
  - Total
- Summary section:
  - Total charges
  - Total payments
  - Outstanding balance
- "Add Payment" button

#### B. Create `PaymentModal.tsx`
Payment entry form:
- Amount (NumberInput, required)
- Payment method (Select: cash, credit card, etc.)
- Payment date (DateInput, defaults to today)
- Notes (Textarea, optional)
- Encounter selection (if not already specified)

#### C. Update `EncounterPage.tsx`
Add "View Charges" button to encounter header that:
- Opens a modal or expands a section
- Shows charges for this encounter
- Shows payments for this encounter
- Shows balance
- Has "Add Payment" button

### Phase 4: Navigation Updates (TODO)

#### A. Update `Header.tsx`
Add new Billing menu:
```typescript
<Menu>
  <Menu.Target>
    <Button leftSection={<IconCash size={16} />}>
      {t('billing.billing')}
    </Button>
  </Menu.Target>
  <Menu.Dropdown>
    <Menu.Item onClick={() => navigate('/billing')}>
      {t('billing.patientCharges')}
    </Menu.Item>
  </Menu.Dropdown>
</Menu>
```

#### B. Update `EMRApp.tsx`
Add billing route:
```typescript
<Route
  path="/billing"
  element={
    <Container fluid>
      <BillingPage />
    </Container>
  }
/>
```

## FHIR Resources Used

### ChargeItem
Represents individual billable items:
```json
{
  "resourceType": "ChargeItem",
  "status": "billable",
  "code": {
    "coding": [{
      "system": "http://example.org/billing-codes",
      "code": "medication",
      "display": "Medication: Amoxicillin 500mg"
    }],
    "text": "Medication: Amoxicillin 500mg"
  },
  "subject": {
    "reference": "Patient/[id]"
  },
  "context": {
    "reference": "Encounter/[id]"
  },
  "occurrenceDateTime": "2025-10-31T10:00:00Z",
  "quantity": {
    "value": 30
  },
  "priceOverride": {
    "value": 0.50,
    "currency": "USD"
  }
}
```

### Account
Stores patient account and payment history:
```json
{
  "resourceType": "Account",
  "status": "active",
  "subject": [{
    "reference": "Patient/[id]"
  }],
  "name": "Account for Patient [id]",
  "extension": [
    {
      "url": "http://example.org/fhir/StructureDefinition/payment",
      "extension": [
        {
          "url": "amount",
          "valueMoney": {
            "value": 100.00,
            "currency": "USD"
          }
        },
        {
          "url": "method",
          "valueString": "credit-card"
        },
        {
          "url": "date",
          "valueDateTime": "2025-10-31T14:00:00Z"
        },
        {
          "url": "encounter",
          "valueReference": {
            "reference": "Encounter/[id]"
          }
        }
      ]
    }
  ]
}
```

## Pricing Storage

All prices are stored in resource extensions:
```json
{
  "extension": [{
    "url": "http://example.org/fhir/StructureDefinition/price",
    "valueMoney": {
      "value": 25.00,
      "currency": "USD"
    }
  }]
}
```

## Workflow Examples

### Example 1: Admin Sets Medication Price
1. Admin opens Medication Catalog
2. Edits "Amoxicillin 500mg"
3. Sets price to $0.50
4. Saves medication
5. Price stored in extension

### Example 2: Provider Administers Medication
1. Provider opens encounter
2. Prescribes Amoxicillin (30 tablets)
3. Administers medication
4. System automatically:
   - Creates MedicationAdministration resource
   - Looks up medication price ($0.50)
   - Creates ChargeItem: 30 × $0.50 = $15.00
   - Links charge to encounter

### Example 3: Patient Admitted to Bed
1. Provider creates inpatient encounter
2. Assigns bed 101A (daily rate: $500)
3. System creates initial bed charge: 1 day × $500 = $500
4. Patient stays 3 days
5. When bed is released, system creates additional charge for remaining days

### Example 4: Billing Staff Records Payment
1. Billing staff opens Billing page
2. Searches for patient "John Doe"
3. Selects encounter from 10/31/2025
4. Views charges:
   - Visit fee: $150
   - Lab test: $75
   - Medication: $15
   - **Total: $240**
5. Patient paid $100 cash
6. Staff clicks "Add Payment"
7. Enters:
   - Amount: $100
   - Method: Cash
   - Date: Today
8. System records payment
9. New balance: $140

### Example 5: View Patient Balance
1. Open Billing page
2. Search for patient
3. View summary:
   - Total charges (all encounters): $1,240
   - Total payments: $800
   - **Outstanding balance: $440**
4. See breakdown by encounter
5. Export invoice if needed

## Payment Methods

- Cash
- Credit Card
- Debit Card
- Check
- Insurance
- Other

## Billing Status

Calculated based on charges vs payments:
- **Paid**: Balance = $0
- **Unpaid**: No payments made
- **Partially Paid**: Some payments, but balance > $0

## Best Practices

1. **Set prices on all billable items** before using them
2. **Review charges before finalizing** encounters
3. **Record payments promptly** to maintain accurate balances
4. **Use appropriate billing codes** for different service types
5. **Keep detailed notes** on payments for audit trail
6. **Generate invoices** for patients regularly
7. **Reconcile accounts** periodically

## Future Enhancements

- Insurance claim generation (FHIR Claim resource)
- Automated billing reminders
- Payment plans
- Discounts and adjustments
- Batch billing/invoicing
- Integration with payment processors
- Financial reports and analytics
- ICD-10 code-based billing
- CPT code support
- EDI (Electronic Data Interchange) for insurance
- Aging reports (30/60/90 days)
- Write-offs and bad debt tracking

## Implementation Order

Follow this order for smooth implementation:

1. ✅ Add translation keys (DONE)
2. ✅ Create billing utilities (DONE)
3. Add pricing fields to all resource admin pages
4. Test pricing storage/retrieval
5. Add automatic charge creation to service actions
6. Test charge creation
7. Create BillingPage UI
8. Create PaymentModal UI
9. Add navigation
10. Test end-to-end billing workflow
11. Add "View Charges" to encounter page
12. Final testing and documentation

## Code Examples

### Adding Price Field to Admin Form
```typescript
<NumberInput
  label={t('billing.price')}
  value={price}
  onChange={(value) => setPrice(Number(value) || 0)}
  min={0}
  precision={2}
  prefix="$"
  placeholder="0.00"
/>
```

### Storing Price
```typescript
const resourceWithPrice = setPriceOnResource(medication, price);
await medplum.updateResource(resourceWithPrice);
```

### Creating Charge After Service
```typescript
const price = getPriceFromResource(medication);
if (price) {
  await createMedicationCharge(
    medplum,
    patientId,
    encounterId,
    medicationName,
    quantity,
    price
  );
}
```

## Support

For questions about the billing system:
- FHIR ChargeItem: https://hl7.org/fhir/chargeitem.html
- FHIR Account: https://hl7.org/fhir/account.html
- FHIR Invoice: https://hl7.org/fhir/invoice.html

## Notes

- All prices are in USD
- Prices are stored with 2 decimal precision
- Charges are created in "billable" status
- Accounts are automatically created for patients
- Payment history is stored in Account extensions
- This system is designed for self-pay patients
- Insurance integration would require additional Claim resources

