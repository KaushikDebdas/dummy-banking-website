import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LogoMark } from '../components/Logo';
import { Accordion } from '../components/ui/advanced';
import { SHORTCUTS } from '../layout/shell';
import { BRANCHES, DEPOSIT_PRODUCT_LIST, LARGE_WITHDRAWAL_LIMIT, LOAN_PRODUCT_LIST, MAX_BACK_VALUE_DAYS, ROLE_LABELS, branchName } from '../data/reference';
import { money } from '../lib/format';
import { useStore } from '../store/StoreContext';

const SECTIONS = [
  { id: 'quick-start', title: 'Quick Start' },
  { id: 'login', title: 'Logging In' },
  { id: 'branches-roles', title: 'Branches & User Roles' },
  { id: 'navigation', title: 'Navigating the Modules' },
  { id: 'customers', title: 'Customers' },
  { id: 'deposits', title: 'Deposit Accounts' },
  { id: 'loans', title: 'Loan Accounts' },
  { id: 'schedules', title: 'Repayment Schedules' },
  { id: 'cash', title: 'Deposit & Withdraw Money' },
  { id: 'statements', title: 'Statements & Transactions' },
  { id: 'approvals', title: 'Approvals (Maker-Checker)' },
  { id: 'tools', title: 'Pipeline, EMI Calculator & Productivity' },
  { id: 'practice-map', title: 'UI Elements Practice Map' },
  { id: 'faq', title: 'FAQ' },
  { id: 'important', title: 'Important Notes & Links' },
];

