# Internationalization Audit Report

## Executive Summary
This document lists all missing translation keys and hardcoded strings that need to be added to the translation files (`en.json` and `es.json`) for complete internationalization.

---

## 1. Missing Translation Keys (Referenced in Code but NOT in JSON files)

### Common/Shared Keys
```json
"common.name": "Name",
"common.dateOfBirth": "Date of Birth",
"common.age": "Age",
"common.procedures": "Procedures",
"common.diagnoses": "Diagnoses",
"common.recorded": "Recorded",
```

### Home Page Keys
```json
"home.newPatient": "New Patient",
```

### Patient Keys
```json
"patient.mrn": "MRN",
"patient.years": "years",
"patient.phone": "Phone",
"patient.phone.home": "Home Phone",
"patient.phone.work": "Work Phone",
"patient.phone.mobile": "Mobile Phone",
"patient.email": "Email",
"patient.email.home": "Home Email",
"patient.email.work": "Work Email",
"patient.address": "Address",
"patient.address.home": "Home Address",
"patient.address.work": "Work Address",
"patient.unknownPayor": "Unknown Payor",
"patient.noneReported": "None reported",
```

### Notes Tab Keys
```json
"notesTab.diagnosticReports": "Diagnostic Reports",
"notesTab.report": "Report",
```

### Diagnosis Keys
```json
"diagnosis.selectSeverity": "Select severity",
"diagnosis.severityLevels.mild": "Mild",
"diagnosis.severityLevels.moderate": "Moderate",
"diagnosis.severityLevels.severe": "Severe",
"cancel": "Cancel",
```

### Orders/Diagnostic Keys
```json
"orders.patientToVisitLab": "Patient to visit lab",
"orders.specimenDetails": "Specimen Details",
"orders.specimenDetailsPlaceholder": "Enter specimen details",
"orders.clinicalNotesPlaceholder": "Additional clinical notes",
"orders.patient": "Patient",
"orders.dob": "DOB",
"orders.cancel": "Cancel",
"orders.submitOrder": "Submit Order",
```

### Encounter Status Keys (Additional)
```json
"encounter.statusUpdated": "Encounter status updated successfully",
```

---

## 2. Hardcoded Strings (NOT using t() function)

### Book Appointment Page (`BookAppointmentPage.tsx`)
```typescript
// Line 123-127
notifications.show({
  title: 'Error',  // Should be: t('error')
  message: 'Please select a patient',  // Should be: t('appointment.selectPatient')
  color: 'red',
});

// Line 156-159
notifications.show({
  title: 'Success',  // Should be: t('success')
  message: 'Appointment booked successfully!',  // Should be: t('appointment.bookSuccess')
  color: 'green',
});

// Line 166-170
notifications.show({
  title: 'Error',  // Should be: t('error')
  message: 'Failed to book appointment. Please try again.',  // Should be: t('appointment.bookError')
  color: 'red',
});

// Line 178
label: 'Unknown',  // Should be: t('common.unknown')

// Line 182
{ value: '', label: 'Any Provider' },  // Should be: t('appointment.anyProvider')

// Line 190
{ value: '', label: 'Any Type' },  // Should be: t('appointment.anyType')

// Line 204
title="Confirm Appointment"  // Should be: t('appointment.confirmTitle')

// Line 217-218
label="Reason for Visit"  // Should be: t('appointment.reasonForVisit')
placeholder="Brief description of the visit reason"  // Should be: t('appointment.reasonPlaceholder')

// Line 226
placeholder="Any additional notes"  // Should be: t('appointment.notesPlaceholder')

// Line 267-268
label="Patient"  // Should be: t('appointment.patient')
placeholder="Select a patient"  // Should be: t('appointment.selectPatient')

// Line 279
placeholder="Any provider"  // Should be: t('appointment.anyProvider')

// Line 287-288
label="Appointment Type"  // Should be: t('appointment.type')
placeholder="Select type"  // Should be: t('appointment.selectType')
```

