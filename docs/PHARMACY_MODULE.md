# Pharmacy & Medication Management Module

## Overview
The EMR now includes a comprehensive pharmacy and medication management system following FHIR standards. This module allows administrators to manage medication catalogs, track inventory, and enables providers to prescribe medications and record medication administrations.

## Features Implemented

### 1. Medication Catalog (Admin)
**Location**: Admin Menu → Medication Catalog (`/admin/medications`)

**Features**:
- Add/edit/delete medications
- Track medication details:
  - Generic and brand names
  - Dosage forms (tablet, capsule, liquid, injection, etc.)
  - Strength and units
  - RxCUI and NDC codes
  - Categories (antibiotic, analgesic, cardiovascular, etc.)
  - Descriptions
- Search functionality
- Full internationalization (English/Spanish)

**FHIR Resources**: `Medication`

### 2. Inventory Management (Admin)
**Location**: Admin Menu → Inventory (`/admin/inventory`)

**Features**:
- View current stock levels for all medications
- Adjust inventory quantities
- Set reorder levels and reorder quantities
- Track expiration dates and lot numbers
- Specify storage locations
- Visual status indicators:
  - 🟢 In Stock (above reorder level)
  - 🟡 Low Stock (at or below reorder level)
  - 🔴 Out of Stock (zero quantity)

**FHIR Resources**: `MedicationKnowledge`

### 3. Prescription Management (Provider)
**Location**: Encounter Page → Quick Actions → "Prescribe Medication"

**Features**:
- Search and select medications from catalog
- Specify dosage instructions
- Set quantity and refills
- Choose prescription type:
  - **External**: Prescription to be filled at outside pharmacy
  - **Internal**: Medication to be dispensed from facility
- Add notes
- View all prescriptions on Medications tab

**FHIR Resources**: `MedicationRequest`

### 4. Medication Administration Record (MAR)
**Location**: Encounter Page → Medications Tab → "Administer" button

**Features**:
- Record when medication is administered to patient
- Document administered dose and quantity
- Add administration notes
- Automatic inventory deduction for internal medications
- Track who administered the medication and when
- View complete administration history

**FHIR Resources**: `MedicationAdministration`

### 5. Medications Tab (Encounter)
**Location**: Encounter Page → Medications Tab

**Features**:
- View all prescriptions for the encounter
- Display prescription status (active, completed, cancelled, on-hold)
- Show prescription type (internal vs external)
- Quick access to administer internal medications
- Complete administration history table
- Tracks who prescribed, when, dosage instructions, quantities, and refills

## FHIR Resources Used

### Medication
Represents the medication product in the catalog:
```json
{
  "resourceType": "Medication",
  "status": "active",
  "code": {
    "coding": [
      {
        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
        "code": "..." // RxCUI
      },
      {
        "system": "http://hl7.org/fhir/sid/ndc",
        "code": "..." // NDC code
      }
    ],
    "text": "Brand/Generic name"
  },
  "form": { ... },
  "amount": { ... }
}
```

### MedicationKnowledge
Tracks inventory information using extensions:
```json
{
  "resourceType": "MedicationKnowledge",
  "code": { "reference": "Medication/..." },
  "packaging": {
    "quantity": { "value": 100 } // Current stock
  },
  "extension": [
    { "url": "...reorder-level", "valueInteger": 10 },
    { "url": "...reorder-quantity", "valueInteger": 50 },
    { "url": "...expiration-date", "valueDate": "..." },
    { "url": "...lot-number", "valueString": "..." },
    { "url": "...storage-location", "valueString": "..." }
  ]
}
```

### MedicationRequest
Prescription order:
```json
{
  "resourceType": "MedicationRequest",
  "status": "active",
  "intent": "order", // or "instance-order" for internal
  "medicationReference": { ... },
  "subject": { "reference": "Patient/..." },
  "encounter": { "reference": "Encounter/..." },
  "dosageInstruction": [{ "text": "..." }],
  "dispenseRequest": {
    "numberOfRepeatsAllowed": 2,
    "quantity": { "value": 30 }
  },
  "extension": [
    {
      "url": "...prescription-type",
      "valueString": "internal" // or "external"
    }
  ]
}
```

### MedicationAdministration
Records actual medication given to patient:
```json
{
  "resourceType": "MedicationAdministration",
  "status": "completed",
  "medicationReference": { ... },
  "subject": { "reference": "Patient/..." },
  "context": { "reference": "Encounter/..." },
  "effectiveDateTime": "...",
  "performer": [{ "actor": { ... } }],
  "request": { "reference": "MedicationRequest/..." },
  "dosage": {
    "text": "...",
    "dose": { "value": 1 }
  }
}
```

