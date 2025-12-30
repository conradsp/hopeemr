# Bed Management System

## Overview
The EMR now includes a complete bed management system for tracking hospital departments, beds, and patient bed assignments using FHIR-compliant Location resources.

## Features Implemented

### 1. Department Management (Admin)
**Location**: Admin Menu → Bed Management → Departments (`/admin/departments`)

**Features**:
- Create, edit, and delete hospital departments
- Track department details:
  - Department name
  - Department code (e.g., ICU, ER, PEDS)
  - Department type (Emergency, ICU, Surgery, Pediatrics, Maternity, General, etc.)
  - Description
- View bed statistics for each department:
  - Total beds
  - Available beds
  - Occupied beds
- Full internationalization (English/Spanish)

**FHIR Resources**: `Location` with `physicalType` = 'wa' (Ward)

### 2. Bed Management (Admin)
**Location**: Admin Menu → Bed Management → Beds (`/admin/beds`)

**Features**:
- Create, edit, and delete beds
- Track bed details:
  - Bed number (e.g., 101A)
  - Room number
  - Department assignment
  - Bed type (Standard, ICU, Isolation, Bariatric, Pediatric, Maternity)
  - Bed status (Available, Occupied, Reserved, Maintenance, Contaminated, Housekeeping)
- Search functionality
- Visual status indicators with color coding
- Automatic status updates when beds are assigned/released

**FHIR Resources**: `Location` with `physicalType` = 'bd' (Bed)

### 3. Bed Assignment During Encounter Creation
**Location**: Patient Page → Create Encounter

**Features**:
- Automatically shows bed assignment fields for inpatient encounters
- Select department and view only available beds in that department
- If no beds are available, the selection is disabled with an informative message
- Add optional notes about the bed assignment
- Bed is automatically assigned when encounter is created
- Bed status automatically changes to "Occupied"

### 4. Bed Assignment Display & Management
**Location**: Encounter Page → Header Section

**Features**:
- Displays current bed assignment for inpatient encounters
- Shows bed number and room number
- "Release Bed" button to free up the bed
- Bed status automatically changes to "Available" when released
- Only visible for inpatient encounters

## FHIR Resources Used

### Location (Department)
Represents a hospital department/ward:
```json
{
  "resourceType": "Location",
  "status": "active",
  "name": "Intensive Care Unit",
  "mode": "instance",
  "physicalType": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/location-physical-type",
      "code": "wa",
      "display": "Ward"
    }]
  },
  "type": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
      "code": "ICU",
      "display": "icu"
    }]
  }],
  "identifier": [{
    "system": "http://example.org/department-codes",
    "value": "ICU"
  }],
  "description": "Intensive Care Unit - 24/7 critical care"
}
```

### Location (Bed)
Represents an individual bed:
```json
{
  "resourceType": "Location",
  "status": "active",
  "name": "Bed 101A",
  "mode": "instance",
  "physicalType": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/location-physical-type",
      "code": "bd",
      "display": "Bed"
    }]
  },
  "type": [{
    "coding": [{
      "system": "http://example.org/bed-types",
      "code": "icu",
      "display": "ICU"
    }]
  }],
  "identifier": [{
    "system": "http://example.org/bed-numbers",
    "value": "101A"
  }],
  "partOf": {
    "reference": "Location/[department-id]"
  },
  "operationalStatus": {
    "system": "http://terminology.hl7.org/CodeSystem/v2-0116",
    "code": "U",
    "display": "Unoccupied"
  },
  "extension": [{
    "url": "http://example.org/fhir/StructureDefinition/room-number",
    "valueString": "101"
  }]
}
```

### Encounter with Bed Assignment
When a bed is assigned to a patient:
```json
{
  "resourceType": "Encounter",
  "id": "encounter-123",
  "status": "in-progress",
  "class": {
    "code": "inpatient"
  },
  "subject": {
    "reference": "Patient/[patient-id]"
  },
  "location": [
    {
      "location": {
        "reference": "Location/[bed-id]",
        "display": "Bed 101A"
      },
      "status": "active",
      "period": {
        "start": "2025-10-31T10:00:00Z"
      }
    }
  ],
  "extension": [
    {
      "url": "http://example.org/fhir/StructureDefinition/bed-assignment-notes",
      "valueString": "Patient requires monitoring"
    }
  ]
}
```

## Operational Status Codes (HL7 V2-0116)

| Code | Status | Description |
|------|--------|-------------|
| U | Unoccupied | Bed is available |
| O | Occupied | Bed is in use |
| K | Housekeeping | Bed needs cleaning |
| C | Closed | Bed under maintenance |
| I | Isolated | Bed contaminated/isolated |

## Workflow Examples

### Example 1: Setting Up a New Department
1. Admin navigates to Departments page
2. Clicks "Add Department"
3. Fills in:
   - Name: "Intensive Care Unit"
   - Code: "ICU"
   - Type: "ICU"
   - Description: "24/7 critical care"
