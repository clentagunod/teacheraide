# Teacher.aide

A web platform where teachers manage attendance, track assignments, and see overdue tasks automatically.

**Stack:** React 18 · Vite · TypeScript (strict) · Firebase Authentication · Cloud Firestore

| Page | What it does |
| --- | --- |
| **Login** | Email + password sign-in (Firebase Auth), password reset, brute-force cool-down |
| **Dashboard** | Admins and supervisors view all classes; teachers see only their assigned section and subject |
| **Attendance** | Mark a class present/absent; teachers are restricted to their assigned section |
| **Learners** | Manage learners in authorized sections and assign subject-tagged tasks. Admins and supervisors can remove learners |
| **Subjects & Tasks** | Admins and supervisors manage subjects and tasks; teachers can create, assign and delete their own tasks |
| **Administration** | Admins create grade sections, teacher and supervisor accounts, import JSON learner rosters, assign each teacher one section and subject, and open the Google Sheets audit log |
| **Sign out** | Bottom of the sidebar |

An assignment is **overdue** when it is still *pending* and its due date and time have passed. This is computed live from the local date and time, so nothing needs to run in the background.

Administrators can import a JSON learner roster from the Administration page. The input format uses `Grade`, `Section`, and a `learners` array with `Surname`, `Name`, `Middle I`, and `Gender`; the referenced grade/section must already exist. Existing learners in that section are skipped by name. If Firestore denies the import, publish the current `firestore.rules` to the same Firebase project used by the app, confirm the learner rule permits `gender` and `middleInitial`, and verify the signed-in account has an Admin staff profile and that the section exists in that project.

Each learner-task assignment is stored independently, so a learner or section can receive multiple tasks across multiple subjects in one action and each learner-task pair has its own status. Duplicate assignments are skipped; the app allows selecting up to 10 different tasks per action. A due time is optional; blank times use **23:59 in the browser's local time zone**. Supervisors have school-wide access to learners, attendance, subjects, tasks and assignments, but cannot access Administration or manage staff accounts. Teachers can permanently delete only tasks they created; their assignments for their assigned section are deleted with the task.

---

## 1. Prerequisites

- **Node.js 20 or newer** (check with `node -v`)
- A free **Google account** for Firebase

## 2. Install

```bash
cd teacher-aide
npm install
```

## 3. Manual Firebase setup (one time)

### 3.1 Create the project
1. Go to <https://console.firebase.google.com> → **Add project** → name it (for example `teacher-aide`). Google Analytics is optional; you can turn it off.

### 3.2 Turn on Authentication
1. **Build → Authentication → Get started**.
2. **Sign-in method** tab → enable **Email/Password** (leave "Email link" off).
3. **Users** tab → **Add user** → create the initial administrator account.
4. After creating Firestore in step 3.3, add an initial admin profile document at `schools/teacher-aide/staff/{uid}` in the Firebase console. Set `email`, `displayName`, `role: admin`, and set `grade`, `sectionId`, `section`, and `subjectId` to `null`.
   - Teacher and supervisor accounts are created by an administrator in the app. Accounts removed from Firebase Authentication should also have their `schools/teacher-aide/staff/{uid}` profile removed in Firestore.

### 3.3 Create the database
1. **Build → Firestore Database → Create database**.
2. Choose a location close to your users (for the Philippines, `asia-southeast1` Singapore is a good choice). The location cannot be changed later.
3. Start in **production mode**. The rules in step 3.5 replace the defaults.

### 3.4 Connect the web app
1. **Project settings (gear icon) → General → Your apps → Web (`</>`)** → register the app (skip Hosting for now).
2. Copy the config values it shows.
3. In the project folder:

   ```bash
   cp .env.example .env
   ```

4. Fill in `.env`:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

   These identify your project and are safe to ship in a web app. Access is protected by sign-in and the Firestore rules, not by hiding these values. `.env` is already in `.gitignore`.

### 3.5 Publish the security rules (important)
The file `firestore.rules` is what actually protects your data. Without it, the database is either locked or open.

**Option A – Firebase CLI (recommended)**
```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick your project
firebase deploy --only firestore:rules,firestore:indexes
```

**Option B – Console:** Firestore Database → **Rules** tab → paste the contents of `firestore.rules` → **Publish**.
Also open Firestore Database → **Indexes** and confirm the `attendance` composite index (`sectionId`, `date`) and the `assignments` composite index (`sectionId`, `subjectId`) exist and reach **Enabled**. Publishing rules alone does not create the required indexes.

### 3.6 Deploy the Apps Script audit service

The Apps Script source is in `apps-script/`. Its only application function is to validate and append audit events to a private Google Sheet. Firebase Auth account creation and Firestore staff profile creation happen directly in the app; delete Firebase Auth users manually in Firebase Console.

