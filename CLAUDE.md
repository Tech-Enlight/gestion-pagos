# CLAUDE.md - Gestion de Pagos

## Purpose
React/TypeScript SPA for payment request management: employees submit payment requests, finance team approves/rejects them, with role-based access (requester vs finance vs admin), exchange rate tracking, and NetSuite integration for payment processing.

## Status
- **Phase:** Active Development
- **Last audited:** 2026-07-15
- **Last modified:** 2026-08-20
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
| src/components/RequestExplorer.tsx | React | Request search/browse (also renders "Mis solicitudes" in `mode="mine"`); aclaración panel offers "Solo responder y reenviar" or "Editar solicitud" (edits concept/departamento/monto before resubmitting) |
| src/components/FinanceManagement.tsx | React | Finanzas queue (Programar Pago / Marcar Pagado) |
| src/components/PaymentModal.tsx | React | "Marcar Pagado" modal (single + bulk); every field mandatory; bulk mode has a per-request NetSuite payment-match card (bill/payment selector, Monto Pagado, T/C, Banco, Referencia all sourced from the matched bill, not the request) plus derived-only Propuesta |
| src/components/DecisionPagos.tsx | React | Admin/superadmin decision queue (Aprobar/Aclaración/Rechazar) |
| src/components/Feed.tsx | React | "Inicio" announcements feed — analista_contable/admin/superadmin can publish (text + optional link); all roles read and can toggle a "like" (Zap icon); marks notifications read on view |
| src/components/TopBar.tsx | React | Bell icon + unread badge, polls unread-count every 90s, dropdown of recent posts, click navigates to Inicio and marks read |
| src/services/posts.ts | TS | API calls for the announcements feed (fetchPosts, createPost, toggleLike, fetchUnreadCount, markNotificationsRead) |
| src/components/Sidebar.tsx | React | Nav visibility per role |
| src/components/Combobox.tsx | React | Reusable searchable dropdown; options support an optional `badge` (e.g. "Ya pagada" on OCs already settled in NetSuite) |
| src/components/WorkflowTracker.tsx | React | Per-request status stepper, includes `Payment Approved` stage |
| src/components/LoginScreen.tsx | React | Google OAuth login screen |
| src/components/RoleGate.tsx | React | Role-based component visibility |
| src/data/mockData.ts | TS | Mock data for development/testing |
| .env | Config | Google Client ID + n8n webhook base URL (gitignored, not committed) |
| public/uploads/decision_pagos.html | HTML | Decision payment reference page |
| n8n-exports/ | JSON (gitignored) | Local copies of live n8n workflows (`workflow-PortalDePagos.json`, `workflow-PortalDecisionPagos.json`, `workflow-stylemailreference.json`) — may embed API tokens, never committed |

