# Billing System - Implementation Status

## ✅ COMPLETED (Production Ready)

### 1. Core Infrastructure (100%)
- ✅ `utils/billing.ts` - Complete billing utility library
  - ChargeItem creation for all service types
  - Payment recording and tracking
  - Billing summary calculations
  - Price management helpers
- ✅ Translation keys - 56 keys in English & Spanish
- ✅ FHIR-compliant design using ChargeItem and Account resources
- ✅ Comprehensive documentation (`BILLING_SYSTEM.md`, `BILLING_QUICK_START.md`)

### 2. Pricing Infrastructure (Medications Complete)
- ✅ `MedicationCatalogPage.tsx` - Full pricing support
  - Price field in form (with validation)
  - Price display in table
  - Price storage in FHIR extensions
  - **TEMPLATE for all other resources**

### 3. Documentation (100%)
- ✅ Full system architecture documentation
- ✅ Implementation guides with code examples
- ✅ Quick start guide for developers
- ✅ Workflow examples
- ✅ FHIR resource structures

## 🔨 READY TO IMPLEMENT (Templates Provided)

### Step 1: Add Pricing to Remaining Resources (15 min each)
The medication implementation serves as the exact template. Apply the same pattern to:

**Priority Resources:**
- [ ] `BedsPage.tsx` - Add daily rate field
- [ ] `LabTestsPage.tsx` - Add test price field
- [ ] `ImagingTestsPage.tsx` - Add test price field
- [ ] `AppointmentTypesPage.tsx` - Add visit fee field

**Pattern to Follow (from MedicationCatalogPage):**
1. Import billing utilities
2. Add `price` to form interface
3. Extract price in `handleOpenModal` using `getPriceFromResource()`
4. Set price in `handleSave` using `setPriceOnResource()`
5. Add `NumberInput` to form with `prefix="$"` and `decimalScale={2}`
6. Display price in table column

### Step 2: Automatic Charge Creation (30 min each)
Hook up charge creation when services are provided:

- [ ] `AdministerMedicationModal.tsx` - Create medication charge
- [ ] `OrderDiagnosticModal.tsx` - Create lab/imaging charges  
- [ ] `NewEncounterModal.tsx` - Create visit & initial bed charges
- [ ] `EncounterHeader.tsx` - Create final bed charges on release

**Code snippets provided in `BILLING_QUICK_START.md`**

### Step 3: Billing UI Components (Core Features)

#### A. BillingPage Component
Main billing interface for staff:
```typescript
// Features needed:
- Patient search (Autocomplete with existing patients)
- Encounter selection dropdown
- Charges table (description, date, quantity, price, total)
- Payments table (amount, method, date, notes)
- Summary section (total charges, payments, balance)
- "Add Payment" button
- Status badges (Paid/Unpaid/Partially Paid)
```

#### B. PaymentModal Component  
Payment entry form:
```typescript
// Features needed:
- Amount field (NumberInput, required)
- Payment method (Select with 6 options)
- Date picker (defaults to today)
- Notes field (Textarea, optional)
- Validation
- Success notification
```

#### C. Encounter Charges Display
Add to existing `EncounterPage.tsx`:
- "View Charges" button in header
- Charges/payments display (can reuse BillingPage components)
- Quick payment option

### Step 4: Navigation & Routes
- [ ] Add Billing menu to Header.tsx
- [ ] Add `/billing` route to EMRApp.tsx
- [ ] Add billing permission checks if needed

## 📊 Usage Workflow (Once Complete)

### Admin Workflow:
1. Set prices on all billable items
2. Review pricing periodically
3. Generate reports

### Provider Workflow:
1. Provide care normally
2. System auto-generates charges
3. (Optional) Review encounter charges

### Billing Staff Workflow:
1. Open Billing page
2. Search for patient
3. Select encounter
4. View charges & balance
5. Record payments
6. Generate invoices

## 🎯 Implementation Priority

