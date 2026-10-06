import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, FileText, Upload, Layers, Check } from "lucide-react";
import { ErrorNotice, Field, Heading } from "../components/ui";
import { useResource } from "../hooks/useResource";
import { api } from "../services/api";

const initialConfig = {
  copies: 1,
  color: false,
  duplex: false,
  paperSize: "A4",
  pageRange: "",
  binding: "none",
  urgency: "standard",
};
export function PrintPage() {
  const navigate = useNavigate();
  const library = useResource("/files?limit=100", false);
  const [document, setDocument] = useState(null);
  const [config, setConfig] = useState(initialConfig);
  const [deadline, setDeadline] = useState("");
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const requestId = useRef(crypto.randomUUID());
  const update = (name, value) => {
    setSummary(null);
    setConfig((current) => ({ ...current, [name]: value }));
  };
  useEffect(() => {
    setSummary(null);
    setPreviewError("");
    if (!document) {
      setAnalyzing(false);
      return;
    }
    const controller = new AbortController();
    setAnalyzing(true);
    const timer = setTimeout(() => {
      api("/print/preview", {
        method: "POST",
        body: { documentId: document._id, config },
        signal: controller.signal,
      })
        .then((result) => {
          if (!controller.signal.aborted) setSummary(result.data);
        })
        .catch((failure) => {
          if (failure.name !== "AbortError") setPreviewError(failure.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setAnalyzing(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [document, config, previewRevision]);
  async function upload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const input = event.target;
    setBusy(true);
    setError("");
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose a file of 10 MB or smaller");
      const body = new FormData();
      body.append("file", file);
      const uploaded = (await api("/files", { method: "POST", body })).data;
      setSummary(null);
      setDocument(uploaded);
      library.reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
      input.value = "";
    }
  }
  async function submitRequest() {
    if (!summary || !document) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/orders", {
        method: "POST",
        body: {
          documentId: document._id,
          config,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          clientRequestId: requestId.current,
        },
      });
      navigate(`/requests/${result.data.order._id}`);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container section">
      <Heading eyebrow="SUBMIT / NEW REQUEST" title="Put it in the queue.">
        Upload a document, set the instructions, and send it to your print desk.
      </Heading>
      <ErrorNotice>{error || library.error}</ErrorNotice>
      <div className="print-layout">
        <div className="form-stack">
          <section className="card">
            <h2 className="step-heading">
              <span>01</span>Pick your document <FileText size={21} />
            </h2>
            <label className={`upload-zone ${busy ? "disabled" : ""}`}>
              <span className="upload-icon">
                <Upload size={28} />
              </span>
              <strong>{busy ? "Working…" : "Choose a file to print"}</strong>
              <span>PDF / PNG / JPEG · MAX 10 MB</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                disabled={busy}
                onChange={upload}
              />
            </label>
            {library.data?.length > 0 && (
              <Field label="Or select a recent upload">
                <select
                  value={document?._id || ""}
                  disabled={busy}
                  onChange={(event) => {
                    setSummary(null);
                    setDocument(
                      library.data.find(
                        (file) => file._id === event.target.value,
                      ) || null,
                    );
                  }}
                >
                  <option value="">Select a document</option>
                  {library.data.map((file) => (
                    <option key={file._id} value={file._id}>
                      {file.name} · {file.pages} pages
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {document && (
              <div className="file-summary">
                <FileText size={25} />
                <div>
                  <strong>{document.name}</strong>
                  <small>
                    {document.pages} pages ·{" "}
                    {(document.bytes / 1024).toFixed(0)} KB
                  </small>
                </div>
                <a
                  href={`/api/files/${document._id}/download`}
                  className="text-link"
                >
                  Download ↗
                </a>
              </div>
            )}
          </section>
          <section className="card">
            <h2 className="step-heading">
              <span>02</span>Print instructions <Layers size={21} />
            </h2>
            <fieldset disabled={busy} className="form-grid">
              <Field label="Color mode">
                <select
                  value={String(config.color)}
                  onChange={(event) =>
                    update("color", event.target.value === "true")
                  }
                >
                  <option value="false">Monochrome</option>
                  <option value="true">Full color</option>
                </select>
              </Field>
              <Field label="Paper size">
                <select
                  value={config.paperSize}
                  onChange={(event) => update("paperSize", event.target.value)}
                >
                  {["A4", "A3", "Letter"].map((size) => (
                    <option key={size}>{size}</option>
                  ))}
                </select>
              </Field>
              <Field label="Print sides">
                <select
                  value={String(config.duplex)}
                  onChange={(event) =>
                    update("duplex", event.target.value === "true")
                  }
                >
                  <option value="false">Single-sided</option>
                  <option value="true">Double-sided</option>
                </select>
              </Field>
              <Field label="Number of copies">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={config.copies}
                  onChange={(event) =>
                    update("copies", Number(event.target.value))
                  }
                />
              </Field>
              <Field
                label="Page selection"
                hint="Empty = all pages. For a selection, use 1-3,5."
              >
                <input
                  value={config.pageRange}
                  maxLength={500}
                  placeholder="All pages"
                  onChange={(event) => update("pageRange", event.target.value)}
                />
              </Field>
              <Field label="Finishing">
                <select
                  value={config.binding}
                  onChange={(event) => update("binding", event.target.value)}
                >
                  <option value="none">No binding</option>
                  <option value="staple">Stapled</option>
                  <option value="spiral">Spiral bound</option>
                </select>
              </Field>
            </fieldset>
          </section>
          <section className="card">
            <h2 className="step-heading">
              <span>03</span>Schedule it <Check size={21} />
            </h2>
            <fieldset disabled={busy} className="form-grid">
              <Field label="Scheduling priority">
                <select
                  value={config.urgency}
                  onChange={(event) => update("urgency", event.target.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="rush">High priority</option>
                </select>
              </Field>
              <Field label="Requested deadline (optional)">
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </Field>
            </fieldset>
            <p className="muted small-text">
              Priority helps the scheduler route your request. A deadline is a
              request, not a guaranteed completion time.
            </p>
          </section>
        </div>
        <aside className="request-summary card">
          <div className="window-bar">
            <span>PRINT TICKET / PREVIEW</span>
            <span aria-hidden="true">↗</span>
          </div>
          <div className="ticket-body">
            <span className="eyebrow">READY WHEN YOU ARE</span>
            <h2>Your print ticket.</h2>
            <ErrorNotice>{previewError}</ErrorNotice>
            {summary ? (
              <>
                <div className="paper-count">
                  <strong>{summary.sheets}</strong>
                  <span>
                    SHEETS
                    <br />
                    REQUIRED
                  </span>
                  <Layers size={27} />
                </div>
                <dl className="detail-list">
                  <dt>Selected pages</dt>
                  <dd>{summary.pages}</dd>
                  <dt>Copies</dt>
                  <dd>{summary.copies}</dd>
                  <dt>Printed sides</dt>
                  <dd>{summary.impressions}</dd>
                  <dt>Paper</dt>
                  <dd>{config.paperSize}</dd>
                  <dt>Color</dt>
                  <dd>{config.color ? "Full color" : "Monochrome"}</dd>
                  <dt>Priority</dt>
                  <dd>{config.urgency === "rush" ? "High" : "Standard"}</dd>
                </dl>
              </>
            ) : (
              <div className="summary-empty">
                <FileText size={34} />
                <p>
                  {analyzing
                    ? "Checking page selection and paper requirements…"
                    : "Choose a document to prepare your ticket."}
                </p>
              </div>
            )}
            <button
              className="button full"
              disabled={!summary || busy || analyzing}
              onClick={submitRequest}
            >
              {busy ? "Submitting…" : "Send to print queue"}
              <ArrowUpRight size={18} />
            </button>
            {previewError && (
              <button
                className="text-button full"
                disabled={!document || busy}
                onClick={() => setPreviewRevision((value) => value + 1)}
              >
                Retry print preview
              </button>
            )}
            <p className="muted small-text">
              Your operator will print the document and record the quality
              check. Track the request from your workspace.
            </p>
            <div className="ticket-barcode" aria-hidden="true" />
          </div>
        </aside>
      </div>
    </div>
  );
}