### Provider Calendar Page (`ProviderCalendarPage.tsx`)
```typescript
// Line 191-195
notifications.show({
  title: 'Success',  // Should be: t('success')
  message: 'Appointment cancelled successfully',  // Should be: t('appointment.cancelSuccess')
  color: 'green',
});

// Line 200-204
notifications.show({
  title: 'Error',  // Should be: t('error')
  message: 'Failed to cancel appointment',  // Should be: t('appointment.cancelError')
  color: 'red',
});

// Line 212
label: 'Unknown',  // Should be: t('common.unknown')

// Line 220
return 'Unknown Patient';  // Should be: t('patient.unknown')

// Line 252
title="Cancel Appointment"  // Should be: t('appointment.cancelTitle')

// Line 262
placeholder="Reason for cancellation"  // Should be: t('appointment.cancelReason')

// Line 301-302
label="Provider"  // Should be: t('common.provider')
placeholder="Select a provider"  // Should be: t('common.selectProvider')
```

### Create Schedule Modal (`CreateScheduleModal.tsx`)
```typescript
// Line 166
title="Create Schedule"  // Should be: t('schedule.createTitle')

// Line 173
label="Provider"  // Should be: t('common.provider')

// Line 186
placeholder="Select appointment type or leave blank for all types"  // Should be: t('schedule.selectType')

// Line 202
label="Start Date"  // Should be: t('schedule.startDate')

// Line 209
label="End Date"  // Should be: t('schedule.endDate')

// Line 218-219
label="Days of Week"  // Should be: t('schedule.daysOfWeek')
placeholder="Select days"  // Should be: t('schedule.selectDays')

// Line 228
label="Start Time"  // Should be: t('schedule.startTime')

// Line 236
label="End Time"  // Should be: t('schedule.endTime')

// Line 257
label="Add Lunch Break"  // Should be: t('schedule.addBreak')

// Line 265
label="Break Start"  // Should be: t('schedule.breakStart')

// Line 272
label="Break End"  // Should be: t('schedule.breakEnd')
```

### Schedule Management Page (`ScheduleManagementPage.tsx`)
```typescript
// Line 156-157
label="Select Provider"  // Should be: t('schedule.selectProvider')
placeholder="Choose a provider"  // Should be: t('schedule.chooseProvider')
```

### Diagnosis Codes Page (`DiagnosisCodesPage.tsx`)
```typescript
// Line 235
title={editingCode ? 'Edit Diagnosis Code' : 'Add Diagnosis Code'}
// Should be: t(editingCode ? 'diagnosis.editTitle' : 'diagnosis.addTitle')

// Line 239
label="Code System"  // Should be: t('diagnosis.codeSystem')

// Line 241-243
{ value: 'http://hl7.org/fhir/sid/icd-10', label: 'ICD-10' },
{ value: 'http://snomed.info/sct', label: 'SNOMED CT' },
{ value: 'custom', label: 'Custom' },
// Should use t() for labels

// Line 251
label="Code"  // Should be: t('diagnosis.code')

// Line 252
placeholder="E.g., E11.9"  // Should be: t('diagnosis.codePlaceholder')

// Line 259
label="Display Name"  // Should be: t('diagnosis.displayName')

// Line 260
placeholder="E.g., Type 2 diabetes mellitus without complications"
// Should be: t('diagnosis.displayPlaceholder')

// Line 267-268
"Cancel" / "Add" / "Update"  // Should be: t('common.cancel'), t('common.add'), t('common.update')
```

### Settings Page (`SettingsPage.tsx`)
```typescript
// Line 104
placeholder="My Hospital EMR"  // Should be: t('settings.namePlaceholder')

// Line 150
placeholder="Choose logo file"  // Should be: t('settings.chooseFile')
```