/** Where to find every UI element / interaction type in the app. */
const PRACTICE_MAP: [string, string, string][] = [
  ['Form elements', 'Text field, textarea, email, tel', 'Customer form (steps 1–3)'],
  ['Form elements', 'Password field + show/hide', 'Login page; Profile → Change Password'],
  ['Form elements', 'Number inputs', 'Monthly Income, deposit Amount, loan Amount / Interest Rate, Teller Amount'],
  ['Form elements', 'Date pickers', 'Date of Birth, Account Opening Date, Loan Start Date, statement and table date filters'],
  ['Form elements', 'File upload (input + drag-and-drop zone)', 'Customer form step 2 (KYC Documents); Loan form (Supporting Documents)'],
  ['Form elements', 'Checkboxes', '"Same as present address" (customer step 3); table row selection'],
  ['Form elements', 'Radio buttons', 'Gender (customer step 1); Repayment Frequency (EMI Calculator)'],
  ['Form elements', 'Toggle switches (role="switch")', 'SMS Alerts / e-Statement (customer step 4); Credit Life Insurance (loan form)'],
  ['Form elements', 'Hidden fields', 'customer-form-channel and customer-form-maker in the customer form'],
  ['Form elements', 'Read-only / disabled fields', 'Customer Name, Branch, Interest Rate, Installment Amount; locked Branch select'],
  ['Dropdowns', 'Standard <select>', 'Customer Type, Deposit Product, Loan Product, Frequency, table filters'],
  ['Dropdowns', 'Searchable single-select (custom, keyboard ↑ ↓ Enter Esc)', 'Occupation (customer step 4)'],
  ['Dropdowns', 'Multi-select searchable with chips', 'Collateral / Security (loan form)'],
  ['Dropdowns', 'Autocomplete with async (delayed) suggestions', 'Customer ID in the deposit and loan forms'],
  ['Dropdowns', 'Dependent / cascading', 'Division → District (districts load after 0.6 s); Statement Customer → Account; MBS Linked Account'],
  ['Tables', 'Search, filter, sort, pagination, CSV export', 'Every list page'],
  ['Tables', 'Row checkboxes + select all + bulk actions', 'Customers (Export / Verify KYC / Activate / Deactivate), Approvals → Deposit Accounts, Transactions'],
  ['Tables', 'Row action buttons', 'View / Edit / Approve / Pay buttons in every table'],
  ['Tables', 'Inline editing (double-click a cell, Enter / Esc)', 'Customers → Email column; User Management → Full Name / Email'],
  ['Tables', 'Expandable rows', 'Customers and Loan Accounts (▶ button at the start of each row)'],
  ['Tables', 'Double-click a row to open it', 'Customers, Deposit Accounts, Loan Accounts'],
  ['Tables', 'Right-click context menu', 'Customers and Deposit Accounts rows'],
  ['Interactive UI', 'Modal and confirmation dialogs', 'Logout, approvals, freeze, reversal, maturity processing'],
  ['Interactive UI', 'Tooltips (hover / focus)', '(i) icons next to labels, KYC badges in the customer list, collapsed sidebar icons'],
  ['Interactive UI', 'Popovers', 'Notifications bell 🔔 (unread badge, item counts, "N new" pills, links to the right tab) and user menu (initials) in the top bar'],
  ['Interactive UI', 'Hover card (appears after 0.4 s)', 'Customer ID links in the Deposit Accounts table'],
  ['Interactive UI', 'Tabs', 'Teller, Approvals, Reports, Audit Logs'],
  ['Interactive UI', 'Accordions', 'EMI Calculator (schedule / formula), this FAQ'],
  ['Interactive UI', 'Toast notifications', 'After every save (bottom-right)'],
  ['Interactive UI', 'Breadcrumbs', 'Top of every page inside the app'],
  ['Interactive UI', 'External links (new tab)', 'Important Notes & Links section below'],
  ['Interactive UI', 'Drag-and-drop', 'Loan Pipeline board (drag cards between columns); file drop zones'],
  ['Interactive UI', 'Sliders / range inputs', 'EMI Calculator; Loan Tenure; Nominee Share (FDR/DPS/MBS)'],
  ['Interactive UI', 'Collapsible sidebar', '« button at the bottom of the sidebar, or press ['],
  ['Advanced', 'Keyboard shortcuts & navigation', 'Ctrl + K quick search, ?, [, g + letter (see section 12)'],
  ['Advanced', 'Dynamic content / delayed loading', 'Dashboard exchange rates (1.5 s), district list, autocomplete search, 300 ms save overlay'],
  ['Advanced', 'Infinite scrolling', 'Audit Logs → Activity Timeline'],
  ['Advanced', 'File download', 'Export CSV buttons (tables, statements)'],
  ['Advanced', 'Native alert / confirm / prompt', 'Deposit account → Add Note (prompt + alert), Teller → Clear (confirm), leaving a filled customer form (confirm)'],
  ['Advanced', 'beforeunload dialog', 'Reload or close the tab with unsaved data in the New Customer form'],
  ['Advanced', 'Clipboard', 'Right-click → Copy Customer ID / Copy account number'],
  ['Advanced', 'Multi-step form + conditional fields', 'Customer onboarding (Business type fields), deposit product fields, collateral required by product'],
  ['Auth & browser', 'Login / invalid login / lockout', 'Login page (3 wrong passwords lock the account)'],
  ['Auth & browser', 'Session expiration', 'Profile → Session Settings (1 minute) → warning modal with countdown → alert → login page'],
  ['Auth & browser', 'Role and branch restrictions', 'Log in as different demo users; open restricted URLs directly'],
  ['Auth & browser', 'Refresh and persistence', 'Data and login survive a page refresh (localStorage)'],
  ['Auth & browser', 'Responsive layout', 'Resize below 1024 px: the sidebar becomes a ☰ drawer'],
];

const ROLE_SUMMARY: { role: keyof typeof ROLE_LABELS; can: string }[] = [
  { role: 'ADMIN', can: 'Everything in every branch, including creating, locking and unlocking users.' },
  { role: 'BRANCH_MANAGER', can: 'Manage customers and accounts, verify KYC, approve accounts and loans, disburse loans, freeze/close accounts, process maturity, approve large withdrawals, reverse transactions, reports and audit log.' },
  { role: 'CSO', can: 'Create and edit customers, open deposit accounts.' },
  { role: 'LOAN_OFFICER', can: 'Create loan accounts, generate repayment schedules, collect installments.' },
  { role: 'TELLER', can: 'Cash deposits, withdrawals, fund transfers and loan repayments.' },
  { role: 'AUDITOR', can: 'Read-only view of all branches, plus reports and audit log. Cannot change anything.' },
];

