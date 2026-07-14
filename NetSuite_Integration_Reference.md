# NetSuite Integration Reference — Portal de Gestión de Pagos Enlight

> Documento de referencia para no empezar de cero. Contiene todas las queries SuiteQL confirmadas,
> endpoints n8n productivos, relaciones entre record types, gotchas descubiertos, y la arquitectura
> completa de la integración NS ↔ n8n ↔ Frontend.

---

## 1. Arquitectura General

```
NetSuite (Account ID: 9231063)
  │  Auth: OAuth 1.0 / Token-Based Authentication (TBA)
  │  API:  SuiteQL (POST /services/rest/query/v1/suiteql)
  │        REST Records (GET /services/rest/record/v1/{type}/{id})
  │
  ▼
n8n Workflows (egenlight.app.n8n.cloud)
  │  Patrón: Webhook → Code (OAuth signature) → HTTP Request → Transform → Respond
  │  Credenciales: consumer key/secret + token key/secret por integration record
  │  NUNCA exponer en frontend — n8n actúa como proxy
  │
  ▼
React Frontend (sheets.ts como capa de abstracción)
  │  Base URL: VITE_N8N_WEBHOOK_BASE
  │  Todas las calls pasan por sheets.ts → n8n webhooks → NetSuite
```

### Base URLs

| Entorno | URL |
|---------|-----|
| NetSuite REST | `https://9231063.suitetalk.api.netsuite.com` |
| SuiteQL Endpoint | `POST /services/rest/query/v1/suiteql` |
| REST Records | `GET /services/rest/record/v1/{recordType}/{internalId}` |
| n8n Webhooks | `https://egenlight.app.n8n.cloud/webhook/` |

---

## 2. Record Types de NetSuite — Nombres Confirmados

SuiteQL **NO** usa nombres genéricos (`transaction`). Cada record type tiene su nombre específico.

| Record Type | Nombre SuiteQL | Confirmado | Notas |
|-------------|---------------|------------|-------|
| Proyecto | `job` | ✅ | Record nativo de NS para proyectos |
| Purchase Order (OC) | `purchaseOrder` | ✅ | NO usar `transaction` |
| Vendor Bill (Factura) | `vendorBill` | ✅ | Factura del proveedor ligada a PO |
| Vendor Payment | `vendorPayment` | ❌ No encontrado | El account de Enlight no lo expone; el endpoint productivo lo resuelve por otro camino |
| Vendor | `vendor` | ✅ | Vía REST Record API, no SuiteQL |
| Líneas de transacción | `transactionLine` | ✅ | Para line items de POs |

### Record Types que NO funcionaron

| Intento | Error |
|---------|-------|
| `transaction` (genérico) | `Record 'transaction' was not found` |
| `vendorPayment` | `Record 'vendorPayment' was not found` |
| `VendorBill` (PascalCase) | Inconsistente entre accounts |
| `transactionLine.orderLine` | `Field 'orderLine' was not found` |
| `custbody_cseg_bb_project` | `Field was not found` en purchaseOrder |

---

## 3. Relaciones Clave entre Records

```
job (Proyecto)
 │
 │  custbody_bb_project = job.id
 ▼
purchaseOrder (OC)
 │
 │  entity = vendor.id
 │  createdFrom ← link directo (cuando Bill se crea desde PO)
 ▼
vendorBill (Factura)
 │
 │  createdFrom = purchaseOrder.id (vía "Related Records > Receipts & Bills" en UI)
 │  El campo is_paid se determina por status = "Pagado por completo"
 │  payment_date, payment_amount se extraen del record de bill payment
 ▼
vendorPayment (Pago)
     No accesible directamente via SuiteQL en este account.
     Se resolvió extrayendo info de pago desde la bill.
```

### El campo que liga PO → Proyecto

| Campo | Tabla | Resultado |
|-------|-------|-----------|
| `custbody_bb_project` | `purchaseOrder` | ✅ Devuelve el `internal_id` del `job` record |
| `custbody_cseg_bb_project` | `purchaseOrder` | ❌ No existe |

**El match es directo:** `purchaseOrder.custbody_bb_project = job.id`

### El campo que liga Bill → PO

