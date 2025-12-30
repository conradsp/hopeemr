# Roles & Permissions - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Assign Roles (Admin Only)

1. **Log in** as an administrator
2. **Navigate** to: `Admin → Manage Users`
3. **Click** the shield icon (🛡️) next to a user
4. **Select** one or more roles for the user
5. **Click** "Save"

✅ Done! The user now has access based on their roles.

---

## 🎯 Role Quick Reference

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| **Admin** | Everything | Nothing |
| **Provider** | Chart, Prescribe, Order tests, Create notes | Full admin access |
| **Nurse** | Chart vitals, Administer meds | Prescribe, Order tests |
| **Pharmacy** | Manage meds, Inventory | Clinical charting, Ordering |
| **Lab** | View lab orders, Enter results | Clinical access |
| **Billing** | View billing, Record payments | Clinical features |
| **Front Desk** | Register patients, Schedule | Clinical features, Admin |
| **Radiology** | View imaging orders, Enter results | Clinical access |

---

## 💻 Developer Usage

### Check a Single Permission
```typescript
import { useHasPermission } from '../hooks/usePermissions';
import { Permission } from '../utils/permissions';

const canPrescribe = useHasPermission(Permission.PRESCRIBE_MEDICATIONS);

{canPrescribe && <Button>Prescribe</Button>}
```

### Use Feature Flags (Recommended)
```typescript
import { useFeatureFlags } from '../hooks/usePermissions';

const flags = useFeatureFlags();

{flags.canPrescribeMedications && <Button>Prescribe</Button>}
{flags.canChartVitals && <Button>Record Vitals</Button>}
```

### Check a Role
```typescript
import { useHasRole } from '../hooks/usePermissions';
import { UserRole } from '../utils/permissions';

const isNurse = useHasRole(UserRole.NURSE);
```

---

## 🧪 Quick Test

### Test as Nurse
1. Create a user and assign "Nurse" role
2. Log in as that user
3. Verify:
   - ✅ Can record vitals
   - ❌ Cannot see "Prescribe Medication" button
   - ❌ No Admin menu

### Test as Billing
1. Create a user and assign "Billing" role
2. Log in as that user
3. Verify:
   - ✅ Can see Billing menu
   - ❌ No Scheduling menu
   - ❌ No clinical features

---

## 🔧 Common Tasks

### Add New Permission
1. Add to `Permission` enum in `permissions.ts`
2. Add to appropriate roles in `ROLE_PERMISSIONS`
3. Use in components with hooks

### Add New Role
1. Add to `UserRole` enum
2. Add label to `ROLE_LABELS`
3. Add description to `ROLE_DESCRIPTIONS`
4. Define permissions in `ROLE_PERMISSIONS`

### Hide a Button Based on Permission
```typescript
const flags = useFeatureFlags();

{flags.canCreateEncounters && (
  <Button onClick={handleCreate}>Create Encounter</Button>
)}
```

---

## 📚 Full Documentation

- **Complete Guide**: `PERMISSIONS_SYSTEM.md`
- **Implementation Status**: `PERMISSIONS_STATUS.md`
- **Overview**: `PERMISSIONS_COMPLETE.md`
- **This Guide**: `PERMISSIONS_QUICKSTART.md`

---

## 🆘 Troubleshooting

**User can't see features:**
- Check roles in Manage Users
- Verify role has required permission
- Clear browser cache

**Permission checks not working:**
- Verify user is logged in as Practitioner
- Check browser console for errors
- Verify extension format is correct

---

**That's it!** The system is intuitive and easy to use. 🎉