1. Open <https://script.google.com> using the Google account that should own the audit spreadsheet. Create a standalone project.
2. Replace `Code.gs` with `apps-script/Code.gs`. In **Project Settings**, enable showing `appsscript.json` and replace its contents with `apps-script/appsscript.json`.
3. In **Project Settings → Script properties**, add:
   - `FIREBASE_PROJECT_ID`: the Firebase project ID used by `.env`.
   - `FIREBASE_WEB_API_KEY`: the web API key used by `.env` (`VITE_FIREBASE_API_KEY`).
   Do not put service-account keys or Firebase passwords in the script or app.
4. In Google Cloud Console, enable **Identity Toolkit API** and **Cloud Firestore API** for the Firebase project. Grant the Apps Script owner's Google account Cloud Datastore Viewer (`roles/datastore.viewer`) access so it can confirm audit actors' Firestore staff profiles. Authorize the script when prompted so it can verify sign-in tokens and write to the sheet.
5. In Apps Script, choose **Deploy → New deployment → Web app**. Set **Execute as** to your account and **Who has access** to **Anyone**. The script validates Firebase ID tokens and confirms the caller has a staff profile before accepting audit events. Deploy and copy the URL ending in `/exec`.
   - Only changes to `apps-script/Code.gs` or `apps-script/appsscript.json` require an Apps Script redeployment. Frontend-only changes do not. When the trusted server code changes, use **Deploy → Manage deployments → Edit**, select **New version**, then deploy; the existing web app URL stays the same.
6. Add `VITE_AUDIT_API_URL="<deployed /exec URL>"` to `.env` and restart the dev server. Existing `.env` files using `VITE_ADMIN_API_URL` continue to work. After the first audit event creates the sheet, find **Teacher.aide Audit Log** in the script owner's Google Drive and add `VITE_AUDIT_SHEET_URL="<sheet URL>"` if you want its admin-only link in the app. Keep the spreadsheet private; do not publish it.

Staff account creation uses a temporary secondary Firebase Auth app so creating an account does not sign out the administrator. The signed-in administrator then writes the staff profile directly to Firestore. If the profile write fails, the new Auth user is rolled back. Staff account creation does not wait for the audit request to finish; any audit delivery failure is reported separately after the account is saved.

