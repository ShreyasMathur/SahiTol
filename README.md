# NAWI Test Records — Legal Metrology (SIH 2026 · PS 26035)

Records OIML R 76 test data for Non-Automatic Weighing Instruments, evaluates
compliance automatically, routes records through technician → inspector
approval, and issues fingerprinted PDF / Word test reports.

## Run

```bash
npm install
npm run dev              # API on :4000, web app on :5173 (Vite proxies /api)
npm test                 # calculation engine and password-policy unit tests
```

Requires Node ≥ 22.13 (uses the built-in `node:sqlite`, so nothing native to compile).
The database is created empty on first start at `server/data/nawi.db`. There are no built-in accounts or sample data.

### First run

1. Start the server. While no accounts exist it prints a one-time **setup code** in its console, e.g.
   `FIRST-RUN SETUP … ABCD-1234`. The code changes on every restart.
2. Open the web app. It goes to **First-run setup**; enter the code and create the administrator account.
3. The administrator registers reference weights and adds the other staff (see [docs/USER-GUIDE.md](docs/USER-GUIDE.md)).

### Sample data (optional)

Nothing is loaded by default. An administrator can load, and later remove, four sample weight sets and four sample
records from **Reference weights → Sample data**. Each record's verdicts were calculated by hand (the arithmetic is in
`shared/src/samples.js`), the record page shows *expected vs calculated* side by side, and `npm test` checks the
engine against the same expectations (`shared/test/samples.test.js`).

### Configuration (environment variables, server)

| Variable               | Default                      | Purpose                                                        |
| ---------------------- | ---------------------------- | -------------------------------------------------------------- |
| `PUBLIC_URL`           | `http://localhost:5173`      | Base URL of the web app, used in activation links and report QR codes |
| `SECURE_COOKIES`       | `true` when `NODE_ENV=production` | Send the session cookie only over HTTPS — **must be on in production** |
| `SESSION_HOURS`        | `10`                         | Absolute session lifetime                                      |
| `SESSION_IDLE_MINUTES` | `60`                         | Sign out after this long without activity                      |
| `LINK_HOURS`           | `72`                         | Validity of activation / password-reset links                  |
| `SETUP_CODE`           | random                       | Fix the first-run setup code (for scripted installs)           |
| `LAB_NAME`             | `Legal Metrology Laboratory` | Shown in report headers                                        |
| `PORT`, `DB_FILE`, `CORS_ORIGIN` | —                  | Server port, SQLite path, allowed origin                       |

### Authentication and accounts

- **No self-registration and no shared passwords.** The administrator creates each account with a role; the system
  issues a one-time **activation link** (valid 72 h, single use) that the administrator hands to the person, who then
  chooses their own password. Administrators never see or set passwords. Forgotten passwords work the same way with a
  **reset link**.
- **Password policy** (shared by browser and server): at least 10 characters, a letter plus a digit or symbol, must not
  contain the username or name, and must not be a common password. Stored as bcrypt (cost 12).
- **Sessions** are server-side. The browser holds only a random id in an `httpOnly`, `SameSite=Strict` cookie; the
  server stores its SHA-256. Sessions end after `SESSION_IDLE_MINUTES` of inactivity or `SESSION_HOURS` in total, on
  sign-out, and immediately for every device when the password is changed or reset, the role changes or the account is
  disabled. Users can see their sessions and sign out the others from **Profile**.
- **Brute-force protection:** 5 consecutive wrong passwords lock the account for 15 minutes (an administrator can unlock it
  sooner), plus a per-network throttle on sign-in, setup and link endpoints. Unknown usernames and wrong passwords get
  the same message.
- **CSRF:** besides the SameSite cookie, every state-changing API call must carry an `X-Requested-With: nawi` header.
- **Security log:** sign-ins, failed attempts, lockouts, account creation, role changes and password resets are listed on
  the **Users** page.
- At least one active administrator always remains; nobody can disable themselves or change their own role.

## What it does

- **Data entry** — manufacturer, model, instrument specification (class, Max, Min, e, d, tare) and
  laboratory conditions, validated live against OIML R 76-1 Table 3 (n range, Min lower limit,
  e = 1/2/5 × 10ᵏ, e–d relationship) and physical plausibility.
- **Six R 76 tests** — zero-setting accuracy, weighing performance (increasing/decreasing, E0-corrected),
  eccentricity, repeatability, discrimination and tare. Each form suggests the R 76 test loads, supports the
  changepoint (ΔL) or direct-reading method, and shows E, Ec, MPE and pass/fail per row as you type.
- **Calculation engine** (`shared/`) — decimal.js arithmetic; MPE per Table 6 (initial and in-service);
  identical code runs in the browser and on the server, so the live result is the official result.
- **Reference weights register** — OIML R 111 classes and certificates; for every applied load the
  weights are composed from the selected sets and checked against the ⅓-MPE rule (R 76-1 3.7.1);
  expired certificates block submission.
- **Workflow & RBAC** — technicians enter and submit; inspectors approve or reject with remarks; admins
  manage users and the weights register. Nobody can review their own record.
- **Signatures & integrity** — signing captures name, role, time and the user's signature image. On approval
  the record is locked, a SHA-256 fingerprint of its content is computed, and the final PDF is generated and
  stored byte-for-byte. The QR code on each page links to a public verification page that recomputes the
  fingerprint and flags any change.
- **Revisions & audit trail** — corrections after approval open a new revision (`…-R1`); the original stays on
  file marked superseded. Every edit, reading, photo and decision is logged with field-level changes.
- **Reports** — PDF (pdfmake) and editable Word (docx) from one shared report model: identification,
  metrological characteristics, conditions, reference standards, summary, full observation tables,
  photographs and signatures. Drafts are watermarked.
- **Dashboard & repository** — status tiles, a role-aware work queue (inspectors: oldest submissions first;
  technicians: returned records first), instruments tested per month by outcome, record pipeline, conformity rate,
  average review time, workload per technician and reference-weight certificate alerts; repository search with
  status, result, class, manufacturer and test-date filters, removable filter chips, sortable columns, paging,
  PDF download and **CSV export** of the filtered set.
- **Productivity** — `Ctrl/⌘ K` quick search across records and pages; `Ctrl/⌘ S` saves test readings in place;
  **Duplicate** starts a new record for another unit of the same model (manufacturer, model and specification
  prefilled); lifecycle stepper and test progress on each record; toast confirmations for every save and decision.

## Layout

```
shared/src/              @nawi/shared — used by client and server
  mpe.js                 MPE bands (R 76-1 Table 6), mpeSchedule
  errors.js              E = I + ½d − ΔL − L, Ec = E − E0
  validation.js          spec (Table 3), manufacturer, model, environment
  tests/                 one module per test + loads.js (suggested loads) + registry
  weights.js             R 111 MPE table, load composition, ⅓-MPE check
  readiness.js           everything required before submission
  rbac.js                permissions and workflow transitions
  auth.js                password policy and username rules
  samples.js             optional sample weight sets and records with hand-calculated verdicts
server/src/
  routes/                auth, records, weights, users, calc, public (verify)
  services/              records, users, sessions, weights, attachments, audit, reports, samples
  reports/               model.js (shared content) → pdf.js / docx.js
  setup.js               first-run setup code
client/src/
  pages/                 Dashboard, RecordEditor, RecordDetail, TestEntry, Repository,
                         Weights, Users, Profile, Verify, Login, Setup, Activate
  features/tests/        the six observation forms and their live-evaluation hook
  features/record/       data-entry sections and record detail cards
```

See [docs/USER-GUIDE.md](docs/USER-GUIDE.md) for how each role uses the system, step by step.
