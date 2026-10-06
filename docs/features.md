# Implemented features

Features below describe the source implementation. Runtime acceptance remains for the project owner; these are not test results.

| Feature / purpose        | How it works                                                               | Backend                                   | Frontend                                      | DSA                                     |
| ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------- | --------------------------------------- |
| Authentication and roles | bcrypt passwords, cookie JWT, DB-loaded roles and ownership checks         | `middleware/auth.js`, auth/user routes    | `AuthPages.jsx`, `AuthContext`, `RequireAuth` | —                                       |
| Document upload          | PDF/PNG/JPEG ≤10 MB stored durably in GridFS                               | `services/files.js`, files routes         | `PrintPage.jsx`                               | —                                       |
| Document analysis        | File signature/readability validation and PDF page count; images one page  | `services/files.js` with pdf-lib          | Uploaded document summary                     | —                                       |
| Print configuration      | Color, copies, paper, sides, page ranges, binding and urgency              | `middleware/validation.js`                | `PrintPage.jsx`                               | Config feeds compatibility and priority |
| Paper preview            | Selected pages, copies, impressions and sheets; recalculated on submission | `printing/plan.js`                        | `PrintPage.jsx`                               | Feeds stock consumption                 |
| Print request management | Durable orders/attempts, idempotent creation, cancellation before start    | `services/workflow.js`                    | `OrderPages.jsx`                              | Removes cancelled waiting jobs          |
| Priority scheduling      | Score → deadline → arrival ordering                                        | `PrintScheduler.plan_dispatch`            | `QueuePage`, `JobsPage`                       | Binary heap                             |
| Multi-printer routing    | Online compatibility and minimum waiting-plus-active load                  | `PrintScheduler.choose_printer`           | `PrintersPage`, `QueuePage`                   | Heap → ring                             |
| Printer buffers          | Bounded waiting slots, separate active print                               | Scheduler / `Workflow.startPrinter`       | `StationPage`                                 | Circular Queue                          |
| Printer status           | Staff sets online/offline/error; offline waiting work reroutes             | `Workflow.setPrinterStatus`               | `PrintersPage`                                | Ring drains into heap                   |
| Print progress           | Operator records progress, completion or failure                           | Workflow job lifecycle methods            | `StationPage`                                 | Completed prints enter FIFO             |
| Quality control          | FIFO inspection, pass/fail, notes, ready status                            | `startQualityCheck`, `finishQualityCheck` | `QueuePage`                                   | Linked FIFO Queue                       |
| Reprint handling         | Failed attempts link to newly queued jobs                                  | `Workflow.reprint`                        | `JobsPage`, order history                     | Heap with reprint boost                 |
| Inventory                | Paper restock and atomic consumption at start                              | Inventory model / Workflow                | `InventoryPage`                               | Start of ring head triggers consumption |
| Real-time updates        | Authorized Socket.IO rooms after saved state changes                       | `sockets/index.js`                        | `RealtimeContext`, `useResource`              | Staff queue snapshots                   |
| Member tracking          | Private tracking by reference/ID with attempt history                      | Order detail/track routes                 | `TrackPage`, `OrderPage`                      | Displays saved lifecycle                |
| Operator dashboard       | Current counts, stations, stock and queue controls                         | Queue/printer/inventory APIs              | `DashboardPage`                               | Real runtime state                      |
| DSA visualization        | Enqueue/dequeue/peek/clear plus live scheduler panel                       | `dsa/demo.py` + Node validation           | `DsaPage.jsx`                                 | Same three production Python classes    |
| Activity log             | Transactional workflow/admin action records                                | AuditLog / `transaction()`                | `AuditPage`                                   | —                                       |
| Recovery                 | Runtime queues reconstruct from MongoDB                                    | `PrintScheduler.restore`                  | REST reload after reconnection                | All three structures                    |
| Single Render URL        | API + sockets + SPA from one listener                                      | `app.js`, `server.js`, `render.yaml`      | Relative fetch, `io()`                        | Same scheduler process                  |

## Deliberate scope boundaries

- Physical printing and progress/status reporting are manual; there is no hardware driver or spool agent.
- Page analysis does not include DOCX conversion, OCR, color estimation, or virus scanning.
- Binding is stored as an instruction for the operator to perform manually.
- READY represents quality checked and ready for collection; no delivery or collected-status workflow exists.
- This is a shared printing utility. Pricing, paid plans, checkout and billing are absent.
- Stock management covers paper additions and consumption only, not toner, negative adjustments or purchase orders.
- User roles can be managed; profile editing, account deletion, email verification, password reset and MFA are not implemented.
- The scheduler runs in one Python worker managed by one Node backend process, uses non-preemptive printer buffers, and does not guarantee deadlines.

The shared UI uses a Y2K/Memphis visual theme. A task-based launchpad, paper preview ticket and control-room navigation organize actual printing tools. One installation is one shared workspace; there is no organization switcher or tenant isolation feature.