## External Dependencies
| System | How connected | Credential location |
|--------|---------------|---------------------|
| Google OAuth | @react-oauth/google, Client ID in .env | .env (gitignored, never committed) |
| n8n webhooks | sheets.ts service layer | VITE_N8N_WEBHOOK_BASE in .env |
| Google Sheets | Via n8n workflow backend (`Portal de Pagos` workflow, sheet MZ-FIN-08 "Pagos Operaciones") | n8n credentials store |
| NetSuite | Reference docs present; gates "Marcar Pagado" in Finanzas | n8n Code nodes ("n8n API" integration credential, rotated 2026-07-14) |

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
2. NetSuite integration scope unclear from code alone - reference docs exist but "Marcar Pagado" gating is the only confirmed live use; broader integration may not be implemented.
3. mockData.ts in src/ - ensure not loaded in production build.
4. `NetSuite_Integration_Reference.md` (§ around line 358) still references the old `public/n8n/` export path — stale since the 2026-07-15 move to `n8n-exports/`; update next time that doc is touched.
5. Per-role sidebar visibility (matrix below) has not yet been re-verified live per-role by Emiliano — confirmed only in code (Sidebar.tsx/App.tsx RoleGates), not by walking through each role in the browser.
6. "Marcar Pagado" and the "Rechazar" email have not been tested live end-to-end. Live-tested 2026-08-13 up through NetSuite bill/payment matching (see § NetSuite OC/Payment Matching Fixes below); actual "Paid" transition + Rechazar email still unverified.
7. **Blocking, added 2026-08-13** — the OC dropdown fix and the partial-payment-aware Marcar Pagado gate (see § NetSuite OC/Payment Matching Fixes) are only live in the local `n8n-exports/workflow-PortalDePagos.json` mirror. Two manual steps remain before either works in production: (a) re-import/paste the changed nodes into the live n8n cloud workflow, (b) add a "NetSuite Payment ID" column to the "Pagos Operaciones" Google Sheet. Until both are done, `nsPaymentId` stays empty for every request and Marcar Pagado behaves as before.
8. **Blocking, added 2026-08-14** — `PaymentModal.tsx`'s "Referencia de Operación" field now auto-prefills (editable) from `NSBill.payment_tranid` (the NetSuite VendPymt transaction number, e.g. `VENDPYMT12895`, confirmed live against payment id 857123 and cross-checked against its NetSuite UI "NÚMERO DE TRANSACCIÓN" field) when a NetSuite payment is matched. The `pagos-por-oc` SuiteQL in `n8n-exports/workflow-PortalDePagos.json` (`Code: Step 3 - Build Payment Query`) selects `t.transactionnumber` (NOT `tranid` — confirmed via direct SuiteQL that `transaction.tranid` is null for VendPymt records on this account; the display number lives in `transactionnumber` instead), joined via `LEFT JOIN transaction t ON t.id = ntll.nextdoc`, and threaded through `Code: Merge Bills + Payments` into each bill/payment row. This is only live in the local mirror — needs re-import to the n8n cloud workflow before the prefill works in production.
9. **Blocking, added 2026-08-18** — the "Editar solicitud" aclaración path (see § Aclaración: edit-and-resend) writes `concept`/`department`/`subtotal`/`iva`/`amount`/`paymentType` in its PATCH body, but the `patchStatus` mapping that persists them to the sheet is only live in the local `n8n-exports/workflow-PortalDePagos.json` mirror — needs re-import to n8n cloud before edited resubmits actually save.
10. Bulk "Marcar Pagado" was significantly reworked 2026-08-18 (see § Bulk "Marcar Pagado" rework) — frontend-only, no n8n dependency, but not yet live-tested with a real multi-request batch.
11. **Added 2026-08-20** — the Announcements Feed (`Feed.tsx`/`TopBar.tsx`, see § Announcements Feed + Notification Center) is live and verified at the n8n/webhook layer (direct curl tests), but has not yet been clicked through in the actual browser UI — verify the composer/like/bell/badge render and behave correctly per role before treating it as done.

## Approval Flow (confirmed with Emiliano 2026-07-14/15 — no routing by project type)
1. Requester submits (`Autorización`) → email to MAC-Dirección roster (`roles=mac,operaciones,ingenieria,servicios`), sent from `postSolicitudes`.
2. MAC-Dirección authorizes in **Aprobaciones** (`Autorización → Pending Fin`) → email to admins ("pendiente de decisión en Decisión de Pagos").
3. **Admin/superadmin decide in Decisión de Pagos** — single-step per-card + bulk actions via `PATCH /solicitudes/status`: Aprobar (`Pending Fin → Payment Approved`, straight to the accountant), Aclaración (`→ Draft` + comment, emails requester and returns to their queue), Rechazar. Legacy `Approved` rows get the same buttons. `analista_contable` has read-only access there.
4. **Requester resubmits after aclaración** (`Draft → Autorización` via `patchStatus`) → MAC-Dirección roster gets a re-envío notification including the requester's clarification response (see Email Notifications).
5. **Analista in Finanzas** works the `Payment Approved` queue: Programar Pago (sets `estimatedPaymentDate` → "Pago Programado" column + email to requester with the date), Marcar Pagado (NetSuite-gated) → `Paid`, plus Rechazar/Aclaración. Superadmin sees the same view with tabs (incl. Pago Aprobado). The intermediate `Approved` status is no longer produced by the UI (legacy rows still accept Programar Pago).

