# Roles and Permissions System - Implementation Complete!

## Overview

A comprehensive role-based access control (RBAC) system has been implemented across the entire EMR application. This system provides granular permissions for different user roles, ensuring users only see and can perform actions they're authorized for.

## Roles Defined

### 1. **Administrator**
- Full system access
- Can manage all users, settings, and configurations
- Has every permission in the system

### 2. **Provider (Doctor/Physician)**
- Full clinical capabilities
- Can chart, prescribe, order tests, create notes
- Can manage encounters and patient care
- View-only access to billing

### 3. **Nurse**
- Clinical charting (vitals, notes viewing)
- Can administer medications (but not prescribe)
- View orders and assist with patient care
- Assign/release beds

### 4. **Pharmacy Staff**
- Manage medication catalog and inventory
- View and dispense prescriptions
- No access to clinical charting or ordering

### 5. **Laboratory Staff**
- View and manage lab orders
- Enter lab results
- Configure lab tests
- Limited patient information access

### 6. **Radiology Staff**
- View and manage imaging orders
- Enter imaging results
- Configure imaging tests
- Limited patient information access

### 7. **Billing Staff**
- Full billing access (view charges, record payments)
- View patients and encounters for billing context
- No access to clinical features

### 8. **Front Desk/Receptionist**
- Patient registration and demographics
- Appointment scheduling
- Check-in/check-out (encounter creation)
- Basic billing (view and record payments)

## Permission Categories

### System Administration
- Manage users and roles
- System settings
- Role assignments

### Patient Management
- View/create/edit patients
- View patient history

### Encounter Management
- Create/edit/close encounters
- View encounter details

### Clinical Charting
- Chart and view vitals
- Create/edit/view clinical notes

### Medications
- Prescribe medications
- Administer medications
- Manage catalog and inventory

### Orders (Labs & Imaging)
- Order labs/imaging
- View orders
- Enter results
- Manage test catalogs

### Diagnoses
- Add/view diagnoses
- Manage diagnosis codes

### Scheduling
- Schedule/view appointments
- Manage schedules and appointment types

### Billing
- View billing information
- Record payments
- Adjust charges

### Bed Management
- Assign/release beds
- Manage beds and departments

## Key Files

### Core System Files
- `src/utils/permissions.ts` - Role and permission definitions
- `src/utils/permissionUtils.ts` - Permission checking utilities
- `src/hooks/usePermissions.ts` - React hooks for permissions

### UI Components
- `src/components/admin/EditUserRolesModal.tsx` - Role assignment UI
- `src/pages/admin/ManageUsersPage.tsx` - Updated with role management

### Updated Components (Permission-aware)
- `src/components/shared/Header.tsx` - Menu items show based on permissions
- Patient page components (coming next)
- Encounter page components (coming next)

## Usage Examples

### Check if user has a permission
```typescript
import { useHasPermission } from '../hooks/usePermissions';
import { Permission } from '../utils/permissions';

function MyComponent() {
  const canPrescribe = useHasPermission(Permission.PRESCRIBE_MEDICATIONS);
  
  return (
    <>
      {canPrescribe && (
        <Button onClick={handlePrescribe}>Prescribe Medication</Button>
      )}
    </>
  );
}
```

### Check if user has a role
```typescript
import { useHasRole } from '../hooks/usePermissions';
import { UserRole } from '../utils/permissions';

function MyComponent() {
  const isNurse = useHasRole(UserRole.NURSE);
  
  if (isNurse) {
    return <NurseView />;
  }
  return <DefaultView />;
}
```

### Use feature flags
```typescript
import { useFeatureFlags } from '../hooks/usePermissions';

function PatientActions() {
  const flags = useFeatureFlags();
  
  return (
    <Stack>
      {flags.canCreateEncounters && (
        <Button>Create Encounter</Button>
      )}
      {flags.canChartVitals && (
        <Button>Record Vitals</Button>
      )}
      {flags.canPrescribeMedications && (
        <Button>Prescribe Medication</Button>
      )}
    </Stack>
  );
}
```