4. Saves department
5. Department appears in the list showing 0 beds initially

### Example 2: Adding Beds to a Department
1. Admin navigates to Beds page
2. Clicks "Add Bed"
3. Fills in:
   - Bed Number: "101A"
   - Room Number: "101"
   - Department: "Intensive Care Unit"
   - Bed Type: "ICU"
   - Status: "Available"
4. Saves bed
5. Bed appears in the list
6. Department page now shows 1 total bed, 1 available

### Example 3: Creating Inpatient Encounter with Bed Assignment
1. Provider opens patient page
2. Clicks "Create Encounter"
3. Selects:
   - Encounter Class: "Inpatient"
4. Bed assignment fields appear
5. Selects:
   - Department: "Intensive Care Unit"
6. System loads available beds in ICU
7. Selects:
   - Bed: "101A - Room 101"
8. Adds notes: "Patient requires continuous monitoring"
9. Creates encounter
10. System:
    - Creates encounter
    - Assigns bed to encounter
    - Updates bed status to "Occupied"
    - Records assignment timestamp

### Example 4: Releasing a Bed
1. Provider opens inpatient encounter
2. Encounter header shows: "Current Bed: Bed 101A - Room 101"
3. Provider clicks "Release Bed"
4. System:
    - Updates encounter location status to "completed"
    - Sets end time for bed assignment
    - Changes bed status back to "Available"
5. Bed is now available for other patients

### Example 5: Managing Bed Status
1. Admin navigates to Beds page
2. Sees bed "101A" is occupied
3. Patient is discharged and bed needs cleaning
4. Admin clicks "Edit" on bed 101A
5. Changes status to "Housekeeping"
6. Bed is temporarily unavailable for assignment
7. After cleaning, admin changes status back to "Available"

## Access Control

- **Department Management**: Admin only
- **Bed Management**: Admin only
- **Assign Beds**: Providers (during encounter creation)
- **Release Beds**: Providers (during encounter)
- **View Bed Assignments**: All users with encounter access

## Internationalization

All UI strings are fully internationalized with support for:
- English (`en.json`)
- Spanish (`es.json`)

Translation keys are prefixed with `beds.*` for easy identification.

## Navigation

### Admin Menu → Bed Management
- Departments
- Beds

### Encounter Creation
- Patient Page → Create Encounter → (Inpatient) → Bed Assignment

### Encounter Page
- Header → Current Bed (for inpatient encounters)
- Header → Release Bed button

## Technical Details

### Files Created
1. `src/utils/bedManagement.ts` - Core bed management utilities
2. `src/pages/admin/DepartmentsPage.tsx` - Department management UI
3. `src/pages/admin/BedsPage.tsx` - Bed management UI
4. `src/components/shared/ConfirmDialog.tsx` - Reusable confirmation dialog

### Files Modified
1. `src/components/encounter/NewEncounterModal.tsx` - Added bed assignment
2. `src/components/encounter/EncounterHeader.tsx` - Display current bed
3. `src/EMRApp.tsx` - Added routes
4. `src/components/shared/Header.tsx` - Added menu items
5. `src/i18n/en.json` & `src/i18n/es.json` - Added translations

### Location Types
- **Ward (wa)**: Hospital departments
- **Bed (bd)**: Individual beds

### Bed Types
- Standard
- ICU
- Isolation
- Bariatric
- Pediatric
- Maternity

### Department Types
- Emergency
- ICU
- Surgery
- Pediatrics
- Maternity
- General
- Cardiology
- Oncology
- Orthopedics
- Psychiatry

## Best Practices

1. **Always create departments before adding beds** - Beds must be assigned to a department
2. **Use standardized department codes** - Makes filtering and reporting easier
3. **Keep room numbers consistent** - Helps staff locate patients quickly
4. **Update bed status promptly** - Ensures accurate availability information
5. **Release beds when patients are discharged** - Frees up resources for new patients
6. **Use appropriate bed types** - Ensures patients get the right level of care
7. **Set beds to maintenance when needed** - Prevents assignment of non-functional beds

## Future Enhancements

Potential additions for future development:
- Bed transfer functionality (move patient between beds)
- Bed reservation system for planned admissions
- Automatic bed cleaning workflow
- Bed occupancy reports and analytics
- Integration with nurse call systems
- Bed preference tracking (window, privacy, etc.)
- Multi-bed rooms support
- Bed assignment history and auditing
- Alerts for low bed availability
- Integration with admission/discharge/transfer (ADT) system

## Support

For issues or questions about the bed management system, refer to:
- FHIR Location Resource: https://hl7.org/fhir/location.html
- FHIR Encounter Resource: https://hl7.org/fhir/encounter.html
- HL7 V2 Location Operational Status: http://terminology.hl7.org/CodeSystem/v2-0116