const MODULES: { name: string; path: string; what: string }[] = [
  { name: 'Dashboard', path: '/dashboard', what: 'Summary cards (customers, accounts, balances, overdue installments), branch summary and recent activity.' },
  { name: 'Customer Management', path: '/customers', what: 'Customer list with search, filters and actions; onboarding form; customer details.' },
  { name: 'Deposit Accounts', path: '/deposits', what: 'All deposit accounts; open new accounts; account details, freeze, close, maturity.' },
  { name: 'Loan Accounts', path: '/loans', what: 'All loans; create loans; approve, disburse, write off.' },
  { name: 'Loan Pipeline', path: '/loans/pipeline', what: 'Drag-and-drop board: approve, disburse or reject loans by moving cards.' },
  { name: 'Repayment Schedules', path: '/schedules', what: 'Find any loan and open its installment schedule.' },
  { name: 'Account Statements', path: '/statements', what: 'Statement of a deposit or loan account for a date range, with CSV export.' },
  { name: 'Transactions', path: '/transactions', what: 'Every transaction in your branch; post new teller transactions; reverse same-day transactions.' },
  { name: 'Approvals', path: '/approvals', what: 'Pending KYC, accounts, loans and large withdrawals waiting for a checker.' },
  { name: 'Reports', path: '/reports', what: 'Portfolio summary, overdue installments, deposit maturity, KYC pending, activity by date.' },
  { name: 'Audit Logs', path: '/audit', what: 'Who changed what and when.' },
  { name: 'EMI Calculator', path: '/tools/emi-calculator', what: 'Try loan amounts, rates and tenures with sliders; open the loan form pre-filled.' },
  { name: 'User Management', path: '/admin/users', what: 'Admin only: create users, lock and unlock accounts.' },
  { name: 'User Profile', path: '/profile', what: 'Your details, permissions, session timeout and change password.' },
  { name: 'User Guide', path: '/guide', what: 'This page.' },
];

