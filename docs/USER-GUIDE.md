# User guide — how each role uses NAWI Test Records

The system has three roles. One person can hold only one role, and nobody can review a record they created.

| Role | Does |
| --- | --- |
| **Administrator** | Sets up the laboratory, manages accounts and the reference-weight register. Can also create and review records. |
| **Lab technician** | Records instruments, enters test readings, attaches photos, submits records for approval. |
| **Inspector** | Reviews submitted records and approves (issuing the final report) or returns them with remarks. |

---

## 0. Installing (once, by whoever runs the server)

1. `npm install`, then `npm run dev` (or `npm start` in production, behind HTTPS with `SECURE_COOKIES=true` and
   `PUBLIC_URL` set to the address people will use).
2. The server console prints a **setup code** such as `K7QM-3XWP`. Give it only to the person who will be administrator.

---

## 1. Administrator

### First sign-in: set up the laboratory

1. Open the web app. With no accounts yet it shows **First-run setup**.
2. Enter the **setup code** from the server console, your full name, a username, your office and a password. A live
   checklist shows the password rules (10+ characters, a letter and a digit/symbol, not containing your name or
   username, not a common password).
3. **Create administrator and sign in.** The setup page is now closed for good. You land on **Users**, which lists the next steps.

### Register the reference weights

Records cannot be submitted without in-date standard weights, so do this before technicians start.

1. **Reference weights → Add weight set.**
2. Enter the set's name, its OIML R 111 class (E1…M3), the smallest and largest weight in the set, the calibration
   certificate number, the calibration lab and date, and the **due date**.
3. Repeat for each set. A set is flagged *Due in N days* 30 days before its due date and *Expired* after it, and the
   dashboard warns everyone. Records that use an expired set are blocked from submission, so recalibrate the set and update its due date.

### Optional: load sample data to check the calculations

**Reference weights → Sample data** (or the **Sample data** card on the empty dashboard):

- **Add sample weight sets** registers four in-date sets (F1 1 mg–5 kg, E2 1 mg–200 g, M1 10–20 kg, M1 50 kg). They are
  tagged *Sample* and can be edited or deactivated like any other set, or used alongside sets you enter yourself.
- **Add sample test records** adds four complete records numbered `SAMPLE/NAWI/…`, each with a panel comparing the
  hand-calculated result with the app's result:

  | Record | Instrument | Expected | What it checks |
  | --- | --- | --- | --- |
  | S-01 | Class III 30 kg, e = 5 g, tare | Pass | An error exactly equal to the MPE (15 kg: +7.5 g) passes |
  | S-02 | Class III 30 kg, no tare | Fail — eccentricity | At 10 kg = 2000e the MPE is 1e = 5 g; corner 3 reads +6.5 g |
  | S-03 | Class III 150 kg, e = 50 g | Fail — repeatability | Each reading within ±50 g, but the spread is 70 g |
  | S-04 | Class II 200 g, e = 0.01 g, d = 0.001 g, in service | Pass | In-service MPE is 2× initial; switch to *initial* and it fails |

  They are left *In process*, so you can also submit one and have an inspector approve it to try the workflow; their
  reports are watermarked “Sample data — not valid”.
- **Remove sample data** deletes all sample records and every sample weight set not used by a real record.

### Add staff

1. **Users → Add user.** Enter the full name, a username (used to sign in, cannot be changed later), the **role**, office
   and optionally an email. You do **not** set a password.
2. **Create user.** A panel shows a one-time **activation link**. Choose **Copy link** and give it to the person in
   person or through official email. It works once, expires after 72 hours, and is shown only once.
3. The user appears as *Awaiting activation* until they use the link. If the link is lost or expires, choose
   **New activation link**, which also cancels the old one.

### Day-to-day account care

| Situation | What to do on **Users** |
| --- | --- |
| Someone forgot their password | **Reset password** → give them the new one-time link. Their old password keeps working until they use the link; once used, all their sessions end. |
| Account shows *Locked* (5 wrong passwords) | Confirm it was them, then **Unlock**. It also unlocks by itself after 15 minutes. |
| Someone changes role | **Edit → Role**. They are signed out everywhere so the new permissions apply immediately. |
| Someone leaves | **Edit → untick Account enabled**. They are signed out at once. Their records and signatures stay on file. |
| Check for suspicious activity | The **Security log** lists sign-ins, failed attempts (red dot), lockouts and account changes. |

The system always keeps at least one active administrator, and you cannot disable yourself or change your own role.

### Also

- **Profile:** draw or upload your signature. It is printed on reports you approve.
- **Report repository → Export CSV:** a register of issued reports for any filter (e.g. *Approved*, a date range).

