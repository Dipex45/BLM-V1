# Admin Portal Access Guide

## Overview
The BLM Motors admin portal is a secure dashboard for managing bookings, pricing, hubs, schedules, administrators, drivers, analytics, maintenance tasks, and customer reviews.

## How to Access the Admin Portal

### Prerequisites
- You must have an admin account created in the system
- Your account must have one of the following roles:
  - `admin` - Full administrative access
  - `super_admin` - Super administrator with all permissions
  - `dispatcher` - Can manage bookings and dispatching
  - `finance_admin` - Can manage pricing and financial records
  - `customer_support_agent` - Can manage customer support and reviews

### Access Steps

1. **Navigate to Login Page**
   - Go to `/login` or click "Log in" on the home page
   - URL: `https://your-domain.com/login`

2. **Sign In with Your Credentials**
   - Enter your email address
   - Enter your password
   - Click "Sign in" button
   - Alternatively, you can use "Continue with Google" if your account is linked to Google

3. **Verify Your Email** (if required)
   - If this is your first time, you may need to verify your email
   - Check your inbox for a verification link
   - Click the link to verify your account
   - Return to the site and log in again

4. **Access the Admin Dashboard**
   - Once logged in, the system automatically detects your admin role
   - You'll be redirected to `/admin` automatically
   - If you have a non-admin role, you'll be taken to the regular `/dashboard` instead

### Direct URL Access
- **Admin Portal URL:** `/admin`
- Full URL: `https://your-domain.com/admin`

### Admin Features Available

Once in the admin portal, you can manage:

1. **Bookings** - View, track, and manage all customer bookings
2. **Prices** - Update vehicle pricing and service rates
3. **Hubs** - Manage operation centers and locations
4. **Schedules** - Create and manage scheduled trips
5. **Admins** - Manage admin users and their permissions
6. **Drivers** - Manage driver accounts and assignments
7. **Analytics** - View business metrics and reports
8. **Maintenance** - System maintenance and configuration tasks
9. **Reviews** - Monitor and manage customer reviews

### Troubleshooting

#### "Redirected to Login"
- Your session may have expired
- Your admin role may have been removed
- Sign out and sign back in

#### "Redirected to Dashboard"
- Your account doesn't have admin privileges
- Contact a super admin to upgrade your role
- Current roles required: `admin`, `super_admin`, `dispatcher`, `finance_admin`, or `customer_support_agent`

#### "Redirected to Email Verification"
- Your email hasn't been verified yet
- Check your inbox for the verification email
- Click the verification link
- Return to `/admin` after verification

#### Google Login Not Working
- Ensure popups are enabled in your browser settings
- Check browser console for specific error messages
- Try using email/password login instead
- If error persists, contact your administrator

### Browser Requirements
- Modern browser with JavaScript enabled
- Cookies enabled for session management
- Pop-ups enabled for Google authentication
- Recommended: Chrome, Firefox, Safari, or Edge (latest versions)

### Account Management

#### Changing Your Password
- Log in to your account
- Go to your dashboard
- Look for account settings
- Select "Change password"
- Enter current password and new password
- Click "Update"

#### Resetting Your Password
- On the login page, click "Forgot password?"
- Enter your email address
- Check your inbox for reset link
- Click the link and set a new password
- Sign in with your new password

#### Logging Out
- Click "Sign out" button in the top navigation
- You'll be returned to the home page
- Your session will be terminated

### Security Best Practices

1. **Use Strong Passwords**
   - Minimum 8 characters
   - Mix of uppercase, lowercase, numbers, and symbols

2. **Keep Session Secure**
   - Don't share your login credentials
   - Log out on shared computers
   - Close your browser after use on public computers

3. **Monitor Account Activity**
   - Admin actions are logged for audit purposes
   - Check audit logs regularly
   - Report any suspicious activity immediately

4. **Two-Factor Authentication** (if available)
   - Enable 2FA on your admin account
   - Use authenticator app or SMS
   - Keep backup codes in a safe place

### Contact Support

For issues accessing the admin portal:
- Email: bookings@blmmotors.ng
- Phone: +234 906 409 0276
- WhatsApp: +234 906 409 0276