| Campo | Tabla | Resultado |
|-------|-------|-----------|
| `createdFrom` | `vendorBill` | ✅ Devuelve el `id` de la PO origen |

**Caveat:** Si las Bills se crearon manualmente (no desde el botón "Bill" en la PO), `createdFrom` será null. En ese caso se necesita cruce por `transactionLine` (ver sección de queries alternativas).

---

## 4. Endpoints n8n — Productivos

### 4.1 Lista de Proyectos

| Propiedad | Valor |
|-----------|-------|
| **Endpoint** | `GET /webhook/lista-proyectos-completos` |
| **Frontend** | `sheets.ts → fetchProjects()` |
| **SuiteQL** | Query sobre `job` |
| **Paginación** | No implementada (riesgo si >1000 proyectos) |

**Response shape:**
```json
{
  "proj_list": [
    {
      "internal_id": "10746",
      "code": "PROJ-590",
      "name": "FRIALSA FRIGORIFICOS...",
      "project_type": "SFV",
      "start_date": "2024-01-15",
      "customer": { "id": "1020", "code": "CUS-1020", "name": "FRIALSA..." }
    }
  ]
}
```

**SuiteQL (confirmada):**
```sql
SELECT
  j.id          AS internal_id,
  j.entityId    AS code,
  j.companyName AS name
FROM job j
ORDER BY j.entityId
```

---

### 4.2 OCs por Proyecto

| Propiedad | Valor |
|-----------|-------|
| **Endpoint** | `GET /webhook/ocs-por-proyecto?projectId={nsProjectInternalId}` |
| **Frontend** | `sheets.ts → fetchOCsByProject(projectId)` |
| **SuiteQL** | Query sobre `purchaseOrder` filtrada por `custbody_bb_project` |

**Response shape:**
```json
{
  "oc_list": [
    {
      "internal_id": "771998",
      "oc_number": "PO-00098273",
      "fecha": "14/05/2026",
      "estatus": "Factura pendiente",
      "vendor_id": "3348",
      "vendor_code": "VEN-395",
      "moneda": "US Dollar",
      "tipo_cambio": 17.1929,
      "monto_total": 51578.70,
      "nota": "descripción"
    }
  ],
  "unique_vendors": [...],
  "hasMore": false
}
```

**SuiteQL (confirmada):**
```sql
SELECT
  t.id                    AS internal_id,
  t.tranId                AS oc_number,
  t.tranDate              AS fecha,
  BUILTIN.DF(t.status)    AS estatus,
  t.entity                AS vendor_id,
  BUILTIN.DF(t.entity)    AS vendor_code,
  BUILTIN.DF(t.currency)  AS moneda,
  t.exchangeRate          AS tipo_cambio,
  t.total                 AS monto_total,
  t.memo                  AS nota
FROM purchaseOrder t
WHERE t.custbody_bb_project = :projectId
  AND t.status NOT IN ('purchaseOrder:G', 'purchaseOrder:H')
ORDER BY t.tranDate DESC
```

**Workflow n8n:**
```
Webhook GET /ocs-por-proyecto
    ↓ (recibe ?projectId=10746)
Code: Build OAuth 1.0 signature para SuiteQL POST
    ↓
HTTP Request: POST /services/rest/query/v1/suiteql
    ↓
Code: Extraer vendor_ids únicos de los resultados
    ↓
SplitInBatches: Para cada vendor_id único
    ↓
    Code: Build OAuth 1.0 signature para REST GET
    ↓
    HTTP Request: GET /services/rest/record/v1/vendor/{vendor_id}
    ↓
    (merge results)
    ↓
Code: Build vendor map { id → companyName }
      Enriquecer POs con vendor names
    ↓
Respond to Webhook: JSON
```

**Estatus de PO excluidos:**

| Código | Significado |
|--------|-------------|
| `purchaseOrder:G` | Cerrada |
| `purchaseOrder:H` | Cancelada |

**Estatus de PO comunes (display values):**

| Valor | Descripción |
|-------|-------------|
| Factura pendiente | PO abierta, sin bill |
| Recepción pendiente | Esperando recepción de bienes |
| Parcialmente completada | Recepción/facturación parcial |
| Cerrada | Completamente facturada y pagada |

---

### 4.3 Vendor Name

