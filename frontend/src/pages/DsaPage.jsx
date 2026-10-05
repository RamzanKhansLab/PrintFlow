import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  ActionButton,
  ErrorNotice,
  Field,
  Heading,
  Loading,
} from "../components/ui";
import { useResource } from "../hooks/useResource";
import { api } from "../services/api";

const concepts = {
  fifo: {
    title: "FIFO Queue",
    subtitle: "First in, first out",
    usage: "Printed jobs waiting for quality control",
    detail:
      "A linked list keeps a head and tail. Enqueue adds at the tail; dequeue removes from the head.",
    complexity: "enqueue O(1) · dequeue O(1) · peek O(1)",
    file: "backend/src/dsa/queue/Queue.py",
  },
  priority: {
    title: "Priority Queue",
    subtitle: "A binary heap",
    usage: "Scheduling new print jobs",
    detail:
      "Higher priority score wins. Equal scores compare deadline, then arrival time. The heap restores its order by bubbling up or down.",
    complexity: "enqueue O(log n) · dequeue O(log n) · peek O(1)",
    file: "backend/src/dsa/priorityQueue/PriorityQueue.py",
  },
  circular: {
    title: "Circular Queue",
    subtitle: "A bounded ring buffer",
    usage: "Waiting jobs at each printer",
    detail:
      "Front is the next removal slot. Rear is the next insertion slot. Both advance with (index + 1) % capacity.",
    complexity: "enqueue O(1) · dequeue O(1) · peek O(1)",
    file: "backend/src/dsa/circularQueue/CircularQueue.py",
  },
};
function Structure({ type, data }) {
  if (type === "priority") {
    const levels = [];
    for (
      let start = 0, width = 1;
      start < data.heap.length;
      start += width, width *= 2
    )
      levels.push(data.heap.slice(start, start + width));
    return (
      <>
        <div className="heap-tree">
          {levels.map((level, index) => (
            <div className="heap-level" key={index}>
              {level.map((job, position) => (
                <div className="ds-node" key={position}>
                  <strong>{job.id}</strong>
                  <span>priority {job.priorityScore}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="muted">
          Heap array: {data.heap.map((job) => job.id).join(" → ") || "empty"}
        </p>
        <p>
          <strong>Removal order:</strong>{" "}
          {data.ordered.map((job) => job.id).join(" → ") || "empty"}
        </p>
        <small className="muted">
          Each level shows the children of the level above. Array index i has
          children 2i+1 and 2i+2.
        </small>
      </>
    );
  }
  if (type === "circular")
    return (
      <>
        <div className="ring-slots">
          {data.slots.map((job, index) => (
            <div key={index} className={`ring-slot ${job ? "occupied" : ""}`}>
              <small>Slot {index}</small>
              <strong>{job?.id || "empty"}</strong>
              <span>
                {data.front === index ? "F " : ""}
                {data.rear === index ? "R" : ""}
              </span>
            </div>
          ))}
        </div>
        <div className="detail-grid">
          <span>front = {data.front}</span>
          <span>rear = {data.rear}</span>
          <span>size = {data.size}/5</span>
        </div>
        <p className="muted">
          F = next removal · R = next insertion ·{" "}
          {data.size === 5
            ? "FULL"
            : data.size === 0
              ? "EMPTY"
              : "space available"}
        </p>
        <p>
          <strong>FIFO order:</strong>{" "}
          {data.items.map((job) => job.id).join(" → ") || "empty"}
        </p>
      </>
    );
  return (
    <div className="linked-queue">
      <span className="count-label">HEAD</span>
      {data.map((job, index) => (
        <div className="linked-node" key={index}>
          <div className="ds-node">
            <strong>{job.id}</strong>
          </div>
          <ArrowRight size={18} />
        </div>
      ))}
      <span className="count-label">
        {data.length ? "TAIL → null" : "null"}
      </span>
    </div>
  );
}
export function DsaPage() {
  const demo = useResource("/dsa", false);
  const production = useResource("/queue");
  const [type, setType] = useState("fifo");
  const [id, setId] = useState("JOB-101");
  const [priority, setPriority] = useState(2);
  const [deadline, setDeadline] = useState("");
  const [result, setResult] = useState(null);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = state || demo.data;
  const concept = concepts[type];
  async function operate(operation) {
    setBusy(true);
    setError("");
    try {
      const data = (
        await api("/dsa/operate", {
          method: "POST",
          body: {
            structure: type,
            operation,
            ...(operation === "enqueue"
              ? {
                  job: {
                    id,
                    priorityScore: priority,
                    deadline: deadline
                      ? new Date(deadline).toISOString()
                      : null,
                  },
                }
              : {}),
          },
        })
      ).data;
      setState(data.state);
      setResult(data);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="BE · Semester 5 · Data Structures & Algorithms"
        title="Inside the queue"
      >
        Operate the actual queue classes, then see where they work in PrintFlow.
      </Heading>
      <div className="tabs" role="tablist" aria-label="Data structure">
        {Object.entries(concepts).map(([key, value]) => (
          <button
            role="tab"
            aria-selected={key === type}
            key={key}
            className={key === type ? "active" : ""}
            onClick={() => {
              setType(key);
              setResult(null);
              setError("");
            }}
          >
            {value.title}
          </button>
        ))}
      </div>
      <ErrorNotice>{error || demo.error}</ErrorNotice>
      {demo.loading ? (
        <Loading />
      ) : (
        current && (
          <section className="card dsa-card">
            <div className="row-between">
              <div>
                <span className="eyebrow">{concept.subtitle}</span>
                <h2>{concept.title}</h2>
              </div>
              <span className="pill">Interactive sandbox</span>
            </div>
            <p className="muted">{concept.detail}</p>
            <div className="structure-view">
              <Structure type={type} data={current[type]} />
            </div>
            <fieldset className="form-grid" disabled={busy}>
              <Field label="Job label">
                <input
                  value={id}
                  maxLength={30}
                  onChange={(event) => setId(event.target.value)}
                />
              </Field>
              {type === "priority" && (
                <>
                  <Field label="Priority score (higher first)">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={priority}
                      onChange={(event) =>
                        setPriority(Number(event.target.value))
                      }
                    />
                  </Field>
                  <Field label="Deadline (optional tie breaker)">
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                    />
                  </Field>
                </>
              )}
            </fieldset>
            <div className="button-row section">
              {["enqueue", "dequeue", "peek", "clear"].map((operation) => (
                <button
                  className={`button ${operation === "enqueue" ? "" : "secondary"}`}
                  disabled={busy}
                  key={operation}
                  onClick={() => operate(operation)}
                >
                  {operation}()
                </button>
              ))}
            </div>
            {result && (
              <div className="operation-result" role="status">
                <strong>
                  {result.operation}() →{" "}
                  {result.result === null
                    ? "empty / no return value"
                    : typeof result.result === "number"
                      ? `size ${result.result}`
                      : result.result.id}
                </strong>
                <span>Core operation: {result.complexity}</span>
                <small>
                  Response visualization traverses the structure; priority
                  ordering takes O(n log n).
                </small>
              </div>
            )}
            <div className="dsa-facts">
              <p>
                <strong>Complexity:</strong> {concept.complexity}
              </p>
              <p>
                <strong>Application use:</strong> {concept.usage}
              </p>
              <code>{concept.file}</code>
            </div>
            <p className="muted small-text">
              Sandbox operations use the same imported classes as the scheduler.
              Each staff account has its own sandbox; it resets after an hour of
              inactivity or a server restart. Sandbox jobs do not become print
              orders.
            </p>
          </section>
        )
      )}
      <section className="card section">
        <div className="row-between">
          <div>
            <span className="eyebrow">Real application state</span>
            <h2>PrintScheduler in action</h2>
          </div>
          <Link className="text-link" to="/admin/queue">
            Live queue →
          </Link>
        </div>
        <ErrorNotice>{production.error}</ErrorNotice>
        {production.data && (
          <div className="scheduler-flow">
            <div>
              <strong>{production.data.pending.length}</strong>
              <span>Priority queue</span>
            </div>
            <ArrowRight />
            <div>
              <strong>
                {production.data.stations.reduce(
                  (count, station) => count + station.buffer.size,
                  0,
                )}
              </strong>
              <span>Circular buffers</span>
            </div>
            <ArrowRight />
            <div>
              <strong>
                {
                  production.data.stations.filter((station) => station.active)
                    .length
                }
              </strong>
              <span>Printing</span>
            </div>
            <ArrowRight />
            <div>
              <strong>{production.data.qualityCheck.waiting.length}</strong>
              <span>FIFO → QC</span>
            </div>
          </div>
        )}
        <p className="muted">
          Priority is 10 for standard and 100 for rush, with +20 for a reprint.
          The scheduler selects the least-loaded compatible online station with
          a free buffer slot. An active print finishes before the next starts.
        </p>
        <code>backend/src/dsa/scheduler/PrintScheduler.py</code>
        <div className="section">
          <ActionButton
            className="button secondary"
            onClick={async () => {
              await api("/queue/schedule", { method: "POST" });
              production.reload();
            }}
          >
            Run production scheduler
          </ActionButton>
        </div>
      </section>
      <div className="callout">
        <h3>Try it during your viva</h3>
        <p>
          Heap: enqueue JOB-101 at priority 2, JOB-102 at 4, JOB-103 at 1. Peek
          returns JOB-102. Ring: enqueue five jobs, dequeue two, enqueue two.
          Rear wraps around while the five-slot capacity stays fixed. FIFO:
          enqueue A, B, C, then dequeue to receive A.
        </p>
      </div>
    </>
  );
}
