# Database design

All model declarations are in [`backend/src/models/index.js`](../backend/src/models/index.js). Collection names are explicit rather than inferred pluralizations. Mongoose records `createdAt` and `updatedAt`; version keys are disabled.

MongoDB Atlas or a replica set is required because workflow changes use transactions. Startup initializes collections/indexes without seeding configuration or sample data. It does not populate fake users, printers, orders, jobs or paper stock.

| Collection       | Model          | Fields and purpose                                                                                                                                                        |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`          | User           | name, unique lowercased email, passwordHash excluded from normal queries, role (`customer`, `operator`, `admin`)                                                          |
| `documents`      | Document       | owner → User, fileId → GridFS, original sanitized name, validated MIME, byte count, analyzed pages                                                                        |
| `orders`         | Order          | customer → User, document → Document, unique PF reference, clientRequestId, saved config/printSummary, deadline, aggregate status                                         |
| `printJobs`      | PrintJob       | order/customer/document refs, label, saved config, sheets, priority score/deadline, status, optional printer, progress, stage timestamps, failure/QC notes, reprint links |
| `printers`       | Printer        | unique name, color/duplex capabilities, paper sizes, bounded buffer capacity, manually reported online/offline/error status                                               |
| `inventory`      | Inventory      | unique paperSize, nonnegative sheets on hand                                                                                                                              |
| `auditLogs`      | AuditLog       | actor → User, action, entity identifier, detail, timestamps for workflow/admin mutations                                                                                  |
| `uploads.files`  | GridFS-managed | File metadata, filename, length, upload time, owner/MIME metadata                                                                                                         |
| `uploads.chunks` | GridFS-managed | Binary chunks keyed by file ID and chunk sequence                                                                                                                         |

## Relationships

```text
User ──owns──> Document ──references──> GridFS file/chunks
  |
  +──places──> Order ──has──> original PrintJob
                 |                  |
                 |                  +──reprintJob──> child PrintJob
                 |                                      |
                 +──document                            +──reprintOf──> parent

PrintJob ──assigned to──> Printer
PrintJob.config.paperSize ──consumes──> Inventory.paperSize
User ──actor of──> AuditLog
```

An order has one document and one original job, with any reprints stored as separate attempts. This version does not implement a multi-document cart. MongoDB references are application-level relationships, not foreign-key constraints; public routes do not delete referenced records.

## Important indexes

- `users.email` unique.
- `orders.reference` unique.
- `(orders.customer, orders.clientRequestId)` unique: creation retries return the existing order.
- `(orders.customer, orders.createdAt descending)` for customer history.
- `(printJobs.status, printJobs.createdAt)` for active-job lookup.
- `(printJobs.order, printJobs.createdAt)` for order attempt history.
- Unique printer name and inventory paper size.
- GridFS manages file/chunk indexes for streamed storage.

There is no queue collection storing an array of jobs. Persisted status/assignment/timestamps allow reconstruction into the custom runtime structures.

## Consistency

Order, job, stock and audit mutations share MongoDB sessions/transactions where they form a workflow action. Starting a printer uses a conditional stock decrement (`sheets >= required`) within the same transaction as `ASSIGNED → PRINTING`; a stock failure aborts all changes. Queued assignment itself is an atomic conditional update. Page and sheet counts are calculated from the owned document and print instructions before committing the request.

State timestamps include `assignedAt`, `startedAt`, `printedAt`, `qcStartedAt` and `completedAt`. They support both customer history and restart ordering. A reprint records `reprintOf` on the new job and `reprintJob` on its failed parent in one transaction.

Authentication and file uploads are not included in the full workflow audit stream. Each normal upload persists GridFS bytes and a Document record separately; cleanup is attempted if Document creation fails. An abrupt crash can leave an orphan GridFS file. There is no automatic retention/deletion job in this version.

The process-local scheduler assumes one backend instance. Database transactions prevent partial business updates; they do not establish a distributed scheduler or guarantee exactly-once physical printing. See [queue system](queue-system.md).

## Compatibility with earlier data

The print request model stays in `orders`, and member accounts keep the stored `customer` role. New requests store `printSummary` with pages, copies, impressions and sheets. Older records can omit it. Query middleware excludes legacy `quote` fields from API responses. The old `pricingRules` collection, if present, is no longer read or written; existing data is not deleted automatically.
