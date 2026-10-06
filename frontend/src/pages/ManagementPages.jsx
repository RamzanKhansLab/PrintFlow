import { useState } from "react";
import {
  ActionButton,
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

export function InventoryPage() {
  const resource = useResource("/inventory");
  const [paperSize, setPaperSize] = useState("A4");
  const [sheets, setSheets] = useState(500);
  const [message, setMessage] = useState("");
  return (
    <>
      <Heading eyebrow="Keep the desk stocked" title="Paper inventory">
        Paper is deducted atomically when an operator starts a print job.
      </Heading>
      <ErrorNotice>{resource.error}</ErrorNotice>
      {resource.loading ? (
        <Loading />
      ) : (
        <div className="grid three">
          {["A4", "A3", "Letter"].map((size) => (
            <div className="card stat" key={size}>
              <span>{size}</span>
              <strong>
                {(
                  resource.data?.find((item) => item.paperSize === size)
                    ?.sheets || 0
                ).toLocaleString()}
              </strong>
              <small>sheets on hand</small>
            </div>
          ))}
        </div>
      )}
      <section className="card section">
        <h2>Add paper stock</h2>
        <div className="form-grid">
          <Field label="Paper size">
            <select
              value={paperSize}
              onChange={(event) => setPaperSize(event.target.value)}
            >
              {["A4", "A3", "Letter"].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </Field>
          <Field label="Sheets to add">
            <input
              type="number"
              min="1"
              max="1000000"
              value={sheets}
              onChange={(event) => setSheets(Number(event.target.value))}
            />
          </Field>
        </div>
        <ActionButton
          onClick={async () => {
            setMessage("");
            await api("/inventory/restock", {
              method: "POST",
              body: { paperSize, sheets },
            });
            setMessage(`Added ${sheets} ${paperSize} sheets.`);
            resource.reload();
          }}
        >
          Add stock
        </ActionButton>
        {message && (
          <p role="status" className="success-text">
            {message}
          </p>
        )}
        <p className="muted small-text">
          Failed prints keep their paper deduction because the sheets may have
          been used. Reprints consume new stock.
        </p>
      </section>
    </>
  );
}
export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resource = useResource(`/users?page=${page}`);
  async function changeRole(user, role) {
    setBusy(true);
    setError("");
    try {
      await api(`/users/${user._id}/role`, { method: "PATCH", body: { role } });
      resource.reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading eyebrow="People at the print desk" title="Accounts & access">
        Members submit print requests. Operators run the stations.
        Administrators manage access.
      </Heading>
      <ErrorNotice>{error || resource.error}</ErrorNotice>
      {resource.loading ? (
        <Loading />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {resource.data?.map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{date(user.createdAt)}</td>
                  <td>
                    <select
                      aria-label={`Role for ${user.name}`}
                      value={user.role}
                      disabled={busy || user._id === currentUser._id}
                      onChange={(event) => changeRole(user, event.target.value)}
                    >
                      {["customer", "operator", "admin"].map((role) => (
                        <option key={role} value={role}>
                          {role === "customer" ? "member" : role}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        pagination={resource.pagination}
        page={page}
        setPage={setPage}
      />
    </>
  );
}
export function AuditPage() {
  const [page, setPage] = useState(1);
  const resource = useResource(`/audit?page=${page}`);
  return (
    <>
      <Heading
        eyebrow="Recorded operations"
        title="Activity log"
        action={
          <button className="button secondary" onClick={resource.reload}>
            Refresh
          </button>
        }
      >
        Workflow, inventory, and role changes recorded by the backend.
      </Heading>
      <ErrorNotice>{resource.error}</ErrorNotice>
      {resource.loading ? (
        <Loading />
      ) : resource.data?.length ? (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {resource.data.map((entry) => (
                <tr key={entry._id}>
                  <td>{date(entry.createdAt)}</td>
                  <td>{entry.actor?.name || "System"}</td>
                  <td>
                    <code>{entry.action}</code>
                  </td>
                  <td>
                    <code>{entry.entity || "—"}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No recorded operations yet">
          Print desk activity will appear here.
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
