# API reference

Source of truth: [`backend/src/routes/api.js`](../backend/src/routes/api.js). All paths below include `/api`. There is no additional API version prefix.

## Shared conventions

- JSON body requests use `Content-Type: application/json`. Uploads use multipart form data.
- Authentication is the `session` HttpOnly cookie set by login/registration. There is no Bearer-token API.
- **Signed-in** = customer, operator or admin. **Staff** = operator/admin. **Admin** = admin only. Customer order/file access is ownership-scoped; staff can see all orders/jobs/documents needed for operations. Listing `/files` always lists the signed-in user's uploads.
- IDs in `:id` parameters are MongoDB ObjectIds; invalid format returns 400.
- Success normally has `{ "data": ... }`. Paginated lists add `"pagination": { "page", "limit", "total", "pages" }`. Page defaults to 1, limit to 20; maximum page is 10,000 and limit 100.
- Errors use `{ "error": "Readable message" }`. Common errors: 400 invalid body/ID/JSON, 401 missing/expired session, 403 role/origin denied, 404 missing/inaccessible record, 409 duplicate/conflicting transition, 413 oversized request/upload, 429 request limit, 500 unexpected database/server failure, 503 unavailable scheduler. Endpoint-specific errors appear below; protected endpoints also inherit 401/403 and all endpoints except health inherit the API rate limit.
- Rate limits: 600 API requests per 15 minutes per IP, shared login/register limit 20 per 15 minutes per IP, and 15 uploads per minute per IP. These limits are process-local.
- Browser mutations must be same-origin. Unknown `/api/*` returns JSON 404 and never the SPA.

## Response objects

| Name           | Important fields                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User           | `_id`, `name`, `email`, `role`; list responses also include timestamps; never `passwordHash`                                                                                                                   |
| Document       | `_id`, `owner`, `fileId`, `name`, `mime`, `bytes`, `pages`, timestamps                                                                                                                                         |
| Quote          | `currency`, `pages`, `copies`, `impressions`, `sheets`, `printPaise`, `bindingPaise`, `rushPaise`, `subtotalPaise`, `taxPaise`, `totalPaise`, `pricingUpdatedAt`                                               |
| Order          | `_id`, `reference`, `customer`, `document`, `config`, `quote`, `deadline`, `status`, `clientRequestId`, timestamps                                                                                             |
| Job            | `_id`, `order`, `customer`, `document`, `label`, `config`, `sheets`, `priorityScore`, `deadline`, `status`, `printer`, `progress`, lifecycle timestamps, `failureReason`, `qcNotes`, `reprintOf`, `reprintJob` |
| Printer        | `_id`, `name`, `color`, `duplex`, `paperSizes`, `capacity`, `status`, timestamps                                                                                                                               |
| Inventory      | `_id`, `paperSize`, `sheets`, timestamps                                                                                                                                                                       |
| Queue snapshot | `ready`, `pending` in removal order, `heap` in physical heap order, `stations`, `qualityCheck`                                                                                                                 |

Each station snapshot has `{ printer, buffer, active }`. Buffer has `{ capacity, front, rear, size, slots, items }`; empty slots are null. `active` is a Job or null. QC has `{ waiting: Job[], active: Job|null }`.

## Health and authentication