| Propiedad | Valor |
|-----------|-------|
| **Endpoint** | `GET /webhook/vendor-name?id={vendorInternalId}` |
| **Frontend** | `sheets.ts → fetchVendorName(vendorId)` |
| **API NS** | REST Record GET (no SuiteQL) |

**Response shape:**
```json
{
  "id": "3348",
  "code": "VEN-395",
  "name": "Exel Solar SAPI De CV",
  "rfc": "ESO160101XXX",
  "email": "contacto@exelsolar.com"
}
```

**REST Call:**
```
GET https://9231063.suitetalk.api.netsuite.com/services/rest/record/v1/vendor/{vendorId}
```

**IMPORTANTE:** Requiere su propio OAuth signature (GET, URL diferente al SuiteQL POST).
No reutilizar la firma del SuiteQL endpoint.

---

### 4.4 Bills (Facturas) por OC — Endpoint Más Reciente

| Propiedad | Valor |
|-----------|-------|
| **Endpoint** | `GET /webhook/pagos-por-oc?poInternalId={nsOcInternalId}` |
| **Frontend** | `sheets.ts → fetchBillsByOC(poInternalId)` |
| **Uso** | Gate en "Marcar Pagado" — verifica si NS tiene pago registrado |

**Response shape:**
```json
{
  "bills": [
    {
      "bill_id": "743605",
      "bill_number": "QR49971",
      "bill_date": "18/02/2026",
      "bill_total": 12722.50,
      "bill_status": "Pagado por completo",
      "currency": "US Dollar",
      "exchange_rate": 17.0953,
      "account": "201.01 Proveedores nacionales",
      "subsidiary": "Enlight Partners L.P. : Grupo Enerclima : Enerclima",
      "memo": "46b283bd-6cdd-4ab0-a894-ec33846d15c4",
      "is_paid": true,
      "payment_date": "10/04/2026",
      "payment_amount": 12722.50,
      "payment_count": 1
    }
  ],
  "summary": {
    "total_bills": 2,
    "total_billed": 14906.76,
    "paid_count": 2,
    "paid_total": 14906.76,
    "open_count": 0,
    "open_total": 0
  }
}
```

**Frontend normaliza currency:** `"US Dollar" → "USD"`, `"Mexican Peso" → "MXN"` (en `sheets.ts`).

**Campos clave:**
- `is_paid: boolean` — determina si el portal permite marcar como pagado
- `bill_status` — `"Pagado por completo"` o `"Abierta"`
- `payment_date`, `payment_amount` — datos del pago ejecutado en NS
- `exchange_rate` — T/C de la factura en NS (se pre-llena en PaymentModal)

---

### 4.5 Tipo de Cambio (Banxico)

| Propiedad | Valor |
|-----------|-------|
| **Endpoint** | `GET /webhook/tipo-cambio` |
| **Frontend** | `sheets.ts → fetchExchangeRates()` |

**Response:** Array de `{ date: string, rate: number }`.

**Nota:** Este endpoint trae T/C de Banxico, no de NS. NS tiene su propia tabla `currencyrate` que podría reemplazar esto en el futuro.

---

### 4.6 CRUD de Solicitudes (Portal interno, no NS)

| Endpoint | Método | Función |
|----------|--------|---------|
| `/webhook/solicitudes` | `GET` | `fetchRequests()` — lista todas las solicitudes |
| `/webhook/solicitudes` | `POST` | `createRequest(data)` — crea nueva solicitud |
| `/webhook/solicitudes/status` | `PATCH` | `updateRequestStatus(id, status, ...)` — cambia status |
| `/webhook/solicitudes/finanzas` | `PATCH` | `updateFinanceFields(id, fields)` — actualiza campos finance |

### 4.7 Role Resolution

| Endpoint | Método | Función |
|----------|--------|---------|
| `/webhook/role?email={email}` | `GET` | `getRoleByEmail(email)` — devuelve rol del usuario |

### 4.8 Roster por Rol + Notificaciones por Email

| Endpoint | Método | Función |
|----------|--------|---------|
| `/webhook/roster?roles={role1,role2}` | `GET` | Lee la hoja `Roles Portal Pagos` y devuelve `{ roles, emails }` con los correos de los roles solicitados (roster inverso de `/webhook/role`). Workflow `roster` en n8n cloud. |

