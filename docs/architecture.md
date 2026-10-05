# Architecture

## Single-origin application

```text
React browser application
  |  fetch('/api/...')       io() + session cookie
  +----------------------+----------------------+
                         |
                   HTTP server
              Express 5 + Socket.IO
                 /             \
        frontend/dist       API route layer
        SPA fallback       auth + Zod validation
                                 |
                          Business services
                  /              |             \
             File service    Pricing engine    Workflow
                  |              |                |
                GridFS      PricingRule       PrintScheduler
                  |              |                |
                  +--------------+----------------+
                                 |
                            MongoDB Atlas
```

`app.js` mounts `/api` before static assets and the SPA fallback. Unknown API endpoints remain JSON 404s. `server.js` shares one HTTP listener with Socket.IO. In development Vite proxies both API and socket traffic, so browser requests still appear same-origin. Workflow uses `PrintSchedulerService` in Node, which calls the Python `PrintScheduler` over private stdin/stdout JSON messages. Python owns the queues and routing; Node owns database transactions and sockets. Both processes run in one Render service.

## Scheduling path

```text
Order + PrintJob committed in MongoDB
                  |
            priority_for(config)
                  |
         Custom PriorityQueue (heap)
                  |
     Compatibility + least-load printer router
                  |
     Custom CircularQueue per printer (waiting)
                  |
     Operator starts head job; stock is consumed
                  |
        One active print at this station
                  |
               PRINTED
                  |
         Custom Queue (linked FIFO)
                  |
        One active quality check globally
              /            \
            pass           fail
             |              |
     COMPLETED / READY    FAILED / ATTENTION
                            |
                  explicit reprint request
                            |
                 New job back into heap
```

The printer engine is this routing and operator station workflow. It does not implement hardware discovery, a spooler, printer drivers, or a timer that pretends printing occurred.

## Responsibilities

| Layer                              | Responsibility                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `frontend/src/pages`               | Customer flows, operator station controls, admin tools and DSA visualization |
| `frontend/src/services/api.js`     | Same-origin JSON/form requests; common error handling                        |
| `frontend/src/store`               | Authentication and Socket.IO invalidation                                    |
| `backend/src/routes/api.js`        | Endpoint contracts, role guards, request/response handling                   |
| `backend/src/services/workflow.js` | Validated state transitions and MongoDB transactions                         |
| `backend/src/pricing/quote.js`     | Page selection and database-rule pricing                                     |
| `backend/src/dsa/scheduler`        | Serialized runtime orchestration, dispatch, reconstruction                   |
| Other `dsa` folders                | Independent queue algorithms; no database or UI dependencies                 |
| `backend/src/models/index.js`      | Durable records and relationships                                            |

## Authentication and real-time events

Passwords use bcrypt. A signed 8-hour JWT is stored in an HttpOnly, SameSite=Lax cookie and Secure in production. Protected requests verify the token and load the current user/role from MongoDB; the JWT does not grant a permanent role. State-changing browser requests enforce the current origin. Administrators bootstrap through the local CLI.

Socket connections validate the same session cookie. Every user joins their own room. Only operators/admins join `staff`. Order/job events go to the job's customer and staff; global queue, printer and inventory updates go to staff. There are no client-controlled room joins or socket commands that mutate jobs. Expiry and role updates disconnect affected sessions; reauthentication is required to regain access.

## Durability and concurrency

MongoDB is the durable authority. In-memory structures decide scheduling; no serialized JSON queue pretends to be the implementation. Order/job creation and state changes use transactions; runtime changes follow commits. Scheduling assignment uses a conditional `QUEUED → ASSIGNED` update.

`PrintSchedulerService.exclusive()` serializes scheduler mutations within one Node process and its one Python worker. Python proposes dispatch assignments; Node persists and confirms them before exposing a queue snapshot. After an error it discards speculative runtime state and restores from MongoDB, restarting the worker if needed. Recovery retains printing/QC jobs rather than assuming success. This design needs a **single application instance**, with operator activity paused during deployments. It does not claim multi-instance coordination.

Socket delivery is transient. React reloads authoritative API data after a connection/reconnection and on received change events. The UI also offers refresh actions. Historical state is in orders/jobs and audit logs, not in a durable socket event stream.