| Method / endpoint         | Authentication / role | Request                                                                                        | Response                                                                                       | Specific errors                                                      |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /api/health`         | Public                | None                                                                                           | 200 `{"status":"ok"}`                                                                          | 503 `{"status":"unavailable"}` when database or scheduler is unready |
| `POST /api/auth/register` | Public                | `{name,email,password}`; name 2–80 chars, email ≤254, password 10–72 chars and ≤72 UTF-8 bytes | 201 `{data: User}`; sets session cookie                                                        | 400 invalid/extra fields, 409 email exists, 429 rate limit           |
| `POST /api/auth/login`    | Public                | `{email,password}` with same password bounds                                                   | 200 `{data: User}`; sets session cookie                                                        | 400 invalid body, 401 incorrect credentials, 429 rate limit          |
| `POST /api/auth/logout`   | Signed-in             | No body                                                                                        | 200 `{data:{signedOut:true}}`; clears this browser's cookie and disconnects the user's sockets | 401 expired session                                                  |
| `GET /api/auth/me`        | Signed-in             | None                                                                                           | 200 `{data: User}`                                                                             | 401 expired session                                                  |

Registration always creates a customer. JWTs last eight hours. There is no password reset, account editing, token refresh, or public administrator registration endpoint. Logout clears the cookie; there is no persisted token revocation list.

## Files

| Method / endpoint             | Authentication / role  | Request                                                                             | Response                                                                     | Specific errors                                                                                                      |
| ----------------------------- | ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `POST /api/files`             | Signed-in              | Multipart, exactly one `file`, no text fields, ≤10 MB; unencrypted PDF, PNG or JPEG | 201 `{data: Document}`                                                       | 400 missing/unreadable/unsupported/encrypted file, PDF pages outside 1–2,000, wrong field; 413 size; 429 upload rate |
| `GET /api/files`              | Signed-in, own uploads | `?page=1&limit=20`                                                                  | Paginated Document list                                                      | 400 invalid pagination                                                                                               |
| `GET /api/files/:id/download` | Owner or staff         | Document ID                                                                         | Binary stream with content type and attachment disposition, private/no-store | 400 malformed ID; 404 missing/inaccessible document; stream/storage failure                                          |

PNG/JPEG are one page each. Downloads accept a Document ID, not the GridFS file ID. Office documents are not supported.

## Pricing

Print configuration:

```json
{
  "copies": 1,
  "color": false,
  "duplex": false,
  "paperSize": "A4",
  "pageRange": "",
  "binding": "none",
  "urgency": "standard"
}
```

Copies: 1–500. Paper: `A4|A3|Letter`. Page range: blank for all pages or comma-separated page numbers/inclusive ranges such as `1-3,5`; ≤500 characters, valid within the uploaded document. Binding: `none|staple|spiral`. Urgency: `standard|rush`. Configuration objects reject unknown fields.

| Method / endpoint         | Authentication / role   | Request                              | Response                  | Specific errors                                                                               |
| ------------------------- | ----------------------- | ------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/pricing`        | Public                  | None                                 | 200 `{data: PricingRule}` | 500 database failure                                                                          |
| `POST /api/pricing/quote` | Signed-in, own document | `{documentId,config}`                | 200 `{data: Quote}`       | 400 invalid config/range or unsafe numeric total, 404 document absent/not owned, 503 no rules |
| `PUT /api/pricing`        | Admin                   | Complete editable rules object below | 200 `{data: PricingRule}` | 400 invalid/extra values; 403 role                                                            |

Editable rule body (values shown are the initial defaults, not a request result):

```json
{
  "basePage": 2,
  "colorMultiplier": 5,
  "duplexMultiplier": 1,
  "paperMultipliers": { "A4": 1, "A3": 2, "Letter": 1 },
  "binding": { "none": 0, "staple": 5, "spiral": 40 },
  "rushMultiplier": 1.5,
  "taxPercent": 0
}
```

Prices are INR, 0–100,000; multipliers 0.1–100 except rush 1–100; tax 0–100%. `binding.none` must be zero. Currency is fixed to INR. Monetary quote output uses integer paise. Rule updates do not change existing saved quotes.

## Orders

| Method / endpoint                  | Authentication / role                   | Request                                                            | Response                                                         | Specific errors                                                                              |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `POST /api/orders`                 | Signed-in, own document                 | `{documentId,config,deadline?,clientRequestId,expectedTotalPaise}` | 201 `{data:{order:Order,job:Job}}`                               | 400 invalid UUID/config/expired deadline, 404 document, 409 total changed/duplicate conflict |
| `GET /api/orders`                  | Signed-in; customer sees own, staff all | `?page=1&limit=20`                                                 | Paginated Order list; `document` populated with `_id,name,pages` | 400 pagination                                                                               |
| `GET /api/orders/track/:reference` | Owner or staff                          | `PF-` plus 8 hex characters, case-insensitive                      | 200 `{data:{order:Order,jobs:Job[]}}`; document populated        | 400 bad reference, 404 unavailable order                                                     |
| `GET /api/orders/:id`              | Owner or staff                          | Order ID                                                           | Same detail response, jobs oldest-first                          | 400 ID, 404 unavailable order                                                                |
| `POST /api/orders/:id/cancel`      | Owner or staff                          | Order ID; no body                                                  | 200 `{data:{order:Order,job:Job}}` with CANCELLED states         | 404 order, 409 order already started/not cancellable                                         |

