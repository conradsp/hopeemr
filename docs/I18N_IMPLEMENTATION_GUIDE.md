# Internationalization Implementation Guide

## Summary of Work Completed

### ✅ Translation Files Updated
- **en.json**: Added 138+ new translation keys (total: ~408 keys)
- **es.json**: Added 138+ Spanish translations (total: ~408 keys)

### ✅ Components Fully Internationalized
1. `BookAppointmentPage.tsx` - All strings translated ✅
2. `AddEmergencyContactModal.tsx` - All strings translated ✅

---

## 📋 Quick Reference: Applying Translations

### Step 1: Add Import
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Add Hook
```typescript
export function MyComponent(): JSX.Element {
  const { t } = useTranslation();
  // ...
}
```

### Step 3: Replace Strings
```typescript
// Before:
title="Add Insurance"
message: 'Success!'

// After:
title={t('patient.addInsurance')}
message: t('success')
```

---

## 🔑 Available Translation Keys

### Common Keys (Always Available)
```typescript
t('error')                    // "Error"
t('success')                  // "Success"
t('common.cancel')            // "Cancel"
t('common.save')              // "Save"
t('common.add')               // "Add"
t('common.update')            // "Update"
t('common.delete')            // "Delete"
t('common.close')             // "Close"
t('common.confirm')           // "Confirm"
t('common.loading')           // "Loading..."
t('common.unknown')           // "Unknown"
t('common.provider')          // "Provider"
t('common.selectProvider')    // "Select Provider"
t('common.patient')           // "Patient"
t('common.status')            // "Status"
t('common.type')              // "Type"
t('common.date')              // "Date"
t('common.time')              // "Time"
t('common.duration')          // "Duration"
t('common.action')            // "Action"
t('common.firstName')         // "First Name"
t('common.lastName')          // "Last Name"
t('common.email')             // "Email"
t('common.phoneNumber')       // "Phone Number"
t('common.optional')          // "Optional"
```

### Patient Keys
```typescript
t('patient.addInsurance')              // "Add Insurance Coverage"
t('patient.assignPractitioner')        // "Assign General Practitioner"
t('patient.addEmergencyContact')       // "Add Emergency Contact"
t('patient.relationship')              // "Relationship"
t('patient.selectRelationship')        // "Select relationship"
t('patient.emergencyContactSuccess')   // "Emergency contact added successfully!"
t('patient.emergencyContactError')     // "Failed to add emergency contact..."
```

### Appointment Keys
```typescript
t('appointment.selectPatient')         // "Please select a patient"
t('appointment.selectDate')            // "Please select a date"
t('appointment.bookSuccess')           // "Appointment booked successfully!"
t('appointment.bookError')             // "Failed to book appointment..."
t('appointment.anyProvider')           // "Any Provider"
t('appointment.anyType')               // "Any Type"
t('appointment.confirmTitle')          // "Confirm Appointment"
t('appointment.searchSlots')           // "Search Slots"
t('appointment.availableSlots')        // "Available Time Slots"
```

### Schedule Keys
```typescript
t('schedule.createTitle')      // "Create Schedule"
t('schedule.startDate')        // "Start Date"
t('schedule.endDate')          // "End Date"
t('schedule.startTime')        // "Start Time"
t('schedule.endTime')          // "End Time"
t('schedule.selectProvider')   // "Select Provider"
```

### Diagnosis Keys
```typescript
t('diagnosis.addTitle')           // "Add Diagnosis Code"
t('diagnosis.editTitle')          // "Edit Diagnosis Code"
t('diagnosis.codeSystem')         // "Code System"
t('diagnosis.displayName')        // "Display Name"
t('diagnosis.selectSeverity')     // "Select severity"
```

### Lab Test Keys
```typescript
t('labTest.code')                 // "Test Code"
t('labTest.name')                 // "Test Name"
t('labTest.category')             // "Category"
t('labTest.specimenType')         // "Specimen Type"
```

### Insurance Keys
```typescript
t('insurance.company')            // "Insurance Company"
t('insurance.memberId')           // "Member ID"
t('insurance.groupNumber')        // "Group Number"
t('insurance.type')               // "Coverage Type"
```