Live-tested end-to-end (2026-07-15, single user): submit → MAC email → aclaración (email + badge + "Requieren tu acción" counter + resubmit with response persisted) → re-authorize (re-envío email) → approve → programar pago (email with date). Not yet tested: per-role sidebar visibility, Marcar Pagado, Rechazar email.

### View visibility matrix (confirmed 2026-07-15, in Sidebar.tsx + App.tsx RoleGates)
- Panel general: mac/operaciones/ingenieria/servicios + admin + superadmin
- Nueva solicitud / Mis solicitudes / Tipo de cambio / Configuración: everyone
- Aprobaciones: mac/operaciones/ingenieria/servicios + superadmin (admin removed)
- Finanzas: analista_contable + superadmin (admin removed)
- Decisión de Pagos / Explorador: admin + analista_contable + superadmin
- "Mis solicitudes" renders `RequestExplorer` with `mode="mine"`: personal summary cards, Concepto + Pago programado columns, plain-language status hint (STATUS_DESC) in the side panel; WorkflowTracker now includes the `Payment Approved` stage (legacy `Approved` maps to it).
- Decisión de Pagos loads progressively: pagos-data/tipo-cambio render immediately, the slow oc-data (NetSuite) + forecast-data cross-reference merges in after ("Cruzando OC/pronóstico…" indicator); silent auto-refresh every 5 min and after each decision.

## Email Notifications (n8n-side, no frontend changes)
Status transitions trigger Gmail emails from inside the existing n8n workflows (no polling/sockets/new frontend deps) — see `NetSuite_Integration_Reference.md` §4.8 for full detail. All email logic below is live in n8n cloud (egenlight.app.n8n.cloud) as of 2026-07-15.
- All emails use the shared Enlight template (gradient header + logo + jade title, white card body, data table, TECH footer) — same visual language as Formulario EPP's emails. The HTML lives in 3 Code nodes of `Portal de Pagos`: `Build email HTML - Solicitud`, `Preparar notificacion pago`, `Preparar notificacion estado`.
- `GET /webhook/roster?roles=a,b` returns emails for given role(s) from the `Roles Portal Pagos` sheet (reverse of the existing `/webhook/role` email→role lookup).
- `postSolicitudes`, `patchStatus`, `patchFinanzas` workflows — each extended with a confirmation email to the requester + (where applicable) a notification email to the next role in the flow.
- Aclaración round-trip: GET `/solicitudes` returns `rejectReason`/`clarificationRequest`/`clarificationResponse` so the "Aclaración" badge and resubmit panel survive a page reload; `patchStatus` writes the real column name "Respuesta a la aclaración"; `Preparar notificacion estado` emails the requester "Tu solicitud requiere aclaración" (yellow comment box + instructions) on `Draft` + clarificationRequest.
- `isAclaracion` in `Preparar notificacion estado` was fixed to a real boolean (`status === 'Draft' && !!clarificationRequest`) — previously a string/boolean mismatch crashed the downstream IF - Notificar node.
- Re-envío after aclaración: when a request returns to `Autorización` via `patchStatus` (only happens on requester resubmit; initial submissions notify from `postSolicitudes`), `Preparar notificacion estado` now sends "Solicitud re-enviada tras aclaración — {id}" to the MAC-Dirección roster with the requester's clarificationResponse in a green box. Previously this transition sent nothing.
- `patchFinanzas` (`estimatedPaymentDate` → "Pago Programado" column, upsert mapping, returned by GET `/solicitudes`): `Preparar notificacion pago` sends "Tu pago fue programado — {id}" to the requester (and keeps the "pago realizado" email on `Paid`); Gmail node subject is dynamic (`{{ $json.subject }}`).
- `patchFinanzas` node order was rewired to be strictly sequential: `Webhook - PATCH Finanzas → Code in JavaScript2 → Append or update row in sheet1 → Obtener solicitud original → Preparar notificacion pago → IF - Notificar Pago → Gmail`. Previously `Obtener solicitud original` ran as a parallel branch off the webhook, racing the sheet upsert and intermittently causing "Node hasn't been executed" in `Preparar notificacion pago`, breaking both the pago-programado and pago-realizado emails. The lookup now reads the id via `$('Webhook - PATCH Finanzas').first().json.body.id` and fetches the row only after the upsert, so emails reflect fresh data.
- Notification routing (see Approval Flow): submission → `roles=mac,operaciones,ingenieria,servicios`; `Pending Fin` → `admin,superadmin`; re-envío (`Autorización` via patchStatus) → `roles=mac,operaciones,ingenieria,servicios`; `Payment Approved` → `analista_contable` (roster URL is a dynamic expression on `rosterRoles`); `Rejected`/approval confirmations → requester. In `patchStatus` the confirmation and next-role notification branches run in parallel off `Preparar notificacion estado`.
- JSON exports live locally under `n8n-exports/` (moved out of `public/` 2026-07-15 so no build/deploy can ever ship them — they may embed API tokens, which is accepted since the folder is gitignored). Not on GitHub, not in the Vercel deploy. The live workflows in n8n cloud (egenlight.app.n8n.cloud) are the source of truth; changes must be imported there to take effect (all 2026-07-15 fixes above were re-imported and verified live). Never deploy with `vercel` CLI from the local working dir.