`deadline` is null/omitted or an ISO datetime with timezone in the future. `clientRequestId` must be a UUID, generated once per order submission (the browser uses `crypto.randomUUID()`). Reusing it for that customer returns the original committed order rather than making a duplicate; use a new UUID for a different order. `expectedTotalPaise` must match the freshly recalculated backend quote. Creation returns its creation snapshot; a scheduler assignment may already be reflected in subsequent GET responses/events.

## Queues, printers and job lifecycle

All endpoints in this table require **staff**, except adding a printer requires **admin**.

| Method / endpoint                | Body / parameters                                                                            | Response                                                                | Specific errors                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------- | --------------------------------- |
| `GET /api/queue`                 | None                                                                                         | 200 `{data: QueueSnapshot}`                                             | 503 recovering scheduler                                             |
| `POST /api/queue/schedule`       | None                                                                                         | 200 `{data: QueueSnapshot}` after dispatch                              | Database/recovery failures                                           |
| `POST /api/queue/qc/start`       | None                                                                                         | 200 `{data: Job}` in QUALITY_CHECK                                      | 409 QC busy/empty/changed                                            |
| `GET /api/printers`              | None                                                                                         | 200 `{data: Printer[]}`, name order                                     | Database failure                                                     |
| `POST /api/printers` — admin     | `{name,color,duplex,paperSizes,capacity}`; name 2–60 chars, 1–3 paper entries, capacity 1–20 | 201 `{data: Printer}`, initially offline                                | 400 validation, 409 duplicate name                                   |
| `PATCH /api/printers/:id/status` | `{status:"online"                                                                            | "offline"                                                               | "error"}`                                                            | 200 `{data: Printer}` | 400 input/ID, 404 unknown station |
| `POST /api/printers/:id/start`   | Printer ID; no body                                                                          | 200 `{data:{job:Job,order:Order}}`                                      | 404 station, 409 offline/busy/empty/insufficient paper/state changed |
| `GET /api/jobs`                  | `?page=1&limit=20&status=FAILED`; optional status enum                                       | Paginated Job list, newest-first                                        | 400 pagination/status                                                |
| `PATCH /api/jobs/:id/progress`   | `{progress: integer 0..99}`                                                                  | 200 `{data: Job}`                                                       | 400 bounds/ID, 409 absent/nonprinting job or progress decreased      |
| `POST /api/jobs/:id/printed`     | Job ID; no body                                                                              | 200 `{data:{job:Job,order:Order}}`; job PRINTED and queued for QC       | 409 absent/nonprinting job                                           |
| `POST /api/jobs/:id/fail`        | `{reason: string 3..500}`                                                                    | 200 `{data:{job:Job,order:Order}}`; FAILED / ATTENTION                  | 400 reason/ID, 409 absent/nonprinting job                            |
| `POST /api/jobs/:id/qc`          | `{passed:boolean,notes?:string}`; notes ≤500 chars and ≥3 when failing                       | 200 `{data:{job:Job,order:Order}}`; COMPLETED/READY or FAILED/ATTENTION | 400 notes/ID, 409 not the active check/already finished              |
| `POST /api/jobs/:id/reprint`     | Failed Job ID; no body                                                                       | 201 `{data:{job:Job,order:Order}}`, new queued child                    | 409 absent/nonfailed job or already has a reprint child              |

Job status enum: `QUEUED`, `ASSIGNED`, `PRINTING`, `PRINTED`, `QUALITY_CHECK`, `COMPLETED`, `FAILED`, `CANCELLED`.

Offline/error transitions requeue only the waiting jobs. Active printing remains for operator resolution. Start atomically consumes paper. A failed print does not refund paper. Printed status sets progress to 100; QC completion determines whether the order is ready. There is no arbitrary job-status PATCH and no physical-printing RPC.

