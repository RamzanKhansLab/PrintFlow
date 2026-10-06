import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
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
import { api, date } from "../services/api";
import { useRealtime } from "../store/RealtimeContext";
import { useAuth } from "../store/AuthContext";

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const resource = useResource(`/orders?page=${page}`);
  return (
    <div className="container section">
      <Heading
        eyebrow="Your print history"
        title={user.role === "customer" ? "My requests" : "All print requests"}
        action={
          <Link className="button" to="/print">
            New print <ArrowRight size={17} />
          </Link>
        }
      >
        Every document, from first upload to final check.
      </Heading>
      <ErrorNotice>{resource.error}</ErrorNotice>
      {resource.loading ? (
        <Loading />
      ) : resource.data?.length ? (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Document</th>
                <th>Submitted</th>
                <th>Sheets</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {resource.data.map((order) => (
                <tr key={order._id}>
                  <td>
                    <Link className="text-link" to={`/requests/${order._id}`}>
                      {order.reference}
                    </Link>
                  </td>
                  <td>{order.document?.name || "Document"}</td>
                  <td>{date(order.createdAt)}</td>
                  <td>{order.printSummary?.sheets ?? "—"}</td>
                  <td>
                    <Badge status={order.status} />
                  </td>
                  <td>
                    <Link
                      to={`/requests/${order._id}`}
                      aria-label={`View ${order.reference}`}
                    >
                      <ArrowRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !resource.error && (
          <Empty title="Your next print starts here">
            Upload a document to submit your first request.
          </Empty>
        )
      )}
      <Pagination
        pagination={resource.pagination}
        page={page}
        setPage={setPage}
      />
    </div>
  );
}
function OrderDetail({ data, reload }) {
  const { order, jobs } = data;
  const { status } = useRealtime();
  const config = order.config;
  return (
    <>
      <Heading
        eyebrow="Request details"
        title={order.reference}
        action={<Badge status={order.status} />}
      >
        {order.document?.name} · Submitted {date(order.createdAt)}
      </Heading>
      <div className="detail-layout">
        <section className="form-stack">
          <div className="card">
            <h2>In the print flow</h2>
            <p className="muted">
              {status === "connected"
                ? "Updates appear here as your print desk works on the request."
                : "Live updates are offline. Refresh to check the latest status."}
            </p>
            <div className="timeline">
              {jobs.map((job, index) => (
                <article key={job._id}>
                  <span className="timeline-dot" />
                  <div className="row-between">
                    <h3>
                      {index === 0 ? "Original print" : `Reprint ${index}`}
                    </h3>
                    <Badge status={job.status} />
                  </div>
                  <p className="muted">
                    Priority {job.priorityScore} · {job.config.urgency} ·{" "}
                    {job.sheets} sheets
                  </p>
                  {job.status === "PRINTING" && (
                    <>
                      <progress value={job.progress} max={100} />
                      <small>Operator-reported progress: {job.progress}%</small>
                    </>
                  )}
                  <div className="event-times">
                    {[
                      ["Queued", job.createdAt],
                      ["Assigned", job.assignedAt],
                      ["Printing started", job.startedAt],
                      ["Printed", job.printedAt],
                      ["QC started", job.qcStartedAt],
                      ["Completed", job.completedAt],
                    ]
                      .filter(([, value]) => value)
                      .map(([label, value]) => (
                        <span key={label}>
                          {label}
                          <strong>{date(value)}</strong>
                        </span>
                      ))}
                  </div>
                  {job.failureReason && (
                    <ErrorNotice>{job.failureReason}</ErrorNotice>
                  )}
                  {job.qcNotes && <p>Quality check: {job.qcNotes}</p>}
                </article>
              ))}
            </div>
            <button className="button secondary small" onClick={reload}>
              Refresh status
            </button>
          </div>
        </section>
        <aside className="card">
          <h2>Print details</h2>
          <dl className="detail-list">
            <dt>Color</dt>
            <dd>{config.color ? "Full color" : "Monochrome"}</dd>
            <dt>Paper</dt>
            <dd>{config.paperSize}</dd>
            <dt>Sides</dt>
            <dd>{config.duplex ? "Double-sided" : "Single-sided"}</dd>
            <dt>Copies</dt>
            <dd>{config.copies}</dd>
            <dt>Pages</dt>
            <dd>{config.pageRange || "All pages"}</dd>
            <dt>Binding</dt>
            <dd>{config.binding}</dd>
            <dt>Deadline</dt>
            <dd>{date(order.deadline)}</dd>
            <dt>Required sheets</dt>
            <dd>
              <strong>
                {order.printSummary?.sheets ?? jobs[0]?.sheets ?? "—"}
              </strong>
            </dd>
          </dl>
          {order.document?._id && (
            <a
              className="button secondary full"
              href={`/api/files/${order.document._id}/download`}
            >
              Download document
            </a>
          )}
          {order.status === "QUEUED" && (
            <ActionButton
              className="button danger full"
              onClick={async () => {
                await api(`/orders/${order._id}/cancel`, { method: "POST" });
                reload();
              }}
            >
              Cancel unstarted request
            </ActionButton>
          )}
          <p className="muted small-text">
            Ready means quality checked and available for collection at the
            print desk.
          </p>
        </aside>
      </div>
    </>
  );
}
export function OrderPage() {
  const { id } = useParams();
  const resource = useResource(`/orders/${id}`);
  return (
    <div className="container section">
      <Link className="text-link back-link" to="/requests">
        ← Back to requests
      </Link>
      <ErrorNotice>{resource.error}</ErrorNotice>
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <OrderDetail data={resource.data} reload={resource.reload} />
        )
      )}
    </div>
  );
}
export function TrackPage() {
  const [reference, setReference] = useState("");
  const [query, setQuery] = useState("");
  const resource = useResource(
    query ? `/orders/track/${encodeURIComponent(query)}` : null,
  );
  return (
    <div className="container section">
      <Heading eyebrow="Stay in the loop" title="Where’s your print?">
        Enter the request reference from your account to see its latest status.
      </Heading>
      <form
        className="track-form card"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(reference.trim().toUpperCase());
          resource.reload();
        }}
      >
        <Field label="Request reference">
          <input
            placeholder="PF-1234ABCD"
            value={reference}
            required
            pattern="[Pp][Ff]-[A-Fa-f0-9]{8}"
            maxLength={11}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>
        <button className="button">
          <Search size={17} />
          Track request
        </button>
      </form>
      <ErrorNotice>{resource.error}</ErrorNotice>
      {query && resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <OrderDetail data={resource.data} reload={resource.reload} />
        )
      )}
    </div>
  );
}