## Workflow Examples

### Example 1: External Prescription
1. Provider opens encounter
2. Clicks "Prescribe Medication" in Quick Actions
3. Selects medication from catalog
4. Enters dosage: "Take 1 tablet by mouth twice daily with food"
5. Sets quantity: 60
6. Sets refills: 2
7. Selects "External (Pharmacy)"
8. Saves prescription
9. Patient receives prescription to fill at pharmacy

### Example 2: Internal Medication Administration
1. Provider opens encounter
2. Clicks "Prescribe Medication"
3. Selects medication (e.g., "Ibuprofen 400mg Tablet")
4. Enters dosage instructions
5. Sets quantity: 1 (or as needed)
6. Selects "Internal (Facility)"
7. Saves prescription
8. Provider navigates to Medications tab
9. Clicks "Administer" button on the prescription
10. Confirms dose administered
11. Adds any administration notes
12. Saves administration
13. **Inventory is automatically reduced** by the quantity administered
14. Administration is recorded in MAR with timestamp and provider info

### Example 3: Inventory Management
1. Admin navigates to Inventory page
2. Sees low stock warning (🟡) on "Amoxicillin 500mg"
3. Clicks "Edit" to adjust inventory
4. Updates:
   - Current Stock: 150 (increased from 8)
   - Lot Number: "LOT12345"
   - Expiration Date: "2026-06-30"
   - Location: "Refrigerator A, Shelf 2"
5. Saves changes
6. Status changes to In Stock (🟢)

## Access Control

- **Medication Catalog**: Admin only
- **Inventory Management**: Admin only
- **Prescribe Medications**: Providers (during encounter)
- **Administer Medications**: Providers (during encounter)
- **View Medications**: All users with encounter access

## Internationalization

All UI strings are fully internationalized with support for:
- English (`en.json`)
- Spanish (`es.json`)

Translation keys are prefixed with `pharmacy.*` for easy identification.

## Navigation

### Admin Menu
- Admin → Medication Catalog
- Admin → Inventory

### Encounter
- Quick Actions → Prescribe Medication
- Tabs → Medications
- Medications Tab → Administer (for internal prescriptions)

## Technical Details

### Files Created
1. `src/utils/medications.ts` - Utility functions
2. `src/pages/admin/MedicationCatalogPage.tsx` - Medication catalog management
3. `src/pages/admin/InventoryPage.tsx` - Inventory tracking
4. `src/components/encounter/PrescribeMedicationModal.tsx` - Prescription modal
5. `src/components/encounter/AdministerMedicationModal.tsx` - MAR modal
6. `src/components/encounter/tabs/MedicationsTab.tsx` - Medications display

### Files Modified
1. `src/pages/encounter/EncounterPage.tsx` - Added medications tab and modals
2. `src/components/encounter/EncounterQuickActions.tsx` - Added prescribe button
3. `src/EMRApp.tsx` - Added routes
4. `src/components/shared/Header.tsx` - Added menu items
5. `src/i18n/en.json` & `src/i18n/es.json` - Added translations

### Code Systems Used
- **RxNorm**: `http://www.nlm.nih.gov/research/umls/rxnorm`
- **NDC**: `http://hl7.org/fhir/sid/ndc`

### Custom Extensions
All extensions use the base URL: `http://example.org/fhir/StructureDefinition/`

- `prescription-type` - Internal vs external prescription
- `reorder-level` - Inventory reorder threshold
- `reorder-quantity` - Quantity to order when restocking
- `expiration-date` - Medication expiration date
- `lot-number` - Medication lot number
- `storage-location` - Physical storage location
- `medication-category` - Medication therapeutic category
- `medication-description` - Additional medication information

## Best Practices

1. **Always verify inventory** before administering internal medications
2. **Set appropriate reorder levels** based on usage patterns
3. **Track lot numbers and expiration dates** for safety and compliance
4. **Use standard RxCUI codes** when available for interoperability
5. **Document administration times accurately** for MAR compliance
6. **Review prescriptions** before finalizing to ensure accuracy

## Future Enhancements

Potential additions for future development:
- Drug interaction checking
- Allergy checking against patient allergies
- Barcode scanning for medication verification
- Automated inventory reordering
- Medication reconciliation workflows
- Controlled substance tracking
- E-prescribing integration
- Medication adherence tracking
- Batch expiration alerts

## Support

For issues or questions about the pharmacy module, refer to:
- Medplum Documentation: https://www.medplum.com/docs/medications
- FHIR Medication Resources: https://hl7.org/fhir/medications-module.html

