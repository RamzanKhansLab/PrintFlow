# Python DSA integration

## Why there is a bridge

Express and the existing database/authentication code remain JavaScript. All four DSA implementations, priority calculation, compatibility checks and printer selection live in Python. Node cannot import a `.py` class directly, so `services/python-dsa.js` spawns one persistent child with:

```text
python -u -B -m dsa.worker       # Windows default
python3 -u -B -m dsa.worker      # Linux/macOS default
```

The working directory is `backend/src`. No Flask/FastAPI server, second deployment, queue library, Python database driver or pip installation is needed. The worker uses the standard library and accepts a fixed set of internal commands.

```text
React → Express API → Workflow / MongoDB transactions
                         |
                PrintSchedulerService (JS)
                         |
                  private JSON-lines pipes
                         |
                   dsa/worker.py
                    /         \
        PrintScheduler.py     demo.py
                    \         /
                same Python DSA classes
```

## Local requirement

Install Python **3.10 or newer** and enable its PATH entry. Windows defaults to `python`; Linux/macOS default to `python3`. If the executable is elsewhere, set optional backend `PYTHON_BIN` to its full executable path, without command arguments or extra surrounding quotes. Example:

```dotenv
PYTHON_BIN=C:\Users\YourName\AppData\Local\Programs\Python\Python313\python.exe
```

Keep `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV` and `PORT` as before. There is no frontend setting. No virtual environment or `requirements.txt` is necessary because the DSA imports only the standard library.

After installing npm dependencies, `npm run check:python` checks the executable and imports the worker using its normal transport. `npm run build` runs this check before building the frontend. This check does not connect to MongoDB and is not an application test suite. Neither it nor runtime tests have been run for this coding-only change.

Node watch mode does not watch Python modules; restart the backend after editing `.py` files. No Python process needs to be started manually.

## Protocol and ordering

Each input line is `{id, operation, payload}`. The output is `{id, result}` or `{id, error, status}`. Node matches IDs to pending promises. JSON handles ObjectIds as strings, timestamps as ISO strings and `None` as JSON null; frontend response shapes remain unchanged. UTF-8 is explicit, including on Windows. Only protocol JSON goes to stdout; errors go to stderr.

Workflow mutations are serialized by the Node service. The worker processes one command at a time. Python first proposes dispatch assignments by moving real heap/ring entries. Node persists conditional assignments, then confirms them in Python. Queue readers wait behind this entire sequence; no uncommitted plan is returned or announced as completed. Other business transitions commit first, then call their corresponding Python queue operation.

Node does not hold its own scheduling queues or reimplement the comparator. Its maps track pending IPC requests; its promise chain serializes database actions. Those transport concerns are separate from the academic DSA.

## Failure and recovery

The request timeout is 15 seconds. Timeout, invalid protocol output or worker exit rejects pending requests and clears scheduler readiness. `/api/health` then reports unavailable. A later workflow operation or the existing 30-second timer starts a new worker and reconstructs real queues from MongoDB.

If MongoDB committed before the worker failed, recovery loads that committed state. If an assignment plan only partially committed, confirmed records rebuild as ASSIGNED and remaining records rebuild as QUEUED. Active prints remain active for operator reconciliation. Lab sessions are in-memory and reset on worker restart.

Startup fails with an actionable error when Python is missing/unsupported. Shutdown closes the worker's stdin, waits for it to exit, and kills it after a short grace period if necessary. There is no silent JavaScript fallback.

## Render

Keep the existing one-service Node Blueprint, build command and start command. Render's native runtimes include Python tooling at both build and runtime; see the [native runtime tool list](https://render.com/docs/native-runtimes). The root build now checks that the available Python meets the 3.10+ requirement. The worker shares the Node service's machine, memory and lifecycle. It opens no port; Express remains the only public listener.

Use one application instance (one Node process and its one Python worker) per database. This bridge is not distributed scheduling, and the previous deployment/recovery limits still apply.
