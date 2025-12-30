# Offline Mode Security & Code Review

## Review Date: 2025-12-29

## Executive Summary

This document details the security and code quality review of the offline mode implementation for HopeEMR. The implementation stores Protected Health Information (PHI) locally using IndexedDB and queues operations for later sync.

---

## Security Findings

### CRITICAL: PHI Stored in Plaintext (IndexedDB)

**Location**: `src/offline/db/schema.ts`, `src/offline/db/operations.ts`

**Issue**: Patient data, medications, diagnoses, and observations are stored in IndexedDB without encryption. IndexedDB data is:
- Accessible to any JavaScript running in the same origin
- Visible in browser developer tools
- Potentially accessible to browser extensions
- Vulnerable to XSS attacks

**Affected Data Stores**:
- `patients` - Patient demographics, contact info
- `encounters` - Visit information
- `observations` - Vital signs, lab values
- `medicationRequests` - Prescriptions
- `serviceRequests` - Lab/imaging orders
- `syncQueue` - Pending operations with full resource data

**Risk Level**: HIGH for production environments

**Mitigations Implemented**:
1. Data expires after 30 days (configurable via `clearStaleData()`)
2. Offline-created resources are preserved until synced
3. App requires authentication to access

**Recommendations for Production**:
1. Implement IndexedDB encryption using a library like `idb-keyval-encrypted` or `localforage` with encryption
2. Add device-level security (PIN/biometric) for offline access
3. Reduce cache duration in high-risk environments
4. Add audit logging for offline data access

---

### HIGH: Cache Not Cleared on Logout

**Location**: `src/offline/db/operations.ts`

**Issue**: The `clearAllData()` function exists but is not automatically called when users log out. This means:
- A previous user's cached patient data remains accessible
- Shared devices retain PHI between users

**Current Code**:
```typescript
// clearAllData exists but is not called on logout
export async function clearAllData(): Promise<void> {
  // Clears all stores...
}
```

**Fix Required**: Call `clearAllData()` on logout

---

### MEDIUM: Service Worker Caches API Responses

**Location**: `vite.config.ts`

**Issue**: The Workbox configuration caches FHIR API responses:
```typescript
urlPattern: /^https:\/\/.*\.medplum\.com\/fhir\/R4\/.*/i,
handler: 'NetworkFirst',
options: {
  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
}
```

**Risks**:
- Cached responses may contain sensitive data
- Stale data could persist for 7 days
- Cache is separate from IndexedDB (dual storage)

**Recommendations**:
1. Reduce cache duration to 1 day for API responses
2. Exclude sensitive endpoints from caching
3. Add cache-busting headers to sensitive responses

---

### MEDIUM: No Integrity Verification on Sync Queue

**Location**: `src/offline/sync/SyncQueue.ts`

**Issue**: Queued operations are stored without integrity verification. A malicious actor with device access could:
- Modify pending operations before sync
- Inject false medical records
- Alter prescriptions or orders

**Recommendations**:
1. Add HMAC signature to queued items
2. Verify signature before syncing
3. Add audit logging for queue modifications

---

### LOW: Network Error Detection via String Matching

**Location**: `src/offline/hooks/useOfflineMutation.ts`

**Issue**: Network errors are detected by matching error message strings:
```typescript
function isNetworkError(error: unknown): boolean {
  const message = error.message.toLowerCase();
  return message.includes('network') || message.includes('fetch') || ...
}
```

**Risks**:
- May miss some network error types
- Could falsely classify non-network errors
- Language-dependent error messages may not match

**Recommendations**:
1. Check for specific error types (e.g., `TypeError` for fetch failures)
2. Use error codes where available
3. Add fallback detection

---

## Code Quality Findings

### Missing Cleanup on Logout

**Location**: `src/offline/OfflineProvider.tsx`

**Issue**: OfflineProvider cleans up SyncManager but doesn't clear cached data.

**Fix**: Add logout handler that clears offline data.

---

### Unused Code

**Location**: `src/components/shared/OfflineBanner.tsx`

**Issue**: `SyncSuccessBanner` component is exported but never used.

**Recommendation**: Either use it or remove it.

---

### Race Condition in Sync

**Location**: `src/offline/sync/SyncManager.ts`

**Issue**: The `isSyncing` flag prevents concurrent syncs but isn't atomic:
```typescript
if (this.isSyncing) {
  return { success: 0, failed: 0 };
}
this.isSyncing = true;
```

**Risk**: Low - unlikely in practice due to JavaScript's single-threaded nature.

---

### Missing ESLint Disable Comment Justification

**Location**: `src/offline/OfflineProvider.tsx:102`

**Issue**: ESLint rule disabled without explanation:
```typescript
// eslint-disable-line react-hooks/exhaustive-deps
```

**Recommendation**: Add comment explaining why the dependency is intentionally excluded.

---

## Positive Security Patterns

1. **UUID Generation**: Uses `crypto.randomUUID()` for local IDs - cryptographically secure
2. **Retry Limits**: Failed syncs have max retry limits to prevent infinite loops
3. **Error Isolation**: Sync errors don't crash the app
4. **Event Cleanup**: Proper cleanup of event listeners in React effects
5. **Type Safety**: Strong TypeScript types for all data structures

---

## Recommended Actions

### Immediate (Before Production)

1. **Clear cache on logout** - Add `clearAllData()` call to logout handler
2. **Reduce API cache duration** - Change from 7 days to 1 day
3. **Add security warning** - Display warning about offline data on shared devices

### Short-term

1. **Implement data encryption** - Encrypt IndexedDB stores
2. **Add integrity verification** - HMAC for sync queue items
3. **Improve network detection** - Use error types instead of string matching

### Long-term

1. **Device security** - Require PIN/biometric for offline access
2. **Audit logging** - Log all offline data access
3. **Data minimization** - Only cache essential fields

---

## Files Reviewed

| File | Status | Notes |
|------|--------|-------|
| `src/offline/types.ts` | OK | Well-typed interfaces |
| `src/offline/db/schema.ts` | REVIEW | PHI storage concern |
| `src/offline/db/operations.ts` | REVIEW | Missing logout cleanup |
| `src/offline/sync/SyncQueue.ts` | OK | Good event handling |
| `src/offline/sync/SyncManager.ts` | OK | Proper error handling |
| `src/offline/hooks/useOfflineStatus.ts` | OK | Clean implementation |
| `src/offline/hooks/useOfflineMutation.ts` | REVIEW | String-based error detection |
| `src/offline/OfflineProvider.tsx` | REVIEW | Missing logout integration |
| `src/components/shared/OfflineBanner.tsx` | OK | Unused export |
| `src/components/shared/SyncStatusBadge.tsx` | OK | Clean implementation |
| `vite.config.ts` | REVIEW | Long cache duration |

---

## Conclusion

The offline mode implementation is functionally sound but requires security hardening before production use in healthcare environments. The primary concerns are:

1. **Unencrypted PHI storage** - Standard for IndexedDB but needs documentation
2. **Missing logout cleanup** - Must be fixed before production
3. **Long cache duration** - Should be reduced

The code quality is good with proper TypeScript types, error handling, and React patterns. The architecture allows for incremental security improvements.