## Inventory, people, audit and DSA lab

| Method / endpoint             | Authentication / role | Request                               | Response                                                                                              | Specific errors                                                |
| ----------------------------- | --------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/inventory`          | Staff                 | None                                  | 200 `{data: Inventory[]}` by paper size                                                               | Database failure                                               |
| `POST /api/inventory/restock` | Staff                 | `{paperSize:"A4"                      | "A3"                                                                                                  | "Letter",sheets:1..1000000}` integer                           | 200 `{data: Inventory}` with stock incremented          | 400 input; not request-key idempotent                              |
| `GET /api/users`              | Admin                 | `?page=1&limit=20`                    | Paginated User list, no password hashes                                                               | 400 pagination                                                 |
| `PATCH /api/users/:id/role`   | Admin                 | `{role:"customer"                     | "operator"                                                                                            | "admin"}`                                                      | 200 `{data: User}`; disconnects affected user's sockets | 400 input, 404 user, 409 self-demotion/self-role-change disallowed |
| `GET /api/audit`              | Admin                 | `?page=1&limit=20`                    | Paginated audit records with actor `{_id,name,email}`, action, entity, detail, timestamps             | 400 pagination                                                 |
| `GET /api/dsa`                | Staff                 | None                                  | 200 `{data:{fifo:JobDemo[],priority:{heap,ordered},circular:{capacity,front,rear,size,slots,items}}}` | 429 sandbox account cap                                        |
| `POST /api/dsa/operate`       | Staff                 | `{structure,operation,job?}` as below | 200 `{data:{result,operation,structure,state,complexity}}`                                            | 400 input/missing job, 409 full sandbox queue, 429 sandbox cap |

Demo request:

```json
{
  "structure": "priority",
  "operation": "enqueue",
  "job": { "id": "JOB-102", "priorityScore": 4, "deadline": null }
}
```

Structures: `fifo|priority|circular`. Operations: `enqueue|dequeue|peek|clear`. Enqueue requires a label 1–30 chars and score integer 0–1,000; optional deadline is an ISO datetime. Backend adds arrival time. Enqueue returns size; dequeue/peek return the item or null; clear returns null. Ring capacity is 5; FIFO/heap limit is 30. Core clear cost for the ring is reported O(c). Response snapshots involve traversal beyond the core operation.

## Socket.IO contract

Connect to the current origin with `io({withCredentials:true})`. An authenticated cookie is required. Clients cannot select rooms or submit workflow mutations through sockets; use the REST endpoints.

| Event                                                | Payload        | Audience / trigger                                                                |
| ---------------------------------------------------- | -------------- | --------------------------------------------------------------------------------- |
| `job:created`                                        | Job            | Customer + staff after new original/reprint job commits                           |
| `job:queued`                                         | Job            | Customer + staff after heap admission or release from offline buffer              |
| `job:assigned`                                       | Job            | Customer + staff after persisted assignment                                       |
| `job:started`                                        | Job            | Customer + staff after printer start transaction                                  |
| `job:progress`                                       | Job            | Customer + staff after recorded progress                                          |
| `job:printed`                                        | Job            | Customer + staff when printing completes                                          |
| `job:quality-check`                                  | Job            | Customer + staff when FIFO head enters active QC                                  |
| `job:completed`                                      | Job            | Customer + staff after QC passes                                                  |
| `job:failed`                                         | Job            | Customer + staff after printing/QC fails                                          |
| `job:cancelled`                                      | Job            | Customer + staff after cancellation                                               |
| `order:status`                                       | Order          | Customer + staff after creation or order state changes                            |
| `printer:online`, `printer:offline`, `printer:error` | Printer        | Staff after status change; new printer emits offline                              |
| `queue:updated`                                      | Queue snapshot | Staff after a successful serialized scheduler operation                           |
| `inventory:updated`                                  | Inventory      | Staff after restock; printer starts also refresh clients through job/queue events |
| `pricing:updated`                                    | PricingRule    | Staff after rule update                                                           |

Events are emitted after their underlying writes. They are not durable replay messages. Consumers should reload authoritative REST state after reconnecting. Customer sockets do not receive other customers' jobs or global queue snapshots.
