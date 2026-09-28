<p align="center">
  <img src="public/favicon.svg" alt="KD Demo Bank logo" width="96" height="96" />
</p>

# KD Demo Bank — Dummy Core Banking System for Playwright Practice

A realistic, **frontend-only** mini core banking system built for practising manual testing, test-case writing and
UI automation (for example with Playwright). There is no backend, database or API: all data and business rules live in the
browser and are persisted in `localStorage`.

You can log in as different users (branch manager, teller, auditor, ...), onboard customers, open deposit accounts,
create and approve loans, generate repayment schedules, collect installments, post teller transactions and view
statements. Every table is dynamic, so you can practise **extracting data from a table row, storing it in variables
and reusing it in the next module**.

📖 A full **User Guide** is built into the app: open **User Guide** in the sidebar, the link on the login page, or
go to `/guide`.

**Two ways to use it:**

| | How | Needs |
|---|---|---|
| 🌐 **Online** | Open the GitHub Pages link: `https://<your-username>.github.io/<repo>/` | Only a browser |
| 💻 **Locally** | Clone, `npm install`, `npm run dev` → http://localhost:5173 | Node.js 18+ |

Both versions are identical and fully functional — see [Use it online](#use-it-online-github-pages) and
[Where is my data saved?](#where-is-my-data-saved).

---

## 1. Quick start (run locally)

Requirements: **Node.js 18 or newer** (tested with Node 22). Check with `node -v`.

```bash
git clone <your-repo-url>
cd Dummy-banking-website
npm install              # first time only
npm run dev              # starts the app at http://localhost:5173
```

Open http://localhost:5173 and click **Use** next to any demo user on the login page.
Keep the terminal open while you use the app — pressing `Ctrl+C` stops it.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with live reload (http://localhost:5173) |
| `npm run build` | Type-checks and builds the production files into `dist/` |
| `npm run preview` | Serves the production build (http://localhost:4173) |
| `npm run typecheck` | TypeScript check only |
| `npm run build:pages` | Production build for GitHub Pages (used by the deploy workflow) |

> Opening `index.html` directly (double-click) does **not** work — the app must be served by `npm run dev` or
> `npm run preview`.
>
> **"Port 5173 is already in use"** means the app is already running in another terminal. Close that one, or start
> on another port with `npx vite --port 5174`.

### Reset / seed data
* **Reset Demo Data** button (top bar, and on the login page) restores the original seed.
* Add `?reset=1` to any URL (e.g. `http://localhost:5173/login?reset=1`) to reset and log out — handy in tests.
* A fresh browser profile / automation browser context starts with empty storage, so it always gets the seed data.

---

## Use it online (GitHub Pages)

Because the app has no backend, GitHub Pages can host it for free and **everything works in the browser** — logins,
roles, forms, tables, drag-and-drop, uploads, downloads and sessions. Nobody needs to clone or install anything.

**One-time setup (repository owner):**
1. Push the project to GitHub (see [Uploading to GitHub](#9-uploading-to-github)).
2. In the repository open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Open the **Actions** tab: the *Deploy to GitHub Pages* workflow builds and publishes the site (about 1–2 minutes).
4. The site is live at `https://<your-username>.github.io/<repo>/` (the link is also shown in the workflow run).

Every later push to `main` redeploys automatically. The workflow is in `.github/workflows/deploy.yml`; it builds
with `BASE_PATH=<repo name>` so all links work under the `/<repo>/` sub-path, and adds a `404.html` copy of the app
so deep links such as `/<repo>/customers/CUS-DHK-000002` and page refreshes work.

**Playwright against the hosted site** — set the base URL to the site *with* the trailing slash and use paths
**without** a leading slash (a leading `/` would drop the `/<repo>/` part):

```bash
pytest --base-url https://<your-username>.github.io/<repo>/
```
```python
page.goto("customers")          # ✔ https://<user>.github.io/<repo>/customers
page.goto("login?reset=1")      # ✔ reset demo data
page.goto("/customers")         # ✘ https://<user>.github.io/customers  (404)
```

## Where is my data saved?

There is no server, so **each visitor's data lives only in their own browser** (`localStorage`):

* It survives page refreshes and browser restarts.
* It is private to that browser and device — visitors never see or change each other's data, and every new visitor
  starts with the same demo data.
* It is removed if you clear the browser's site data, and a private/incognito window starts fresh every time.
* **Reset Demo Data** (or `?reset=1`) restores the original demo data at any time.
* To keep or move your data, use **User Profile → Data Backup**: *Export Data* downloads a JSON file, *Import Data*
  loads it back — in the same browser later, or in another browser or computer.
* Playwright: every new browser context has empty storage, so each test starts from clean seed data automatically.
  To keep a logged-in session between tests, use Playwright's `storage_state`.

---

## 2. Demo credentials

| Username | Password | Role | Branch | What to use it for |
|---|---|---|---|---|
| `admin` | `Admin@123` | Admin | All branches | Everything, incl. user management |
| `manager.dhaka` | `Manager@123` | Branch Manager | Dhaka | Checker: KYC, approvals, disbursement, freeze, maturity, reversal |
| `manager.ctg` | `Manager@123` | Branch Manager | Chattogram | Checker for Chattogram |
| `manager.sylhet` | `Manager@123` | Branch Manager | Sylhet | Checker for Sylhet |
| `cso.dhaka` | `Cso@123` | Customer Service Officer | Dhaka | Create/edit customers, open deposit accounts |
| `cso.ctg` | `Cso@123` | Customer Service Officer | Chattogram | Same, for Chattogram |
| `loan.dhaka` | `Loan@123` | Loan Officer | Dhaka | Create loans, generate schedules, collect installments |
| `loan.ctg` | `Loan@123` | Loan Officer | Chattogram | Same, for Chattogram |
| `teller.dhaka` | `Teller@123` | Teller | Dhaka | Deposits, withdrawals, transfers, loan repayments |
| `teller.sylhet` | `Teller@123` | Teller | Sylhet | Same, for Sylhet |
| `auditor` | `Audit@123` | Auditor | All branches | Read-only access to everything + reports + audit log |
| `locked.user` | `Locked@123` | CSO | Sylhet | **Locked** — negative login test |

Three wrong passwords in a row lock any account (admin can unlock it in **User Management**).

---

## 3. Why this tech stack

| Choice | Why it suits an automation practice app |
|---|---|
| **React 18 + TypeScript** | Component model keeps forms/tables consistent; types catch business-logic mistakes. |
| **Vite** | Instant dev server, one-command production build and preview server. |
| **Tailwind CSS** | Styling without a component library that injects random IDs or portals — the DOM stays predictable. |
| **React Router** | Stable, bookmarkable URLs (`/customers/CUS-DHK-000002`) you can `page.goto()` directly. |
| **React Hook Form + Zod** | One validation layer shared by forms and business services, so messages are identical everywhere. |
| **localStorage** | Data survives refreshes; each Playwright context is isolated automatically. |

No other runtime dependencies. Data tables are a small custom component so every row, cell and button has a stable selector.

---

## 4. Features and business rules

### Branches and access
* Three branches: **Dhaka (DHK)**, **Chattogram (CTG)**, **Sylhet (SYL)**, 10 seeded customers each.
* Branch users only see their own branch's customers, accounts, loans, transactions and audit logs. Opening another
  branch's record by URL shows **Access Denied**. Admin and Auditor see all branches (with a *Branch* filter).

### Roles and permissions
| Capability | Admin | Branch Mgr | CSO | Loan Officer | Teller | Auditor |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| View customers / accounts / statements | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Create / edit customers | ✔ | ✔ | ✔ | | | |
| Activate / deactivate customer, verify KYC | ✔ | ✔ | | | | |
| Open deposit account | ✔ | ✔ | ✔ | | | |
| Approve accounts, freeze, close, maturity, interest | ✔ | ✔ | | | | |
| Create loan, generate schedule | ✔ | ✔ | | ✔ | | |
| Approve / disburse / write off loan | ✔ | ✔ | | | | |
| Collect loan installment | ✔ | | | ✔ | ✔ | |
| Post teller transactions | ✔ | | | | ✔ | |
| Approve large withdrawals, reverse transactions | ✔ | ✔ | | | | |
| Reports, audit log | ✔ | ✔ | | | | ✔ |
| User management | ✔ | | | | | |

Menu items and buttons are hidden for roles without permission, and the service layer re-checks every action.

### Customers
* 5-step onboarding form: Personal → Contact & Identity → Address → Financial & Branch → Review.
* Customer ID is generated per branch: `CUS-DHK-000031`.
* Validation: names (3–60 letters), age ≥ 18, BD mobile `01[3-9]XXXXXXXX`, email, NID of 10/13/17 digits,
  address length, income, and *Business* customers need a Business Name and Trade License (`TL-1234567`).
* **Duplicate detection**: same NID or mobile is blocked; same name + date of birth shows a warning you can override.
* KYC status (Pending / Verified / Rejected). Changing a verified customer's NID resets KYC to Pending.
* A customer with an open loan cannot be deactivated.

### Deposit accounts
| Product | Rule highlights |
|---|---|
| Savings (`SAV`) | Min opening 500, 3.50%, minimum balance 500, one per customer, monthly interest posting |
| Current (`CUR`) | Min opening 5,000, no interest, no minimum balance |
| FDR (`FDR`) | Min 10,000, tenure 3/6/12/24/36 months (6.00–7.50%), no deposit/withdrawal before maturity, nominee required |
| DPS (`DPS`) | Monthly installment 500–50,000 in multiples of 500, 3/5/10 years, deposits must equal the installment |
| MBS (`MBS`) | Min 50,000, 3/5 years, monthly profit to a **linked** Savings/Current account |

* Account number: `DHK-SAV-0000012`. Fields change with the selected product.
* Opening date: today or up to 30 days back. New accounts are **Pending Approval** until a checker approves them,
  which requires the customer's KYC to be Verified; approval posts the opening deposit.
* Freeze/unfreeze (frozen accounts accept credits, block debits), close (balance must be zero; term deposits only
  after maturity), maturity processing (renew FDR, transfer to linked account, or cash).
* Seeded matured FDR ready for processing: **`DHK-FDR-0000010`**.

### Loans and repayment schedules
| Product | Amount (BDT) | Rate | Tenure | Notes |
|---|---|---|---|---|
| Personal | 50,000 – 2,000,000 | 9–14% | 12–60 m | Installment ≤ 50% of monthly income |
| Business | 500,000 – 20,000,000 | 10–15% | 12–84 m | Business customers only |
| Home | 1,000,000 – 30,000,000 | 7.5–10% | 60–300 m | Installment ≤ 50% of income |
| SME | 200,000 – 10,000,000 | 9–13% | 12–60 m | Business customers only |
| Consumer | 20,000 – 500,000 | 12–16% | 6–36 m | Installment ≤ 50% of income |

* Loan number: `LN-CTG-PER-000007`. Frequencies: Monthly, Quarterly, Half-Yearly (tenure must be a multiple).
* Installment = reducing-balance EMI `P·r·(1+r)^n / ((1+r)^n − 1)`, `r` = annual rate ÷ periods per year, rounded to
  2 decimals; the last installment absorbs rounding so the balance ends at exactly 0.
* Workflow: **Applied → Approved → Active (disbursed) → Closed**, or Rejected / Written Off. Maximum 2 open loans per customer.
* Schedule columns: Installment No, Due Date, Opening Principal, Installment, Principal, Interest, Closing Principal,
  Status (Pending / Paid / Overdue). Installments must be paid **in order**; paying the last one closes the loan.
* A write-off requires at least 3 overdue installments (try **`LN-SYL-SME-000001`**).

### Transactions, statements and more
* Teller: cash deposit, cash withdrawal, fund transfer, loan repayment. Checks: insufficient funds, minimum balance,
  frozen account, product restrictions, DPS installment amount.
* Withdrawals above **500,000** go to the approval queue before posting.
* **Reversal**: same-day cash deposits/withdrawals only, by a different user than the one who posted it.
* Statements: pick customer → account → date range; opening/closing balance, totals, search by Transaction ID,
  "No transactions found for the selected period." message and **CSV export**.
* **Maker-checker**: the approvals page lists pending KYC, accounts, loans and large withdrawals. Nobody can approve
  their own record.
* Dashboard cards, live-loading exchange rates, branch summary, recent customers/accounts/loans/transactions,
  Reports (portfolio, overdue, maturity, KYC pending, activity by date range), Audit Logs of every change (table and
  infinite-scroll timeline), User Management and Profile (change password, session timeout).
* **Loan Pipeline**: a drag-and-drop board — move loan cards to approve, disburse or reject them.
* **EMI Calculator**: sliders for amount, rate and tenure, amortization schedule, "Apply for this Loan" hand-off.
* **Session expiry** after inactivity (15 min by default, 1 min selectable in Profile) with a countdown warning.

---

## 5. UI elements you can practise on

Every common web UI element and interaction type appears in a realistic banking context. The in-app
**User Guide → UI Elements Practice Map** lists exactly where each one is.

| Category | What is included |
|---|---|
| Form elements | text, textarea, email, tel, password (show/hide), **number**, **date**, **file upload with drag-and-drop zone**, checkboxes, **radio buttons**, **toggle switches** (`role="switch"`), **hidden fields**, read-only and disabled fields |
| Dropdowns | native `<select>`, **searchable single-select** (Occupation), **multi-select with chips** (Collateral), **autocomplete with delayed async suggestions** (Customer ID in deposit/loan forms), **cascading** (Division → District, loaded after 0.6 s), full keyboard support (↑ ↓ Enter Esc Home End) |
| Tables | search, filters, date range, sorting, pagination, CSV export, **row checkboxes + select-all + bulk actions**, row action buttons, **inline editing** (double-click a cell), **expandable rows**, **double-click to open**, **right-click context menu** |
| Interactive UI | modals, confirm dialogs, **tooltips**, **popovers** (notifications, user menu), **hover cards**, tabs, **accordions**, toasts, **breadcrumbs**, pagination, internal and **external links** (new tab), **drag-and-drop** board, **range sliders**, **collapsible sidebar** |
| Advanced | hover, double-click, right-click, **keyboard shortcuts** (Ctrl+K, ?, [, g + letter), **command palette**, auto-suggest, **delayed/dynamic content**, **infinite scroll**, file download and upload, **native alert / confirm / prompt**, **beforeunload**, clipboard, multi-step form, conditional fields, loading indicators, validation |
| Auth & browser | login/logout, invalid login and lockout, **session expiration with warning**, role-based and branch-based access, multi-page navigation, refresh persistence, responsive layout |

---

## 6. Automation-friendly selectors

### Selector conventions
| Element | Selector |
|---|---|
| Form control | `get_by_test_id("customer-form-mobile")` — also linked to its `<label>` (`get_by_label("Mobile Number")`) |
| Field error | `get_by_test_id("customer-form-mobile-error")` — always `<control test id>-error` |
| Toasts | `toast-success`, `toast-error` (only one toast at a time), message in `toast-message` |
| Confirm dialog | `confirm-dialog`, `confirm-remarks`, `confirm-yes-btn`, `confirm-no-btn` |
| Loading overlay | `loading-overlay` (fixed 300 ms after each save — Playwright waits automatically) |
| Sidebar | `nav-dashboard`, `nav-customers`, `nav-deposits`, `nav-loans`, `nav-schedules`, `nav-statements`, `nav-transactions`, `nav-approvals`, `nav-reports`, `nav-audit`, `nav-users`, `nav-profile`, `nav-logout` |
| Access denied | `access-denied`, `access-denied-message` |
| Searchable / autocomplete dropdown | input `<id>` (`role="combobox"`), list `<id>-listbox`, options `<id>-option-<value>`, `<id>-loading`, `<id>-no-results`, `<id>-clear` |
| Multi-select | input `<id>`, chips `<id>-chip-<value>`, remove `<id>-remove-<value>`, options `<id>-option-<value>`, `<id>-count` |
| Radio group / toggle | radios `<id>-<value>` (e.g. `customer-form-gender-Female`); switch `<id>` with `aria-checked` |
| File upload | file input `<id>` (use `set_input_files`), drop zone `<id>-dropzone`, items `<id>-file-<n>`, remove `<id>-remove-<n>`, `<id>-upload-error` |
| Slider | range `<id>-slider` synchronised with number input `<id>` |
| Tooltip / info icon | trigger `<id>-info`, tooltip `<id>-tooltip` (`role="tooltip"`) |
| Popover / accordion | `<id>-trigger` (`aria-expanded`) and `<id>-panel` |
| Drag-and-drop | cards `pipeline-card-<loan no>`, columns `pipeline-column-<status>` (`locator.drag_to(...)`) |
| Session | `session-timer`, `session-warning-modal`, `session-countdown`, `session-stay-btn`, `login-session-expired` |
| Quick search | `command-palette-btn` or Ctrl+K, `command-palette-input`, options `command-option-<key>` |

### Dynamic table contract
Every data table (`customers`, `deposits`, `loans`, `schedule`, `statement`, `transactions`, `audit`, `users`,
`approvals-kyc`, `approvals-deposits`, `approvals-loans`, `approvals-txns`, ...) exposes:

| Part | Selector |
|---|---|
| Table | `<id>-table` |
| Row | `<row-prefix>-<record id>` **and** `data-row-id="<record id>"` |
| Cell | `cell-<column>` inside the row, with `data-value` = raw unformatted value |
| Row action | `<action>-btn-<record id>` e.g. `view-btn-CUS-DHK-000002`, `approve-btn-DHK-SAV-0000016`, `pay-btn-13` |
| Search / filter | `<id>-search`, `<id>-filter-<field>`, `<id>-filter-date-from`, `<id>-filter-date-to` |
| Sort | `<id>-sort-<column>` (the header has `aria-sort`) |
| Pagination | `<id>-page-size`, `<id>-prev-page`, `<id>-next-page`, `<id>-page-info`, `<id>-current-page` |
| Count / empty | `<id>-total-count` (`data-count`), `<id>-empty` |
| Row selection | `<id>-select-all`, `select-row-<record id>`, `<id>-selection-bar`, `<id>-selected-count`, `<id>-clear-selection`, bulk buttons `bulk-*-btn` |
| Expandable row | `expand-btn-<record id>` (`aria-expanded`), details row `<row-prefix>-<record id>-details` |
| Inline edit | double-click the cell → `inline-edit-<column>`, Enter / `inline-edit-save`, Escape / `inline-edit-cancel`, `inline-edit-error` |
| Context menu | right-click the row → `context-menu`, items `context-menu-item-<key>` |

Row prefixes: `customer-row`, `deposit-row`, `loan-row`, `installment-row`, `statement-row`, `txn-row`, `audit-row`,
`user-row`, `kyc-row`, `approval-deposit-row`, `approval-loan-row`, `approval-txn-row`.
Lists are sorted **newest first**, so a record you just created is on page 1.

Example with Playwright for Python:

```python
# find the customer you just created by its unique mobile, then reuse the generated ID
page.get_by_test_id("customers-search").fill(mobile)
row = page.locator('[data-testid^="customer-row-"]').filter(has_text=mobile)
customer_id = row.get_attribute("data-row-id")                        # e.g. CUS-DHK-000011
name = row.get_by_test_id("cell-fullName").inner_text()
row.get_by_test_id(f"view-btn-{customer_id}").click()

# later: open a deposit account for that same customer
page.goto("/deposits/new")
page.get_by_test_id("deposit-form-customerId").fill(customer_id)
```

---

## 7. Practice ideas

1. Create a customer, find it in the Customer List by mobile number and read its generated Customer ID from the row.
2. Use that ID to open a Savings account and a Personal loan; read the new account and loan numbers from the tables.
3. Generate the loan schedule, read every installment across all pages and check that the interest column adds up
   to *Total Interest Payable*.
4. Verify the EMI shown in the loan form against your own calculation of `P·r·(1+r)^n / ((1+r)^n − 1)`.
5. Log in as each role and check which menu items and buttons are visible; open restricted URLs directly.
6. Try boundary values: savings deposit 499.99 vs 500, NID of 9/10/11 digits, age 17 vs 18, loan tenure outside limits.
7. Withdraw more than 500,000, then approve it as a different user (maker-checker).
8. Filter a statement by date range, check opening + credits − debits = closing, and export it to CSV.
9. Upload a valid and an invalid KYC document; drop a file onto the drop zone; remove an uploaded file.
10. Pick a Division, wait for the District list to load, then select a district.
11. Drag a loan card on the Loan Pipeline to an invalid column and assert the error, then to a valid one.
12. Add an account note (handle the native `prompt`), clear the teller form (handle `confirm`).
13. Set the session timeout to 1 minute (or use `page.clock`) and test the warning modal and automatic logout.
14. Scroll the Audit Logs → Activity Timeline until "You have reached the end" appears.

## 8. Project structure

```
src/
├── types/              domain models (Customer, DepositAccount, LoanAccount, Transaction, ...)
├── data/               reference data (branches, products, rates) and deterministic seed data
├── lib/                loan & deposit maths, validation (Zod), dates, CSV, IDs
├── store/              services.ts (all business rules), selectors (branch scoping), persistence
├── auth/               permissions matrix, auth context, route guards
├── components/         UI kit (fields, modal, toasts, confirm, combobox, multi-select, file upload,
│                       slider, tooltip, popover, accordion, toggle, radio group) and DataTable
├── layout/             sidebar, top bar, session timer, command palette, breadcrumbs
└── pages/              one folder/file per module (UserGuidePage.tsx is the in-app guide)
.github/workflows/      deploy.yml — builds and publishes to GitHub Pages
scripts/                copy-404.mjs — creates dist/404.html for GitHub Pages deep links
```

Business logic lives in `src/store/services.ts`; each function validates permissions and rules, then updates a
draft of the state that is saved only when the action succeeds. To add a product, extend
`src/data/reference.ts`; to add a rule, add it to the matching service function.

## 9. Uploading to GitHub

The repository is ready to publish: `node_modules/` and `dist/` are ignored, so only source code is committed.

```bash
git init
git add .
git commit -m "KD Demo Bank - frontend-only banking app for testing practice"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Then enable GitHub Pages once (**Settings → Pages → Source: GitHub Actions**) to get the online version — see
[Use it online](#use-it-online-github-pages). Anyone can use the online link directly, or clone the repository and run
`npm install` and `npm run dev`.

> This is a training simulator. Names, NIDs and balances are fictitious and no real money is involved.