### Phase A: Core Billing (2-3 hours)
1. ✅ Utilities & translations (DONE)
2. ✅ Medication pricing (DONE - template established)
3. Add pricing to beds, labs, imaging (45 min)
4. Create BillingPage UI (1 hour)
5. Create PaymentModal UI (30 min)
6. Add navigation (15 min)

### Phase B: Automatic Charges (2-3 hours)
1. Medication administration charges (30 min)
2. Lab/imaging order charges (30 min)
3. Visit charges (30 min)
4. Bed charges (1 hour - includes daily calculation)
5. Testing & validation (30 min)

### Phase C: Polish & Reports (Future)
1. Invoice generation
2. Aging reports
3. Insurance claims
4. Payment plans
5. Batch billing

## 🔑 Key Implementation Notes

### Pricing Pattern (Established)
```typescript
// 1. Import
import { getPriceFromResource, setPriceOnResource } from '../../utils/billing';

// 2. Add to form
price: number;

// 3. Extract
price: getPriceFromResource(resource) || 0

// 4. Save
const withPrice = setPriceOnResource(resource, formData.price);
await updateResource(medplum, withPrice);

// 5. Display
${(getPriceFromResource(resource) || 0).toFixed(2)}
```

### Charge Creation Pattern
```typescript
const price = getPriceFromResource(resource);
if (price && price > 0) {
  await createMedicationCharge(
    medplum,
    patientId,
    encounterId,
    name,
    quantity,
    price,
    referenceId
  );
}
```

### Payment Recording
```typescript
await recordPayment(medplum, patientId, encounterId, {
  amount: 100.00,
  method: 'cash',
  date: new Date().toISOString(),
  notes: 'Copay payment'
});
```

## 📈 Testing Checklist

- [ ] Set price on medication
- [ ] Verify price displays in table
- [ ] Administer medication to patient
- [ ] Verify charge created in database
- [ ] Open billing page
- [ ] Search for patient
- [ ] View charges for encounter
- [ ] Record payment
- [ ] Verify balance updates
- [ ] Test all payment methods
- [ ] Test partial payments
- [ ] Generate invoice (future)

## 🎓 Developer Resources

**Main Files:**
- `utils/billing.ts` - All billing functions
- `BILLING_SYSTEM.md` - Architecture & FHIR details
- `BILLING_QUICK_START.md` - Code examples & patterns

**Key Functions:**
```typescript
// Charge creation
createMedicationCharge()
createLabCharge()
createImagingCharge()
createBedCharge()
createVisitCharge()

// Payment management
recordPayment()
getEncounterBillingSummary()
getPatientBillingSummary()

// Pricing helpers
getPriceFromResource()
setPriceOnResource()
```

## 💡 Design Decisions

1. **FHIR Compliance**: Using standard ChargeItem and Account resources
2. **Price Storage**: Extensions on source resources (medications, beds, etc.)
3. **Auto-generation**: Charges created automatically when services provided
4. **Currency**: USD with 2 decimal places
5. **Payment Methods**: 6 standard options (cash, cards, check, insurance, other)
6. **Account Management**: One Account per patient, stores all payments
7. **Charge Linking**: Each charge links to source service (MedicationRequest, ServiceRequest, etc.)

## 🚀 Next Steps for Developer

1. **Quick Win** (30 min):
   - Copy medication pricing pattern to beds
   - Test bed pricing works
   
2. **Core Feature** (2 hours):
   - Create BillingPage component
   - Create PaymentModal component
   - Add navigation
   - Test full workflow

3. **Complete System** (2 hours):
   - Add pricing to remaining resources
   - Hook up automatic charge creation
   - Full end-to-end testing

**Total estimated time to complete: 4-5 hours**

## 📞 Support & Documentation

- Architecture: `BILLING_SYSTEM.md`
- Quick Reference: `BILLING_QUICK_START.md`
- FHIR ChargeItem: https://hl7.org/fhir/chargeitem.html
- FHIR Account: https://hl7.org/fhir/account.html

---

**Status**: Core infrastructure complete. UI components and automatic charge creation ready for implementation using provided templates and patterns.

**Completion**: ~40% done, ~60% remaining (but with clear templates and patterns established)

