# Implementation notes

## Authentication

`middleware/auth.js` verifies an HS256 JWT from an HttpOnly cookie, then fetches the current user and role. Tokens last eight hours. `routes/api.js` hashes passwords with bcrypt cost 12 and validates credentials with Zod. Public registration cannot assign roles. Production uses Secure cookies, the Render proxy setting, same-origin mutation checks, Helmet, and request limits. The local promotion CLI bootstraps an existing administrator account without a default password.

## File upload and document analysis

`services/files.js` accepts one in-memory upload up to 10 MB through Multer. It inspects PDF/PNG/JPEG signatures, parses PDFs with pdf-lib to count pages, and parses images through pdf-lib embedding to reject unreadable content. PDFs must be unencrypted and have 1–2,000 pages; images count as one page. File bytes are written to MongoDB GridFS and metadata to `documents`.

Downloads require ownership or a staff role, use attachment disposition, and are not exposed as a public static directory. Analysis is limited to format/readability/page count; there is no OCR, DOCX conversion, automatic color detection or malware scanner. GridFS write and metadata creation are separate steps with cleanup on a caught metadata failure; an abrupt process crash between them can leave an orphan upload needing administrative cleanup.

## Print configuration and pricing

`configSchema` validates copies (1–500), color, duplex, paper size, page range, binding and urgency. `pricing/quote.js` validates the selected page numbers and deduplicates overlaps using a Set. The frontend does not decide prices; it debounces quote requests after changes.

```text
impressions = selectedPages × copies
sheets = ceil(selectedPages / (duplex ? 2 : 1)) × copies
printing = basePage × impressions × colorMultiplier × paperMultiplier × duplexMultiplier
binding = configured binding price × copies
rush surcharge = (printing + binding) × (rushMultiplier - 1), only for rush
tax = (printing + binding + rush surcharge) × taxPercent / 100
total = printing + binding + rush surcharge + tax
```

Monochrome and single-sided use multiplier 1. Monetary components are rounded to integer paise; the saved quote is INR. There is no delivery fee or discount implementation. Quotes include the rule update timestamp. Order creation recalculates against current rules and rejects an unexpected total, so the browser cannot submit a fabricated price. Existing orders retain their saved config and quote.

## Order creation

`Workflow.createOrder()` validates a UUID `clientRequestId`, document ownership, optional future deadline and expected total. A MongoDB transaction creates the order, original job and audit entry together. A unique `(customer, clientRequestId)` index supports retrying a committed creation. The new job enters the live heap and dispatch runs before the scheduler operation resolves. The creation response contains the creation snapshot; retrieve the order for current assigned status.

## Priority scheduling and routing

Python `PrintScheduler` imports all three custom Python structures. Standard/rush/reprint scores are computed in Python `priority_for()`. Node's `PrintSchedulerService` sends commands through `PythonDsa`; the live dispatcher runs Python heap dequeue and station-ring enqueue, then Node persists/confirms the proposed assignments. Compatibility checks and least-load routing are also Python. Assigned buffers remain FIFO. Offline/error stations release waiting work to the heap while retaining any active print for human resolution.

## Printer buffers and paper stock

Every configured printer gets a fixed-capacity circular queue. Starting its head job uses a transaction to change the job/order, conditionally decrement sufficient paper stock, and record an audit entry. An empty, offline, busy or understocked station produces a 409 response. Inventory cannot go negative through the start endpoint. Failed prints do not refund sheets; explicit reprints consume additional paper when started.

## Quality control and reprints

Finishing printing clears the station's active slot and enqueues the job into the linked FIFO. QC start takes only the head and permits one active inspection globally. Passing sets the job to COMPLETED and the order to READY. Failing records a reason and leaves the order needing attention. Reprints link the failed job to a new queued attempt; duplicate direct children are rejected.

## Real-time updates

`sockets/index.js` emits persisted job/order changes to authorized rooms. Queue snapshots go only to staff. The client connects with `io()` to the current origin and invalidates REST resources on changes. Reconnection refetches missed state. Job progress is supplied by an operator, not an artificial timer. Printer status is also operator-reported.

## Frontend and admin dashboard

`App.jsx` declares customer, staff and admin route groups. The shared layout, responsive CSS, labeled controls, error notices and disabled mutation buttons support both desktop and narrow screens. The workspace shows actual queue counts, printer buffers, jobs, stock and role-specific management pages. Every mutating action calls a protected API. Browser route guards are a convenience; backend middleware enforces authorization.

## DSA visualizer

`DsaPage.jsx` calls `services/dsa-demo.js` through the API. This Node module validates input and calls Python `dsa/demo.py`, which imports the production Queue, PriorityQueue and CircularQueue. The UI renders linked FIFO items, heap levels/removal order, and all ring slots with front/rear pointers. A separate panel fetches the real Python scheduler snapshot. Sandbox clear/dequeue never remove production jobs.

## Serving and recovery

`app.js` handles API routes and API 404s before static assets and a non-API GET history fallback. Production requires an existing built `index.html`. `server.js` validates MongoDB transaction support, initializes model indexes/pricing, restores scheduler state and binds one HTTP/Socket.IO listener on `0.0.0.0`. The process-local scheduling model and recovery limitations are described in [queue system](queue-system.md).
