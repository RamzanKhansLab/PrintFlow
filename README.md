# PrintFlow - Shared Print Workspace

A **BE Engineering 5th Semester mini project developed for the Data Structures and Algorithms (DSA) subject**.

PrintFlow is a shared printing tool for printing shops, colleges, offices, libraries and labs. Members submit documents and print instructions; operators run printer stations and quality checks; administrators manage equipment and access. One installation serves one shared print desk. Scheduling is powered by custom Python data structures.

The interface combines Y2K chrome panels, digital typography and grids with Memphis colors, geometric shapes and bold borders. The launchpad opens practical tools for submitting, tracking and processing print requests. There are no pricing pages, paid plans, quotes, checkout or billing features.

## Features

- PDF, PNG and JPEG upload with format validation and PDF page counting; files persist in MongoDB GridFS.
- Print configuration, selected page ranges, copies, color, paper size, duplex and binding.
- Server-calculated page, copy, impression and paper-sheet previews.
- Authenticated request tracking and cancellation before printing starts.
- Custom binary-heap scheduling, bounded circular printer buffers, and a linked FIFO for quality checks.
- Compatibility-based routing across online printers, operator-reported progress, QC and reprint handling.
- Socket.IO updates, member/operator/admin access, paper inventory, and an activity log.
- Interactive `/admin/dsa` lab using the **same Python classes as the live workflow**.

Printing is **operator-controlled**: the operator downloads the document, uses the physical printer, and records progress/results. Printer status is manually reported. Direct printer drivers, automatic document spooling, online payments, delivery, DOCX conversion, password recovery, and antivirus scanning are not implemented.

## DSA connected to the application

| Structure                  | Actual use                                  | Source                                                             |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| Linked FIFO Queue          | Printed jobs waiting for QC                 | [Queue.py](backend/src/dsa/queue/Queue.py)                         |
| Binary-heap Priority Queue | New and reprint job scheduling              | [PriorityQueue.py](backend/src/dsa/priorityQueue/PriorityQueue.py) |
| Circular Queue             | Bounded waiting buffer per printer          | [CircularQueue.py](backend/src/dsa/circularQueue/CircularQueue.py) |
| PrintScheduler             | Routing, orchestration and restart recovery | [PrintScheduler.py](backend/src/dsa/scheduler/PrintScheduler.py)   |

The real path is `POST /api/orders → Workflow.createOrder → Node/Python bridge → Python PrintScheduler → PriorityQueue → CircularQueue → operator printing → Queue → QC`. MongoDB stores job records; the runtime structures execute queue operations in Python. There is no duplicate JavaScript queue implementation or library replacement. The DSA lab calls the same Python classes. See [Python integration](docs/python-dsa.md).

## Stack and architecture

React 19, Vite, React Router, Express 5, Node.js 22, Python 3.10+, Mongoose/MongoDB Atlas, Socket.IO, pdf-lib, and custom Python DSA classes. The Python worker uses only the standard library and runs inside the same deployed service.

```text
Browser (React SPA, fetch('/api/...'), io())
                         |
               One Render Web Service
                 Node.js / Express
                  /             \
          frontend/dist       /api + Socket.IO
                                    |
                             Business services
                                    |
                    /                       \
       Local Python DSA worker       MongoDB Atlas + GridFS
```

```text
frontend/             React pages, styles, API and socket clients
backend/src/
  config/             Backend environment loading
  middleware/         Authentication, roles, validation, errors
  models/             Persistent MongoDB schemas
  routes/             Implemented API endpoints
  services/           Print workflow, files, MongoDB integration, Python bridge
  printing/           Page selection and paper requirements
  dsa/                Python queues, scheduler, worker and lab sandbox
  sockets/            Authenticated real-time rooms and events
  scripts/            Administrator promotion and Python availability check
  app.js              API routing and production SPA serving
  server.js           Startup, recovery, HTTP/Socket.IO lifecycle
docs/                 Setup, architecture, DSA and academic report
package.json          npm workspaces and root commands
render.yaml           One Node web service
```

## Local setup

Use Node **22.12 or newer within the 22.x line**, npm, **Python 3.10+ on PATH**, and MongoDB Atlas (or a local MongoDB replica set). The backend starts Python automatically; no pip dependencies or separate Python server are required. A standalone MongoDB server cannot support this application's transactions.

```powershell
npm.cmd ci
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env`. Only backend settings are used:

| Variable      | Requirement                                                      |
| ------------- | ---------------------------------------------------------------- |
| `MONGODB_URI` | Required; Atlas URI including the `printflow` database           |
| `JWT_SECRET`  | Required; at least 32 random characters                          |
| `NODE_ENV`    | `development` locally; `production` on Render for secure cookies |
| `PORT`        | Optional locally, defaults to `5000`; Render supplies it         |

Optional `PYTHON_BIN` selects a Python executable when it is not on PATH; see [Python integration](docs/python-dsa.md).

Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. In Atlas, create a database user, authorize your development IP and Render outbound addresses, and copy the driver connection URI. See [setup](docs/setup.md) for details. There is **no frontend `.env`**, production frontend URL setting, or optional third-party service to configure.

```powershell
npm.cmd run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and `/socket.io` to port 5000. Alternatively, use `npm run dev:backend` and `npm run dev:frontend` in separate terminals. On macOS/Linux use `npm` instead of `npm.cmd`.

Register your first account, then promote that existing account:

```powershell
npm.cmd run admin -- your-email@example.com
```

Sign out and sign in again. In the workspace, add a printer, set it online, and add paper inventory. New databases have **no sample accounts, requests, printers, inventory or seeded configuration**.

## Build and single-service deployment

```powershell
npm.cmd run build
npm.cmd start
```

The build first runs `npm run check:python` to verify the interpreter/worker imports, then builds React. Open `http://localhost:5000` to use the built SPA and API together. Keep `NODE_ENV=development` for this local HTTP run; Render uses `production` behind HTTPS. The frontend build is served directly from `frontend/dist`; no copying is needed.

On Render, create **one Node Web Service** from the repository root, or use the included Blueprint:

| Setting         | Value                                   |
| --------------- | --------------------------------------- |
| Build           | `npm ci --include=dev && npm run build` |
| Start           | `npm start`                             |
| Health check    | `/api/health`                           |
| Runtime         | Node 22, one instance                   |
| Backend secrets | `MONGODB_URI`, `JWT_SECRET`             |
| Environment     | `NODE_ENV=production`                   |

The backend binds `0.0.0.0` on Render's `PORT`. Express handles `/api/*` before serving the SPA and its history fallback. **No separate Vercel deployment is needed.** Follow the complete [deployment procedure](docs/deployment.md), including first-admin setup without a Render shell.

## Main browser routes

| Audience           | Routes                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Public             | `/`, `/guide`, `/login`, `/register`                                                                                                    |
| Signed-in accounts | `/print`, `/track`, `/requests`, `/requests/:id`, `/account`                                                                            |
| Operator/admin     | `/admin`, `/admin/dashboard`, `/admin/queue`, `/admin/printers`, `/admin/jobs`, `/admin/inventory`, `/admin/dsa`, `/station/:printerId` |
| Admin              | `/admin/users`, `/admin/audit`                                                                                                          |

The browser redirects old `/orders` links to `/requests` and `/services` to `/guide`. The `/api/orders` contract and stored `customer` role remain for compatibility; the UI calls these print requests and members. Old monetary snapshots are excluded from request responses; old database records are not deleted.

## Documentation

- [Setup](docs/setup.md) · [Render deployment](docs/deployment.md)
- [Architecture](docs/architecture.md) · [Implementation](docs/implementation.md) · [Features](docs/features.md)
- [DSA explanation](docs/dsa.md) · [DSA mapping](docs/dsa-mapping.md) · [Queue system](docs/queue-system.md)
- [API reference](docs/api.md) · [Database](docs/database.md)
- [Frontend](docs/frontend.md) · [Backend](docs/backend.md) · [User flow](docs/user-flow.md)
- [Academic project report](docs/project-report.md) · [Manual acceptance checklist](docs/acceptance.md)

## Scope and evaluation

Coding and documentation were prepared in the initially empty target folder. Application builds, tests, database connections, browser checks, and deployment **have not been executed**; evaluation is left to the project owner as requested. The dependency lockfile records package resolution, not runtime verification.

The scheduler is intended for one Node process with one local Python worker. Render free instances can sleep/restart; queues recover from MongoDB, but continuous availability is not promised. Stop operator activity while deploying; shared active-active schedulers are outside this project. Files use Atlas storage rather than Render's temporary filesystem.

Future scope: a physical printer agent with acknowledgements, document conversion, email/password recovery, stock corrections and consumables, durable event replay, more advanced scheduling, automated verification, and coordinated multi-instance execution.