## NetSuite OC/Payment Matching Fixes — 2026-08-13 (local mirror only, not yet imported to n8n cloud)
Found and fixed while live-testing a full payment cycle against PO-00098600 (NetSuite id 840258, project PROJ-588/id 9600). Both fixes are in `n8n-exports/workflow-PortalDePagos.json`; see Known Issue #7 for what's still pending.

- **OC dropdown (`ocs-por-proyecto`) missed POs with project assigned at the line level.** The query only matched the header field `custbody_bb_project`. Newer POs in this account (e.g. PO-00098600) instead carry project via a line-level custom segment, `transactionLine.cseg_bb_project` — a completely different NetSuite ID space than `job.id` (segment record id ≠ job id; only the display text, e.g. "PROJ-588 - ...", links them). `Code: OAuth SuiteQL` now matches `custbody_bb_project = :projectId OR BUILTIN.DF(tl.cseg_bb_project) LIKE (SELECT j.entityId FROM job j WHERE j.id = :projectId) || ' - %'` via a `LEFT JOIN transactionLine`, with `DISTINCT` to dedupe the line join.
- **PO status codes in the query didn't match this account's actual mapping.** The dropdown whitelisted `('B','E','F')` assuming NetSuite's generic status-letter meanings. This account's real `purchaseOrder.status` mapping is: A=Aprobación del supervisor pendiente, B=Recepción pendiente, C=Rechazado por supervisor, D=Parcialmente recibida, E=Facturación pendiente/parcialmente recibido, F=Factura pendiente, **G=Totalmente facturada**, H=Cerrada. Confirmed by querying `SELECT DISTINCT status, BUILTIN.DF(status) FROM purchaseOrder` directly. Changed the filter to `t.status NOT IN ('A','C','H')` (exclude only pending-approval/rejected/closed) so it doesn't silently drop valid statuses like G again if the letter mapping is ever misremembered.
- **"Marcar Pagado" gate only recognized fully-paid bills, but bills here are routinely paid in installments.** The old gate required `bill.is_paid` (NetSuite status = "Pagado por completo"), so a bill with any partial payment blocked every solicitud tied to it indefinitely. Reworked to match on amount instead: `pagos-por-oc`'s merge node (`Code: Merge Bills + Payments`) now returns **one row per (bill, payment) pair**, each carrying its own `payment_id` (previously collapsed into a single aggregated total per bill, with no `payment_id` exposed at all). Frontend (`FinanceManagement.tsx`) matches a request's `amount` against candidate payments (±1%/±1 unit tolerance) and excludes any `payment_id` already claimed by another request (via a new `nsPaymentId` field on `Request`, round-tripped through `patchFinanzas` → "NetSuite Payment ID" column → GET `/solicitudes`) — so two solicitudes can't be settled off the same NetSuite payment, and each installment can clear its own solicitud independently.

