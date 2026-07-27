# AGAPE Cooperative Ledger

A ledger for the AGAPE Cooperative Society (FRSC) that replaces monthly bank
deduction schedules with a proper running ledger: import any bank's Excel
schedule, get one recomputed source of truth, and let each of the 200+
members log in to see only their own balances and history.

## How it works

- **Members table** — one row per person, keyed by their COOP./ACS account
  number (e.g. `ACS-002`), which is the durable identity across banks and
  months. Bank account numbers can and do change; this doesn't.
- **`deduction_transactions`** — an append-only ledger. Every import row
  becomes 4 transaction rows (savings, loan, electronic, other). **The
  file's own TOTAL column is never trusted or stored** — it's always
  recomputed as the sum of the 4 categories, because the source files
  contain real mismatches.
- **`balances`** — a running total per member per category, kept in sync
  automatically by a Postgres trigger every time a transaction is written.
  Nothing ever edits `balances` directly.
- **Re-importing the same file/sheet is safe.** Each import now gets a stable
  key from bank, month, year, batch, and filename, so re-uploading that same
  schedule updates the same import and transaction rows instead of duplicating
  them.
- **Duplicate monthly deductions are guarded.** If the same cooperative account
  appears again for the same month in another file/batch, the app stops the
  import and shows the duplicate rows. An admin can explicitly import anyway
  when the second deduction is intentional.
- **Manual adjustments** (a correction, a manual payment) post a
  transaction with no `import_id`, so they show up in history without being
  tied to a bank file.

## Column mapping (why any bank's file works)

The parser (`lib/parseSchedule.ts`) matches on normalized header text, not
exact wording, so both of these map to the same fields:

| Canonical field | UBA header    | FCMB header           |
|---|---|---|
| savings | `M/SAVINGS`   | `MONTHLY SAVING`      |
| loan | `LOAN DED.`   | `LOAN DEDUCTION`      |
| electronic | `PZ DED.`     | `ELECTRONIC DEDUCTION`|
| other | `LAND/OTHER`  | `OTHER DEDUCTION`     |

It also scans the first 10 rows of each sheet to find the real header row
(bank files have 3-4 letterhead/title rows above it, and the count varies),
and handles multi-sheet files like UBA's "BATCH I" / "BATCH II" workbook —
each sheet is parsed and can become its own import record.

Validated against both May 2026 files: 356 rows across 3 sheets, header row
auto-detected correctly on every sheet, all rows matched to the right fields,
and there are 0 genuine TOTAL mismatches. One member (`ACS-1156`) appears in
both the FCMB and UBA files for May 2026, so the duplicate guard will flag that
before it can inflate balances.

## Setup

### 1. Create a Supabase project

Free tier is plenty for 200+ members. supabase.com → New project.

### 2. Run the schema

Supabase dashboard → SQL Editor → paste the entire contents of
`supabase/schema.sql` → Run. It's safe to re-run.

### 3. Environment variables

```
cp .env.example .env.local
```

Fill in the three values from **Project Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (used only server-side, for the import route —
  never exposed to the browser)

### 4. Install and run

```
npm install
npm run dev
```

### 5. Create your first admin

a. In the Supabase dashboard, go to **Authentication → Users → Add user**
   and create your own login (email + password).
b. Copy that user's UUID.
c. In the SQL Editor, run:

```sql
insert into profiles (id, role, full_name)
values ('<paste-uuid-here>', 'admin', 'Your Name')
on conflict (id) do update set role = 'admin';
```

d. Sign in at `/login` — you'll land on the admin import screen.

### 6. Import your first month

Go to **Import schedule**, drop a bank's `.xlsx` file, check the preview
(new members and any total mismatches are flagged), pick the month/year,
and confirm. Members are created automatically from the file — you don't
need to pre-populate anything.

Prefer to add someone by hand instead of importing a file? Go to
**Members → + Add member** and enter their cooperative account number and
name directly. The same page also has a **Delete** button per member —
deleting removes that member's entire transaction history permanently (a
confirmation prompt says so), but if they had a linked login, the login
itself survives and just becomes unlinked.

### 7. How members get access

Two ways, both live in the app now — no SQL required for either:

**A. Member requests access themselves (`/signup`)**
1. They enter their name, cooperative account number, email, and password.
2. This creates their login and submits a request — nothing is linked yet.
3. You get a notification (bell icon, top right of any admin page) showing
   "*Name* has sent a request" with **Accept** / **Decline** right there, or
   review it on the **Requests** tab, which shows name, email, and account
   number together before you decide.
4. **Accept** links their login to that member record (creating the member
   record too, if it doesn't exist yet — so approving is always one click).
   **Decline** just marks it declined; they see that on their end and can
   fix their details and resubmit.

**B. You create their login directly (skip the request)**
On the **Members** page:
- Adding a brand-new member has a checkbox, *"Create a login for them now"*
  — choose **Send invite email** (they get a link to set their own
  password — nobody types or shares one) or **Set temporary password
  myself** (works even if your project's email sending isn't configured
  yet).
- For an existing member who doesn't have a login yet, click **Create
  login** on their row and pick the same way.

Either way, once linked, a member sees only their own balances and
history — enforced by row-level security in the database, not just hidden
in the UI.

### 8. If someone forgets their password

`/login` has a "Forgot password?" link → they enter their email → they get
a reset link → `/reset-password` lets them set a new one. Standard
Supabase Auth flow, nothing to configure beyond what you already have.

### 9. Import history

**Import history** (admin nav) lists every bank file that's ever been
uploaded — bank, month, batch, filename, row count, mismatch count, who
uploaded it, and when. Useful for "did May's UBA file already get
imported?" without digging into the database.

If your Supabase project has **email confirmation** turned on
(Authentication → Providers → Email) and someone signs up via `/signup`,
they'll need to click a confirmation link before they can sign in — the
request is still submitted immediately either way, so you can review and
accept it while they're doing that.

## Deploying

Push this repo to GitHub, import it into Vercel, add the same 3 environment
variables in Vercel's project settings, deploy. No other config needed.

## A note on notifications

The bell icon is an **in-app** notification — it shows pending requests
whenever an admin is looking at an admin page (the count is fetched fresh
on every page load/navigation). It doesn't send an email, SMS, or push
notification to your phone when a request comes in. If you want to be
alerted even when you're not looking at the app, that would need an email
or webhook integration added on top of this — happy to add that if it
matters to your officer.

## Already deployed and adding this feature?

If you set up the database from an earlier version of `schema.sql`, just
re-run the whole file again in the Supabase SQL editor — every statement
is written to be safe to re-run, and this update only *adds* the
`membership_requests` table and its policies without touching your
existing data.

## Open questions worth confirming with your officer

- **Loan balance meaning**: right now "loan repaid" is just the cumulative
  sum of loan deductions — there's no starting principal recorded, so the
  app can't yet show "amount remaining on loan." If you want that, we'd
  need a `loan_principal` field per disbursement and subtract repayments
  from it.
- **What "PZ" stands for** — the FCMB file calls this same column
  "ELECTRONIC DEDUCTION," so it's mapped as `electronic`, but worth
  confirming with your officer that both banks mean the same thing by it.
