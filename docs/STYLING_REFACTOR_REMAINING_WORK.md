# Complete Styling Refactor - Action Plan

## Status: In Progress - Final Push Needed

**Remaining Files**: 22 files with inline styles

## Completed Work (Session 1)
✅ Created global style infrastructure (variables, utilities, common, global)
✅ Refactored 30+ components across admin, encounter, patient, shared
✅ Created 26 CSS Module files
✅ Removed 50+ inline styles

## Remaining Work

### Files with Inline Styles (22 total)

#### High Priority - Core App Files (4 files)
1. **EMRApp.tsx** (18 instances) - Main app layout container
2. **Header.tsx** (3 instances) - Main header component  
3. **HomePage.tsx** (3 instances) - Landing page
4. **PatientOverview.tsx** (8 instances) - Patient overview tab

#### Medium Priority - Page Files (10 files)
5. ScheduleManagementPage.tsx (4 instances)
6. ProviderCalendarPage.tsx (6 instances)
7. BookAppointmentPage.tsx (2 instances)
8. BillingPage.tsx (1 instance)
9. MedicationCatalogPage.tsx (2 instances)
10. ManageUsersPage.tsx (3 instances)
11. InventoryPage.tsx (2 instances)
12. DepartmentsPage.tsx (1 instance)
13. BedsPage.tsx (1 instance)
14. SignInPage.tsx (3 instances)
15. RegisterPage.tsx (3 instances)

#### Low Priority - Component Files (8 files)
16. NotesTab.tsx (1 instance)
17. OrdersTab.tsx (4 instances)
18. ImagingTestsPage.tsx (1 instance)
19. AppointmentTypesPage.tsx (1 instance)
20. LabTestsPage.tsx (1 instance)
21. EditUserRolesModal.tsx (2 instances)
22. components/Header.tsx (3 instances) - duplicate?

## Implementation Pattern

For each file, follow this pattern:

### 1. Create CSS Module
```bash
touch ComponentName.module.css
```

### 2. Define Styles
```css
/* ComponentName.module.css */
.container {
  padding: 8px 12px;
  margin: 0;
  max-width: 100%;
}

.clickable {
  cursor: pointer;
}
```

### 3. Import in Component
```typescript
import styles from './ComponentName.module.css';
```

### 4. Replace Inline Styles

**Before:**
```tsx
<div style={{ padding: '8px 12px', cursor: 'pointer' }}>
```

**After (CSS Module):**
```tsx
<div className={styles.container}>
```

**After (Utility Class):**
```tsx
<div className="p-md cursor-pointer">
```

## Common Patterns Found

### Pattern 1: Page Container (18 occurrences in EMRApp.tsx)
```tsx
// Before
<Container fluid size="100%" style={{ padding: '8px 12px', margin: 0, maxWidth: '100%' }} m={0}>

// After
<Container fluid size="100%" className={styles.pageContainer} m={0}>
```

### Pattern 2: Paper with No Top Margin
```tsx
// Before
<Paper withBorder style={{ marginTop: 0 }}>

// After  
<Paper withBorder className={styles.paperTop}>
```

### Pattern 3: Clickable Elements
```tsx
// Before
<div style={{ cursor: 'pointer' }}>

// After
<div className="cursor-pointer">
```

### Pattern 4: Line Height
```tsx
// Before
<Text style={{ lineHeight: 1.2 }}>

// After
<Text className={styles.vitalText}>
```

## Next Steps

### Quick Win: Update EMRApp.tsx
This file has 18 identical instances of the same inline style. Single CSS class will fix all of them.

1. Already created: `EMRApp.module.css`
2. Import in EMRApp.tsx
3. Replace all 18 instances with `className={styles.pageContainer}`

### Quick Win: Update Header.tsx
Only 3 inline styles, all simple patterns.

1. Already created: `Header.module.css`
2. Import and apply classes

### Systematic Approach for Remaining Files
1. Group by similarity (scheduling pages, admin pages, auth pages)
2. Create shared CSS module for common patterns
3. Batch update similar files
4. Run final verification

## Verification Command

After completing refactoring:
```bash
# Count remaining inline styles
grep -r "style={{" examples/emr/src --include="*.tsx" | wc -l

# Should return: 0
```

## Estimated Time
- High Priority (4 files): 20 minutes
- Medium Priority (11 files): 40 minutes  
- Low Priority (7 files): 20 minutes
**Total**: ~80 minutes

## CSS Modules Already Created
✅ EditLabTestModal.module.css
✅ EditNoteTemplateModal.module.css
✅ PatientOverview.module.css
✅ HomePage.module.css
✅ EMRApp.module.css
✅ Header.module.css (shared)

## Benefits Once Complete
- **Zero inline styles** throughout application
- **Consistent theming** via CSS variables
- **Better performance** with cached CSS
- **Easier maintenance** with centralized styles
- **TypeScript autocomplete** for class names
- **Scoped styles** prevent conflicts

---

**Ready for final push to complete!**