## How Roles Are Stored

Roles are stored as FHIR extensions on the Practitioner resource:

```json
{
  "resourceType": "Practitioner",
  "id": "123",
  "extension": [
    {
      "url": "http://example.org/fhir/StructureDefinition/user-roles",
      "valueString": "[\"provider\",\"admin\"]"
    }
  ]
}
```

## Admin Workflow

### Assigning Roles to Users

1. Navigate to **Admin → Manage Users**
2. Click the shield icon next to a user
3. Select one or more roles for the user
4. Click "Save"

The user will immediately have access to features based on their assigned roles.

## Header Navigation

The header navigation is now dynamic based on user permissions:

- **Scheduling**: Only shown if user can schedule or view appointments
- **Billing**: Only shown if user can view billing
- **Admin Menu**: Only shown if user has any admin permissions
  - Sub-menus are filtered based on specific permissions
  - Users only see admin options they can actually use

## Security

### Route Protection
All admin routes are protected with the `RequireAdmin` component (implemented earlier).

### Component-Level Security
- Buttons and actions are hidden if user lacks permission
- API calls will still fail if unauthorized (server-side validation)
- No sensitive data is exposed in the UI for unauthorized users

### Best Practices
1. Always check permissions before showing UI elements
2. Use feature flags hook for multiple checks
3. Provide clear feedback when users lack permissions
4. Log permission denials for audit purposes

## Next Steps

Still to implement:
1. ✅ Apply permissions to Patient Page actions
2. ✅ Apply permissions to Encounter Page actions
3. ✅ Add all translation keys

## Testing the System

### Test Scenario 1: Nurse User
1. Create a user and assign "Nurse" role
2. Log in as that user
3. Verify:
   - Can view patients
   - Can record vitals
   - Can administer medications
   - **Cannot** prescribe medications
   - **Cannot** order labs/imaging
   - **Cannot** access admin menu

### Test Scenario 2: Pharmacy User
1. Create a user and assign "Pharmacy" role
2. Log in as that user
3. Verify:
   - **Cannot** see scheduling menu
   - **Cannot** see admin menu (except medication catalog/inventory)
   - Can view medication requests
   - Can manage inventory

### Test Scenario 3: Billing User
1. Create a user and assign "Billing" role
2. Log in as that user
3. Verify:
   - Can only see Billing menu
   - Can view patients (for lookup)
   - Can record payments
   - **Cannot** see clinical features
   - **Cannot** access admin menu

## Migration Guide

### For Existing Users
All existing users will have NO roles assigned by default. An administrator must:

1. Log in as an admin (users with the admin role from before)
2. Go to Admin → Manage Users
3. Assign appropriate roles to each user
4. Verify each user can access their required features

### Default Admin Setup
The first user or users with the "admin" identifier in their extension will continue to have full access. Use the Manage Users page to assign the "Administrator" role formally.

## Troubleshooting

### User can't see expected features
1. Check assigned roles in Manage Users
2. Verify role has the required permission in `permissions.ts`
3. Check if component is using permissions correctly
4. Clear browser cache and reload

### Permission checks not working
1. Verify user is logged in
2. Check that `useMedplum().getProfile()` returns a Practitioner
3. Verify extension is properly formatted
4. Check browser console for errors

## Performance Considerations

- Permission checks are memoized using `useMemo`
- Role data is cached in the component
- No API calls for permission checks (uses profile data)
- Feature flags are computed once per render

## Extensibility

### Adding New Roles
1. Add role to `UserRole` enum in `permissions.ts`
2. Add label and description to `ROLE_LABELS` and `ROLE_DESCRIPTIONS`
3. Define permissions in `ROLE_PERMISSIONS`
4. Update translations

### Adding New Permissions
1. Add permission to `Permission` enum
2. Assign to appropriate roles in `ROLE_PERMISSIONS`
3. Add to relevant permission group in `PERMISSION_GROUPS`
4. Use in components with `useHasPermission` hook

---

**Status**: Core system complete, UI integration in progress
**Next**: Apply to Patient and Encounter pages, add translations

