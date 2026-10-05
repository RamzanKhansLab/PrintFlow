import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FileText, Upload } from "lucide-react";
import { ErrorNotice, Field, Heading } from "../components/ui";
import { useResource } from "../hooks/useResource";
import { api, money } from "../services/api";

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
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const requestId = useRef(crypto.randomUUID());
  const update = (name, value) => {
    setQuote(null);
    setConfig((current) => ({ ...current, [name]: value }));
  };
  useEffect(() => {
    setQuote(null);
    setQuoteError("");
    if (!document) {
      setQuoting(false);
      return;
    }
    const controller = new AbortController();
    setQuoting(true);
    const timer = setTimeout(() => {
      api("/pricing/quote", {
        method: "POST",
        body: { documentId: document._id, config },
        signal: controller.signal,
      })
        .then((result) => setQuote(result.data))
        .catch((failure) => {
          if (failure.name !== "AbortError") setQuoteError(failure.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoting(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [document, config, quoteRevision]);
  async function upload(event) {
    const file = event.target.files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose a file of 10 MB or smaller");
      const body = new FormData();
      body.append("file", file);
      setDocument((await api("/files", { method: "POST", body })).data);
      library.reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }
  async function placeOrder() {
    if (!quote || !document) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/orders", {
        method: "POST",
        body: {
          documentId: document._id,
          config,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          expectedTotalPaise: quote.totalPaise,
          clientRequestId: requestId.current,
        },
      });
      navigate(`/orders/${result.data.order._id}`);
    } catch (failure) {
      setError(failure.message);
      if (failure.status === 409) setQuoteRevision((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container section">
      <Heading eyebrow="Let’s put it on paper" title="Start a new print">
        A few choices, a clear quote, and you’re in the queue.
      </Heading>
      <ErrorNotice>{error || library.error}</ErrorNotice>
      <div className="print-layout">
        <div className="form-stack">
          <section className="card">
            <h2 className="step-heading">
              <span>01</span>Your document
            </h2>
            <label className={`upload-zone ${busy ? "disabled" : ""}`}>
              <Upload size={28} />
              <strong>{busy ? "Working…" : "Choose a document"}</strong>
              <span>PDF, PNG or JPEG · up to 10 MB</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                disabled={busy}
                onChange={upload}
              />
            </label>
            {library.data?.length > 0 && (
              <Field label="Or use a recent upload">
                <select
                  value={document?._id || ""}
                  disabled={busy}
                  onChange={(event) => {
                    setQuote(null);
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
                <FileText size={24} />
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
                  Download
                </a>
              </div>
            )}
          </section>
          <section className="card">
            <h2 className="step-heading">
              <span>02</span>Make it yours
            </h2>
            <fieldset disabled={busy} className="form-grid">
              <Field label="Print color">
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
              <Field label="Sides">
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
              <Field label="Copies">
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
                label="Page range"
                hint="Leave empty for all pages. Example: 1-3,5"
              >
                <input
                  value={config.pageRange}
                  maxLength={500}
                  placeholder="All pages"
                  onChange={(event) => update("pageRange", event.target.value)}
                />
              </Field>
              <Field label="Binding">
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
              <span>03</span>Set the pace
            </h2>
            <fieldset disabled={busy} className="form-grid">
              <Field label="Service">
                <select
                  value={config.urgency}
                  onChange={(event) => update("urgency", event.target.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="rush">Rush · priority handling</option>
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
              A requested deadline helps schedule your job; it isn’t a
              guaranteed completion time.
            </p>
          </section>
        </div>
        <aside className="quote-card card">
          <span className="eyebrow">Your print, at a glance</span>
          <h2>Order summary</h2>
          <ErrorNotice>{quoteError}</ErrorNotice>
          {quote ? (
            <>
              <div className="quote-meta">
                {quote.pages} selected pages × {quote.copies} copies
                <br />
                {quote.sheets} sheets · {config.paperSize}
              </div>
              {[
                ["Printing", quote.printPaise],
                ["Binding", quote.bindingPaise],
                ["Rush service", quote.rushPaise],
                ["Tax", quote.taxPaise],
              ].map(([label, value]) => (
                <div className="price-line" key={label}>
                  <span>{label}</span>
                  <strong>{money(value)}</strong>
                </div>
              ))}
              <div className="quote-total">
                <span>Total</span>
                <strong>{money(quote.totalPaise)}</strong>
              </div>
            </>
          ) : (
            <p className="muted">
              {quoting
                ? "Calculating your quote…"
                : "Choose a document to see your live quote."}
            </p>
          )}
          <button
            className="button full"
            disabled={!quote || busy || quoting}
            onClick={placeOrder}
          >
            {busy ? "Please wait…" : "Place order"}
            <ArrowRight size={18} />
          </button>
          <button
            className="text-button full"
            onClick={() => setQuoteRevision((value) => value + 1)}
            disabled={!document || busy}
          >
            Refresh quote
          </button>
          <p className="muted small-text">
            Your quote is saved with the order. Payment is handled separately at
            the print desk.
          </p>
        </aside>
      </div>
    </div>
  );
}
