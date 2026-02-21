# Role-Based Access Control (RBAC) Matrix

## Roles

| Role | Code | Description |
|------|------|-------------|
| Management | `MANAGEMENT` | President/MD/CFO — full visibility, approval authority |
| Consultant | `CONSULTANT` | Contractors/consultants — self-service portal |
| Recruitment | `RECRUITMENT` | Internal recruiters — sourcing + submission |
| Sales | `SALES` | Business development — vendor/client relations |
| HR | `HR` | Human resources — onboarding, engagement, compliance |
| Immigration | `IMMIGRATION` | Immigration specialists — visa case management |
| Accounts | `ACCOUNTS` | Finance — billing, payroll, AR management |

## Multi-Tenancy Model

- Each staffing firm is a **Tenant**
- All data is scoped by `tenantId` using Postgres Row-Level Security (RLS)
- Users belong to exactly one tenant
- Superadmin role (platform-level) exists for system operations only

## Permission Matrix

| Resource | Management | Consultant | Recruitment | Sales | HR | Immigration | Accounts |
|----------|-----------|------------|-------------|-------|-----|-------------|----------|
| Dashboard (own role) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Command Center | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| All consultants | ✅ | ❌ | ✅ | ✅(read) | ✅ | ✅(read) | ✅(read) |
| Own profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Jobs | ✅ | ✅(read own) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Submissions | ✅ | ✅(own) | ✅ | ✅(read) | ❌ | ❌ | ❌ |
| Interviews | ✅ | ✅(own) | ✅ | ✅(read) | ❌ | ❌ | ❌ |
| Vendors/Clients | ✅ | ❌ | ✅(read) | ✅ | ❌ | ❌ | ✅(read) |
| Timesheets | ✅ | ✅(own) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Invoices | ✅ | ✅(own,read) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Payments | ✅ | ✅(own,read) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Immigration cases | ✅ | ✅(own,read) | ❌ | ❌ | ❌ | ✅ | ❌ |
| Compliance docs | ✅ | ✅(own) | ❌ | ❌ | ✅ | ✅(read) | ❌ |
| Trust scores | ✅ | ❌ | ✅(read) | ✅ | ❌ | ❌ | ✅(read) |
| Agent audit logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tenant settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Approval Gates (Human Sign-off Required)

| Action | Approver |
|--------|----------|
| Final rate proposal (above/below threshold) | Management |
| Immigration document submission | Management |
| Payroll run | Management + Accounts |
| Contract signing | Management |
| Vendor onboarding (high-risk terms flagged) | Management |
| Compliance override | Management |
| Agent policy change | Management |