### Encounter Keys
```typescript
t('encounter.createTitle')        // "Create New Encounter"
t('encounter.classLabel')         // "Encounter Class"
t('encounter.statusLabel')        // "Encounter Status"
t('encounter.changeStatusTitle')  // "Change Encounter Status"
t('encounter.statusUpdated')      // "Encounter status updated successfully"
```

---

## 📝 Remaining Files to Update

### High Priority
1. **AddInsuranceModal.tsx**
   - Line 112: `title="Add Insurance Coverage"` → `title={t('patient.addInsurance')}`
   - Line 116-117: `label="Insurance Company"` → `label={t('insurance.company')}`
   - Line 124: `label="Member ID"` → `label={t('insurance.memberId')}`
   - Line 132: `label="Group Number"` → `label={t('insurance.groupNumber')}`
   - Line 139: `label="Coverage Type"` → `label={t('insurance.type')}`
   - Line 152: `label="Status"` → `label={t('common.status')}`
   - Notifications: Use `t('success')` and `t('error')`

2. **AddPractitionerModal.tsx**
   - Line 92: `title="Assign General Practitioner"` → `title={t('patient.assignPractitioner')}`
   - Line 99: `label="Select Practitioner"` → `label={t('patient.selectPractitioner')}`
   - Line 100: `placeholder="Choose a practitioner"` → `placeholder={t('patient.choosePractitioner')}`
   - Notifications: Use `t('success')` and `t('error')`

3. **EncounterHeader.tsx**
   - Line 121: `title="Change Encounter Status"` → `title={t('encounter.changeStatusTitle')}`
   - Line 123: `label="Encounter Status"` → `label={t('encounter.statusLabel')}`
   - Notification: Use `t('encounter.statusUpdated')`

4. **NewEncounterModal.tsx**
   - Line 108: `title="Create New Encounter"` → `title={t('encounter.createTitle')}`
   - Line 112: `label="Patient"` → `label={t('common.patient')}`
   - Line 120: `label="Encounter Class"` → `label={t('encounter.classLabel')}`

5. **ProviderCalendarPage.tsx**
   - Lines 191-195, 200-204: Notifications
   - Lines 252, 262, 301-302: Modal and form labels

6. **CreateScheduleModal.tsx**
   - Lines 166-272: All form labels and modal title

7. **DiagnosisCodesPage.tsx**
   - Lines 235-271: Modal and form elements

8. **SettingsPage.tsx**
   - Lines 104, 150: Placeholders

---

## 🎯 Pattern Examples

### Notification Pattern
```typescript
// Before:
notifications.show({
  title: 'Success',
  message: 'Item added successfully!',
  color: 'green',
});

// After:
notifications.show({
  title: t('success'),
  message: t('item.addSuccess'),
  color: 'green',
});
```

### Modal Pattern
```typescript
// Before:
<Modal opened={opened} onClose={onClose} title="Add Item">

// After:
<Modal opened={opened} onClose={onClose} title={t('item.addTitle')}>
```

### Form Field Pattern
```typescript
// Before:
<TextInput
  label="First Name"
  placeholder="John"
  required
/>

// After:
<TextInput
  label={t('common.firstName')}
  placeholder={t('common.firstNamePlaceholder')}
  required
/>
```

---

## ✅ Validation Checklist

After updating each file:
1. ☐ Import added
2. ☐ Hook declared
3. ☐ All hardcoded strings replaced
4. ☐ No lint errors
5. ☐ Test in browser (English)
6. ☐ Test in browser (Spanish)

---

## 🔄 Next Steps

1. Apply pattern to remaining 9 files
2. Test language switching
3. Check for text overflow in Spanish
4. Verify all modals and notifications
5. Run full application test

---

## 📊 Translation Coverage

**Current Status**: ~60% Complete
- ✅ Translation keys: 100%
- ✅ Spanish translations: 100%
- ⏳ Component updates: 20% (2/10 high-priority files)

**Estimated Time to Complete**: 30-45 minutes for remaining files