## PaymentModal / Marcar Pagado Fixes — 2026-08-18 (live in n8n cloud + frontend)
- **"Marcar Pagado" (single request) had an unsequenced race between its two PATCH calls.** `FinanceManagement.tsx`'s `handleMarkPaid` fired `onUpdateFinanceFields` (fields) and `onUpdateRequest` (status → `Paid`) back-to-back without `await`ing either — unlike the bulk path (`handleBulkMarkPaidConfirm`), which already awaited each sequentially. This let the two writes race on the same Google Sheets row and was the likely cause of a request reverting to `Draft` after being marked paid (finance fields saved, status not). Fixed by making `handleMarkPaid` async and awaiting the fields write before the status write, matching the bulk path.
- **Propuesta is now derived, not user-entered, and read-only in the modal.** Business rule: a request that went through Programar Pago (`estimatedPaymentDate` set) was "Aplazado"; one approved straight to payment was "Autorizado". Computed via `getProposal()` in `PaymentModal.tsx` for both single and bulk modes — the old manual Autorizado/Aplazado dropdown was removed.
- **Estatus OC was silently broken in bulk "Marcar Pagado".** The bulk gate (`handleBulkMarkPaidGate`) already computed a per-request PO status map but never used it — every request in a batch shared one blank field. Now threaded through as `nsOcStatusMap` → a per-row, still-editable column in the bulk table (prefilled from NetSuite, same as single mode already did).
- **Cliente now shows the NetSuite customer (CUS code + name), sourced from the OC/PO — not from the request's own `nsProjectId`.** Originally implemented by calling `proyecto-detalle` (`fetchProjectById`) using the request's stored `nsProjectId`, but that field is only set when the request was created with a project explicitly selected, so it was blank on department-level or legacy requests even when the OC/bill data resolved fine (confirmed live: PAY-880 had working Estatus OC/N° Factura but blank Cliente). Root-cause fix: `Code: Build PO Status Query` in `n8n-exports/workflow-PortalDePagos.json` now joins `purchaseOrder → job → customer` directly off the PO id (matching project at header level via `custbody_bb_project` or line level via `cseg_bb_project`, same pattern as the OC dropdown fix), and `Code: Attach PO Status` passes `customer_code`/`customer_name` through the `pagos-por-oc` response (`NSBillsResponse` in `sheets.ts`). `FinanceManagement.tsx` builds Cliente from this response in both single and bulk flows. **Re-imported to n8n cloud and confirmed live 2026-08-18** (correctly showed CUS on a real request).
- One N° de Factura value looked like a bug (a GUID: `9D9685D4-390F-...`) but wasn't — checked NetSuite global search and that GUID is genuinely this account's document number for that vendor bill (`vb.tranId`, assigned by NetSuite when auto-numbering isn't configured for the transaction type/subsidiary). No query change needed there.

## "OC ya pagada" badge — 2026-08-18 (frontend only, no n8n changes)
In **Nueva Solicitud**, the OC dropdown's "Estatus OC" (`BUILTIN.DF(purchaseOrder.status)`) only reflects billing status (e.g. "Totalmente facturada" = fully billed) — it does not mean the resulting vendor bill has actually been paid ("Pagado por completo"). To stop requesters from creating a duplicate request against an OC that's already fully paid: when a project's OC list loads, `NewRequest.tsx` now calls the existing `pagos-por-oc` endpoint (`fetchBillsByOC`, the same one used by Marcar Pagado's NetSuite gate — no new NetSuite query) for every OC in parallel, non-blocking, and flags any OC with at least one fully-paid bill (`NSBill.is_paid`). Paid OCs get a "Ya pagada" badge in the Combobox dropdown (`Combobox.tsx` gained an optional `badge` field on options) and, once selected, a yellow warning banner in the "Datos de la OC (NetSuite)" section. Scoped to one project's OC list at a time (typically a handful of orders), not the whole request queue, to avoid hammering NetSuite.