Este roster lo consumen internamente (vía HTTP Request node) los workflows de estado para enviar notificaciones por email con Gmail (credencial "Tecnología"), sin cambios en el frontend:

| Workflow | Trigger | Emails enviados |
|----------|---------|------------------|
| `postSolicitudes` | `POST /solicitudes` (nueva solicitud) | Confirmación al solicitante + notificación a `analista_contable` (Finanzas). **Pendiente:** enrutar también a los aprobadores — el criterio depende del tipo de proyecto y aún no está definido (ver sticky note "TODO aprobadores" en el workflow). |
| `patchStatus` | `PATCH /solicitudes/status` con `status = Approved` o `Rejected` | Confirmación al solicitante siempre; notificación adicional a `analista_contable` solo si `Approved`. |
| `patchFinanzas` | `PATCH /solicitudes/finanzas` con `status = Paid` | Confirmación al solicitante únicamente. |

El patrón de email (nodo "Build email HTML" + par de nodos Gmail Confirmación→Notificación) sigue el estilo de referencia en `public/n8n/partialworkflow-stylemailreference.json` (copia local). Los exports JSON en `public/n8n/` quedaron fuera de git (`.gitignore`, 2026-07-14); la fuente de verdad es la instancia n8n cloud.

---

## 5. Queries SuiteQL — Catálogo Completo

### 5.1 Proyectos activos

```sql
SELECT
  j.id          AS internal_id,
  j.entityId    AS code,
  j.companyName AS name
FROM job j
ORDER BY j.entityId
```

**Status:** ✅ Producción

---

### 5.2 OCs por proyecto (filtrada)

```sql
SELECT
  t.id                    AS internal_id,
  t.tranId                AS oc_number,
  t.tranDate              AS fecha,
  BUILTIN.DF(t.status)    AS estatus,
  t.entity                AS vendor_id,
  BUILTIN.DF(t.entity)    AS vendor_code,
  BUILTIN.DF(t.currency)  AS moneda,
  t.exchangeRate          AS tipo_cambio,
  t.total                 AS monto_total,
  t.memo                  AS nota
FROM purchaseOrder t
WHERE t.custbody_bb_project = :projectId
  AND t.status NOT IN ('purchaseOrder:G', 'purchaseOrder:H')
ORDER BY t.tranDate DESC
```

**Status:** ✅ Producción
**Notas:**
- Reemplazar `:projectId` con el `internal_id` del `job` record
- 6,264 POs totales en el account; filtro por proyecto reduce a ~30-40

---

### 5.3 Todas las POs (sin filtro de proyecto)

```sql
SELECT
  t.id                         AS internal_id,
  t.tranId                     AS oc_number,
  t.tranDate                   AS fecha,
  BUILTIN.DF(t.status)         AS estatus,
  BUILTIN.DF(t.entity)         AS beneficiario,
  BUILTIN.DF(t.subsidiary)     AS subsidiaria,
  BUILTIN.DF(t.currency)       AS moneda,
  t.exchangeRate               AS tipo_cambio,
  t.total                      AS monto_total
FROM purchaseOrder t
WHERE t.status NOT IN ('purchaseOrder:H')
ORDER BY t.tranDate DESC
```

**Status:** ✅ Confirmada (diagnóstica)
**Notas:**
- Devuelve ~6,264 rows sin paginación
- `BUILTIN.DF(t.entity)` devuelve `entityId` code (e.g. `VEN-395`), NO el nombre
- Para nombre → necesitas JOIN a `vendor` o REST lookup

---

### 5.4 POs con JOIN a vendor (nombre resuelto en query)

```sql
SELECT
  t.id                    AS internal_id,
  t.tranId                AS oc_number,
  t.tranDate              AS fecha,
  BUILTIN.DF(t.status)    AS estatus,
  v.companyName           AS beneficiario,
  BUILTIN.DF(t.subsidiary) AS subsidiaria,
  BUILTIN.DF(t.currency)  AS moneda,
  t.exchangeRate          AS tipo_cambio,
  t.total                 AS monto_total
FROM purchaseOrder t
JOIN vendor v ON t.entity = v.id
ORDER BY t.tranDate DESC
```

**Status:** ✅ Confirmada
**Notas:** Más eficiente que REST lookups si solo necesitas `companyName`

