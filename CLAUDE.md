# CLAUDE.md - Gestion de Pagos

## Purpose
React/TypeScript SPA for payment request management: employees submit payment requests, finance team approves/rejects them, with role-based access (requester vs finance vs admin), exchange rate tracking, and NetSuite integration for payment processing.

## Status
- **Phase:** Active Development
- **Last audited:** 2026-07-01
- **Last modified:** 2026-06-30
- **Owner:** Emiliano / Enlight TECH

## Architecture
```mermaid
graph LR
  A[React SPA] -->|Google OAuth login| B[AuthContext]
  A --> C[NewRequest component]
  C -->|POST| D[n8n webhook - sheets.ts service]
  A --> E[ApprovalManagement component]
  E -->|PATCH| D
  A --> F[Dashboard + KPI components]
  F -->|GET| D
  D -->|read/write| G[(Google Sheets backend)]
  H[NetSuite integration] --> I[NetSuite_Integration_Reference.md docs]
  J[decision.ts service] --> K[DecisionPagos component]
```

## Files & Responsibilities
| File | Type | Purpose |
|------|------|---------|
| src/App.tsx | React | Root app, OAuth provider, view routing |
| src/context/AuthContext.tsx | React | Google OAuth + role management |
| src/services/sheets.ts | TS | API calls to n8n/Sheets backend (fetchRequests, createRequest, etc.) |
| src/services/decision.ts | TS | Decision logic for payment approval |
| src/components/Dashboard.tsx | React | KPI dashboard view |
| src/components/ApprovalManagement.tsx | React | Finance approval queue |
| src/components/NewRequest.tsx | React | New payment request form |
| src/components/RequestExplorer.tsx | React | Request search/browse |
| src/components/FinanceManagement.tsx | React | Finance team view |
| src/components/LoginScreen.tsx | React | Google OAuth login screen |
| src/components/RoleGate.tsx | React | Role-based component visibility |
| src/data/mockData.ts | TS | Mock data for development/testing |
| .env | Config | Google Client ID + n8n webhook base URL (gitignored, not committed) |
| public/uploads/decision_pagos.html | HTML | Decision payment reference page |

## External Dependencies
| System | How connected | Credential location |
|--------|---------------|---------------------|
| Google OAuth | @react-oauth/google, Client ID in .env | .env (gitignored, never committed) |
| n8n webhooks | sheets.ts service layer | VITE_N8N_WEBHOOK_BASE in .env |
| Google Sheets | Via n8n workflow backend | n8n credentials store |
| NetSuite | Reference docs present; integration scope unclear | TBD |

## Design System Compliance
- Fonts: Alexandria + Albert Sans self-hosted in src/assets/fonts/ - DS COMPLIANT.
- Colors: Uses CSS custom properties matching brand tokens.
- Component architecture appropriate for a production React app.

## Key Technical Decisions
1. Google Sheets as backend via n8n - avoids dedicated database for MVP, but has scaling ceiling.
2. Role-based access via RoleGate component + AuthContext.
3. Mock data in mockData.ts - allows development without live API.

## Known Issues / Tech Debt
1. Google Sheets as backend will hit scaling limits at moderate request volume - plan migration to proper DB.
2. NetSuite integration scope unclear from code alone - reference docs exist but integration may not be implemented.
3. mockData.ts in src/ - ensure not loaded in production build.
4. Approver routing for the submission-notification email (see below) depends on project type; the exact rule is undefined and not documented anywhere in code or sheets yet.

## Email Notifications (n8n-side, no frontend changes)
Status transitions trigger Gmail emails from inside the existing n8n workflows (no polling/sockets/new frontend deps) — see `NetSuite_Integration_Reference.md` §4.8 for full detail.
- `public/n8n/workflow-roster.json` (new) — `GET /webhook/roster?roles=a,b` returns emails for given role(s) from the `Roles Portal Pagos` sheet (reverse of the existing `/webhook/role` email→role lookup).
- `public/n8n/workflow-postSolicitudes.json`, `workflow-patchStatus.json`, `workflow-patchFinanzas.json` — each extended with a confirmation email to the requester + (where applicable) a notification email to Finanzas (`analista_contable`), following the style pattern in `public/n8n/partialworkflow-stylemailreference.json`.
- **Open item:** submission-time notification only reaches Finanzas today — approver routing by project type is unresolved (see Known Issues #4). A sticky note in `workflow-postSolicitudes.json` marks where to wire it in once defined.
- These are JSON exports kept in the repo for reference/version history — the live workflows must still be updated/imported in the n8n cloud instance (egenlight.app.n8n.cloud) for changes to take effect.

## Resolved
- 2026-07-06: Removed stray `gestioon-pagos/` nested git clone (leftover duplicate of this same repo, not part of the Vercel deploy which builds from repo root). Its only tracked content, `decision_pagos.html`, was moved to `public/uploads/decision_pagos.html`; the outdated duplicate `netsuite_integration.md` was dropped in favor of the more complete root-level `NetSuite_Integration_Reference.md`. Real `.env` values (previously only present untracked inside the nested clone) were copied into the root `.env` (gitignored, never committed in either location — the prior "exposed credentials" note was inaccurate).

## Agent Routing
- Frontend/React tasks -> @agent-html
- NetSuite tasks -> @agent-netsuite
- n8n tasks -> @agent-n8n