### 3.7 Run it
```bash
npm run dev
```
Open the URL shown (usually <http://localhost:5173>) and sign in with the user from step 3.2.

**First-run order that works well:** Administration → add sections → add teachers → Learners → add learners → Subjects & Tasks → add tasks → assign tasks → Attendance → Dashboard.

---

## 4. Deploy (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting,firestore
```

`firebase.json` already includes single-page-app routing and security headers (CSP, `X-Frame-Options`, HSTS, `nosniff`, referrer and permissions policies).

After deploying, in **Authentication → Settings → Authorized domains**, make sure your hosting domain is listed (Firebase adds `*.web.app` and `*.firebaseapp.com` automatically; add a custom domain if you use one).

---

## 5. Security measures

| Layer | What is in place |
| --- | --- |
| **Access control** | Shared school records live under `schools/teacher-aide/*`. Firestore rules use staff profiles to enforce admin/teacher roles, section scope and learning-area scope. Hiding controls in the client is not the security boundary. |
| **Server-side validation** | `firestore.rules` validates document fields, types, grade ranges, class references, subject IDs, dates and assignment references. Only administrators can create teacher and supervisor staff profiles. |
| **Client validation** | `src/lib/validation.ts` trims, length-limits and checks every form before it is sent. It mirrors the rules. |
| **XSS** | React escapes all output. No `dangerouslySetInnerHTML`, no `eval`. The CSP header blocks inline and third-party scripts. |
| **Auth hygiene** | Generic "incorrect email or password" message (no account enumeration); neutral password-reset message; 30 s cool-down after 5 failed attempts (Firebase also rate-limits server-side); session-only sign-in unless "Keep me signed in" is ticked. |
| **Shared computers** | Firestore offline persistence is deliberately **off**, so no learner data is stored in the browser after the tab closes. |
| **Secrets** | Nothing secret is in the code. `.env` is git-ignored. |
| **Production build** | `console` and `debugger` stripped, source maps off. |
| **Resilience** | Error boundary for render crashes; friendly, non-technical error messages; destructive actions need confirmation; unsaved attendance changes are guarded. |

### Recommended extras (optional, in the Firebase console)
- **App Check** (reCAPTCHA v3) to stop requests from outside your site.
- **Budget alerts** under Google Cloud billing.
- **Password policy** under Authentication → Settings.
- Enable **multi-factor authentication** if your school requires it.

**Apps Script audit limitation:** app mutations submit audit events after their Firestore write through a one-way no-CORS request, so the browser cannot verify that Google accepted an individual audit row. For guaranteed logging of every possible Firestore write, use a trusted Firestore-triggered backend instead of client-submitted audit events.

### Privacy note
Learner names are personal data. Keep the Firebase project private to your school, give access only to staff who need it, and follow your school's data-privacy policy (in the Philippines, the Data Privacy Act of 2012).

---

## 6. Data model

School data is grouped under `schools/teacher-aide/`:

| Collection | Fields |
| --- | --- |
| `staff/{uid}` | `email, displayName, role, grade, sectionId, section, subjectId` |
| `subjects/{subjectId}` | `subjectId, name, color, active, createdAt, updatedAt` |
| `sections/{sectionId}` | `sectionId, grade, name, createdAt, updatedAt` |
| `learners/{id}` | `firstName, middleInitial (optional), lastName, gender ("female" \| "male"), grade, section, sectionId, createdAt, updatedAt` |
| `tasks/{id}` | `subjectId` (references `subjects/{subjectId}`), `title, description, createdBy, active, createdAt, updatedAt` |
| `assignments/{learnerId_taskId}` | `learnerId, taskId, subjectId, grade, section, sectionId, dueDate, dueTime (local HH:mm; defaults to 23:59), status, createdAt, updatedAt` |
| `attendance/{date_grade_sectionId}` | `date ("YYYY-MM-DD"), grade, section, sectionId, records { learnerId: "present" \| "absent" }, updatedAt` |

Design decisions worth knowing:
- **Subjects are admin-managed** in the Subjects & Tasks page. Math, English, and Science are seeded into Firestore once when the admin catalog is initialized; teacher profiles store subject IDs, not labels.
- **Subject deletion is protected**: the app checks for teacher, task, or assignment references before deleting the subject directly in Firestore.
- **Section assignment is explicit**: each teacher profile has one grade and section ID; multiple teachers can share a section.
- **The app starts with a clean shared dataset.** Existing documents under the previous `users/{uid}` layout remain untouched and are not migrated.
- **Due dates are plain `YYYY-MM-DD` text**, not timestamps, so "due today" never shifts by timezone.
- **Attendance id is deterministic** (`date_grade_sectionId`), so saving twice overwrites instead of duplicating.
- **Task lifecycle**: teachers can permanently delete only their own tasks and assignments in their assigned section. Admins and supervisors can permanently delete any task and its assignments in batches.
- **The app keeps the last 90 days of attendance live** for the dashboard; older days are still stored and are fetched on demand by the Attendance page.
- **Composite indexes** for teacher assignment and attendance queries are declared in `firestore.indexes.json`.
- A learner can have a given task only once (the assign dialog skips learners who already have it).

---

## 7. Project structure

```
src/
  components/      ui kit (Button, Modal, Toast, Field…), charts (SVG, no chart library), layout
  context/         AuthContext, StaffContext (roles) and DataContext (scoped realtime Firestore listeners)
  features/        auth · dashboard · attendance · learners · subjects · tasks · admin
  hooks/           useElementWidth
  lib/             firebase init, validation, analytics (pure logic), dates, errors
  services/        all Firestore reads/writes (the only place that talks to the database)
  styles/          design tokens + base + components + layout + pages
  types/           shared TypeScript types
firestore.rules    database security rules
firestore.indexes.json indexes for teacher-scoped queries
apps-script/       Apps Script audit service (Google Sheets)
firebase.json      hosting + security headers + rules wiring
```

Rule of thumb: **pages never call Firestore directly**; they call `services/`. Calculations (overdue, summaries, trends) live in `lib/analytics.ts` as pure functions with unit tests.

## 8. Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (analytics, validation, dates) |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## 9. Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Almost there — connect Firebase" screen | `.env` is missing or incomplete. Fill all four values and restart `npm run dev`. |
| "Incorrect email or password" for a correct login | Make sure Email/Password sign-in is enabled and the user exists (step 3.2). |
| Assignment fails with "You do not have permission to do that" | Publish the current `firestore.rules` (step 3.5). Confirm the learner, task, and subject documents exist, and that a teacher's assigned section and subject match the learner and task. |
| Data saves but never appears / endless loading | Check the browser console for `permission-denied`, and that Firestore was created in step 3.3. |
| Account creation fails | Confirm the administrator profile, published Firestore rules, and Email/Password sign-in provider are configured. |
| Teacher reports a missing class or task | Confirm the admin assigned exactly one existing section and one of the three learning-area tags. |
| Blank page after deploy | Run `npm run build` before `firebase deploy`; the `dist/` folder must exist. |
| Login works locally but not on your domain | Add the domain under Authentication → Settings → Authorized domains. |
| CSP blocks something after you add a feature | Adjust the `Content-Security-Policy` value in `firebase.json` (for example to allow another provider's domain). |

## 10. Ideas for later

CSV import of learners, printable reports, multi-school data separation, automatic audit delivery confirmation, and email summaries for overdue work.