---

### 5.5 Vendor Bills por PO (vía createdFrom)

```sql
SELECT
  vb.id                    AS bill_id,
  vb.tranId                AS bill_number,
  vb.tranDate              AS bill_date,
  vb.total                 AS bill_total,
  BUILTIN.DF(vb.status)    AS bill_status,
  BUILTIN.DF(vb.currency)  AS moneda,
  vb.exchangeRate          AS tipo_cambio,
  vb.createdFrom           AS created_from
FROM vendorBill vb
WHERE vb.createdFrom = :purchaseOrderInternalId
ORDER BY vb.tranDate DESC
```

**Status:** ✅ Confirmada (base del endpoint `/pagos-por-oc`)
**Nota:** `createdFrom` funciona cuando la Bill se creó desde la PO en NS UI.

---

### 5.6 Query combinada Bill + Payment (teórica)

```sql
SELECT
  vb.id                    AS bill_id,
  vb.tranId                AS bill_number,
  vb.total                 AS bill_total,
  vp.id                    AS payment_id,
  vp.tranId                AS payment_number,
  vp.tranDate              AS payment_date,
  vp.total                 AS payment_total,
  BUILTIN.DF(vp.status)    AS payment_status,
  BUILTIN.DF(vp.account)   AS bank_account,
  vp.memo                  AS memo,
  vp.exchangeRate          AS tipo_cambio_pago
FROM vendorBill vb
LEFT JOIN vendorPayment vp ON vp.createdFrom = vb.id
WHERE vb.createdFrom = :purchaseOrderInternalId
ORDER BY vp.tranDate DESC
```

**Status:** ❌ No funciona — `vendorPayment` no encontrado en este account.
El endpoint productivo resuelve la info de pago desde el record de la bill.

---

### 5.7 Line items de una PO (diagnóstica)

```sql
SELECT
  tl.id          AS line_id,
  tl.transaction AS tran_id,
  tl.item        AS item_id,
  tl.amount      AS amount,
  tl.quantity    AS quantity,
  tl.memo        AS memo
FROM transactionLine tl
WHERE tl.transaction = :purchaseOrderInternalId
```

**Status:** ✅ Confirmada
**Notas:**
- Una PO puede tener múltiples line items (e.g. PO-00098173 tenía ~15)
- El campo `item` devuelve internal ID; necesita `BUILTIN.DF()` o join para nombre
- El CSV exportado de NS tiene columna "Artículo" que corresponde a `item`
- `orderLine` NO existe como field en este account

---

### 5.8 Cruce Bill↔PO por transaction lines (alternativa si createdFrom falla)

```sql
SELECT DISTINCT
  vb.id      AS bill_id,
  vb.tranId  AS bill_number,
  vb.total   AS bill_total,
  BUILTIN.DF(vb.status) AS bill_status
FROM transactionLine tl_po
JOIN transactionLine tl_vb ON tl_vb.orderLine = tl_po.id
JOIN vendorBill vb ON tl_vb.transaction = vb.id
WHERE tl_po.transaction = :purchaseOrderInternalId
```

**Status:** ❌ No funciona — `orderLine` no existe como field.
**Alternativa si se necesita:** Buscar por vendor + item + monto como heurística.

---

## 6. Función `BUILTIN.DF()` — Display Field

`BUILTIN.DF(campo)` resuelve el "display value" (texto legible) de un campo que internamente es un ID numérico.

| Ejemplo | Sin DF | Con DF |
|---------|--------|--------|
| `t.entity` | `3348` | `VEN-395` (código, no nombre) |
| `t.status` | `purchaseOrder:B` | `Factura pendiente` |
| `t.currency` | `2` | `US Dollar` |
| `t.subsidiary` | `5` | `Enlight Partners L.P. : Grupo Enerclima...` |

**Gotcha:** Para vendors, `BUILTIN.DF(t.entity)` devuelve el `entityId` code, NO el `companyName`. Para el nombre completo necesitas `JOIN vendor v ON t.entity = v.id` → `v.companyName`.

---

## 7. OAuth 1.0 en n8n — Patrón de Signature

Cada call a NetSuite requiere firma OAuth 1.0 con los 4 tokens. **El signature es diferente para SuiteQL (POST) vs REST Records (GET).**

