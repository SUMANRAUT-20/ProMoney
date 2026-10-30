# ProMoney authentication UI — wired to the Phase 1 backend

Owner: Arpan Khatiwada (Auth frontend + backend, Phase 1)
Backend: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
(see `docs/INTEGRATION_CONTRACT.md` section 3.2 and the Task 1 backend handoff).

## Open the pages

Run the frontend with `npm run dev` from `frontend/` and the backend from `backend/`:
- `/login`: login form — submits to the real API
- `/register`: registration form — submits to the real API
- `/login?view=welcome`: welcome screen (uses the existing login route)

The auth header contains Log in, Sign up, and a live Japan Standard Time clock.

## How the session works

- `frontend/src/context/AuthContext.jsx` (`AuthProvider` / `useAuth()`) owns the session.
  Login and register store the returned token in `localStorage` under `pm_auth_token`
  (the key `frontend/src/services/api.js` sends as `Authorization: Bearer <token>`)
  and the public user (`{ id, display_name, email }`) under `pm_auth_user`.
- On load, a stored token is verified with `GET /api/auth/me`. If the backend rejects
  it (401/expired) or is unreachable, the stored session is cleared — a stored string
  alone is never treated as a logged-in session.
- `ProtectedRoute.jsx` wraps the whole workspace in `App.jsx`: unauthenticated
  visitors are redirected to `/login`, and login returns them to the page they
  originally requested. Logout is available in the Topbar and the Sidebar; it clears
  both storage keys (the JWT is stateless, so there is no server logout call).
- Backend error messages are shown as returned (400 validation, 401 invalid
  email/password, 409 duplicate email). A network failure shows a distinct
  "could not reach the server" message.

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

## Still NOT implemented (kept honest in the UI)

- Apple / Microsoft / GitHub sign-in — buttons still explain they are not connected.
- Password reset — the link still explains no reset email is sent; there is no
  reset endpoint in the contract.

## Files changed in this wiring

- Added: `frontend/src/context/AuthContext.jsx`, `frontend/src/features/auth/ProtectedRoute.jsx`
- Updated: `LoginView.jsx`, `RegisterView.jsx`, `WelcomeView.jsx` (hint text),
  `frontend/src/services/api.js` (`getMe()`), `frontend/src/App.jsx` (AuthProvider +
  ProtectedRoute — shared file, Arpan-approved, needs Suman's review),
  `frontend/src/components/layout/Topbar.jsx` + `Sidebar.jsx` (user initials,
  display name, logout)

## Validation

See the delivery handoff for the exact commands run (frontend production build and
backend test suite). End-to-end register/login in a browser still requires a local
MySQL database with `backend/sql/schema.sql` imported and a backend `.env`
(`JWT_SECRET`, `DB_*`) — the same open verification item as the Task 1 backend.