---

## 2. Lab technician

### Activate your account (once)

1. Open the **activation link** the administrator gave you. It greets you by name and shows your username.
2. Choose a password that meets the checklist, confirm it, then choose **Activate account and sign in**.
3. You land on **Profile**. Draw or upload your **signature** and choose **Save signature**. It is applied when you submit.

Afterwards sign in normally with your username and password. If you forget your password, ask the administrator for a
reset link. The system has no self-service reset, because there is no email service.

### Record an instrument

1. **New test record** (or **Duplicate** on an existing record for another unit of the same model: manufacturer, model and
   specification are copied; you enter the new serial number and today's conditions).
2. Fill in the four sections:
   - **Manufacturer details:** name, address, country, contact.
   - **Model information:** model, **serial number**, year, approval certificate, software version.
   - **Instrument specification:** accuracy class, unit, **Max**, **Min**, **e**, d, tare device and T. It is checked live
     against OIML R 76-1 Table 3. For example, class III with e = 0.005 kg requires Min ≥ 20e = 0.1 kg. The
     **Metrological summary** on the right shows n = Max/e and the MPE bands.
   - **Laboratory & environmental conditions:** test date, temperature, humidity and pressure at start and end.
3. **Save draft** if you are interrupted, or **Save & continue to tests** when the details are complete.

### Enter test readings

1. On the record, **OIML R 76 tests** lists the applicable tests with a progress bar. Open each with **Enter readings**:
   zero-setting, weighing performance, eccentricity, repeatability, discrimination and tare (tare applies only if the
   instrument has a tare device).
2. The suggested R 76 test loads are pre-filled. Type indications (and ΔL for the changepoint method). Error, corrected
   error, MPE and **Pass/Fail** update per row as you type, and the tab shows the live result.
3. **Ctrl + S** saves without leaving the page. **Save & next** moves to the next test, and **Save & close** returns to the record.

### Reference weights and photos

1. **Reference weights → Change:** tick the sets you used and choose **Save selection**. Each test load is composed
   from the sets and checked against ⅓ of the instrument's MPE.
2. **Photographs:** add photos of the instrument, data plate and seals with a caption. They go into the report.

### Submit

1. The **Submission** card lists anything still missing (fields, tests, weights, expired certificates). When it shows
   ✓, choose **Submit for approval**. This signs the record electronically and locks it.
2. The status becomes *Awaiting approval* and the inspector's queue and **Approvals** badge update.
3. If the inspector **returns** it, it appears first in **My open work** on your dashboard with their remarks in red on the
   record. Correct it and submit again.
4. **Preview draft (PDF)** at any time shows the watermarked report.

### Correct an approved record

Approved records are locked. On the record choose **Create revision**, give a reason, and a new revision (`…-R1`) opens
with the same data for you to correct and resubmit. The original stays on file marked *Superseded*.

---

## 3. Inspector

### Activate your account (once)

Same as the technician: open the activation link, set your password, then add your **signature** on **Profile** (it is
printed on reports you approve).

### Review submissions

1. The dashboard **Review queue** lists submissions oldest first, with how long each has waited, and the **Approvals**
   item in the sidebar shows a count.
2. Open a record. Check:
   - the instrument details and test conditions;
   - each test (**View**), where failing rows are marked in red with their error and MPE;
   - **Reference weights**, where every load must pass the ⅓-MPE check;
   - photographs, and the **History** card showing who changed what and when.
3. Decide in the **Inspector review** card:
   - **Approve** (remarks optional). The record is signed with your name and time, locked, the final PDF is generated
     and its SHA-256 fingerprint stored. A record whose tests failed can still be approved as **non-conforming**. The
     report then states *Fail*, and you can say why in the remarks.
   - **Reject** (remarks required). The record goes back to the technician with your remarks.
4. You cannot review a record you created. Another inspector or an administrator must review it.

### After approval

- **Download report (PDF)** or **Export to Word**. Every page carries a QR code and the fingerprint.
- Anyone, including someone without an account, can scan the QR code or open the **Public verification page**. It
  recomputes the fingerprint and shows *Authentic*, or flags that the record changed or was superseded.

---

## Signing in and security (everyone)

- Sessions end after 60 minutes of inactivity or 10 hours in total. You'll be asked to sign in again.
- **Profile → Where you are signed in** lists your sessions; sign out any you don't recognise, or **Sign out all others**.
- Changing your password (**Profile → Change password**) signs you out on every other device.
- Five wrong passwords in a row lock the account for 15 minutes. Ask the administrator if you need it sooner.
- **Ctrl + K** opens quick search: type a reference, serial number, manufacturer or page name.