### Add Emergency Contact Modal (`AddEmergencyContactModal.tsx`)
```typescript
// Line 105
title="Add Emergency Contact"  // Should be: t('patient.addEmergencyContact')

// Line 110-111
label="First Name"  // Should be: t('common.firstName')
placeholder="John"  // Should be: t('common.firstNamePlaceholder')

// Line 117-118
label="Last Name"  // Should be: t('common.lastName')
placeholder="Doe"  // Should be: t('common.lastNamePlaceholder')

// Line 126-127
label="Relationship"  // Should be: t('patient.relationship')
placeholder="Select relationship"  // Should be: t('patient.selectRelationship')

// Line 142
label="Phone Number"  // Should be: t('common.phoneNumber')

// Line 151
label="Email"  // Should be: t('common.email')
```

### Add Insurance Modal (`AddInsuranceModal.tsx`)
```typescript
// Line 112
title="Add Insurance Coverage"  // Should be: t('patient.addInsurance')

// Line 116-117
label="Insurance Company"  // Should be: t('insurance.company')
placeholder="Blue Cross Blue Shield"  // Should be: t('insurance.companyPlaceholder')

// Line 124
label="Member ID"  // Should be: t('insurance.memberId')

// Line 132
label="Group Number"  // Should be: t('insurance.groupNumber')

// Line 139-140
label="Coverage Type"  // Should be: t('insurance.type')
placeholder="Select type"  // Should be: t('insurance.selectType')

// Line 152-153
label="Status"  // Should be: t('common.status')
placeholder="Select status"  // Should be: t('common.selectStatus')
```

### Add Practitioner Modal (`AddPractitionerModal.tsx`)
```typescript
// Line 92
title="Assign General Practitioner"  // Should be: t('patient.assignPractitioner')

// Line 99-100
label="Select Practitioner"  // Should be: t('patient.selectPractitioner')
placeholder="Choose a practitioner"  // Should be: t('patient.choosePractitioner')
```

### Encounter Header (`EncounterHeader.tsx`)
```typescript
// Line 121
title="Change Encounter Status"  // Should be: t('encounter.changeStatusTitle')

// Line 123
label="Encounter Status"  // Should be: t('encounter.statusLabel')
```

### Orders Tab (`OrdersTab.tsx`)
```typescript
// Line 183
title="Upload Imaging"  // Should be: t('orders.uploadImagingTitle')

// Line 185
label="Select Image"  // Should be: t('orders.selectImage')

// Line 186
label="Notes"  // Should be: t('common.notes')
placeholder="Enter notes"  // Should be: t('common.enterNotes')
```

### Edit Lab Test Modal (`EditLabTestModal.tsx`)
```typescript
// Line 151
label="Test Code"  // Should be: t('labTest.code')

// Line 161
label="Test Name"  // Should be: t('labTest.name')

// Line 177-178
label="Category"  // Should be: t('labTest.category')
placeholder="Select category"  // Should be: t('labTest.selectCategory')

// Line 186-187
label="Specimen Type"  // Should be: t('labTest.specimenType')
placeholder="Select specimen type"  // Should be: t('labTest.selectSpecimenType')

// Line 194-195
label="Description"  // Should be: t('common.description')
placeholder="Brief description of the test"  // Should be: t('labTest.descriptionPlaceholder')

// Line 213-236 (Result Fields)
label="Name" / "Label" / "Type" / "Unit"
// Should use translations for all these
```

### New Encounter Modal (`NewEncounterModal.tsx`)
```typescript
// Line 108
title="Create New Encounter"  // Should be: t('encounter.createTitle')

// Line 112
label="Patient"  // Should be: t('common.patient')

// Line 120
label="Encounter Class"  // Should be: t('encounter.classLabel')
```

---

## 3. Missing Spanish Translations

The Spanish translation file is missing the same keys as English, plus it needs Spanish translations for all the hardcoded English strings above.

---

## 4. Recommended Translation Keys to Add

