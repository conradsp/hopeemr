# i18n Translation Plan - Complete Coverage

## Overview
Comprehensive plan to identify and translate all hardcoded strings in the EMR application to ensure full English and Spanish support.

## Current State Analysis
- Translation files: `i18n/en.json` and `i18n/es.json`
- Current English entries: ~420 keys
- Current Spanish entries: ~280 keys
- **Gap**: Spanish is missing ~140 translations

## Strategy

### Phase 1: Audit All Components
Scan all files for hardcoded strings that need translation:

#### A. Admin Components (7 files)
- [ ] EditAppointmentTypeModal.tsx
- [ ] EditDiagnosticProviderModal.tsx
- [ ] EditImagingTestModal.tsx
- [ ] EditLabTestModal.tsx
- [ ] EditNoteTemplateModal.tsx
- [ ] EditUserRolesModal.tsx
- [ ] NewProviderModal.tsx ✅ (recently refactored)

#### B. Billing Components (5 files)
- [ ] BillingSearchSection.tsx ✅ (recently created with translations)
- [ ] BillingSummaryCard.tsx ✅ (recently created with translations)
- [ ] ChargesTable.tsx ✅ (recently created with translations)
- [ ] PaymentModal.tsx
- [ ] PaymentsTable.tsx ✅ (recently created with translations)

#### C. Encounter Components (13+ files)
- [ ] AddDiagnosisModal.tsx
- [ ] AdministerMedicationModal.tsx
- [ ] CreateNoteModal.tsx
- [ ] EncounterHeader.tsx
- [ ] EncounterList.tsx
- [ ] EncounterPageWrapper.tsx
- [ ] EncounterQuickActions.tsx
- [ ] EnterLabResultModal.tsx
- [ ] NewEncounterModal.tsx
- [ ] OrderDiagnosticModal.tsx
- [ ] PrescribeMedicationModal.tsx
- [ ] RecordVitalsModal.tsx
- [ ] Encounter Tabs (10 files)

#### D. Patient Components (13+ files)
- [ ] AddEmergencyContactModal.tsx
- [ ] AddInsuranceModal.tsx
- [ ] AddPractitionerModal.tsx
- [ ] NewPatientModal.tsx
- [ ] PatientDemographics.tsx
- [ ] PatientEncounters.tsx
- [ ] PatientMainSection.tsx
- [ ] PatientObservations.tsx
- [ ] PatientOverview.tsx
- [ ] PatientSidebar.tsx
- [ ] PatientTimeline.tsx
- [ ] PatientTopMenu.tsx

#### E. Scheduling Components (1 file)
- [ ] CreateScheduleModal.tsx

#### F. Shared Components (6 files)
- [ ] BreadcrumbNav.tsx
- [ ] ClinicalImpressionDisplay.tsx
- [ ] ConfirmationModal.tsx
- [ ] ConfirmDialog.tsx
- [ ] Header.tsx
- [ ] LanguageSelector.tsx

#### G. Pages (20+ files)
- Admin pages (12 files)
- Auth pages (2 files)
- Billing pages (1 file)
- Encounter pages (1 file)
- Patient pages (1 file)
- Scheduling pages (3 files)
- HomePage

### Phase 2: Extract Missing Strings
For each component:
1. Identify hardcoded English strings
2. Create translation keys following naming convention
3. Add to en.json
4. Add Spanish translation to es.json

### Phase 3: Update Components
Replace hardcoded strings with `t()` function calls

### Phase 4: Fill Spanish Gaps
Ensure all English keys have Spanish equivalents

## Naming Convention
```
{section}.{subsection}.{element}
```

Examples:
- `admin.medications.title` - "Medication Catalog"
- `admin.medications.add` - "Add Medication"
- `modal.confirm.delete` - "Confirm Deletion"
- `form.field.required` - "This field is required"

## Common Translation Categories

### Modal Titles
- `modal.{feature}.title`
- `modal.{feature}.edit`
- `modal.{feature}.create`
- `modal.{feature}.delete`

### Form Fields
- `form.{field}.label`
- `form.{field}.placeholder`
- `form.{field}.error`
- `form.{field}.required`

### Actions/Buttons
- `action.{action}` (save, cancel, delete, edit, add, etc.)

### Status/States
- `status.{state}` (active, inactive, pending, completed, etc.)

### Messages
- `message.success.{action}`
- `message.error.{action}`
- `message.warning.{action}`
- `message.info.{action}`

### Validation
- `validation.{type}` (required, email, phone, minLength, etc.)

## Implementation Order
1. **High Priority** - User-facing text in main workflows
2. **Medium Priority** - Admin configuration screens
3. **Low Priority** - Error messages, tooltips, helper text

## Tools & Utilities
- Use `useTranslation()` hook from react-i18next
- Use `t('key')` for simple translations
- Use `t('key', { variable })` for interpolation
- Use `t('key', { count })` for pluralization

## Quality Assurance
1. No hardcoded user-facing strings (except debug/dev code)
2. All English keys have Spanish equivalents
3. Consistent naming conventions
4. Proper use of interpolation for dynamic content
5. Test language switching between EN/ES

## Estimated Effort
- Phase 1 (Audit): 4-6 hours
- Phase 2 (Extract): 8-10 hours
- Phase 3 (Update): 10-12 hours
- Phase 4 (Spanish): 4-6 hours
- **Total: 26-34 hours**

## Next Steps
1. Create comprehensive translation key list
2. Systematically update components by category
3. Verify Spanish translations with native speaker
4. Test language switching in all screens

