# EMR Application - Comprehensive Code Review & Refactor Plan

## Executive Summary
After adding extensive billing, pharmacy, bed management, and scheduling features, the codebase has grown significantly. This review identifies consolidation opportunities, error handling gaps, security concerns, and refactoring priorities.

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

### 1. **Incomplete TODO: Automatic Charge Automation**
**Status**: Billing system is 85% complete but missing critical automation
**Impact**: High - Revenue loss, manual work required

**Missing Implementations:**
- ❌ Visit charge automation in `NewEncounterModal.tsx`
- ❌ Bed charge automation (initial + final) in `NewEncounterModal.tsx` and `EncounterHeader.tsx`

**Fix Required**: Complete the 3 remaining steps from `BILLING_FINAL_STATUS.md`

### 2. **Security: Client-Side Environment Variables**
**Location**: Multiple files access `import.meta.env`
**Risk**: HIGH - Sensitive configuration exposed
**Issue**: 
```typescript
// Current (UNSAFE):
const baseUrl = import.meta.env.VITE_MEDPLUM_BASE_URL;
```

**Fix**: Already implemented `envValidation.ts` but not consistently used
**Action**: Ensure all env access goes through `getEnvConfig()`

### 3. **Unprotected Admin Routes**
**Location**: `EMRApp.tsx` - All admin routes
**Risk**: MEDIUM - Unauthorized access to admin functions
**Issue**: No route-level permission checks

```typescript
// Current:
<Route path="/admin/settings" element={<SettingsPage />} />

// Should be:
<Route 
  path="/admin/settings" 
  element={
    <RequireAdmin>
      <SettingsPage />
    </RequireAdmin>
  } 
/>
```

**Action**: Create `RequireAdmin` wrapper component

---

## 🟡 HIGH PRIORITY (Fix Soon)

### 4. **Code Duplication: Modal Patterns**
**Locations**: 15+ modal components
**Impact**: Maintenance burden, inconsistent UX

**Duplicated Pattern:**
```typescript
// Repeated in every modal:
const [loading, setLoading] = useState(false);
const [formData, setFormData] = useState({...});

const handleSave = async () => {
  setLoading(true);
  try {
    await saveFunction();
    notifications.show({ title: 'Success', ... });
    onClose(true);
  } catch (error) {
    notifications.show({ title: 'Error', ... });
  } finally {
    setLoading(false);
  }
};
```

**Solution**: Create `useModalForm` hook
```typescript
function useModalForm<T>(initialData: T, onSave: (data: T) => Promise<void>) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialData);
  
  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(formData);
      showSuccess('Saved successfully');
      return true;
    } catch (error) {
      handleError(error, 'saving');
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  return { formData, setFormData, loading, handleSave };
}
```

**Files to Update**: All modal components (15+ files)

### 5. **Inconsistent Error Handling**
**Issue**: Mix of `handleError()`, `console.log()`, `notifications.show()`, `alert()`

**Found in**:
- `OrderDiagnosticModal.tsx` - Still has `console.log`
- `BedsPage.tsx` - Mix of notification styles
- Various utility files

**Solution**: Standardize on `handleError()` and `showSuccess()` everywhere

### 6. **Missing Input Validation**
**Locations**: Most forms
**Risk**: MEDIUM - Invalid data reaching backend

**Examples:**
```typescript
// Current (NO VALIDATION):
<TextInput 
  value={formData.email}
  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
/>

// Should have:
<TextInput 
  value={formData.email}
  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
  error={!isValidEmail(formData.email) && 'Invalid email'}
/>
```

**Action**: Add `utils/validation.ts` with common validators

### 7. **Race Conditions in Data Loading**
**Location**: Multiple pages with `useEffect` + `loadData()`
**Issue**: No cleanup, can cause "setState on unmounted component"

