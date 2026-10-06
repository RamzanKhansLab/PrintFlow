import { AlertCircle, ArrowRight, LoaderCircle, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-icon">
        <Printer size={23} />
      </span>
      PrintFlow<span className="brand-dot">.</span>
    </Link>
  );
}
export function Heading({ eyebrow, title, children, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {children && <p className="muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function ErrorNotice({ children }) {
  return children ? (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <span>{children}</span>
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading PrintFlow…
    </div>
  );
}
export function Empty({ title = "Nothing here yet", children }) {
  return (
    <div className="empty">
      <Printer size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Badge({ status }) {
  return (
    <span className={`badge status-${String(status).toLowerCase()}`}>
      {status === "customer" ? "member" : String(status).replaceAll("_", " ")}
    </span>
  );
}
export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ActionButton({
  onClick,
  children,
  className = "button",
  disabled = false,
  ...props
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="action-wrap">
      <button
        {...props}
        className={className}
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onClick();
          } catch (failure) {
            setError(failure.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <LoaderCircle size={15} className="spin" />}
        {children}
      </button>
      {error && (
        <span className="inline-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
export function Pagination({ pagination, page, setPage }) {
  if (!pagination || pagination.pages < 2) return null;
  return (
    <div className="pagination">
      <button
        className="button secondary small"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {pagination.pages}
      </span>
      <button
        className="button secondary small"
        disabled={page >= pagination.pages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
export function TextLink({ to, children }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}