### Para SuiteQL (POST)
```
Method: POST
URL: https://9231063.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql
Headers:
  Authorization: OAuth realm="9231063", oauth_consumer_key=..., oauth_token=...,
                 oauth_nonce=..., oauth_timestamp=..., oauth_signature_method="HMAC-SHA256",
                 oauth_version="1.0", oauth_signature=...
  Content-Type: application/json
  Prefer: transient
Body: { "q": "SELECT ... FROM ..." }
```

### Para REST Records (GET)
```
Method: GET
URL: https://9231063.suitetalk.api.netsuite.com/services/rest/record/v1/vendor/{id}
Headers:
  Authorization: OAuth (mismos parámetros, pero firma generada con GET + URL diferente)
```

**NUNCA reutilizar la firma de un SuiteQL POST para un REST GET** — la firma incluye el método HTTP y la URL completa.

---

## 8. Normalización de Moneda

NetSuite devuelve moneda como texto descriptivo. El frontend normaliza en `sheets.ts`:

| NetSuite | Normalizado |
|----------|-------------|
| `US Dollar` | `USD` |
| `Mexican Peso` | `MXN` |
| `Canadian Dollar` | `CAD` |
| `Euro` | `EUR` |

Implementado en dos lugares:
- `sheets.ts → normalizeCurrency()` para bills (endpoint `/pagos-por-oc`)
- `NewRequest.tsx → normalizeCurrency()` para OCs (dropdown de moneda)

---

## 9. Campos Custom Conocidos

| Campo | Record | Tipo | Descripción |
|-------|--------|------|-------------|
| `custbody_bb_project` | `purchaseOrder` | Integer (FK → `job.id`) | Liga PO al proyecto |

### Campos que NO existen
| Campo intentado | Record | Error |
|-----------------|--------|-------|
| `custbody_cseg_bb_project` | `purchaseOrder` | Field not found |
| `orderLine` | `transactionLine` | Field not found |

---

## 10. Frontend → NS: Flujo de Datos en la Request

Cuando el usuario crea una solicitud en `NewRequest.tsx`, se guardan estos campos para traceability:

```typescript
// Campos NS en la interface Request (mockData.ts)
nsProjectId?: string;        // internal_id del job (proyecto)
nsOcInternalId?: string;     // internal_id de la purchaseOrder
vendorId?: string;           // internal_id del vendor
vendorRfc?: string;          // RFC del vendor
paymentType?: string;        // "Completo" | "Parcial"
ocTotal?: number;            // monto_total de la PO
exchangeRate?: number;       // T/C de la PO
```

El campo `nsOcInternalId` es el que se usa para consultar `/pagos-por-oc` cuando Finanzas quiere marcar como pagado.

---

## 11. Datos del CSV de POs — Referencia de Estructura

Del CSV exportado de NS (729 line items, 115 POs únicas, 7 estatus):

| Índice | Columna | Campo SuiteQL |
|--------|---------|---------------|
| 0 | ID interno | `t.id` |
| 1 | Subsidiaria | `BUILTIN.DF(t.subsidiary)` |
| 2 | Project | `BUILTIN.DF(t.custbody_bb_project)` |
| 3 | Enlight Project Type | Custom field del proyecto |
| 4 | Estado | `BUILTIN.DF(t.status)` |
| 5 | Nombre (vendor) | `v.companyName` via JOIN |
| 6 | Fecha | `t.tranDate` |
| 7 | Número de documento | `t.tranId` |
| 8 | Nombre (customer/nota) | Line-level o `custbody` |
| 9 | Nota | `tl.memo` o item description |
| 10 | Moneda | `BUILTIN.DF(t.currency)` |
| 11 | Tipo de cambio | `t.exchangeRate` |
| 12 | Subcategoria | Custom field |
| 13 | Budget Item | Custom field |
| 14 | Artículo | `item.itemId` via line join |
| 15 | Cantidad | `tl.quantity` |
| 16 | Cantidad completada | `tl.quantityReceived` |
| 17 | Importe | `tl.amount` |

**El CSV es a nivel LINE ITEM** (múltiples rows por PO). El portal trabaja a nivel HEADER (una row por PO).

---

## 12. Gotchas y Lecciones Aprendidas

