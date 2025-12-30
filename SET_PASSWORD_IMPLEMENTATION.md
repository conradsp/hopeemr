# Set Password Implementation for EMR

## What Was Added

The `/setpassword/:id/:secret` endpoint has been successfully implemented in the EMR application.

## Files Created

### 1. `src/pages/auth/SetPasswordPage.tsx`
A React component that:
- Accepts `id` and `secret` URL parameters
- Displays a password form with confirmation field
- Validates that passwords match
- Calls the Medplum API `/auth/setpassword` endpoint
- Shows success message and redirects to sign-in
- Handles all error cases with user-friendly messages

### 2. `src/pages/auth/SetPasswordPage.module.css`
Styling for the set password page with:
- Centered layout with gradient background
- Responsive design
- Success state styling

## Files Modified

### `src/EMRApp.tsx`
- **Import added**: `SetPasswordPage` component
- **Route added**: `/setpassword/:id/:secret` route
- **Auth bypass**: Allow unauthenticated access to setpassword route
- **Direct rendering**: Render SetPasswordPage for matching routes

## How It Works

### 1. User Receives Email
When you invite a provider via the Medplum API, they receive an email with a link like:
```
http://localhost:3000/setpassword/550e8400-e29b-41d4-a716-446655440000/abc123xyz789
```

### 2. User Clicks Link
The EMR app loads the `SetPasswordPage` component with:
- `id`: The UserSecurityRequest ID
- `secret`: The secure token

### 3. User Sets Password
The page displays a form where the user:
- Enters their desired password (min 8 characters)
- Confirms their password
- Submits the form

### 4. Password is Set
The component:
- Sends POST request to `${medplumBaseUrl}/auth/setpassword`
- Server validates the request
- Password is hashed and stored
- UserSecurityRequest is marked as used

### 5. User Redirects to Sign In
Upon success:
- Success message is displayed
- User can click button to go to sign-in page
- User can now log in with their email and new password

## Testing

### Test the Flow

1. **Start the EMR dev server**:
   ```bash
   cd examples/emr
   npm run dev
   ```

2. **Invite a provider** (use your existing invite flow or API)

3. **Check the email** for the setpassword link

4. **Click the link** or manually visit:
   ```
   http://localhost:3000/setpassword/{id}/{secret}
   ```

5. **Set a password** and verify you can sign in

### Manual Test (No Email)

If you want to test without sending email:

1. Create a UserSecurityRequest via API:
   ```bash
   POST http://localhost:8103/fhir/R4/UserSecurityRequest
   Authorization: Bearer YOUR_TOKEN
   Content-Type: application/json

   {
     "resourceType": "UserSecurityRequest",
     "type": "invite",
     "user": {
       "reference": "User/YOUR_USER_ID"
     },
     "secret": "test-secret-123"
   }
   ```

2. Visit the page with the returned ID:
   ```
   http://localhost:3000/setpassword/{returned-id}/test-secret-123
   ```

## Features

### ✅ Password Validation
- Minimum 8 characters required
- Passwords must match
- Server checks against breach database (haveibeenpwned.com)

### ✅ Error Handling
- "Passwords do not match"
- "Already used" (link expired)
- "Incorrect secret" (invalid token)
- "Password found in breach database"
- Network errors

### ✅ User Experience
- Clear instructions
- Password visibility toggle
- Success confirmation
- Smooth redirect to sign-in

### ✅ Security
- One-time use tokens
- Timing-safe secret comparison on server
- No authentication required (public endpoint)
- Passwords hashed with bcrypt

## Customization

### Change the Styling

Edit `SetPasswordPage.module.css` to match your EMR's design:
```css
.container {
  background: your-custom-gradient;
}
```

### Change the Logo

The component uses `<Logo />` from `@medplum/react`. To use your custom logo:

1. Replace the Logo component in `SetPasswordPage.tsx`:
   ```tsx
   // Replace this:
   <Logo size={32} />
   
   // With this:
   <img src="/your-logo.png" alt="Your EMR" style={{ width: 32, height: 32 }} />
   ```

### Add Expiration Check

To add expiration (e.g., 24 hours), modify the server code in:
`packages/server/src/auth/setpassword.ts`

### Change Success Message

Edit the success section in `SetPasswordPage.tsx`:
```tsx
{success && (
  <div data-testid="success" className={styles.success}>
    <Text>Your custom success message</Text>
    {/* ... */}
  </div>
)}
```

## Troubleshooting

### Issue: "Route not found" or 404
**Solution**: Make sure the dev server is running and visit the exact URL pattern:
`/setpassword/:id/:secret`

### Issue: "Incorrect secret"
**Solution**: The secret token must match exactly. Check that:
- The URL wasn't truncated
- No extra characters were added
- The UserSecurityRequest hasn't been used already

### Issue: Page shows but API call fails
**Solution**: Check that:
- Medplum server is running (default: `http://localhost:8103`)
- The `VITE_MEDPLUM_BASE_URL` in `.env` is correct
- CORS is configured properly on the server

### Issue: User can't access page (redirects to signin)
**Solution**: The authentication bypass should allow this. If it doesn't work:
- Check that `isSetPasswordRoute` logic is correct in `EMRApp.tsx`
- Make sure the route path matches exactly `/setpassword/:id/:secret`

## API Endpoint Details

### POST /auth/setpassword

**Request Body:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "secret": "abc123xyz789",
  "password": "MySecurePassword123!"
}
```

**Success Response (200 OK):**
```json
{
  "resourceType": "OperationOutcome",
  "id": "allok",
  "issue": [
    {
      "severity": "information",
      "code": "informational",
      "details": { "text": "All OK" }
    }
  ]
}
```

**Error Response (400 Bad Request):**
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "invalid",
      "details": { "text": "Incorrect secret" },
      "expression": ["secret"]
    }
  ]
}
```

## Next Steps

1. ✅ Test the complete invite → email → set password → sign in flow
2. Consider customizing the page styling to match your EMR branding
3. Test error cases (wrong secret, already used, etc.)
4. Consider adding password strength indicator
5. Consider adding "Resend invitation" functionality

## Related Files

- Server invite logic: `packages/server/src/admin/invite.ts`
- Server setpassword endpoint: `packages/server/src/auth/setpassword.ts`
- Medplum app reference: `packages/app/src/SetPasswordPage.tsx`
