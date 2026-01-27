# GitHub Issue: FR-006 Calculation Engine

## Title
[Feature] Per-Project Revenue Share Calculation Engine

## Labels
`MUS`, `enhancement`, `calculations`, `critical`

## User Story
As an HR admin, I want to run the settlement calculation, so that payouts are generated automatically based on the policy.

## Proposed Solution

### The Calculation Flow

1. **For each project in period:**
   - Calculate 40/20/40 split from gross revenue
   - Store `companyRetained`, `crpContribution`, `pppPool` on project
   - Distribute PPP among contributors by PW
   - Handle referral bonus (5% of gross) if referrer exists

2. **At period level:**
   - Sum all project CRPs
   - Divide among active core members
   - Handle deferred CRP (inactive >60 days → company retained)
   - Calculate intern bonuses with caps

3. **Generate monthly payout records:**
   - One record per member with: CRP + PPP + Referrals + Intern = Total

### Technical Approach

```typescript
// Pure calculation functions in features/calculations/engine.ts
export function calculateProjectSplit(grossRevenue: number) { ... }
export function calculatePPPPayouts(pppPool: number, contributors: Contributor[]) { ... }
export function calculateCRPDistribution(totalCRP: number, coreMembers: Member[]) { ... }
export function calculateInternBonus(totalRevenue: number, internCount: number) { ... }

// Orchestrator that uses DB
export async function runSettlementCalculation(periodId: string) { ... }
```

### Unit Tests Required

- `calculateProjectSplit` returns correct 40/20/40
- `calculatePPPPayouts` distributes by PW correctly
- `calculateCRPDistribution` handles inactive members
- `calculateInternBonus` applies tier caps

## Acceptance Criteria

- [x] Pure calculation functions are tested
- [x] "Run Calculation" button triggers full settlement
- [x] Each project gets 40/20/40 stored
- [x] PPP distributed within each project
- [x] CRP summed and divided among active core members
- [x] Inactive core members get CRP deferred
- [x] Referral bonus = 5% of gross (if referrer)
- [x] Intern bonus capped correctly
- [x] Period status changes to CALCULATED
- [x] Cannot re-run calculation on FINALIZED period



# GitHub Issue: FR-007 Settlement View

## Title
[Feature] Settlement View with Per-Member Breakdown

## Labels
`MUS`, `enhancement`, `settlements`

## User Story
As an HR admin, I want to see per-member breakdowns, so that I can verify and approve payouts.

## Proposed Solution

### Settlements Page (`/settlements` or `/periods/[id]/settlements`)

**Settlement Table:**
| Member | Ref Code | CRP | PPP | Referrals | Intern | Total | Status |
|--------|----------|-----|-----|-----------|--------|-------|--------|

**Features:**
- Filter by period
- Sort by any column
- Search by member name
- Status badges (Pending, Approved, Paid)
- Bulk approve button

### Member Detail Modal/Page
- Breakdown of how their total was calculated
- CRP: ₦X (from Total CRP ÷ 8 core members)
- PPP by project:
  - Project A: 3 PW × ₦Y = ₦Z
  - Project B: 2 PW × ₦W = ₦V
- Referral: 5% of ₦X = ₦R
- Total: ₦ Sum

## Acceptance Criteria

- [x] Settlement table shows all members with payouts
- [x] Columns: CRP, PPP, Referrals, Intern, Total
- [x] Can sort by any column
- [x] Can filter by period
- [x] Member detail shows calculation breakdown
- [x] Can approve individual payouts
- [x] Can bulk approve all pending
- [x] Status updates correctly



# GitHub Issue: FR-010 Authentication with Better Auth

## Title
[Feature] Secure Authentication with Better Auth

## Labels
`MUS`, `enhancement`, `auth`

## User Story
As an admin, I want to log in securely, so that only authorized users can access the dashboard.

## Proposed Solution

### Auth Features
- Email/password login
- Session management
- Role-based access (Admin, HR, Member)
- Protected routes

### Login Page (`/login`)
- Email input
- Password input
- "Sign In" button
- Error messages for invalid credentials

### User Roles
| Role | Access |
|------|--------|
| Admin | Full access, can finalize and delete |
| HR | Create periods, projects, run calculations |
| Member | View own data only (Phase 2) |

### Technical Approach

- Better Auth with Prisma adapter
- Store users in database
- Middleware for route protection
- Link users to team_members table

### Database Addition

```prisma
model User {
  id           String  @id @default(uuid())
  email        String  @unique
  password     String  // hashed
  role         UserRole
  teamMemberId String? @unique
  teamMember   TeamMember? @relation(fields: [teamMemberId], references: [id])
}

enum UserRole {
  ADMIN
  HR
  MEMBER
}
```

## Acceptance Criteria

- [x] Login page works
- [x] Invalid credentials show error
- [x] Successful login redirects to dashboard
- [x] Session persists across refreshes
- [x] Logout clears session
- [x] Protected routes redirect to login
- [x] Admin role has full access
- [x] HR role can manage data but not delete
