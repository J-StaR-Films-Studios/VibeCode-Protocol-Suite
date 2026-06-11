 Current Takomi stage: Genesis. I have enough to proceed without extra questions. Short plan:

 1. Read the existing foundation docs and align them with the idea note.
 2. Update Genesis artifacts for EduClearance as a standalone clearance-request product.
 3. Add one issue file per functional requirement under docs/issues/.
 4. Include your chosen infra constraints: Paystack, Neon production DB, and local PostgreSQL on localhost:54321 /
    database edu_clearance / password password.
 5. Verify the FR ↔ issue mapping and report the next recommended stage.


 read docs/Project_Requirements.md



 read docs/Coding_Guidelines.md



 read docs/Builder_Prompt.md



 $ find docs -maxdepth 3 -type f | sort

 docs/Builder_Prompt.md
 docs/Coding_Guidelines.md
 docs/Project_Requirements.md

 Took 0.1s


 Organizing project files

 I need to create directories for docs, features, mockups, issues, and scripts. I'm considering using bash's mkdir
 command for that. The user wants documentation, so maybe I'll have a session on the Takomi board to discuss this.
 Since the workflow suggests creating a session for broad topics, I should definitely initiate one. I might also need
 to write the documentation first and include the current timestamp, possibly by using date in bash.


 $ date +orch-%Y%m%d-%H%M%S && mkdir -p docs/features docs/mockups docs/issues scripts

 orch-20260611-130831

 Took 0.2s


 Creating PRD Content

 I need to create content for the PRD, focusing on concise yet comprehensive Functional Requirements (FRs). I’m
 thinking about including around 15 FRs, with one issue per FR. Now, I need to be careful about how to handle the local
 database connection and the sensitive password. Is it alright to include the password in the documentation, perhaps as
 a .env.local example? I should avoid hardcoding it and recommend not committing production secrets. Plus, I need to
 finalize the tech stack!

 Setting Up Payment Handling

 I want to set Paystack top-ups as the main user story since the user mentioned managing payments with Paystack. I’m
 also considering allowing manual wallet credits as a fallback option for admins. For the database, I’m thinking of
 using Neon DB in production and local PostgreSQL.

 I could go with Drizzle as the ORM, especially for its lightweight migrations that work well with Neon. For
 authentication, Better Auth seems good with email/password. Finally, I need to write issue files and could use a
 script or bash to create multiple files efficiently.

 Handling File Operations

 I’m considering using the write function multiple times for file creation and overwriting, but that doesn’t seem very
 efficient. The developer suggests using write for this purpose, which is allowed, yet I wonder if I should write each
 document one at a time. Since there are 15 issues to address, I could explore using bash with Python for file
 operations.

 It seems like using multiple write tools in parallel could create separate files effectively, but I’m cautious about
 managing that complexity.

 Drafting PRD Features

 I'm working on creating a Product Requirements Document (PRD) with various features listed in a table format. It
 includes items like a landing page, school directory, registration processes, and various admin functionalities. I
 think I need to identify meaningful issues, likely having one per feature, which might total around 19. I'm
 contemplating future integrations too. There are also guidelines to consider, like security measures, setup commands,
 and database integrity. It does feel a bit overwhelming but manageable!

 Planning Documentation Structure

 I'm thinking through how to set up our build order, environment, and database, possibly including documentation for
 features, like a clearance workflow. Creating a file structure with directories might be beneficial, but empty
 directories won't show in Git without a .gitkeep file. So, I might create these files after writing the documentation.
 The workflow suggests creating orchestration sessions and a master plan markdown to align everything. It feels a bit
 complex, but I think organizing it will help a lot!


 todo → Update Genesis docs
 ◐ in progress



 $ python - <<'PY'
 from pathlib import Path
 from textwrap import dedent

 root = Path('.')
 for d in ['docs/features', 'docs/mockups', 'docs/issues', 'scripts',
 'docs/tasks/orchestrator-sessions/orch-20260611-130831/tasks']:
     Path(d).mkdir(parents=True, exist_ok=True)

 prd = dedent('''\
 # EduClearance Project Requirements

 Created: 2026-06-11
 Stage: Genesis
 Primary source: `00_Notes/Idea.md`

 ## 1. Project Overview

 **EduClearance** is a private school-to-school student transfer clearance network for local school clusters. It helps
 an admitting school open a clearance request for an incoming student, check whether any unresolved clearance or
 outstanding-balance issue exists, notify the previous school, and keep a traceable case history.

 The MVP must stay focused on the wedge: **student transfer clearance**, not full school management. Meloschool remains
 a separate product and can integrate later.

 ## 2. Mission

 Help schools avoid admitting transfer students blindly by giving approved schools a structured, private, auditable way
 to verify whether an incoming student has unresolved obligations at a previous school.

 Core positioning:

 > Protect your school before admitting a new student.

 ## 3. MVP Product Principles

 1. **Clearance request, not simple search** — every check opens a single-student verification window.
 2. **No record found does not mean cleared** — the UI must say: “No unresolved record was found on EduClearance. This
 does not confirm clearance. Please verify with the previous school.”
 3. **Private professional wording** — avoid “debtor database” and “blacklist.” Use “clearance,” “outstanding balance,”
 “transfer verification,” and “unresolved issue.”
 4. **Contribution should be free** — reporting an unresolved issue is free so schools are encouraged to contribute
 useful records.
 5. **Consumption is paid** — the admitting school pays credits to start a clearance request.
 6. **Human review remains possible** — schools can contact one another and admin can handle disputes, duplicates, and
 abuse.
 7. **Data minimization** — store clearance cases and unresolved issue reports, not a permanent database of every
 child.

 ## 4. Tech Stack

 | Area | Decision |
 | :--- | :--- |
 | Frontend | Next.js App Router + TypeScript |
 | Styling | Tailwind CSS + shadcn/ui |
 | Database | PostgreSQL |
 | Production DB | Neon |
 | Local DB | PostgreSQL on Windows: `localhost:54321`, database `edu_clearance`, user `postgres` |
 | ORM / migrations | Drizzle ORM recommended for a lightweight Postgres-first MVP |
 | Auth | Email/password auth with school-scoped roles; implementation may use Better Auth or an equivalent
 Next.js-compatible auth layer |
 | Payments | Paystack for wallet top-ups and payment verification/webhooks |
 | Notifications | MVP: dashboard notification + generated WhatsApp/manual message; later: SMS/email automation |
 | Deployment | Vercel or similar Next.js host, connected to Neon |

 ## 5. Local Development Database

 Local PostgreSQL connection for development:

 ```env
 DATABASE_URL="postgresql://postgres:password@localhost:54321/edu_clearance"
 ```

 Rules:
 - This is local-only and must not be reused for production.
 - Production Neon credentials and Paystack keys must live in environment variables and must not be committed.
 - Migrations should run cleanly against both local PostgreSQL and Neon.

 ## 6. Business Model

 MVP pricing should remain simple:

 - School wallet starts with **₦5,000 credit**.
 - Public sales message: **₦5,000 gives 50 student checks**.
 - Internal product action: one paid **clearance request** per incoming student.
 - Each clearance request deducts **₦100** initially.
 - Reporting unresolved issues is free.
 - Paystack manages wallet top-ups.
 - Admin can still manually credit wallets when needed for demos, corrections, or offline payments.

 Future monetization can add reward credits, verified claims, SMS fees, or Meloschool integrations, but not in the MVP.

 ## 7. Core Roles

 | Role | Description |
 | :--- | :--- |
 | Platform Admin | Owns EduClearance operations, approves schools, credits wallets, resolves disputes, monitors abuse.
 |
 | School Owner/Admin | Claims a school, manages school profile, starts clearance requests, reports issues, views
 wallet/history. |
 | School Staff | Optional delegated school user with restricted ability to start requests/report issues. |
 | Previous School Contact | Receives request notification and can respond to/resolve a clearance case when active. |

 ## 8. Core Data Model Draft

 ```txt
 schools
 - id
 - name
 - slug
 - address
 - area
 - main_phone
 - clearance_phone
 - contact_email
 - contact_person
 - logo_url
 - status: unclaimed | pending | active | suspended
 - created_at
 - updated_at

 users
 - id
 - school_id
 - name
 - email
 - phone
 - role: platform_admin | school_owner | school_admin | school_staff
 - created_at

 clearance_requests
 - id
 - incoming_school_id
 - previous_school_id nullable
 - previous_school_name_snapshot
 - student_name
 - student_name_normalized
 - gender nullable
 - last_class nullable
 - parent_name
 - parent_phone
 - status: pending_verification | no_platform_record_found | previous_school_notified | cleared_by_previous_school |
 outstanding_balance_reported | disputed | no_response | previous_school_not_on_platform | closed
 - search_result: no_match | possible_match | confirmed_match
 - amount_charged
 - notification_status: not_sent | dashboard | whatsapp_generated | sent | failed
 - expires_at
 - created_by_user_id
 - created_at
 - updated_at

 clearance_issues
 - id
 - clearance_request_id nullable
 - reporting_school_id
 - student_name
 - student_name_normalized
 - parent_name
 - parent_phone
 - amount_owed
 - issue_type: school_fees | books | uniform | transport | other
 - academic_session
 - term
 - note
 - evidence_url nullable
 - status: unresolved | resolved | disputed | withdrawn
 - created_at
 - resolved_at nullable

 wallets
 - id
 - school_id
 - balance_kobo
 - created_at
 - updated_at

 wallet_transactions
 - id
 - school_id
 - type: credit | debit | refund | adjustment
 - amount_kobo
 - description
 - reference
 - provider: paystack | manual | system
 - created_by_user_id nullable
 - created_at

 payments
 - id
 - school_id
 - provider: paystack
 - provider_reference
 - amount_kobo
 - status: initialized | successful | failed | abandoned
 - metadata_json
 - created_at
 - verified_at nullable

 disputes
 - id
 - clearance_request_id nullable
 - clearance_issue_id nullable
 - raised_by_school_id nullable
 - reason
 - status: open | under_review | resolved | rejected
 - admin_note nullable
 - created_at
 - resolved_at nullable

 audit_logs
 - id
 - actor_user_id nullable
 - actor_school_id nullable
 - action
 - entity_type
 - entity_id
 - metadata_json
 - ip_address nullable
 - created_at
 ```

 ## 9. MVP Pages

 Highest-priority MVP pages:

 ```txt
 /
 /login
 /register
 /claim-school
 /dashboard
 /clearance/new
 /clearance/[id]
 /clearance
 /issues/new
 /issues
 /wallet
 /admin
 /admin/schools
 /admin/wallets
 /admin/clearance
 /admin/issues
 /admin/disputes
 ```

 ## 10. Functional Requirements

 | FR ID | Description | User Story | Status |
 | :--- | :--- | :--- | :--- |
 | FR-001 | Landing page explains EduClearance, pricing, privacy framing, and calls schools to claim/register. | As a
 school owner, I want to quickly understand the product, so that I know why to join. | MUS |
 | FR-002 | School directory stores manually seeded local schools with unclaimed/pending/active/suspended status. | As
 an admin, I want schools listed before onboarding, so that the network feels real and local. | MUS |
 | FR-003 | School claim and registration flow lets a school request access to an existing profile or create a new
 claim. | As a school owner, I want to claim my school, so that I can use the platform officially. | MUS |
 | FR-004 | Authentication and role-based authorization protect platform admin and school-only areas. | As a platform
 operator, I want secure role-based access, so that only approved users see sensitive data. | MUS |
 | FR-005 | Admin can approve, reject, suspend, and edit school profiles and school users. | As an admin, I want
 onboarding control, so that fake or abusive schools cannot join unchecked. | MUS |
 | FR-006 | A school can start a paid clearance request for one incoming student. | As an admitting school, I want to
 open a transfer clearance window, so that I can verify before admitting. | MUS |
 | FR-007 | Clearance request matching returns no-match, possible-match, or confirmed-match wording with safe
 disclaimers. | As a school user, I want careful result language, so that I do not mistake “no record” for “cleared.” |
 MUS |
 | FR-008 | Previous school notification/contact flow provides dashboard notification and generated WhatsApp/manual
 message. | As a school user, I want the previous school contacted, so that verification can continue outside a
 one-time search. | MUS |
 | FR-009 | Schools can report unresolved clearance issues for free, with structured fields and professional wording. |
 As a previous school, I want to report unresolved obligations, so that other schools are warned. | MUS |
 | FR-010 | Clearance requests and issues support statuses for pending, notified, cleared, unresolved, disputed, no
 response, and closed. | As all parties, I want clear statuses, so that each case has an understandable lifecycle. |
 MUS |
 | FR-011 | Wallet credits are deducted for clearance requests, can be topped up through Paystack, and can be adjusted
 by admin. | As a school owner, I want to pay for checks through wallet credits, so that pricing stays simple. | MUS |
 | FR-012 | Admin dashboard manages schools, wallets, clearance requests, issues, disputes, and suspicious activity. |
 As a platform admin, I want operational control, so that I can run the MVP safely. | MUS |
 | FR-013 | Audit logs and privacy controls record sensitive actions and enforce data-minimizing, school-only access. |
 As the platform owner, I want accountability, so that the product is safer and more defensible. | MUS |
 | FR-014 | The UI is mobile-friendly and fast for school owners using phones. | As a proprietor or staff member, I
 want to use the app on my phone, so that it works during admissions. | MUS |
 | FR-015 | Seed/demo data supports a convincing local demo with schools, wallets, and sample clearance cases. | As the
 builder, I want demo data, so that I can show the MVP quickly. | MUS |
 | FR-016 | Automated SMS/email notification sends previous-school requests without manual WhatsApp. | As a school
 user, I want automated notifications, so that follow-up is easier. | Future |
 | FR-017 | Advanced fuzzy matching improves name/phone matching and duplicate detection. | As a school user, I want
 stronger matching, so that spelling variations do not hide cases. | Future |
 | FR-018 | Reward credits or trust levels incentivize high-quality reports without revenue sharing complexity. | As a
 participating school, I want recognition for useful reporting, so that contribution feels valuable. | Future |
 | FR-019 | Meloschool integration lets Meloschool admissions open EduClearance checks directly. | As a Meloschool
 user, I want clearance checks inside admissions, so that the products work together later. | Future |
 | FR-020 | Parent-facing dispute/clearance portal allows parents to view and challenge records safely. | As a parent,
 I want a clear dispute path, so that inaccurate records can be corrected. | Future |

 ## 11. Non-Functional Requirements

 - Sensitive pages must require authentication.
 - School users must only access their own school data plus minimum necessary clearance result data.
 - Paystack webhook verification must validate signatures before crediting wallets.
 - Wallet debits must be transactional/idempotent; duplicate requests must not double-charge accidentally.
 - Records involving children must be minimized, purpose-bound, and not publicly indexed.
 - The app must be usable on mobile screens first.
 - Database migrations must be repeatable against local PostgreSQL and Neon.
 - Important actions must be audit logged.

 ## 12. MVP Acceptance Summary

 The MVP is acceptable when:

 1. Admin can seed schools and approve claims.
 2. Active schools can log in and see their wallet.
 3. Active schools can start a clearance request and get safe result wording.
 4. Starting a clearance request deducts credit.
 5. Active schools can report unresolved issues for free.
 6. Previous-school contact/notification guidance is visible.
 7. Admin can review schools, wallets, requests, issues, and disputes.
 8. Paystack top-up flow credits wallets after verified payment.
 9. The app is mobile-friendly and has demo data for a local school-cluster pitch.
 ''')

 coding = dedent('''\
 # EduClearance Coding Guidelines

 Created: 2026-06-11
 Stage: Genesis

 ## 1. Scope Law

 EduClearance is an inter-school transfer clearance network. Do **not** turn the MVP into a full school ERP. Avoid
 building results, attendance, report cards, class management, or AI tutoring unless a future task explicitly adds
 Meloschool integration.

 ## 2. Product Language Rules

 Use professional, legally safer wording:

 - Use: “clearance request,” “outstanding balance,” “unresolved issue,” “transfer verification,” “no platform record
 found.”
 - Avoid: “blacklist,” “debtor database,” “bad parent,” “cleared” when there is only no match.

 Required no-match wording:

 > No unresolved record was found on EduClearance. This does not confirm that the student has cleared the previous
 school. Please contact the previous school directly or wait for their response.

 ## 3. Recommended Stack Conventions

 - Next.js App Router with TypeScript.
 - Tailwind CSS + shadcn/ui for UI.
 - PostgreSQL through Drizzle ORM migrations.
 - Neon for production database.
 - Local PostgreSQL for development:

 ```env
 DATABASE_URL="postgresql://postgres:password@localhost:54321/edu_clearance"
 ```

 - Paystack for top-ups and payment verification.
 - Store all secrets in `.env.local` or deployment environment variables; never commit real production secrets.

 ## 4. TypeScript Rules

 - Prefer explicit domain types for statuses, roles, and transaction types.
 - Avoid `any`; if unavoidable, isolate and document why.
 - Validate server inputs using a schema library such as Zod.
 - Keep server-only code out of client components.
 - Keep database access in server actions, route handlers, or server-side modules.

 ## 5. Database Rules

 - Use migrations for schema changes; do not hand-edit production schema.
 - Represent money in integer kobo (`balance_kobo`, `amount_kobo`) rather than floats.
 - Use transactions for wallet debits/credits and clearance request creation.
 - Make payment verification idempotent using unique provider references.
 - Normalize searchable names into separate fields where useful.
 - Add timestamps to all important tables.
 - Add audit logs for sensitive reads/writes.

 ## 6. Auth and Access Control

 - Platform admin access must be separate from school access.
 - School users must only mutate records belonging to their school unless a workflow explicitly permits a
 previous-school response.
 - Suspended schools must be blocked from starting clearance requests and creating reports.
 - Unapproved/pending schools must not access sensitive clearance data.
 - Never trust client-side role checks alone; enforce permissions server-side.

 ## 7. Privacy and Safety Rules

 - Store only the minimum student/parent data needed for a clearance case.
 - Do not expose clearance records publicly or to search engines.
 - Avoid public profile pages for children or parents.
 - Provide dispute and correction paths.
 - Log who searched or viewed sensitive case data.
 - Do not show unnecessary details when there is no confirmed match.

 ## 8. Paystack Rules

 - Initialize payments server-side.
 - Verify Paystack responses server-side before crediting wallets.
 - Verify webhook signatures before processing webhooks.
 - Make wallet credits idempotent by `provider_reference`.
 - Keep manual admin wallet adjustments clearly marked as `manual` with audit logs.

 ## 9. UI Rules

 - Mobile-first layout; school owners may use phones during admissions.
 - Make primary actions obvious: Start Clearance Request, Report Issue, Top Up Wallet.
 - Display wallet balance and checks remaining clearly.
 - Show sensitive disclaimers in result states.
 - Use calm, official visual language; avoid shame-based UX.

 ## 10. Verification Commands

 Use the strongest available checks for the eventual app. Recommended scripts once the Next.js project exists:

 ```bash
 npm run lint
 npm run typecheck
 npm run test
 npm run build
 ```

 If no dedicated typecheck script exists, use:

 ```bash
 npx tsc --noEmit
 ```

 Database verification should include:

 ```bash
 npm run db:generate
 npm run db:migrate
 npm run db:seed
 ```

 Exact scripts may change after the project is initialized, but build tasks must update this file when they do.

 ## 11. Definition of Done for Build Tasks

 A task is not complete unless:

 - The implementation matches the relevant `docs/issues/FR-XXX.md` acceptance criteria.
 - Permissions are enforced server-side.
 - Money operations are transactional/idempotent where relevant.
 - UI states include loading, empty, success, and error states where practical.
 - Verification commands were run or the reason they could not run is documented.
 ''')

 builder = dedent('''\
 # EduClearance Builder Prompt

 Created: 2026-06-11
 Recommended next stage: Vibe Design, then Vibe Build

 ## Product Focus

 Build **EduClearance**, not Meloschool. The MVP is a standalone transfer-clearance network for local schools.

 The core product action is:

 > Start a paid clearance request for one incoming student.

 Not:

 > Search a debtor database.

 ## Stack to Use

 - Next.js App Router + TypeScript
 - Tailwind CSS + shadcn/ui
 - PostgreSQL
 - Neon for production
 - Local PostgreSQL for development
 - Drizzle ORM recommended
 - Paystack for wallet top-ups

 Local development database:

 ```env
 DATABASE_URL="postgresql://postgres:password@localhost:54321/edu_clearance"
 ```

 Production secrets must come from environment variables:

 ```env
 DATABASE_URL="<neon-postgres-url>"
 PAYSTACK_SECRET_KEY="<server-only>"
 PAYSTACK_PUBLIC_KEY="<client-safe-public-key>"
 PAYSTACK_WEBHOOK_SECRET="<if configured>"
 NEXT_PUBLIC_APP_URL="http://localhost:3000"
 ```

 ## Build Priority Order

 1. Initialize app, styling, auth scaffold, database/migrations.
 2. Create schema for schools, users, clearance requests, issues, wallets, transactions, payments, disputes, audit
 logs.
 3. Build platform admin login/protection and seeded admin user strategy.
 4. Build school directory and claim/approval flow.
 5. Build school dashboard with wallet balance.
 6. Build Start Clearance Request flow with safe result wording.
 7. Implement matching against unresolved issues.
 8. Deduct wallet credit transactionally when a request starts.
 9. Build unresolved issue reporting; reporting must be free.
 10. Build previous-school notification/contact UX, with WhatsApp/manual message generation for MVP.
 11. Build Paystack top-up initialization and verification/webhook path.
 12. Build admin views for schools, wallets, requests, issues, disputes.
 13. Add seed/demo data for a local school-cluster pitch.
 14. Polish mobile UI and landing page copy.

 ## Must-Not-Build Yet

 Do not build these unless a future issue explicitly changes scope:

 - Full result management
 - Report cards
 - Attendance
 - Class/subject setup
 - Parent portal beyond future dispute planning
 - AI learning recommendations
 - School fees collection outside wallet top-ups
 - Revenue sharing/split settlement
 - Inter-school penalties

 ## Critical Product Details

 - “No record found” must never be presented as “cleared.”
 - Reporting an unresolved issue is free.
 - Starting a clearance request costs wallet credit.
 - Previous school contact details should use official school clearance contact, not private staff numbers unless
 intentionally provided.
 - Use statuses from `docs/Project_Requirements.md`.
 - All sensitive access should be logged.

 ## Demo Target

 Prepare a demo that shows:

 1. Admin has seeded schools in a local area.
 2. A school claims/registers and gets approved.
 3. Admin credits or Paystack tops up wallet.
 4. School starts a clearance request for an incoming student.
 5. No-match case shows safe disclaimer and previous-school contact.
 6. Match case shows an unresolved issue professionally.
 7. Previous school can report/resolve/dispute.
 8. Admin can monitor and intervene.
 ''')

 Path('docs/Project_Requirements.md').write_text(prd, encoding='utf-8')
 Path('docs/Coding_Guidelines.md').write_text(coding, encoding='utf-8')
 Path('docs/Builder_Prompt.md').write_text(builder, encoding='utf-8')

 features = [
     ('FR-001','Landing Page Positioning','marketing, onboarding','Landing page explains EduClearance, pricing, privacy
 framing, and calls schools to claim/register.','As a school owner, I want to quickly understand the product, so that I
 know why to join.','Build a mobile-friendly landing page using professional clearance language, simple pricing, and a
 clear CTA to claim/register a school.','Create sections for hero, problem, how it works, pricing, privacy/trust, and
 CTA. Use copy from the PRD and avoid debtor/blacklist language.','Use Next.js page composition with reusable UI
 sections. Include a primary CTA to claim school and secondary CTA to contact platform/admin.','Must clearly state
 ₦5,000 = 50 student checks; must clarify this is private school-to-school verification; must not promise guaranteed
 clearance.',['Landing page is accessible at `/`.','Copy uses EduClearance positioning and safe language.','Pricing is
 visible as ₦5,000 for 50 checks.','CTA routes to claim/register flow.','Mobile layout is usable.'],'MUS'),
     ('FR-002','School Directory','schools, admin','School directory stores manually seeded local schools with
 unclaimed/pending/active/suspended status.','As an admin, I want schools listed before onboarding, so that the network
 feels real and local.','Create school records that can exist before a school has claimed them.','Define `schools`
 schema, seed sample/local schools, add admin list/search, and expose claimable schools in the claim flow.','Use slugs
 for stable routing/search. Status controls visibility and permissions.','Directory is not a public sensitive data
 source; only official school contact information should be exposed.',['Schools can be seeded manually or through seed
 script.','Statuses include unclaimed, pending, active, suspended.','Admin can view/search schools.','Claim flow can
 select existing unclaimed school.'],'MUS'),
     ('FR-003','School Claim Registration','onboarding, auth','School claim and registration flow lets a school request
 access to an existing profile or create a new claim.','As a school owner, I want to claim my school, so that I can use
 the platform officially.','Let school owners create an account and submit a claim for a listed school or a new
 school.','Build claim form, validate contact fields, create pending user/school claim, and show awaiting approval
 state.','Registration should create school-scoped user but not grant active access until admin approval.','Prevent
 duplicate active claims where practical; admin can resolve duplicates.',['User can submit claim for existing
 school.','User can submit new school request if not listed.','Claim stays pending until admin approval.','Pending
 users cannot access sensitive clearance data.'],'MUS'),
     ('FR-004','Authentication and RBAC','auth, security','Authentication and role-based authorization protect platform
 admin and school-only areas.','As a platform operator, I want secure role-based access, so that only approved users
 see sensitive data.','Implement login/logout and server-enforced roles for platform admin and school users.','Set up
 auth provider, session handling, protected layouts, and permission helpers.','Use server-side guards in route
 handlers/server actions; client checks are only UI helpers.','Suspended/pending users should fail closed.',['Users can
 sign in and out.','Protected routes reject unauthenticated users.','Platform admin routes require platform_admin
 role.','School routes require active school membership.','Permission checks exist server-side.'],'MUS'),
     ('FR-005','Admin School Approval','admin, onboarding','Admin can approve, reject, suspend, and edit school
 profiles and school users.','As an admin, I want onboarding control, so that fake or abusive schools cannot join
 unchecked.','Build admin controls for school lifecycle and user activation.','Create admin pages/actions to approve
 pending claims, reject claims, suspend/reactivate schools, and edit official contacts.','School status should drive
 all school permissions.','Every approval/suspension action should be audit logged.',['Admin can approve a pending
 school claim.','Admin can reject a claim with note.','Admin can suspend active schools.','Suspended schools cannot
 start requests or report issues.','Actions are audit logged.'],'MUS'),
     ('FR-006','Paid Clearance Request','clearance, wallet','A school can start a paid clearance request for one
 incoming student.','As an admitting school, I want to open a transfer clearance window, so that I can verify before
 admitting.','Create the main workflow: school enters student/parent/previous school info and opens a clearance request
 after wallet debit.','Build form, validation, wallet check, transactional debit, request creation, and redirect to
 result/detail page.','Use a DB transaction to debit wallet and create the request. Block if balance is
 insufficient.','Do not store more student data than needed.',['Active school can submit request form.','Request
 creation charges ₦100 from wallet.','Insufficient wallet balance blocks request.','Request has lifecycle status and
 detail page.','Debit and request creation are transactional.'],'MUS'),
     ('FR-007','Safe Matching Results','clearance, safety','Clearance request matching returns no-match,
 possible-match, or confirmed-match wording with safe disclaimers.','As a school user, I want careful result language,
 so that I do not mistake “no record” for “cleared.”','Match incoming clearance request against unresolved issues and
 return professional result states.','Normalize name/phone, match primarily by parent phone plus student name, show
 safe no-match language, and avoid overexposing data for weak matches.','Start with simple deterministic matching;
 advanced fuzzy matching is future scope.','No-match language is legally/product-wise critical.',['Result can be
 no_match, possible_match, or confirmed_match.','No-match state says no platform record found, not cleared.','Possible
 matches are clearly labeled as possible.','Confirmed unresolved issue shows previous school, type, amount, status, and
 actions.'],'MUS'),
     ('FR-008','Previous School Notification','notifications, clearance','Previous school notification/contact flow
 provides dashboard notification and generated WhatsApp/manual message.','As a school user, I want the previous school
 contacted, so that verification can continue outside a one-time search.','When previous school is selected, generate a
 notification and contact path.','Create dashboard notification for active previous school and generate WhatsApp
 message/contact block for manual outreach.','Use official clearance contact fields from school profile.','Do not
 expose private staff numbers unless configured as official clearance contact.',['Request detail shows previous school
 contact if known.','Active previous school receives dashboard notification.','WhatsApp/manual message can be
 generated.','Notification status is tracked.'],'MUS'),
     ('FR-009','Free Issue Reporting','issues, contribution','Schools can report unresolved clearance issues for free,
 with structured fields and professional wording.','As a previous school, I want to report unresolved obligations, so
 that other schools are warned.','Allow active schools to create unresolved issue records without wallet
 charge.','Build issue form with amount/type/session/term/note/evidence and status. Validate and audit log
 creation.','Reports should be structured and professional, not public shaming.','Future can add verified claims/trust
 scoring; not MVP.',['Active schools can report an issue for free.','Required fields are validated.','Issue status
 starts unresolved unless saved otherwise by allowed flow.','Issue creation is audit logged.','UI avoids
 blacklist/debtor language.'],'MUS'),
     ('FR-010','Case Status Workflow','workflow, disputes','Clearance requests and issues support statuses for pending,
 notified, cleared, unresolved, disputed, no response, and closed.','As all parties, I want clear statuses, so that
 each case has an understandable lifecycle.','Implement status fields and actions that move cases through the MVP
 lifecycle.','Define valid status transitions for clearance requests and clearance issues. Add action buttons for mark
 cleared, report outstanding, dispute, close, and admin override where appropriate.','Keep transitions simple and
 auditable.','Avoid impossible mixed states where a case is both cleared and unresolved.',['Statuses match PRD
 enumerations.','School/admin actions update statuses predictably.','Dispute status can be opened.','Closed cases are
 read-only except admin.','Status changes are audit logged.'],'MUS'),
     ('FR-011','Wallet and Paystack Top-up','wallet, payments','Wallet credits are deducted for clearance requests, can
 be topped up through Paystack, and can be adjusted by admin.','As a school owner, I want to pay for checks through
 wallet credits, so that pricing stays simple.','Build wallet balance, transactions, Paystack
 initialization/verification, and admin manual adjustments.','Use kobo integers, transaction table, Paystack reference
 verification, webhook or callback verification, and idempotency.','Never trust client payment success alone.','Manual
 credits must be clearly marked and audit logged.',['Wallet balance is visible to school.','Clearance request debit
 appears in transaction history.','Paystack top-up can initialize payment.','Verified successful Paystack payment
 credits wallet once.','Admin can make manual adjustment with audit log.'],'MUS'),
     ('FR-012','Admin Operations Dashboard','admin, operations','Admin dashboard manages schools, wallets, clearance
 requests, issues, disputes, and suspicious activity.','As a platform admin, I want operational control, so that I can
 run the MVP safely.','Create an admin dashboard with operational views and simple filters.','Build admin index plus
 subpages for schools, wallets, clearance, issues, disputes. Include basic counts and latest activity.','Prioritize
 useful CRUD/review tools over visual complexity.','Admin actions are sensitive and must require
 platform_admin.',['Admin dashboard exists.','Admin can view schools, wallets, requests, issues, and disputes.','Admin
 can filter or search key records.','Admin actions require platform_admin.'],'MUS'),
     ('FR-013','Audit Logs and Privacy Controls','privacy, compliance','Audit logs and privacy controls record
 sensitive actions and enforce data-minimizing, school-only access.','As the platform owner, I want accountability, so
 that the product is safer and more defensible.','Implement audit logging for sensitive actions and basic privacy
 safeguards.','Add audit log helper and call it from auth, clearance, issue, wallet, admin actions. Add noindex
 headers/meta for private pages.','Log enough metadata to investigate abuse without dumping sensitive full records into
 logs.','Children/parent data must be minimized and purpose-bound.',['Sensitive create/update/view actions are audit
 logged.','Private routes are not publicly indexed.','School users cannot view unrelated full
 records.','Dispute/correction path exists or is clearly stubbed.'],'MUS'),
     ('FR-014','Mobile-Friendly UI','ui, mobile','The UI is mobile-friendly and fast for school owners using
 phones.','As a proprietor or staff member, I want to use the app on my phone, so that it works during
 admissions.','Design all MVP flows mobile-first with clean, official UI.','Use responsive shadcn/Tailwind components,
 readable forms, clear cards, and sticky/obvious primary actions where helpful.','Do not over-design; prioritize
 clarity and trust.','Phone usage is a primary use case.',['Landing page works on mobile.','Dashboard cards are
 readable on mobile.','Forms are usable on mobile.','Critical result/disclaimer text is not hidden.'],'MUS'),
     ('FR-015','Seed and Demo Data','demo, seed','Seed/demo data supports a convincing local demo with schools,
 wallets, and sample clearance cases.','As the builder, I want demo data, so that I can show the MVP quickly.','Create
 seed data for a local school-cluster demo.','Add seed script for schools, admin user strategy, sample wallet balances,
 unresolved issue, resolved issue, and clearance requests.','Do not seed real children or private personal data. Use
 clearly fake/demo names.','Demo data must be safe and distinguishable from production.',['Seed script creates sample
 schools.','Seed script creates wallet/demo balances.','Seed script creates at least one no-match and one match
 scenario.','Demo data uses fake names and numbers.'],'MUS'),
     ('FR-016','Automated SMS Email Notifications','notifications, future','Automated SMS/email notification sends
 previous-school requests without manual WhatsApp.','As a school user, I want automated notifications, so that
 follow-up is easier.','Add automatic SMS/email notification after MVP validates workflow.','Integrate provider,
 templates, delivery status, retries, and notification preferences.','MVP should not depend on this; manual
 WhatsApp/dashboard path comes first.','Requires cost and consent review.',['Notification provider
 selected.','Templates approved.','Delivery status tracked.','Failures are visible to users/admin.'],'Future'),
     ('FR-017','Advanced Fuzzy Matching','matching, future','Advanced fuzzy matching improves name/phone matching and
 duplicate detection.','As a school user, I want stronger matching, so that spelling variations do not hide
 cases.','Improve matching beyond exact normalized fields.','Evaluate trigram indexes, phonetic matching, aliases,
 duplicate review, and admin merge tools.','Must avoid overconfident false matches.','Show match confidence
 carefully.',['Fuzzy matching improves typo/name variation detection.','Possible matches include
 confidence/explanation.','Admin can review duplicate candidates.'],'Future'),
     ('FR-018','Reward Credits and Trust Levels','incentives, future','Reward credits or trust levels incentivize
 high-quality reports without revenue sharing complexity.','As a participating school, I want recognition for useful
 reporting, so that contribution feels valuable.','Add non-complex incentives after usage data exists.','Design trust
 levels, reward credits, and penalties for false reports.','Do not implement revenue sharing in MVP.','Incentives must
 not encourage false reporting.',['Trust/reward rules are documented.','False report penalties exist.','Rewards are
 shown in wallet/trust UI.'],'Future'),
     ('FR-019','Meloschool Integration','integration, future','Meloschool integration lets Meloschool admissions open
 EduClearance checks directly.','As a Meloschool user, I want clearance checks inside admissions, so that the products
 work together later.','Expose EduClearance checks inside Meloschool admissions once standalone product works.','Design
 API/auth handoff and embedded admissions action.','Keep product boundaries clear.','EduClearance remains usable by
 non-Meloschool schools.',['Integration approach documented.','Meloschool can open clearance request.','Shared
 identity/payment risks are handled.'],'Future'),
     ('FR-020','Parent Dispute Portal','parents, future','Parent-facing dispute/clearance portal allows parents to view
 and challenge records safely.','As a parent, I want a clear dispute path, so that inaccurate records can be
 corrected.','Create limited parent-facing flow for disputes and corrections.','Design secure token-based access or
 verified identity process, parent view, evidence upload, and admin resolution.','This involves extra
 privacy/compliance concerns and is future scope.','Do not expose child data publicly.',['Parent can open dispute
 securely.','Parent can submit evidence.','Admin can resolve dispute.','Schools see dispute outcome.'],'Future'),
 ]

 for fr, title, labels, desc, story, solution, flow, tech, considerations, ac, status in features:
     content = f"""# {fr}: {title}\n\nStatus: {status}  \nLabels: {labels}\n\n## Requirement\n\n{desc}\n\n## User
 Story\n\n{story}\n\n## Proposed Solution\n\n{solution}\n\n## Implementation Flow\n\n{flow}\n\n## Technical
 Approach\n\n{tech}\n\n## Key Considerations\n\n{considerations}\n\n## Acceptance Criteria\n\n"""
     content += ''.join(f"- [ ] {item}\n" for item in ac)
     content += "\n## Notes\n\nKeep this issue aligned with `docs/Project_Requirements.md`. If scope changes, update
 the FR table and this issue together.\n"
     Path(f'docs/issues/{fr}.md').write_text(content, encoding='utf-8')

 feature_doc = dedent('''\
 # EduClearance Clearance Workflow

 This folder is reserved for feature-level design notes. Current core workflow:

 1. Admitting school starts a clearance request for one incoming student.
 2. Wallet is charged for the request.
 3. System checks unresolved issues and returns safe result wording.
 4. Previous school is notified or contact information/manual WhatsApp message is shown.
 5. Case remains open until cleared, unresolved, disputed, no response, or closed.

 Detailed implementation scope lives in `docs/issues/FR-006.md` through `docs/issues/FR-010.md`.
 ''')
 Path('docs/features/clearance-workflow.md').write_text(feature_doc, encoding='utf-8')
 Path('docs/mockups/.gitkeep').write_text('', encoding='utf-8')
 Path('scripts/.gitkeep').write_text('', encoding='utf-8')

 session_plan = dedent('''\
 # Orchestration Session: EduClearance Genesis to MVP

 Session ID: orch-20260611-130831
 Project: EduClearance
 Current stage: Genesis

 ## Scope

 Create a clear product foundation for EduClearance as a standalone school transfer-clearance MVP, then proceed to UI
 design and build.

 ## Genesis Outputs

 - `docs/Project_Requirements.md`
 - `docs/Coding_Guidelines.md`
 - `docs/Builder_Prompt.md`
 - `docs/issues/FR-001.md` through `docs/issues/FR-020.md`
 - `docs/features/clearance-workflow.md`

 ## Recommended Lifecycle

 1. Genesis: foundation artifacts and FR issue mapping.
 2. Design: mobile-first UX flows and page/component plan.
 3. Build: initialize app and implement MUS issues in priority order.
 4. Review: deep privacy/payment/wallet review before demo use.

 ## Build Priority

 Start with auth, database schema, admin/school onboarding, wallet, clearance request, issue reporting, Paystack, then
 demo polish.
 ''')
 Path('docs/tasks/orchestrator-sessions/orch-20260611-130831/MASTER_PLAN.md').write_text(session_plan,
 encoding='utf-8')

 genesis_task = dedent('''\
 # Task: Genesis Foundation Artifacts

 Task ID: genesis-foundation
 Stage: Genesis
 Role: orchestrator/architect
 Status: completed

 ## Objective

 Convert `00_Notes/Idea.md` plus the user's infrastructure decisions into a buildable project foundation for
 EduClearance.

 ## Acceptance Criteria

 - [x] PRD defines mission, stack, business model, functional requirements, and data model draft.
 - [x] Coding guidelines define implementation law, privacy rules, payment rules, and verification expectations.
 - [x] Builder prompt gives build order and local/prod environment constraints.
 - [x] One issue file exists for every FR in the PRD.
 - [x] Paystack, Neon, and local PostgreSQL details are captured.

 ## Notes

 Next recommended stage: Vibe Design.
 ''')
 Path('docs/tasks/orchestrator-sessions/orch-20260611-130831/tasks/genesis-foundation.md').write_text(genesis_task,
 encoding='utf-8')

 print('Wrote Genesis artifacts: PRD, coding guidelines, builder prompt, 20 issue files, feature note, session plan.')
 PY

 spawn ENAMETOOLONG

 Took 0.1s


 Considering issue generation

 I'm exploring whether to use a smaller Python script with simplified issue definitions, which could make things less
 long but still effective. I wonder if I can generate issue files automatically from the PRD. Using a Python list to
 summarize could work, with a simpler loop and generic templates. While the detailed issue file might be required, I
 want to ensure the final documents are practical and avoid unnecessary complexity. Let's focus on writing the PRD
 first.

 Writing simpler Python scripts

 I’m thinking about writing a simpler Python script to handle issues. It seems this could make things more manageable
 than my current approach. Instead of using commands, I could use a write function to streamline the process. So, I’ll
 focus on creating the PRD first, which could help organize everything more effectively. It feels like simplifying will
 save time and effort in the long run!