```typescript
// Current (UNSAFE):
useEffect(() => {
  loadData();
}, []);

// Should be:
useEffect(() => {
  let cancelled = false;
  
  const load = async () => {
    const data = await loadData();
    if (!cancelled) {
      setData(data);
    }
  };
  
  load();
  return () => { cancelled = true; };
}, []);
```

**Action**: Create `useAsync` hook or add cancellation tokens

---

## 🟢 MEDIUM PRIORITY (Improve Code Quality)

### 8. **Prop Drilling**
**Issue**: Deep prop passing (4-5 levels)
**Example**: `patient` passed through multiple components

**Solution**: Context API or state management
```typescript
// Create contexts:
- PatientContext
- EncounterContext  
- BillingContext
```

### 9. **Large Component Files**
**Files**:
- `EncounterPage.tsx` - 340 lines
- `BillingPage.tsx` - 300+ lines
- `PatientPage.tsx` - Large with complex logic

**Solution**: Extract sub-components and custom hooks

### 10. **Inconsistent Naming**
**Issues**:
- Mix of `handleSave` vs `onSave` vs `save`
- Mix of `formData` vs `data` vs `form`
- Inconsistent file naming (some `Page.tsx`, some not)

**Solution**: Establish naming conventions

### 11. **Missing Loading States**
**Locations**: Several pages
**Issue**: No feedback during async operations

**Action**: Add `<Loading />` components everywhere

### 12. **Hardcoded Values**
**Found**:
- Magic numbers (timeouts, limits)
- Repeated strings
- URLs and endpoints

**Solution**: Create `constants.ts` file

---

## 🔵 LOW PRIORITY (Nice to Have)

### 13. **Performance: Unnecessary Re-renders**
**Issue**: Missing `useMemo`, `useCallback` in key places
**Impact**: Minor performance degradation

### 14. **Accessibility Issues**
**Found**:
- Missing ARIA labels
- No keyboard navigation in some modals
- Color contrast issues

### 15. **Missing Tests**
**Coverage**: 0%
**Action**: Add unit tests for utilities, integration tests for key flows

---

## 📊 Consolidation Opportunities

### A. **Duplicate Table Components**
**Pattern**: 10+ pages with similar table structure
**Solution**: Create `<DataTable>` component

### B. **Duplicate Form Patterns**
**Pattern**: Similar form layouts across 20+ components
**Solution**: Create form builder utilities

### C. **Duplicate CRUD Operations**
**Pattern**: create/update/delete repeated in multiple utils
**Solution**: Generic CRUD helper functions

```typescript
function createCRUDOperations<T extends Resource>(resourceType: string) {
  return {
    getAll: (medplum: MedplumClient) => medplum.search(resourceType),
    getOne: (medplum: MedplumClient, id: string) => medplum.readResource(resourceType, id),
    create: (medplum: MedplumClient, data: T) => medplum.createResource(data),
    update: (medplum: MedplumClient, data: T) => medplum.updateResource(data),
    delete: (medplum: MedplumClient, id: string) => medplum.deleteResource(resourceType, id),
  };
}
```

### D. **Duplicate Price Management**
**Pattern**: `getPriceFromResource` and `setPriceOnResource` called repeatedly
**Solution**: Already centralized in `billing.ts` - just need consistent usage

---

## 🔒 Security Checklist

### Authentication & Authorization
- ✅ OAuth2 authentication
- ✅ `isUserAdmin()` utility
- ❌ Route-level protection
- ❌ API request authentication verification
- ❌ Token refresh handling

### Data Validation
- ❌ Client-side input validation
- ❌ Server-side validation (backend responsibility)
- ❌ SQL injection prevention (using FHIR API - safe)
- ✅ XSS prevention (React escapes by default)

### Sensitive Data
- ❌ Patient data encryption in transit (HTTPS required)
- ❌ Audit logging for sensitive operations
- ❌ Data masking for PII in logs
- ✅ No hardcoded credentials