### SuiteQL

1. **`transaction` no es tabla válida** — Usar el nombre específico del record type (`purchaseOrder`, `vendorBill`, etc.)
2. **`vendorPayment` no existe** en este account — La info de pago se extrae desde la bill
3. **`BUILTIN.DF()` para vendors devuelve el código** (`VEN-395`), no el nombre — Para `companyName` necesitas JOIN o REST
4. **Paginación no implementada** — Si SuiteQL devuelve `hasMore: true`, se pierden registros. Límite default = 1000.
5. **OAuth signature es por-request** — Diferente firma para POST (SuiteQL) vs GET (REST Records)
6. **`createdFrom`** es el link estándar entre transacciones hijas y padres (Bill → PO). Funciona si la bill se creó desde la PO en la UI.
7. **El casing de record types varía entre accounts** — `vendorBill` funcionó, `VendorBill` no en este caso.

### n8n

1. **Sin error handling** en workflows actuales — Si NS devuelve 401 (token expirado) o 429 (rate limit), el webhook responde con error crudo al frontend
2. **Sin cache** — Cada request dispara query a NS. Los proyectos no cambian cada minuto.
3. **Sin paginación real** — Variable `offset` declarada pero no iterada en loops
4. **Vendor lookup por batches** — Para OCs: extraer vendor_ids únicos → SplitInBatches → REST GET cada vendor → merge

### Frontend

1. **Normalización de moneda** duplicada en `sheets.ts` y `NewRequest.tsx` — Considerar centralizar
2. **`nsOcInternalId` puede ser undefined** en solicitudes creadas antes de la integración NS — El gate en "Marcar Pagado" lo detecta y bloquea con mensaje claro
3. **`cleanPayload()` en sheets.ts** filtra objetos anidados antes de enviar a n8n — Necesario porque n8n/GSheets no manejan nested objects

---

## 13. Endpoints Pendientes / Futuros

| Endpoint | Propósito | Estado |
|----------|-----------|--------|
| Tipo de cambio desde NS (`currencyrate`) | Reemplazar mock de Banxico | 🔮 Futuro |
| Line items de una OC | Detalle de artículos en el portal | 🔮 Futuro (query 5.7 confirmada) |
| Escritura a NS (crear PO, actualizar status) | Bidireccionalidad | 🔮 Futuro — cambia scope radicalmente |
| Role resolution via n8n | Reemplazar mock email mapping | ✅ Implementado (§4.7) |
| Enrutamiento de aprobadores por tipo de proyecto | Notificar al aprobador correcto al enviar una solicitud (hoy solo se notifica a Finanzas) | 🔮 Pendiente de definir criterio — ver §4.8 |
| Notificaciones in-app (campana) | Alternativa/complemento a las notificaciones por email (§4.8) | 🔮 Futuro |

---

## 14. Governance y Límites de NS

| Límite | Valor | Impacto |
|--------|-------|---------|
| SuiteQL rows por query | 1,000 (default) | Paginación requerida para >1000 results |
| SuiteScript governance units | Varía por script type | Queries pesadas consumen más units |
| REST API rate limits | ~10 concurrent requests | Bulk vendor lookups deben ser secuenciales |
| Token expiration | No expira (TBA tokens son permanentes) | Pero pueden revocarse manualmente |

**Regla: Siempre prototipar en sandbox, nunca en producción.**

---

## 15. Resumen de sheets.ts — Funciones y Endpoints

```typescript
// === Roles ===
getRoleByEmail(email)           → GET /role?email=...

// === Solicitudes CRUD ===
fetchRequests()                 → GET /solicitudes
createRequest(data)             → POST /solicitudes
updateRequestStatus(id, ...)    → PATCH /solicitudes/status
updateFinanceFields(id, ...)    → PATCH /solicitudes/finanzas

// === NetSuite Data ===
fetchProjects()                 → GET /lista-proyectos-completos
fetchOCsByProject(projectId)    → GET /ocs-por-proyecto?projectId=...
fetchVendorName(vendorId)       → GET /vendor-name?id=...
fetchBillsByOC(poInternalId)    → GET /pagos-por-oc?poInternalId=...

// === Banxico ===
fetchExchangeRates()            → GET /tipo-cambio
```
