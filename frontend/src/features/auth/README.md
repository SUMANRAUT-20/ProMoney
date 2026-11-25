# ProMoney authentication UI — wired to the Phase 1 backend

Owner: Arpan Khatiwada (Auth frontend + backend, Phase 1)
Backend: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
(see `docs/INTEGRATION_CONTRACT.md` section 3.2 and the Task 1 backend handoff).

## Open the pages

Run the frontend with `npm run dev` from `frontend/` and the backend from `backend/`:
- `/login`: login form — submits to the real API
- `/register`: registration form — submits to the real API
- `/` and `/landing`: public landing and direct demo entry. The old welcome query redirects to `/`.

The landing modal, `/login`, and `/register` use the same auth view with a login/sign-up switch.

## How the session works

- `AuthContext.jsx` verifies the httpOnly session cookie with `GET /api/auth/me`.
- `ProtectedRoute.jsx` sends signed-out visits to the login form and preserves the
  requested page. On logout the Sidebar calls the existing endpoint, then the route
  guard returns the user to the landing at `/`.
- Client-side sign-up validation matches the server rules, including 10–128
  password characters with at least one letter and one digit. Field errors appear
  under their input and clear when fixed. Credential and demo submits show
  confirmation before navigating.

## Register fields — contract decision

The approved contract accepts only `display_name`, `email`, and `password`, and the
`users` table has no `username` / `date_of_birth` columns. The form therefore keeps
first name + last name and combines them into `display_name` (used, never discarded),
and the old UI-only username and date-of-birth inputs were removed rather than
collecting personal data that cannot be stored. Restoring them requires a contract
amendment and a schema migration approved by Arpan + Suman.
Confirm password stays client-side only.

## Google Sign-In (connected, ID-token flow)

- `GoogleSignInButton.jsx` renders Google's official button via Google Identity
  Services; the returned ID token goes to `POST /api/auth/google`, which verifies
  it (RS256 signature against Google's JWKS, issuer, audience = our client ID,
  expiry, verified email) and returns a ProMoney JWT in the usual envelope.
- First Google sign-in creates the account (with the 8 default categories);
  a Google email matching an existing password account links to that account
  (`google_sub`, migration `003_add_google_signin_to_users.sql`) — one user,
  one account, both sign-in methods.
- Configuration: `VITE_GOOGLE_CLIENT_ID` in `frontend/.env` and `GOOGLE_CLIENT_ID`
  in `backend/.env` (same value; it is a public identifier, not a secret — this
  flow uses no client secret). The client ID's Authorized JavaScript origins in
  Google Cloud Console must include the frontend origin (e.g. http://localhost:5173).
  Without `VITE_GOOGLE_CLIENT_ID`, the button area explains Google sign-in is
  not configured instead of rendering a dead button.

## Social sign-in scope

- Google is the ONLY social provider offered. Apple / Microsoft / GitHub
  buttons were REMOVED from the UI on 2026-10-30 (Arpan's decision) rather
  than shown as not-connected placeholders.

## Still NOT implemented (kept honest in the UI)

- Password reset — the link still explains no reset email is sent; there is no
  reset endpoint in the contract.

## Validation

See the delivery handoff for the exact commands run (frontend production build and
backend test suite). End-to-end register/login in a browser requires the backend
running with a `.env` that sets `JWT_SECRET`.
