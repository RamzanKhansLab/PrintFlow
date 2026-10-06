# Backend

## Entry points

`backend/src/server.js` loads backend settings, connects to MongoDB, requires replica-set/sharded transaction support, initializes model collections/indexes, configures sockets and starts a local Python worker. It reconstructs the live Python scheduler before binding one listener on `0.0.0.0` using `PORT` or 5000.

`backend/src/app.js` configures Helmet, production trust-proxy behavior, JSON parsing, cookies, same-origin mutation checks and API routes. Unknown API paths return JSON. Express then serves `frontend/dist`; non-API extensionless GET routes fall back to `index.html`. A missing static asset returns 404 rather than HTML. Production startup refuses a missing frontend build.

## Modules

- `config/env.js`: backend-only `.env` loading, required Mongo URI and signing secret, valid port.
- `middleware/auth.js`: JWT verification, current user lookup, roles, public user projection and origin checks.
- `middleware/validation.js`: shared print/printer/ID/pagination schemas.
- `middleware/errors.js`: predictable JSON errors without exposing unexpected server exceptions.
- `models/index.js`: actual persistent models and indexes.
- `routes/api.js`: the endpoint layer; [API reference](api.md) documents every mounted route.
- `services/workflow.js`: order creation, cancellation, printer start/status, progress, completion, QC, reprints, stock and transactional audits.
- `services/files.js`: file inspection, PDF/image parsing, GridFS storage.
- `printing/plan.js`: page-range validation and page/copy/impression/sheet counts.
- `dsa/`: Python implementations of the three data structures, scheduler, sandbox and worker dispatcher.
- `services/python-dsa.js`: private JSON-lines subprocess transport; optional `PYTHON_BIN` selects the executable.
- `services/print-scheduler.js`: serializes Node mutations and persists/acknowledges Python scheduling decisions.
- `services/dsa-demo.js`: HTTP input validation for the Python sandbox in `dsa/demo.py`.
- `sockets/index.js`: authenticated rooms and persisted-state events.
- `scripts/promote-admin.js`: local CLI to promote an existing registered user.

## State and concurrency

Controllers do not own array queues. They call Workflow, which enters the Node scheduler service's serial mutation chain. Transactional business writes precede Python runtime changes. For dispatch, Python plans assignments with its real heap/rings, Node atomically saves QUEUED → ASSIGNED and confirms each result, then releases queue readers. On failure, the worker is restarted when necessary and all live queues are restored from MongoDB.

The supported topology is one scheduler process for one database. Start/finish/QC paths check their required persisted states; duplicate or incompatible transitions return 409. Order creation has a customer-scoped UUID key. Reprint linkage stops a failed attempt from spawning multiple direct children. This does not promise distributed or hardware-level exactly-once execution.

## File storage and print preparation

Uploads never depend on a Render disk. GridFS stores bytes and Document stores metadata. Ownership/staff authorization protects downloads. `preparePrint` checks ownership and derives paper usage from validated instructions. Submission recalculates and persists `printSummary`. Stock is paper-specific; starting a job decrements enough sheets inside the same transaction as the job/order transition.

## Health and shutdown

`GET /api/health` returns 200 only when MongoDB is connected, the Python worker is running and scheduler reconstruction is ready. A database disconnect or worker failure clears readiness. Recovery retries every 30 seconds and on the next scheduled mutation. SIGTERM/SIGINT stops Socket.IO/HTTP, waits for the scheduler chain, closes the worker and disconnects MongoDB with a ten-second shutdown timeout.

Runtime queue state is expendable because active job records persist. Active physical printing is not automatically reissued after restart. The operator must reconcile that stage with the printer before taking the next action.

## Operational scope

Sessions expire after eight hours, use HttpOnly cookies, and are Secure in production. Requests use the current user role. Rate limits and demonstration sessions are memory-local; they reset on restart. There is no external service dependency beyond Atlas and no optional payment or media provider configured.

No backend process, database initialization or deployment was run as part of the coding-only handoff. See [setup](setup.md) and [acceptance](acceptance.md) to execute it.