## Aclaración: edit-and-resend + notification audit — 2026-08-18 (frontend live; n8n change pending re-import)
Before building anything, verified against the actual code (not just this file's prior claims) whether aclaración notifications already worked:
- **Confirmed already live**: every aclaración trigger (single/bulk, from `DecisionPagos.tsx` or `FinanceManagement.tsx`) funnels through the same `PATCH /solicitudes/status` path. `Preparar notificacion estado` in n8n already emails the requester ("Tu solicitud requiere aclaración") whenever `status === 'Draft' && clarificationRequest`, regardless of which role triggered it, and emails the MAC-Dirección roster ("Solicitud re-enviada tras aclaración") on resubmit including the requester's `clarificationResponse` — both wired to live Gmail nodes, not dead-ended. No changes needed for either.
- **New**: the requester's only option used to be answering a plain textarea and resubmitting. `RequestExplorer.tsx`'s aclaración panel now offers two paths: **"Solo responder y reenviar"** (unchanged) or **"Editar solicitud"**, which opens inline fields for Concepto, Departamento, and Tipo de Pago (Completo/Parcial, same subtotal/IVA 16% math as Nueva Solicitud, validated against `ocTotal`), then "Guardar cambios y reenviar".
- To persist those edits, `n8n-exports/workflow-PortalDePagos.json`'s `patchStatus` branch (the Code node building `update` before "Append or update row in sheet") now maps `concept`/`department`/`subtotal`/`iva`/`amount`/`paymentType` from the request body onto their real sheet columns (`Concepto de pago`, `Departamento solicitante`, `Subtotal`, `IVA`, `Monto Solicitado`, `paymentType`), and the sheet-write node's column mapping + schema were extended to include them. **Not yet confirmed re-imported/live-tested in n8n cloud** — until then, editing and resubmitting won't actually save the new concept/amount.
- No race risk on the notification: `Preparar notificacion estado` builds the re-envío email straight from the webhook body (not a re-read of the sheet), and also runs downstream of the sheet write, so it will reflect whatever the requester edited.

## PaymentModal: all fields mandatory — 2026-08-18 (frontend only)
Every field in "Marcar Pagado" is now required, single and bulk: N° de Factura, Link Factura, Cliente, Prestación del Bien o Servicio, Estatus OC, Comprobante de Pago, Tipo de Operación, and Tipo de Gasto all show `*`, red-border + inline error when empty (bulk mode highlights the specific missing cell per row via `bulkCellClass` and lists affected IDs in one summary message). `PaymentData`'s TS type was tightened to match (only `nsPaymentId` stays optional). Propuesta is exempt since it's derived, not user-entered.

## Bulk "Marcar Pagado" rework — 2026-08-18 (frontend only, no n8n changes)
An analysis found bulk mode had drifted out of sync with single mode's NetSuite-accuracy work and could misrecord data or double-claim a payment. Fixed in `PaymentModal.tsx`:
- **Monto Pagado / Tipo de Cambio now come from the matched NetSuite bill** (`bill.payment_amount ?? bill.bill_total`, `bill.exchange_rate`) instead of the request's own stated amount and today's generic Banxico rate — previously bulk silently recorded the *requested* amount, not what NetSuite actually shows was paid.
- **Cross-row duplicate-payment protection.** `FinanceManagement.tsx`'s `claimedPaymentIds` only reflects already-persisted claims, not what other rows in the *current* batch are about to claim — two requests could independently match and confirm against the same NetSuite `payment_id` in one bulk operation. Fixed with a greedy default-assignment pass (each row prefers a candidate payment not already picked by an earlier row in the batch) plus a hard validation block if two rows still end up on the same `payment_id` (red-outlined cards, IDs named in the error).
- **Per-row bill/payment selector** for rows with more than one NetSuite candidate (mirrors single mode's "Factura de NS a referenciar", previously bulk silently used index `[0]`).
- **Banco is now per-row**, sourced from `bill.bank_account` (read-only + "(NS)" badge) when present, editable otherwise — previously one shared dropdown was forced onto every row in the batch even when NetSuite showed different bank accounts per payment.
- **Referencia de Operación is now prefilled per-row from `bill.payment_tranid`.** Removed the "Aplicar la misma referencia a todas" toggle (defaulted to ON) entirely, since it would silently overwrite each row's real, distinct NetSuite reference with one shared value.
- **View change**: added a "Confirmación de Pago por Solicitud (NetSuite)" card list — one card per selected request with the bill selector, Monto Pagado, Tipo de Cambio, N° Factura, Banco, Referencia — separating NetSuite-verified money fields from the administrative details table below (which shrank from 11 to 7 columns since Ref./N° Factura moved into the cards).
- Not yet live-tested with a real multi-request batch, especially one with genuinely ambiguous/overlapping candidate payments.

## Announcements Feed + Notification Center — 2026-08-20 (live in n8n cloud + frontend)
New "Inicio" feed so Finanzas/admin/superadmin can broadcast process announcements in-app instead of email/chat, plus a bell notification center for everyone, to cut down direct-to-Finanzas noise. Scope: read-only feed with a "like" (Zap icon) for regular roles, no comments; notifications are derived only from new posts (existing email flows for status changes are untouched).
- **New Google Sheets tabs in MZ-FIN-08** (same spreadsheet as "Pagos Operaciones"): `Posts` (id, authorEmail, authorName, authorRole, body, link, createdAt), `PostReads` (postId, email, readAt), `PostReactions` (postId, email, liked, reactedAt). No separate "Notification" entity — the bell's unread count is derived as `Posts − PostReads` per email; a "like" is a boolean-toggle row rather than a delete, so `appendOrUpdate` handles it without needing row-delete logic.
- **New n8n webhooks in `workflow-PortalDePagos.json`**: `GET /posts` (newest first, includes per-post like count + likedByMe for the requesting email), `POST /posts` (Code-node role check on `authorRole` in `[analista_contable, admin, superadmin]` — defense in depth, the UI also gates), `POST /posts/like` (toggle), `GET /notifications/unread-count`, `PATCH /notifications/mark-read`.
- **Fix (real, not cosmetic): n8n chains after a Google Sheets "Get row(s)" node don't fire at all when that read returns 0 rows** (not just an empty response — the whole downstream chain, including the actual write step, silently never executes). Discovered because `posts/like` and `notifications/mark-read` do nothing the first time a sheet is empty. Fixed by setting `alwaysOutputData: true` on every such read node in these new chains (`GS: Leer Posts`, `GS: Leer Reacciones`, `GS: Leer Reacciones para Like`, `GS: Leer Posts Unread`, `GS: Leer Reads Unread`, `GS: Leer Posts MarkRead`) and having downstream Code nodes reference the read node by name (`$('Node Name').all()`) rather than `$input`, so they still run correctly off zero-row input.
- **`appendOrUpdate` requires an existing header row to match against** — it can't bootstrap headers on a blank sheet the way plain `append` can (which is how `POST /posts` auto-created the `Posts` header on first write). `PostReads`/`PostReactions` needed their header rows typed in manually before `posts/like` and `notifications/mark-read` worked; also hit one real header-casing mismatch (`postID` vs `postId`) that had to be corrected directly in the sheet. If either sheet's headers ever get retyped, re-verify the exact casing matches what the n8n nodes expect before assuming a failure is something else.
- **Fix 2026-08-21: `appendOrUpdate` with two `matchingColumns` (`[postId, email]`) was not reliably ANDing them** — a second user's like/read on the same post overwrote the first user's row (matched on `postId` alone) instead of appending a new one, so only one email ever ended up recorded per post. Confirmed live in the browser (Emiliano's account) and in the `PostReactions` sheet directly. Switched `GS: Guardar Reaccion` and `GS: Guardar Reads` to plain `append` (event log, never update-in-place) — every like/read click just appends a row. `Code: Armar Posts` and `Code: Toggle Like` now derive current state by taking the *latest* `reactedAt` row per (postId, email) rather than trusting a single upserted row; `likeCount` counts distinct users whose latest state is `liked:true`, so repeat-clicking never inflates one person's count past 1. `PostReads` doesn't need "latest wins" (read is one-directional, existence-only), so `Code: Contar No Leidos` was unaffected. Live-verified with two distinct users liking the same post independently and toggling correctly.
- Live-tested 2026-08-20/21 end-to-end via direct webhook calls: publish (admin), reject-non-allowed-role (403), fetch, like toggle on/off across multiple distinct users (count + likedByMe correct per user), mark-read both "all" and single-`postId` forms (unread-count correctly drops to 0). Confirmed working live in the browser by Emiliano 2026-08-21. `Feed.tsx`/`TopBar.tsx` UI itself (composer, bell dropdown, badge) still not exhaustively clicked through beyond what's been screenshotted.
- Pushed directly to the live n8n cloud workflow via the n8n public API (session-scoped API key, not stored anywhere) rather than the usual manual copy/paste re-import — first time this project's workflow has been updated that way.

## Resolved
- 2026-07-06: Removed stray `gestioon-pagos/` nested git clone (leftover duplicate of this same repo, not part of the Vercel deploy which builds from repo root). Its only tracked content, `decision_pagos.html`, was moved to `public/uploads/decision_pagos.html`; the outdated duplicate `netsuite_integration.md` was dropped in favor of the more complete root-level `NetSuite_Integration_Reference.md`. Real `.env` values (previously only present untracked inside the nested clone) were copied into the root `.env` (gitignored, never committed in either location — the prior "exposed credentials" note was inaccurate).
- 2026-07-15: Aclaración round-trip, re-envío notification, and `patchFinanzas` race condition (see Email Notifications) fixed, re-imported to n8n cloud, and live-tested end-to-end for the happy path.
- 2026-08-18: Single-request "Marcar Pagado" race condition, dead Estatus OC bulk wiring, Propuesta manual-entry (now derived), and Cliente/CUS resolution (now sourced from the OC/PO instead of the unreliable `nsProjectId`) — see § PaymentModal / Marcar Pagado Fixes. NetSuite query change re-imported to n8n cloud and confirmed live.
- 2026-08-18: Confirmed the aclaración requester/re-envío emails were already correctly wired (no fix needed); added the "Editar solicitud" resend path and reworked bulk "Marcar Pagado" to source amount/FX/bank/reference from each row's matched NetSuite bill instead of the request's own data, with duplicate-payment protection — see § Aclaración: edit-and-resend and § Bulk "Marcar Pagado" rework. Both still need the pending n8n re-import / live test noted in Known Issues #9-10.
- 2026-08-20: Announcements Feed + Notification Center built end-to-end (new Sheets tabs, 5 new n8n webhooks, `Feed.tsx`/`TopBar.tsx`) and live-tested at the n8n/webhook layer — see § Announcements Feed + Notification Center. Still needs a browser-UI pass.

## Agent Routing
- Frontend/React tasks -> @agent-html
- NetSuite tasks -> @agent-netsuite
- n8n tasks -> @agent-n8n

---

## Audit Update — 2026-07-27
Re-verified the CRITICAL credential-exposure flag from the 2026-07-01 global knowledge map (".env with Google OAuth Client ID + n8n webhook base URL committed inside gestion-pagos/gestioon-pagos/.env"). Current state: `gestion-pagos/.env` exists at the repo root (2 lines: `VITE_GOOGLE_CLIENT_ID`, `VITE_N8N_WEBHOOK_BASE`) but per `.gitignore` and this file's own 2026-07-06 "Resolved" note, it is gitignored and was never committed in either the root or the old nested `gestioon-pagos/` clone — the prior audit's framing ("committed") appears to have been inaccurate/stale. **No new action required**, but recommend the next global knowledge map refresh explicitly mark this item as resolved/non-issue rather than continuing to carry it as an open CRITICAL, to avoid repeat false-alarm flags.
No file activity since 2026-07-16 (dist/ rebuild + package-lock). Confirmed still Active Dev per the detailed Approval Flow / Email Notifications sections already in this file (last live test 2026-07-15).
