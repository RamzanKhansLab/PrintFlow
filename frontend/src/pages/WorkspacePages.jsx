import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Boxes, CheckCheck, Layers, Printer } from "lucide-react";
import {
  ActionButton,
  Badge,
  Empty,
  ErrorNotice,
  Field,
  Heading,
  Loading,
  Pagination,
} from "../components/ui";
import { useResource } from "../hooks/useResource";
import { useAuth } from "../store/AuthContext";
import { api, date } from "../services/api";

function JobChip({ job }) {
  return (
    <Link to={`/requests/${job.order}`} className="job-chip">
      <strong>{job.label}</strong>
      <small>
        Priority {job.priorityScore} · {job.config.paperSize} · {job.sheets}{" "}
        sheets
      </small>
    </Link>
  );
}
export function DashboardPage() {
  const queue = useResource("/queue");
  const inventory = useResource("/inventory");
  const { user } = useAuth();
  const state = queue.data;
  return (
    <>
      <Heading
        eyebrow="Print workspace"
        title={`Hello, ${user.name.split(" ")[0]}.`}
        action={
          <Link className="button" to="/admin/queue">
            Open live queue <ArrowRight size={16} />
          </Link>
        }
      >
        Here’s what’s moving through your print desk.
      </Heading>
      <ErrorNotice>{queue.error || inventory.error}</ErrorNotice>
      {queue.loading ? (
        <Loading />
      ) : (
        state && (
          <>
            <div className="stats-grid">
              {[
                [Layers, "Priority queue", state.pending.length],
                [
                  Printer,
                  "Printing now",
                  state.stations.filter((station) => station.active).length,
                ],
                [
                  Boxes,
                  "Buffered jobs",
                  state.stations.reduce(
                    (total, station) => total + station.buffer.size,
                    0,
                  ),
                ],
                [
                  CheckCheck,
                  "Quality checks",
                  state.qualityCheck.waiting.length +
                    (state.qualityCheck.active ? 1 : 0),
                ],
              ].map(([Icon, title, value]) => (
                <div className="card stat" key={title}>
                  <span>
                    {title}
                    <Icon size={18} />
                  </span>
                  <strong>{value}</strong>
                  <small>Current runtime state</small>
                </div>
              ))}
            </div>
            <div className="grid two section">
              <section className="card">
                <div className="row-between">
                  <h2>Printer stations</h2>
                  <Link className="text-link" to="/admin/printers">
                    Manage
                  </Link>
                </div>
                {state.stations.length ? (
                  state.stations.map((station) => (
                    <Link
                      className="station-row"
                      key={station.printer._id}
                      to={`/station/${station.printer._id}`}
                    >
                      <Printer size={22} />
                      <div>
                        <strong>{station.printer.name}</strong>
                        <small>
                          {station.active
                            ? `Printing ${station.active.label}`
                            : `${station.buffer.size} jobs waiting`}
                        </small>
                      </div>
                      <Badge status={station.printer.status} />
                    </Link>
                  ))
                ) : (
                  <Empty title="Add your first printer">
                    An administrator can configure a station in Printers.
                  </Empty>
                )}
              </section>
              <section className="card">
                <h2>Paper on hand</h2>
                {inventory.data?.length ? (
                  inventory.data.map((stock) => (
                    <div className="data-line" key={stock._id}>
                      <span>{stock.paperSize}</span>
                      <strong>{stock.sheets.toLocaleString()} sheets</strong>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    No paper has been added yet. Restock before starting a
                    print.
                  </p>
                )}
                <Link className="text-link" to="/admin/inventory">
                  Manage inventory <ArrowRight size={16} />
                </Link>
                <div className="callout">
                  <h3>A queue you can explain.</h3>
                  <p>
                    Explore the heap, printer rings, and FIFO with interactive
                    operations.
                  </p>
                  <Link to="/admin/dsa">Open the DSA lab →</Link>
                </div>
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}
function QualityControls({ active, reload }) {
  const [notes, setNotes] = useState("");
  return (
    <div className="qc-active">
      <div className="row-between">
        <h3>Checking {active.label}</h3>
        <Badge status="QUALITY_CHECK" />
      </div>
      <a className="text-link" href={`/api/files/${active.document}/download`}>
        Download original document
      </a>
      <Field label="Quality check notes">
        <textarea
          value={notes}
          maxLength={500}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Alignment, page count, color and finishing…"
        />
      </Field>
      <div className="button-row">
        <ActionButton
          onClick={async () => {
            await api(`/jobs/${active._id}/qc`, {
              method: "POST",
              body: { passed: true, notes },
            });
            reload();
          }}
        >
          Pass & mark ready
        </ActionButton>
        <ActionButton
          className="button danger"
          onClick={async () => {
            await api(`/jobs/${active._id}/qc`, {
              method: "POST",
              body: { passed: false, notes },
            });
            reload();
          }}
        >
          Fail quality check
        </ActionButton>
      </div>
    </div>
  );
}
export function QueuePage() {
  const { data, loading, error, reload } = useResource("/queue");
  return (
    <>
      <Heading
        eyebrow="From queue to quality"
        title="Live print flow"
        action={
          <ActionButton
            className="button secondary"
            onClick={async () => {
              await api("/queue/schedule", { method: "POST" });
              reload();
            }}
          >
            Run scheduler
          </ActionButton>
        }
      >
        Higher priority, earlier deadline, then arrival time. Assigned work
        stays in station order.
      </Heading>
      <ErrorNotice>{error}</ErrorNotice>
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <section className="card">
              <div className="row-between">
                <h2>01 · Priority queue</h2>
                <span className="count-label">
                  {data.pending.length} waiting
                </span>
              </div>
              <p className="muted">
                Jobs remain here until an online, compatible printer has buffer
                space.
              </p>
              <div className="queue-strip">
                {data.pending.length ? (
                  data.pending.map((job) => <JobChip key={job._id} job={job} />)
                ) : (
                  <p className="muted">The priority queue is empty.</p>
                )}
              </div>
            </section>
            <div className="grid two section">
              {data.stations.map((station) => (
                <section className="card" key={station.printer._id}>
                  <div className="row-between">
                    <h3>{station.printer.name}</h3>
                    <Badge status={station.printer.status} />
                  </div>
                  <p className="muted">
                    Buffer {station.buffer.size}/{station.buffer.capacity} ·
                    front {station.buffer.front} · rear {station.buffer.rear}
                  </p>
                  {station.active && (
                    <div className="callout">
                      Printing: {station.active.label} ·{" "}
                      {station.active.progress}%
                    </div>
                  )}
                  <div className="queue-strip">
                    {station.buffer.items.map((job) => (
                      <JobChip key={job._id} job={job} />
                    ))}
                  </div>
                  <Link
                    className="text-link"
                    to={`/station/${station.printer._id}`}
                  >
                    Open station <ArrowRight size={16} />
                  </Link>
                </section>
              ))}
            </div>
            <section className="card">
              <div className="row-between">
                <h2>03 · FIFO quality checks</h2>
                <span className="count-label">
                  {data.qualityCheck.waiting.length} waiting
                </span>
              </div>
              <div className="queue-strip">
                {data.qualityCheck.waiting.map((job) => (
                  <JobChip key={job._id} job={job} />
                ))}
              </div>
              {data.qualityCheck.active ? (
                <QualityControls
                  key={data.qualityCheck.active._id}
                  active={data.qualityCheck.active}
                  reload={reload}
                />
              ) : (
                <ActionButton
                  disabled={!data.qualityCheck.waiting.length}
                  onClick={async () => {
                    await api("/queue/qc/start", { method: "POST" });
                    reload();
                  }}
                >
                  Start next quality check
                </ActionButton>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
export function PrintersPage() {
  const resource = useResource("/printers");
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/printers", {
        method: "POST",
        body: {
          name: fields.get("name"),
          capacity: Number(fields.get("capacity")),
          color: fields.has("color"),
          duplex: fields.has("duplex"),
          paperSizes: fields.getAll("paperSizes"),
        },
      });
      form.reset();
      resource.reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading eyebrow="The print desk" title="Printer stations">
        Configure capabilities, bring stations online, and manage their work.
      </Heading>
      <ErrorNotice>{resource.error || error}</ErrorNotice>
      {resource.loading ? (
        <Loading />
      ) : (
        <div className="grid two">
          {resource.data?.map((printer) => (
            <article className="card" key={printer._id}>
              <div className="row-between">
                <Printer size={26} />
                <Badge status={printer.status} />
              </div>
              <h2>{printer.name}</h2>
              <p className="muted">
                {printer.color ? "Color & monochrome" : "Monochrome"} ·{" "}
                {printer.duplex ? "Duplex" : "Single-sided"}
                <br />
                {printer.paperSizes.join(", ")} · {printer.capacity} waiting
                slots
              </p>
              <div className="button-row">
                {["online", "offline", "error"]
                  .filter((status) => status !== printer.status)
                  .map((status) => (
                    <ActionButton
                      key={status}
                      className="button secondary small"
                      onClick={async () => {
                        await api(`/printers/${printer._id}/status`, {
                          method: "PATCH",
                          body: { status },
                        });
                        resource.reload();
                      }}
                    >
                      Set {status}
                    </ActionButton>
                  ))}
              </div>
              <Link className="text-link spaced" to={`/station/${printer._id}`}>
                Open station <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      )}
      {!resource.loading && !resource.data?.length && (
        <Empty title="No printers configured">
          Add a station with the capabilities available at your print desk.
        </Empty>
      )}
      {user.role === "admin" && (
        <form className="card form-stack section" onSubmit={create}>
          <h2>Add a printer</h2>
          <div className="form-grid">
            <Field label="Station name">
              <input
                name="name"
                required
                minLength={2}
                maxLength={60}
                placeholder="Printer 01"
              />
            </Field>
            <Field label="Waiting buffer capacity">
              <input
                name="capacity"
                type="number"
                required
                min="1"
                max="20"
                defaultValue="5"
              />
            </Field>
          </div>
          <div className="checkbox-row">
            <label>
              <input type="checkbox" name="color" />
              Color printing
            </label>
            <label>
              <input type="checkbox" name="duplex" />
              Double-sided printing
            </label>
          </div>
          <fieldset className="checkbox-row">
            <legend>Supported paper sizes</legend>
            {["A4", "A3", "Letter"].map((size) => (
              <label key={size}>
                <input
                  type="checkbox"
                  name="paperSizes"
                  value={size}
                  defaultChecked={size === "A4"}
                />
                {size}
              </label>
            ))}
          </fieldset>
          <button className="button" disabled={busy}>
            {busy ? "Adding…" : "Add station"}
          </button>
          <small className="muted">
            New stations start offline. Bring them online when the print desk is
            ready.
          </small>
        </form>
      )}
    </>
  );
}
function ActivePrint({ job, reload }) {
  const [progress, setProgress] = useState(job.progress);
  const [reason, setReason] = useState("");
  return (
    <section className="card">
      <div className="row-between">
        <h2>Printing {job.label}</h2>
        <Badge status={job.status} />
      </div>
      <p>
        {job.config.copies} copies · {job.config.paperSize} ·{" "}
        {job.config.color ? "Color" : "Monochrome"} ·{" "}
        {job.config.duplex ? "Duplex" : "Single-sided"} · Binding:{" "}
        {job.config.binding}
      </p>
      <p>
        Pages: {job.config.pageRange || "All"} · {job.sheets} sheets
      </p>
      <a
        className="button secondary small"
        href={`/api/files/${job.document}/download`}
      >
        Download document
      </a>
      <div className="section">
        <progress value={job.progress} max="100" />
        <p>Reported progress: {job.progress}%</p>
        <div className="inline-form">
          <Field label="Update progress (%)">
            <input
              type="number"
              min={job.progress}
              max="99"
              value={progress}
              onChange={(event) => setProgress(Number(event.target.value))}
            />
          </Field>
          <ActionButton
            className="button secondary"
            onClick={async () => {
              await api(`/jobs/${job._id}/progress`, {
                method: "PATCH",
                body: { progress },
              });
              reload();
            }}
          >
            Save progress
          </ActionButton>
        </div>
      </div>
      <ActionButton
        onClick={async () => {
          await api(`/jobs/${job._id}/printed`, { method: "POST" });
          reload();
        }}
      >
        Printing finished · send to QC
      </ActionButton>
      <div className="section">
        <Field label="If printing failed, describe the problem">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Paper jam, damaged pages…"
          />
        </Field>
        <ActionButton
          className="button danger"
          onClick={async () => {
            await api(`/jobs/${job._id}/fail`, {
              method: "POST",
              body: { reason },
            });
            reload();
          }}
        >
          Mark print failed
        </ActionButton>
      </div>
    </section>
  );
}
export function StationPage() {
  const { printerId } = useParams();
  const resource = useResource("/queue");
  const station = resource.data?.stations.find(
    (item) => item.printer._id === printerId,
  );
  return (
    <div className="container section">
      <Link className="text-link back-link" to="/admin/printers">
        ← All printers
      </Link>
      <ErrorNotice>{resource.error}</ErrorNotice>
      {resource.loading ? (
        <Loading />
      ) : station ? (
        <>
          <Heading
            eyebrow="Operator station"
            title={station.printer.name}
            action={<Badge status={station.printer.status} />}
          >
            Download the document, print it at your station, and record the
            result here.
          </Heading>
          <div className="detail-layout">
            <div>
              {station.active ? (
                <ActivePrint
                  key={station.active._id}
                  job={station.active}
                  reload={resource.reload}
                />
              ) : (
                <div className="card">
                  <h2>Ready for the next job</h2>
                  <p className="muted">
                    Starting a job deducts its paper requirement from inventory.
                    Only one job can print at this station at a time.
                  </p>
                  <ActionButton
                    disabled={
                      station.printer.status !== "online" ||
                      !station.buffer.size
                    }
                    onClick={async () => {
                      await api(`/printers/${printerId}/start`, {
                        method: "POST",
                      });
                      resource.reload();
                    }}
                  >
                    Start next buffered job
                  </ActionButton>
                  {station.printer.status !== "online" && (
                    <p className="muted">
                      Set this printer online in the Printers page first.
                    </p>
                  )}
                </div>
              )}
            </div>
            <aside className="card">
              <h2>Circular buffer</h2>
              <p className="muted">
                {station.buffer.size} / {station.buffer.capacity} waiting
                <br />
                Front: {station.buffer.front} · Rear: {station.buffer.rear}
              </p>
              <div className="buffer-list">
                {station.buffer.items.map((job, index) => (
                  <div key={job._id}>
                    <span className="count-label">
                      {index === 0 ? "Next" : index + 1}
                    </span>
                    <JobChip job={job} />
                  </div>
                ))}
              </div>
              {!station.buffer.size && (
                <p className="muted">No jobs waiting.</p>
              )}
            </aside>
          </div>
        </>
      ) : (
        !resource.error && (
          <Empty title="Station not found">
            Choose an existing station from the printer list.
          </Empty>
        )
      )}
    </div>
  );
}
export function JobsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const resource = useResource(
    `/jobs?page=${page}${status ? `&status=${status}` : ""}`,
  );
  return (
    <>
      <Heading
        eyebrow="Every job, every stage"
        title="Print jobs"
        action={
          <Field label="Filter by status">
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {[
                "QUEUED",
                "ASSIGNED",
                "PRINTING",
                "PRINTED",
                "QUALITY_CHECK",
                "COMPLETED",
                "FAILED",
                "CANCELLED",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
        }
      />
      <ErrorNotice>{resource.error}</ErrorNotice>
      {resource.loading ? (
        <Loading />
      ) : resource.data?.length ? (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request / job</th>
                <th>Priority</th>
                <th>Deadline</th>
                <th>State</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {resource.data.map((job) => (
                <tr key={job._id}>
                  <td>
                    <Link className="text-link" to={`/requests/${job.order}`}>
                      {job.label}
                    </Link>
                    <small>
                      {job._id.slice(-8)}
                      {job.reprintOf ? " · Reprint" : ""}
                    </small>
                  </td>
                  <td>{job.priorityScore}</td>
                  <td>{date(job.deadline)}</td>
                  <td>
                    <Badge status={job.status} />
                    {job.failureReason && <small>{job.failureReason}</small>}
                  </td>
                  <td>
                    {job.status === "FAILED" ? (
                      job.reprintJob ? (
                        <span className="muted">Reprint created</span>
                      ) : (
                        <ActionButton
                          className="button secondary small"
                          onClick={async () => {
                            await api(`/jobs/${job._id}/reprint`, {
                              method: "POST",
                            });
                            resource.reload();
                          }}
                        >
                          Create reprint
                        </ActionButton>
                      )
                    ) : (
                      job.printer && (
                        <Link
                          className="text-link"
                          to={`/station/${job.printer}`}
                        >
                          Station →
                        </Link>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No matching jobs">
          Print jobs will appear here after a request is submitted.
        </Empty>
      )}
      <Pagination
        pagination={resource.pagination}
        page={page}
        setPage={setPage}
      />
    </>
  );
}