export function UserGuidePage() {
  const { user } = useAuth();
  const { state } = useStore();

  return (
    <div className="min-h-screen bg-slate-100" data-testid="user-guide-page">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <LogoMark size={36} />
          <div className="flex-1">
            <h1 className="text-base font-semibold text-slate-900" data-testid="page-title">
              QA Demo Bank — User Guide
            </h1>
            <p className="text-xs text-slate-500">How to use the core banking simulator</p>
          </div>
          <Link
            to={user ? '/dashboard' : '/login'}
            data-testid="guide-back-link"
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
          >
            {user ? 'Back to Dashboard' : 'Go to Login'}
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[14rem_1fr]">
        <nav className="lg:sticky lg:top-20 lg:self-start" aria-label="Guide contents" data-testid="guide-toc">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Contents</div>
            <ol className="flex flex-col gap-0.5 text-sm">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} data-testid={`guide-toc-${s.id}`} className="block rounded px-2 py-1 text-slate-700 hover:bg-teal-50 hover:text-teal-800">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <main className="flex min-w-0 flex-col gap-6">
          <Section id="quick-start" title="1. Quick Start">
            <p>QA Demo Bank is a practice core banking system. Everything runs in your browser — there is no server and no real money. A typical first session:</p>
            <Steps
              items={[
                <>Log in as <Code>cso.dhaka</Code> and create a customer (Customer Management → <B>+ New Customer</B>).</>,
                <>Open a Savings account for that customer (<B>+ Deposit</B> on the customer's row).</>,
                <>Log out and log in as <Code>manager.dhaka</Code>. In <B>Approvals</B>, verify the customer's KYC and approve the account.</>,
                <>Log in as <Code>teller.dhaka</Code> and deposit or withdraw money (Transactions → <B>+ New Transaction</B>).</>,
                <>Open <B>Account Statements</B> to see every transaction with its running balance.</>,
              ]}
            />
          </Section>

          <Section id="login" title="2. Logging In">
            <Steps
              items={[
                <>Open the login page. The <B>Demo Credentials</B> table lists every user.</>,
                <>Click <B>Use</B> next to a user to fill the username and password, or type them yourself.</>,
                <>Click <B>Sign In</B>. You land on the Dashboard; your name, role and branch are shown in the top bar.</>,
                <>To log out, click <B>Logout</B> (top bar or sidebar) and confirm.</>,
              ]}
            />
            <Table
              testId="guide-credentials"
              head={['Username', 'Password', 'Role', 'Branch']}
              rows={state.users.map((u) => [<Code key="u">{u.username}</Code>, <Code key="p">{u.password}</Code>, ROLE_LABELS[u.role] + (u.status === 'Locked' ? ' (locked)' : ''), branchName(u.branch)])}
            />
            <Note>Three wrong passwords in a row lock the account. An Admin can unlock it in User Management, or use <B>Reset demo data</B> on the login page.</Note>
          </Section>

          <Section id="branches-roles" title="3. Branches & User Roles">
            <p>The bank has three branches. Each branch user only sees the customers, accounts and transactions of their own branch. Admin and Auditor see all branches and can filter by branch.</p>
            <Table testId="guide-branches" head={['Code', 'Branch', 'Address']} rows={BRANCHES.map((b) => [<Code key="c">{b.code}</Code>, b.name, b.address])} />
            <Table testId="guide-roles" head={['Role', 'What they can do']} rows={ROLE_SUMMARY.map((r) => [<B key="r">{ROLE_LABELS[r.role]}</B>, r.can])} />
            <Note>Menu items and buttons you are not allowed to use are hidden. Opening a restricted page by URL shows an <B>Access Denied</B> message.</Note>
          </Section>

          <Section id="navigation" title="4. Navigating the Modules">
            <p>Use the dark sidebar on the left. On tablets, open it with the <B>☰</B> button in the top bar. Most IDs in tables (customer ID, account number, loan number) are links to the record's detail page.</p>
            <Table
              testId="guide-modules"
              head={['Module', 'Address', 'What you do there']}
              rows={MODULES.map((m) => [<B key="n">{m.name}</B>, <Code key="p">{m.path}</Code>, m.what])}
            />
            <p>Every list supports <B>search</B>, <B>filters</B>, <B>sorting</B> (click a column header), <B>rows per page</B>, page buttons and <B>Export CSV</B>. Newest records are shown first.</p>
          </Section>

          <Section id="customers" title="5. Creating and Managing Customers">
            <H3>Create a customer</H3>
            <Steps
              items={[
                <>Go to <B>Customer Management</B> and click <B>+ New Customer</B>.</>,
                <><B>Step 1 – Personal:</B> customer type, full name, father's and mother's name, date of birth, gender (radio buttons). Business customers also need a Business Name and Trade License (format <Code>TL-1234567</Code>).</>,
                <><B>Step 2 – Contact & Identity:</B> mobile (<Code>01XXXXXXXXX</Code>, 11 digits), email, National ID (10, 13 or 17 digits) and optional KYC documents (JPG, PNG or PDF, max 2 MB, up to 3 files — click or drag files onto the box).</>,
                <><B>Step 3 – Address:</B> present address, <B>Division</B> then <B>District</B> (districts load after you choose a division), and permanent address (tick the box if it is the same).</>,
                <><B>Step 4 – Financial & Preferences:</B> occupation (searchable dropdown), monthly income, branch (fixed to your own branch unless you are Admin), status, and SMS Alerts / e-Statement switches.</>,
                <><B>Step 5 – Review</B> and click <B>Create Customer</B>. A Customer ID such as <Code>CUS-DHK-000011</Code> is generated and the new customer appears at the top of the list.</>,
              ]}
            />
            <H3>Rules</H3>
            <Bullets
              items={[
                'All fields are required. Customers must be at least 18 years old.',
                'The same NID or mobile number cannot be registered twice. The same name and date of birth shows a warning you can confirm.',
                'New customers start with KYC status Pending. Accounts and loans can be created, but they cannot be approved until a Branch Manager verifies KYC.',
              ]}
            />
            <H3>Manage customers</H3>
            <Bullets
              items={[
                <><B>Search</B> by name, customer ID or mobile; filter by status, KYC status, customer type (and branch for Admin/Auditor).</>,
                <><B>View</B> shows full details plus the customer's deposit and loan accounts.</>,
                <><B>Edit</B> changes details. Changing the NID of a verified customer resets KYC to Pending.</>,
                <><B>Deactivate / Activate</B> (Branch Manager). A customer with an open loan cannot be deactivated; inactive customers cannot open accounts.</>,
                <><B>Verify KYC / Reject KYC</B> on the customer page or in Approvals (Branch Manager, not the user who created the customer).</>,
              ]}
            />
          </Section>

          <Section id="deposits" title="6. Creating Deposit Accounts">
            <Steps
              items={[
                <>Click <B>+ Deposit</B> on a customer row, or go to <B>Deposit Accounts → + New Deposit Account</B>.</>,
                <>Start typing the <B>Customer ID</B>, name or mobile number and pick a suggestion (or type the full ID). The name and branch fill in automatically.</>,
                <>Choose the <B>Deposit Product</B>. The form changes: term products ask for tenure, nominee and nominee share (slider), MBS asks for a linked account.</>,
                <>Set the <B>opening date</B> (today or up to {MAX_BACK_VALUE_DAYS} days back) and the <B>amount</B>. Interest rate, maturity date and maturity amount are calculated for you.</>,
                <>Click <B>Create Deposit Account</B>. An account number such as <Code>DHK-SAV-0000016</Code> is generated with status <B>Pending Approval</B>.</>,
                <>A Branch Manager approves it (Approvals or the account page). The opening deposit is then posted and the account becomes <B>Active</B>.</>,
              ]}
            />
            <Table testId="guide-deposit-products" head={['Product', 'Rules']} rows={DEPOSIT_PRODUCT_LIST.map((p) => [<B key="n">{p.name}</B>, p.description])} />
            <Note>From the account page a Branch Manager can also <B>Freeze/Unfreeze</B> (frozen accounts accept deposits but block withdrawals), <B>Post Interest</B> (Savings, once per month), <B>Process Maturity</B> (term deposits after the maturity date) and <B>Close Account</B> (balance must be zero).</Note>
          </Section>

          <Section id="loans" title="7. Creating Loan Accounts">
            <Steps
              items={[
                <>Click <B>+ Loan</B> on a customer row, or go to <B>Loan Accounts → + New Loan Account</B> (Loan Officer, Branch Manager or Admin).</>,
                <>Start typing the <B>Customer ID</B>, name or mobile and pick a suggestion, then choose the <B>Loan Product</B>. The default interest rate fills in and the allowed limits are shown under each field.</>,
                <>Enter <B>Loan Amount</B>, <B>Interest Rate</B>, <B>Repayment Frequency</B>, <B>Start Date</B>, <B>Tenure</B> (slider or number box) and <B>Purpose</B>. Home, Business and SME loans also need at least one <B>Collateral</B> type (multi-select). Optionally switch on Credit Life Insurance and upload documents.</>,
                <>The <B>Installment Amount</B>, number of installments and maturity date are calculated live using the reducing-balance (EMI) method.</>,
                <>Click <B>Create Loan Account</B>. A number such as <Code>LN-DHK-PER-000005</Code> is generated with status <B>Applied</B>.</>,
                <>A Branch Manager <B>Approves</B> the loan, then <B>Disburses</B> it. The loan becomes <B>Active</B> and the outstanding balance equals the loan amount.</>,
              ]}
            />
            <Table
              testId="guide-loan-products"
              head={['Product', 'Amount (BDT)', 'Rate', 'Tenure', 'Notes']}
              rows={LOAN_PRODUCT_LIST.map((p) => [
                <B key="n">{p.name}</B>,
                `${money(p.minAmount)} – ${money(p.maxAmount)}`,
                `${p.minRate}% – ${p.maxRate}%`,
                `${p.minTenure} – ${p.maxTenure} months`,
                [p.businessOnly && 'Business customers only', p.dbrCheck && 'Installment ≤ 50% of monthly income'].filter(Boolean).join('. ') || '-',
              ])}
            />
            <Note>Tenure must be a multiple of the repayment period (3 months for Quarterly, 6 for Half-Yearly). A customer can have at most 2 open loans. The loan status flow is Applied → Approved → Active → Closed (or Rejected / Written Off).</Note>
          </Section>

          <Section id="schedules" title="8. Generating Loan Repayment Schedules">
            <Steps
              items={[
                <>Open the loan (click its number in Loan Accounts) and click <B>Generate Schedule</B>. If you skip this, the schedule is generated automatically when the loan is disbursed.</>,
                <>Click <B>Repayment Schedule</B> on the loan page, <B>Schedule</B> on the loan row, or use the <B>Repayment Schedules</B> menu and enter a loan number.</>,
                <>The summary shows total installments, installment amount, total interest, total repayment, paid and overdue counts, outstanding principal and next due date.</>,
                <>Each row shows installment number, due date, opening principal, installment, principal, interest, closing principal and status (<B>Pending</B>, <B>Paid</B> or <B>Overdue</B>). Filter by status or due date.</>,
                <>To collect a payment, click <B>Mark Paid</B> on the next unpaid installment and confirm (Teller, Loan Officer or Admin; loan must be Active).</>,
              ]}
            />
            <Note>Installments must be paid in order. Paying one reduces the outstanding balance by its principal part; paying the last one closes the loan.</Note>
          </Section>

          <Section id="cash" title="9. Adding (Deposit) and Withdrawing Money">
            <p>Money is posted by a <B>Teller</B> (or Admin) from <B>Transactions → + New Transaction</B>, or with the <B>Transact</B> / <B>New Transaction</B> button on a deposit account.</p>
            <H3>Deposit money</H3>
            <Steps
              items={[
                <>Select the <B>Cash Deposit</B> tab.</>,
                <>Enter the <B>Account Number</B>. The account holder, product, status and balance appear on the right, so you can check you have the right account.</>,
                <>Enter the <B>Amount</B> (up to 2 decimals) and an optional narration.</>,
                <>Click <B>Post Transaction</B>. The result box shows the <B>Transaction ID</B> and the new balance.</>,
              ]}
            />
            <H3>Withdraw money</H3>
            <Steps
              items={[
                <>Select the <B>Cash Withdrawal</B> tab.</>,
                <>Enter the account number and amount, then click <B>Post Transaction</B>.</>,
                <>If the amount is above <B>{money(LARGE_WITHDRAWAL_LIMIT)}</B>, it is saved as <B>Pending Approval</B> and the balance changes only after a Branch Manager approves it in Approvals → Transactions.</>,
              ]}
            />
            <H3>Rules you will meet</H3>
            <Bullets
              items={[
                'Savings accounts must keep a minimum balance of 500. Withdrawing below it shows "Insufficient funds".',
                'Frozen accounts accept deposits but block withdrawals and transfers out.',
                'FDR and MBS accept no deposits or withdrawals before maturity. DPS accepts deposits equal to its monthly installment only.',
                'Pending, Closed, Matured and Rejected accounts cannot be used.',
                <><B>Fund Transfer</B> moves money between two deposit accounts. <B>Loan Repayment</B> collects the next installment of a loan by loan number.</>,
                <>A Branch Manager can <B>Reverse</B> a cash deposit or withdrawal on the same day it was posted (from the Transactions list), as long as they did not post it themselves.</>,
              ]}
            />
          </Section>

          <Section id="statements" title="10. Account Statements and Transaction History">
            <H3>Account statement</H3>
            <Steps
              items={[
                <>Open <B>Account Statements</B> (or click <B>Statement</B> / <B>View Statement</B> on an account).</>,
                <>Select the <B>Customer</B>, then one of their deposit or loan <B>Accounts</B>.</>,
                <>Adjust <B>From Date</B> and <B>To Date</B>. By default the full history from the opening date to today is shown.</>,
                <>The summary shows opening balance, closing balance, total debit and credit and the number of transactions. The table lists date, transaction ID, type, description, debit, credit and running balance (outstanding balance for loans).</>,
                <>Search by <B>Transaction ID</B>, and click <B>Export CSV</B> to download the statement.</>,
              ]}
            />
            <H3>Transaction history</H3>
            <p>The <B>Transactions</B> page lists every transaction in your branch, newest first. Search by transaction ID, account number or customer ID; filter by type, account type, status and date range. Each deposit account page also shows its own transaction history.</p>
          </Section>

          <Section id="approvals" title="11. Approvals (Maker-Checker)">
            <p>Important actions need two different people: the <B>maker</B> who creates the record and the <B>checker</B> who approves it. You can never approve or reject something you created yourself.</p>
            <Table
              testId="guide-approvals"
              head={['Needs approval', 'Created by (maker)', 'Approved by (checker)']}
              rows={[
                ['Customer KYC', 'CSO / Branch Manager / Admin', 'Branch Manager / Admin'],
                ['New deposit account', 'CSO / Branch Manager / Admin', 'Branch Manager / Admin (customer KYC must be Verified)'],
                ['New loan (then disbursement)', 'Loan Officer / Branch Manager / Admin', 'Branch Manager / Admin (customer KYC must be Verified)'],
                [`Withdrawal above ${money(LARGE_WITHDRAWAL_LIMIT)}`, 'Teller / Admin', 'Branch Manager / Admin'],
              ]}
            />
            <p>Open <B>Approvals</B> and use the tabs (KYC Verification, Deposit Accounts, Loans, Transactions). Rejecting always requires remarks.</p>
          </Section>

          <Section id="tools" title="12. Pipeline, EMI Calculator & Productivity">
            <H3>Loan Pipeline (drag and drop)</H3>
            <p>
              Open <B>Loan Pipeline</B> in the sidebar (or <B>Pipeline Board</B> on the Loan Accounts page). Drag a card from <B>Applied</B> to <B>Approved</B> to approve it, from <B>Approved</B> to{' '}
              <B>Disbursed / Active</B> to disburse it, or to <B>Rejected</B> to reject it (remarks required). The same rules apply as with the buttons, so an invalid move shows an error.
            </p>
            <H3>EMI Calculator</H3>
            <p>
              Open <B>EMI Calculator</B> in the sidebar. Move the sliders (or type) to see the installment, total interest and the full amortization schedule. <B>Apply for this Loan</B> opens the loan form
              already filled in.
            </p>
            <H3>Quick search and shortcuts</H3>
            <p>
              Press <Code>Ctrl + K</Code> (or click <B>Search</B> in the top bar) to jump to any page, customer, account or loan. Press <Code>?</Code> for the list of shortcuts:
            </p>
            <Table testId="guide-shortcuts" head={['Keys', 'Action']} rows={SHORTCUTS.map((k) => [<Code key="k">{k.keys}</Code>, k.action])} />
            <H3>Other helpers</H3>
            <Bullets
              items={[
                <>The <B>🔔 bell</B> lists all pending work you can act on (it stays until the work is handled). Its red number counts only <B>new</B> items and clears when you open the bell; new work raises it again. Each line opens the right tab, e.g. Approvals → Transactions. The <B>initials</B> button opens your user menu.</>,
                <>Right-click a row in Customers or Deposit Accounts for a context menu; double-click a row to open it.</>,
                <>The <B>⏱ timer</B> in the top bar shows how long until you are logged out for inactivity. Change it in <B>Profile → Session Settings</B>.</>,
              ]}
            />
          </Section>

          <Section id="practice-map" title="13. UI Elements Practice Map">
            <p>Every common web UI element and interaction type appears somewhere in the app, in a banking context. Use this map to find it.</p>
            <Table testId="guide-practice-map" head={['Category', 'Element / interaction', 'Where to find it']} rows={PRACTICE_MAP.map(([c, e, w]) => [c, <B key="e">{e}</B>, w])} />
          </Section>

          <Section id="faq" title="14. FAQ">
            <Accordion
              id="guide-faq"
              items={[
                {
                  id: 'data-lost',
                  title: 'Where is my data stored? Will it be lost?',
                  content: (
                    <>
                      In your own browser's localStorage — there is no server, even on the online version. It survives refreshes and restarts but is lost if you clear site data or use a private window.
                      Other visitors never see your data. Use User Profile → Data Backup to export it to a file and import it later or elsewhere, and Reset Demo Data to start again.
                    </>
                  ),
                },
                {
                  id: 'online',
                  title: 'Do I need to install anything?',
                  content: <>No. If the app is published on GitHub Pages, open its link in any modern browser. To run it on your own computer instead, clone the repository and run npm install and npm run dev.</>,
                },
                { id: 'bell-zero', title: 'Why did the bell number go to 0 but the list still shows items?', content: <>The red number counts only new items you have not seen yet, and opening the bell marks them as seen. The list keeps showing all pending work until it is handled (approved, verified or processed). Items you created yourself are not listed, because you cannot approve your own work.</> },
                { id: 'approve-own', title: 'Why can I not approve an account I created?', content: <>Maker-checker: the person who creates a record cannot approve it. Log in as another user with approval rights (e.g. a Branch Manager).</> },
                { id: 'not-approved', title: 'The approval fails with "KYC must be Verified". What do I do?', content: <>Verify the customer's KYC first (Approvals → KYC Verification, or Verify KYC on the customer page), then approve the account or loan.</> },
                { id: 'cannot-see', title: 'I cannot see a customer that exists.', content: <>Branch users only see their own branch. Log in as admin or auditor to see all branches.</> },
                { id: 'logged-out', title: 'I was logged out automatically.', content: <>Your session expired after inactivity. The timeout is set in Profile → Session Settings (default 15 minutes).</> },
                { id: 'port', title: 'The app does not start: "Port 5173 is already in use".', content: <>The app is already running in another terminal. Use that one, or stop it with Ctrl+C and start again.</> },
              ]}
            />
          </Section>

          <Section id="important" title="15. Important Notes & Links">
            <Bullets
              items={[
                <>All data is saved in <B>your own browser</B> (local storage) — also on the online (GitHub Pages) version. It survives refreshes and restarts, is private to this browser and device, and is lost if you clear site data or use a private window.</>,
                <>To keep or move your data, open <B>User Profile → Data Backup</B>: <B>Export Data</B> downloads a JSON file and <B>Import Data</B> loads it back, here or in another browser.</>,
                <><B>Reset Demo Data</B> (top bar, or on the login page) restores the original demo customers, accounts and transactions. Adding <Code>?reset=1</Code> to any address does the same.</>,
                <>Amounts are in BDT and shown as <Code>1,234.50</Code>. Dates use the format <Code>YYYY-MM-DD</Code>.</>,
                <>Every change is recorded in the <B>Audit Logs</B> with the user and time.</>,
                <>Useful demo records: matured FDR <Code>DHK-FDR-0000010</Code> (process maturity), frozen savings <Code>CTG-SAV-0000009</Code>, loan with overdue installments <Code>LN-SYL-SME-000001</Code>, loan waiting for approval <Code>LN-DHK-CON-000003</Code>, customer with pending KYC <Code>CUS-DHK-000009</Code>.</>,
                <>This is a training simulator. All names, IDs and balances are fictitious.</>,
              ]}
            />
            <H3>Useful links (open in a new tab)</H3>
            <ul className="flex list-disc flex-col gap-1 pl-5" data-testid="guide-external-links">
              {[
                ['playwright-python', 'Playwright for Python documentation', 'https://playwright.dev/python/'],
                ['playwright-locators', 'Playwright locators guide', 'https://playwright.dev/python/docs/locators'],
                ['bangladesh-bank', 'Bangladesh Bank (central bank)', 'https://www.bb.org.bd/'],
              ].map(([key, label, href]) => (
                <li key={key}>
                  <a href={href} target="_blank" rel="noopener noreferrer" data-testid={`external-link-${key}`} className="font-medium text-teal-700 hover:underline">
                    {label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        </main>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ small building blocks
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-5 shadow-sm" data-testid={`guide-section-${id}`}>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

const H3 = ({ children }: { children: ReactNode }) => <h3 className="mt-1 font-semibold text-slate-900">{children}</h3>;
const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-slate-900">{children}</strong>;
const Code = ({ children }: { children: ReactNode }) => <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.8rem] text-slate-800">{children}</code>;

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">{children}</div>;
}

function Table({ head, rows, testId }: { head: string[]; rows: ReactNode[][]; testId: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm" data-testid={testId}>
        <thead className="bg-slate-50">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
