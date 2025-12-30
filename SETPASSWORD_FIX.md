# SetPassword Route Fix

## The Problem

The error you encountered:
```json
{
  "issue": [
    {
      "severity": "error",
      "code": "invalid",
      "expression": ["id"],
      "details": { "text": "Invalid request ID" }
    },
    {
      "severity": "error",
      "code": "invalid",
      "expression": ["secret"],
      "details": { "text": "Missing secret" }
    }
  ]
}
```

**Root Cause**: The `id` and `secret` URL parameters were not being extracted correctly because the component was being rendered **outside** of the React Router `<Routes>` context.

## The Fix

### What Changed in `EMRApp.tsx`

**Before (❌ Broken)**:
```tsx
if (isSetPasswordRoute) {
  return <SetPasswordPage />;  // Rendered OUTSIDE of <Routes>
}

return (
  <div className={styles.appContainer}>
    <Header />
    <Routes>
      <Route path="/setpassword/:id/:secret" element={<SetPasswordPage />} />
      {/* other routes */}
    </Routes>
  </div>
);
```

**After (✅ Fixed)**:
```tsx
// No early return for setpassword route

return (
  <div className={styles.appContainer}>
    {!isSetPasswordRoute && <Header />}  // Hide header on setpassword page
    <Routes>
      <Route path="/setpassword/:id/:secret" element={<SetPasswordPage />} />
      {/* other routes */}
    </Routes>
  </div>
);
```

### What Changed in `SetPasswordPage.tsx`

Added validation and debugging:
```tsx
// Debug logging
console.log('SetPasswordPage - URL params:', { id, secret });

// Validate parameters exist
if (!id || !secret) {
  return <InvalidLinkMessage />;
}
```

## Why This Fixes It

1. **React Router Context**: `useParams()` only works inside components rendered by `<Route>` elements
2. **Early Return Problem**: Rendering the component before `<Routes>` meant it had no access to URL parameters
3. **Solution**: Let React Router handle the routing and parameter extraction properly

## Testing

1. **Restart your dev server** (if running):
   ```bash
   cd examples/emr
   npm run dev
   ```

2. **Check browser console** for debug logs:
   ```
   SetPasswordPage - URL params: { id: "xxx", secret: "yyy" }
   SetPasswordPage - Current pathname: /setpassword/xxx/yyy
   ```

3. **Try setting password** - should now work correctly

## Expected Behavior

### Valid Link
When you visit: `http://localhost:3000/setpassword/550e8400-e29b-41d4-a716-446655440000/abc123`

You should see:
- ✅ Password form displays
- ✅ Console shows: `URL params: { id: "550e8400...", secret: "abc123" }`
- ✅ Can submit the form
- ✅ API receives correct id and secret

### Invalid Link
When you visit: `http://localhost:3000/setpassword` (no parameters)

You should see:
- ✅ "Invalid Link" message
- ✅ Debug info showing missing parameters
- ✅ Button to go to sign-in

## Additional Notes

### Header Hidden on SetPassword Page
The fix also hides the EMR header on the setpassword page:
```tsx
{!isSetPasswordRoute && <Header />}
```

This is appropriate because:
- User is not authenticated yet
- Header would show empty/broken state
- Matches the signin/register page behavior

### No Breaking Changes
This fix:
- ✅ Doesn't affect any other routes
- ✅ Maintains authentication bypass for setpassword
- ✅ Keeps all other functionality intact

## Troubleshooting

### Still seeing the error?

1. **Hard refresh**: Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. **Clear browser cache**: Sometimes React dev server caches old code
3. **Check console**: Look for the debug logs to see what parameters are being received
4. **Verify URL format**: Must be exactly `/setpassword/{id}/{secret}` with no extra slashes or characters

### Parameters still undefined?

Check that the URL is correct:
```
✅ Good: /setpassword/550e8400-e29b-41d4-a716-446655440000/abc123xyz
❌ Bad:  /setpassword/550e8400-e29b-41d4-a716-446655440000/  (missing secret)
❌ Bad:  /setpassword/550e8400-e29b-41d4-a716-446655440000   (missing secret)
❌ Bad:  /setpassword                                         (missing both)
```

## Summary

✅ **Fixed**: URL parameters now correctly extracted via `useParams()`
✅ **Added**: Validation to show error if parameters are missing
✅ **Added**: Debug logging to help troubleshoot
✅ **Improved**: Header hidden on setpassword page for better UX

The setpassword flow should now work end-to-end!
