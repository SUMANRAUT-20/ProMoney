# ProMoney authentication UI

Only this folder is changed. The shared router, stylesheet, dashboard, other features,
API client, database schema, backend, and team guidance are untouched.

## Open the pages

Run the existing frontend with `npm run dev` from `frontend/`:
- `/login`: login form
- `/register`: registration form
- `/login?view=welcome`: welcome screen (uses the existing login route)

The auth header contains Log in, Sign up, and a live Japan Standard Time clock.
The main-screen link opens the auth welcome screen, not the dashboard. No global
route changes or route protection have been introduced.

## Files

Updated: AuthLayout.jsx, LoginView.jsx, RegisterView.jsx.
Added: AuthControls.jsx (password visibility, notices, provider buttons),
WelcomeView.jsx, auth.css (scoped layout styles using existing theme tokens), README.md.

## Current implementation boundary

This is a frontend prototype, consistent with the supplied foundation. Both supplied
backend auth handlers return HTTP 501. Forms validate but do not send, persist, or log
personal information, issue tokens, create accounts, or claim authentication success.
Google, Apple, Microsoft, and GitHub buttons explain that sign-in is not connected.
Password reset similarly does not claim to send an email.

Registration replaces the display-name input with username, first name, last name,
date of birth, email, password, and confirm password. Validation covers required
fields, email format, username format, future birth dates, password length, and
matching passwords. Inputs use standard autocomplete attributes.

Before real integration, coordinate changes to the existing `/api/auth/register`
contract, which currently accepts only display_name, email, and password. The new
username, first_name, last_name, and date_of_birth fields need backend validation,
username uniqueness rules, and approved storage. Confirm password stays client-side.
OAuth providers require server-side setup, redirect handling, and provider credentials.
The existing shared API client and auth-state/route-protection work remain separate.

## Validation

Frontend production build succeeded after refreshing platform-specific dependencies
in the temporary test environment. All seven existing backend tests passed.
The returned archive retains the original dependency files and all non-auth files
byte-for-byte. Use `npm ci` if the ZIP's bundled node_modules does not match your OS.
