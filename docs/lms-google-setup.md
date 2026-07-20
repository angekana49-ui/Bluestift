# Google Classroom integration — setup

The `/school` → **LMS** tab can connect a school's Google Workspace to import
courses. It's a standard server-side OAuth 2.0 authorization-code flow; tokens are
stored in `schools.lms_connections` and courses land in `schools.lms_class_mappings`.

## What you (the operator) must do once

1. **Google Cloud project** → console.cloud.google.com → create/select a project.
2. **Enable the API**: APIs & Services → Library → enable **Google Classroom API**.
3. **OAuth consent screen**: configure it (External or Internal for a Workspace),
   add the scopes below, and add your test users while it's in "Testing".
4. **Credentials** → Create credentials → **OAuth client ID** → type **Web
   application**. Add **Authorized redirect URIs**, one per origin you run on:
   - `http://localhost:3000/api/school/lms/google/callback` (local dev)
   - `https://<your-domain>/api/school/lms/google/callback` (production)
5. Copy the client id + secret into `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

## Scopes requested

```
openid  email  profile
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.rosters.readonly
```

`access_type=offline` + `prompt=consent` are sent so Google returns a
**refresh token** on first consent (stored for later syncs; Google only returns it
once, so we keep the old one if a later exchange omits it).

## Flow (code map)

| Step | Route | What it does |
|---|---|---|
| Connect | `GET /api/school/lms/google/start` | admin_master only → sets a CSRF `state` cookie → redirects to Google consent |
| Callback | `GET /api/school/lms/google/callback` | verifies `state` → exchanges code for tokens → upserts the `google_classroom` connection |
| Sync | `POST /api/school/lms/google/sync` | refreshes the token if expired → `courses.list` → inserts new `lms_class_mappings` (class_id null until mapped) |
| Map | `PATCH /api/school/lms/mappings` | assigns an internal class to an imported course |

Helpers live in `lib/lms/google.ts`. Until `GOOGLE_CLIENT_ID/SECRET` are set,
`/start` redirects back with `?lmsError=not_configured` and the button is inert.

## Not done yet

Roster import (matching Google students to Bluestift accounts) and a recurring
background sync — today sync is manual (the **Sync courses** button) and only pulls
the course list. Other providers (PowerSchool/Canvas/MINESEC) remain a manual
registry with no live sync.