### Dependencies
- ⚠️ Need to audit package.json for vulnerabilities
- ⚠️ No automated security scanning

---

## 🎯 Refactoring Priority Matrix

| Priority | Issue | Impact | Effort | ROI |
|----------|-------|--------|--------|-----|
| P0 | Complete billing automation | High | Low | High |
| P0 | Route-level auth protection | High | Low | High |
| P1 | Standardize error handling | High | Medium | High |
| P1 | Create useModalForm hook | High | Low | High |
| P1 | Input validation | Medium | Medium | High |
| P2 | Extract large components | Medium | High | Medium |
| P2 | Fix race conditions | Medium | Medium | Medium |
| P2 | Consolidate table components | Medium | Medium | Medium |
| P3 | Performance optimizations | Low | Medium | Low |
| P3 | Accessibility improvements | Low | High | Low |

---

## 📝 Recommended Implementation Plan

### Phase 1: Critical Fixes (2-3 hours)
1. ✅ Complete billing automation (visit + bed charges)
2. Create `RequireAdmin` component
3. Audit and fix all environment variable access
4. Add route-level protection

### Phase 2: Error Handling & Validation (3-4 hours)
1. Create `useModalForm` hook
2. Replace all error handling with standard utilities
3. Create `validation.ts` with common validators
4. Add input validation to all forms
5. Fix race conditions with cleanup

### Phase 3: Code Consolidation (4-5 hours)
1. Create `<DataTable>` component
2. Extract sub-components from large files
3. Create generic CRUD utilities
4. Establish and enforce naming conventions

### Phase 4: Testing & Documentation (3-4 hours)
1. Add unit tests for utilities
2. Add integration tests for critical flows
3. Update documentation
4. Create developer guidelines

**Total Estimated Time: 12-16 hours**

---

## 🔧 Immediate Action Items

### Today:
1. Complete billing automation (30 min)
2. Create `RequireAdmin` wrapper (15 min)
3. Create `useModalForm` hook (30 min)
4. Standardize error handling in 5 key files (1 hour)

### This Week:
1. Input validation framework
2. Fix race conditions
3. Extract large components
4. Create `DataTable` component

### This Month:
1. Comprehensive testing
2. Performance optimization
3. Accessibility audit
4. Security audit

---

## 📚 New Utilities to Create

1. `hooks/useModalForm.ts` - Standardize modal patterns
2. `hooks/useAsync.ts` - Handle async with cleanup
3. `hooks/usePagination.ts` - Consistent pagination
4. `utils/validation.ts` - Input validators
5. `utils/constants.ts` - Centralized constants
6. `components/RequireAdmin.tsx` - Route protection
7. `components/DataTable.tsx` - Reusable tables
8. `components/FormField.tsx` - Validated form inputs

---

## 🎓 Code Quality Metrics

### Current State:
- **Files**: ~100+ files
- **Lines of Code**: ~15,000+
- **Components**: ~50+
- **Utilities**: ~20+
- **Test Coverage**: 0%
- **Duplication**: ~30%
- **Technical Debt**: Medium-High

### Target State:
- **Test Coverage**: 60%+
- **Duplication**: <10%
- **Technical Debt**: Low
- **Build Time**: <30s
- **Bundle Size**: <500KB

---

## 📖 Conclusion

The EMR application has grown significantly and is feature-rich. However, rapid development has introduced technical debt. The recommended refactoring will:

1. ✅ Improve security posture
2. ✅ Reduce maintenance burden
3. ✅ Enhance code consistency
4. ✅ Prevent bugs
5. ✅ Improve developer experience

**Priority**: Start with Phase 1 (critical fixes) immediately, then proceed systematically through remaining phases.

**Risk**: Low - Most refactoring is additive and can be done incrementally without breaking existing functionality.

**Recommendation**: Allocate 2-3 hours for critical fixes this week, then 2-3 hours per week for ongoing improvements over the next month.