### Common Keys
```json
"common.provider": "Provider",
"common.selectProvider": "Select Provider",
"common.firstName": "First Name",
"common.lastName": "Last Name",
"common.phoneNumber": "Phone Number",
"common.email": "Email",
"common.description": "Description",
"common.notes": "Notes",
"common.enterNotes": "Enter notes",
"common.add": "Add",
"common.update": "Update",
"common.save": "Save",
"common.delete": "Delete",
"common.close": "Close",
"common.confirm": "Confirm",
"common.loading": "Loading...",
"common.selectStatus": "Select Status",
"common.firstNamePlaceholder": "John",
"common.lastNamePlaceholder": "Doe",
"common.patient": "Patient",
"common.unknown": "Unknown",
```

### Appointment Keys
```json
"appointment.selectPatient": "Please select a patient",
"appointment.bookSuccess": "Appointment booked successfully!",
"appointment.bookError": "Failed to book appointment. Please try again.",
"appointment.anyProvider": "Any Provider",
"appointment.anyType": "Any Type",
"appointment.confirmTitle": "Confirm Appointment",
"appointment.reasonForVisit": "Reason for Visit",
"appointment.reasonPlaceholder": "Brief description of the visit reason",
"appointment.notesPlaceholder": "Any additional notes",
"appointment.patient": "Patient",
"appointment.type": "Appointment Type",
"appointment.selectType": "Select type",
"appointment.cancelTitle": "Cancel Appointment",
"appointment.cancelReason": "Reason for cancellation",
"appointment.cancelSuccess": "Appointment cancelled successfully",
"appointment.cancelError": "Failed to cancel appointment",
```

### Schedule Keys
```json
"schedule.createTitle": "Create Schedule",
"schedule.selectType": "Select appointment type or leave blank for all types",
"schedule.startDate": "Start Date",
"schedule.endDate": "End Date",
"schedule.daysOfWeek": "Days of Week",
"schedule.selectDays": "Select days",
"schedule.startTime": "Start Time",
"schedule.endTime": "End Time",
"schedule.addBreak": "Add Lunch Break",
"schedule.breakStart": "Break Start",
"schedule.breakEnd": "Break End",
"schedule.selectProvider": "Select Provider",
"schedule.chooseProvider": "Choose a provider",
```

### Lab Test Keys
```json
"labTest.code": "Test Code",
"labTest.name": "Test Name",
"labTest.category": "Category",
"labTest.selectCategory": "Select category",
"labTest.specimenType": "Specimen Type",
"labTest.selectSpecimenType": "Select specimen type",
"labTest.descriptionPlaceholder": "Brief description of the test",
```

### Insurance Keys
```json
"insurance.company": "Insurance Company",
"insurance.companyPlaceholder": "Blue Cross Blue Shield",
"insurance.memberId": "Member ID",
"insurance.groupNumber": "Group Number",
"insurance.type": "Coverage Type",
"insurance.selectType": "Select type",
```

### Settings Keys
```json
"settings.namePlaceholder": "My Hospital EMR",
"settings.chooseFile": "Choose logo file",
```

---

## 5. Priority Action Items

### High Priority (User-Facing Errors/Notifications)
1. All notification messages (Success/Error titles and messages)
2. Form validation messages
3. Modal titles
4. Button labels

### Medium Priority (UI Labels)
1. Form field labels
2. Placeholders
3. Table headers
4. Tab labels

### Low Priority (Fallback Text)
1. Unknown/default values
2. Empty state messages

---

## 6. Implementation Checklist

- [ ] Add all missing translation keys to `en.json`
- [ ] Add corresponding Spanish translations to `es.json`
- [ ] Replace all hardcoded strings with `t()` calls
- [ ] Test language switching between English and Spanish
- [ ] Verify all UI elements display correctly in both languages
- [ ] Check for text overflow issues with longer Spanish translations
- [ ] Add translation keys for any new features going forward

---

## Estimated Translation Keys to Add
- **Common**: ~25 keys
- **Appointment**: ~15 keys
- **Schedule**: ~10 keys
- **Diagnosis**: ~8 keys
- **Orders**: ~10 keys
- **Insurance**: ~6 keys
- **Patient**: ~15 keys
- **Lab Tests**: ~6 keys
- **Settings**: ~2 keys
- **Encounter**: ~3 keys

**Total**: ~100 new translation keys needed

