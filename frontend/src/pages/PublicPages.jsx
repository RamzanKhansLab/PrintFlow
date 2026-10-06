import {
  ArrowRight,
  ArrowUpRight,
  FilePlus2,
  Printer,
  Layers,
  ScanLine,
  BookOpen,
  FileText,
  CheckCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, ErrorNotice, Loading, Heading } from "../components/ui";
import { useAuth } from "../store/AuthContext";
import { useResource } from "../hooks/useResource";
import { date } from "../services/api";

function PrintIllustration() {
  return (
    <div
      className="print-illustration"
      role="img"
      aria-label="Illustration of a shared print workstation"
    >
      <div className="art-grid" />
      <span className="art-spark spark-one" aria-hidden="true">
        ✳
      </span>
      <span className="art-spark spark-two" aria-hidden="true">
        ✦
      </span>
      <div className="chrome-orbit" aria-hidden="true" />
      <div className="printer-object">
        <div className="printer-paper">
          <span>PRINTFLOW</span>
          <div className="paper-symbol" />
          <i />
          <i />
          <i />
        </div>
        <div className="printer-body">
          <div className="printer-controls">
            <span />
            <span />
            <i />
          </div>
          <div className="printer-slot" />
          <div className="paper-output">
            <div className="output-check">
              <CheckCheck size={28} />
            </div>
            <span>
              MAKE IT
              <br />
              <strong>HAPPEN.</strong>
            </span>
          </div>
        </div>
      </div>
      <div className="art-label">DOCUMENT → QUEUE → PRINT → CHECK</div>
      <div className="art-sticker">
        GOOD
        <br />
        ON PAPER<span>↗</span>
      </div>
      <svg className="art-squiggle" viewBox="0 0 120 60" aria-hidden="true">
        <path d="M5 50Q20 0 35 35T65 30T95 25T115 10" />
      </svg>
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const staff = user && user.role !== "customer";
  const recent = useResource(user ? "/orders?limit=4" : null);
  const queue = useResource(staff ? "/queue" : null);
  const tools = [
    [
      FilePlus2,
      "01",
      "New print request",
      "Upload a document. Set your print instructions.",
      "/print",
      "lilac",
    ],
    [
      Layers,
      "02",
      staff ? "Open the live queue" : "Your print requests",
      staff
        ? "Route jobs, manage buffers, and start quality checks."
        : "Follow your documents from submitted to ready.",
      staff ? "/admin/queue" : "/requests",
      "lime",
    ],
    [
      Printer,
      "03",
      staff ? "Printer stations" : "Print desk guide",
      staff
        ? "See capabilities and open an operator station."
        : "A quick guide to the shared print workflow.",
      staff ? "/admin/printers" : "/guide",
      "peach",
    ],
    [
      ScanLine,
      "04",
      "Track a request",
      "Find the latest stage using your PF reference.",
      "/track",
      "cyan",
    ],
  ];
  return (
    <div className="container launchpad">
      <div className="launch-header">
        <span className="eyebrow">
          {user
            ? `WORKSPACE / ${user.name}`
            : "WELCOME TO YOUR SHARED PRINT DESK"}
        </span>
        <span className="system-tag">V.01 / PRINT UTILITY</span>
      </div>
      <section className="tool-hero">
        <div className="hero-copy">
          <span className="pill">ONE DESK. EVERY DOCUMENT.</span>
          <h1>
            Your print
            <br />
            control <span className="title-mark">room.</span>
          </h1>
          <p>
            For busy shops, college labs, offices, and everywhere paper gets
            things done. Submit it. Queue it. Keep it moving.
          </p>
          <div className="button-row">
            <Link to="/print" className="button">
              <FilePlus2 size={19} />
              New print request
            </Link>
            <Link
              to={staff ? "/admin" : user ? "/requests" : "/login"}
              className="button chrome"
            >
              {staff
                ? "Open control room"
                : user
                  ? "My requests"
                  : "Sign in to workspace"}
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="hero-tags">
            <span>PDF + IMAGES</span>
            <span>SHARED PRINTERS</span>
            <span>LIVE UPDATES</span>
          </div>
        </div>
        <PrintIllustration />
      </section>
      <div className="section-label">
        <h2>Pick your next move.</h2>
        <span>YOUR TOOLKIT ↘</span>
      </div>
      <section className="tool-grid" aria-label="Printing tools">
        {tools.map(([Icon, number, title, description, to, tone]) => (
          <Link to={to} className={`tool-tile ${tone}`} key={number}>
            <div className="tile-top">
              <Icon size={27} />
              <span>
                {number} <ArrowUpRight size={18} />
              </span>
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
          </Link>
        ))}
      </section>
      {staff && queue.data && (
        <section
          className="activity-ribbon"
          aria-label="Current printing activity"
        >
          <span className="ribbon-label">RIGHT NOW /</span>
          <span>
            <strong>{queue.data.pending.length}</strong> queued
          </span>
          <span>
            <strong>
              {queue.data.stations.filter((station) => station.active).length}
            </strong>{" "}
            printing
          </span>
          <span>
            <strong>
              {queue.data.qualityCheck.waiting.length +
                (queue.data.qualityCheck.active ? 1 : 0)}
            </strong>{" "}
            at quality check
          </span>
          <Link to="/admin/queue">
            View queue <ArrowRight size={16} />
          </Link>
        </section>
      )}
      <ErrorNotice>{recent.error || queue.error}</ErrorNotice>
      <div className="home-bottom">
        <section className="card recent-panel">
          <div className="window-bar">
            <span>{user ? "RECENT REQUESTS" : "GETTING STARTED"}</span>
            <span className="window-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
          {user ? (
            <>
              {recent.loading ? (
                <Loading />
              ) : recent.data?.length ? (
                recent.data.map((request) => (
                  <Link
                    className="recent-request"
                    to={`/requests/${request._id}`}
                    key={request._id}
                  >
                    <FileText size={21} />
                    <div>
                      <strong>
                        {request.document?.name || request.reference}
                      </strong>
                      <small>
                        {request.reference} · {date(request.createdAt)}
                      </small>
                    </div>
                    <Badge status={request.status} />
                    <ArrowUpRight size={18} />
                  </Link>
                ))
              ) : (
                !recent.error && (
                  <div className="home-empty">
                    <FilePlus2 size={30} />
                    <h3>A fresh page.</h3>
                    <p>Your submitted requests will appear here.</p>
                    <Link className="text-link" to="/print">
                      Submit your first document <ArrowRight size={16} />
                    </Link>
                  </div>
                )
              )}
            </>
          ) : (
            <div className="getting-started">
              {[
                [
                  "01",
                  "Create your workspace account",
                  "Keep your documents and requests together.",
                ],
                [
                  "02",
                  "Send a document to the desk",
                  "Choose pages, paper, copies, and priority.",
                ],
                [
                  "03",
                  "Follow the print flow",
                  "Your operator prints it and records the quality check.",
                ],
              ].map(([n, title, detail]) => (
                <div key={n}>
                  <span>{n}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{detail}</p>
                  </div>
                </div>
              ))}
              <Link className="text-link" to="/register">
                Create account <ArrowRight size={17} />
              </Link>
            </div>
          )}
        </section>
        <aside className="lab-poster">
          <div className="poster-top">
            <BookOpen size={27} />
            <span>UNDER THE HOOD /</span>
          </div>
          <h2>
            A little
            <br />
            queue
            <br />
            <em>theory.</em>
          </h2>
          <p>
            Real Python data structures. Real print jobs. Explore the heap,
            FIFO, and circular buffers that make this desk work.
          </p>
          <Link className="button chrome" to={staff ? "/admin/dsa" : "/guide"}>
            {staff ? "Open the DSA lab" : "Explore the workflow"}
            <ArrowUpRight size={18} />
          </Link>
          <span className="poster-cross" aria-hidden="true">
            ✳
          </span>
        </aside>
      </div>
    </div>
  );
}

export function GuidePage() {
  return (
    <div className="container section">
      <Heading
        eyebrow="FIELD GUIDE / PRINTFLOW"
        title="One shared desk. A clear workflow."
      >
        A shared print desk for your shop, campus, office, or lab. Keep
        documents, printer stations, and their progress in one workspace.
      </Heading>
      <div className="guide-banner">
        <Printer size={42} />
        <div>
          <h2>Bring the printers. We’ll organize the jobs.</h2>
          <p>
            Members submit documents. Operators run stations and quality checks.
            Administrators manage printers and access.
          </p>
        </div>
        <span aria-hidden="true">✳</span>
      </div>
      <div className="grid three">
        {[
          [
            "01",
            "Submit a document",
            "Use an unencrypted PDF, PNG or JPEG up to 10 MB. PDFs can contain up to 2,000 pages.",
          ],
          [
            "02",
            "Set the instructions",
            "Choose page ranges, copies, color, paper size, sides, and finishing. Preview the required sheets before submitting.",
          ],
          [
            "03",
            "Choose a priority",
            "Standard or high priority, with an optional requested deadline. Availability and existing station buffers affect when work starts.",
          ],
          [
            "04",
            "Route to a station",
            "The Python scheduler assigns compatible jobs to online printers with free waiting slots.",
          ],
          [
            "05",
            "Print and inspect",
            "An operator downloads and prints the document, records progress, then checks the finished output.",
          ],
          [
            "06",
            "Track and collect",
            "Use your request reference to follow every stage. Failed attempts can be reprinted; completed checks mark the output ready.",
          ],
        ].map(([n, title, detail]) => (
          <article className="card feature-card" key={n}>
            <span className="step-number">{n}</span>
            <h3>{title}</h3>
            <p>{detail}</p>
          </article>
        ))}
      </div>
      <div className="callout">
        <h3>Setting up the desk?</h3>
        <p>
          An administrator configures your printer stations, records their
          capabilities, assigns staff access, and adds paper inventory. Physical
          printing is performed by an operator; printer status and progress are
          recorded here.
        </p>
        <Link className="text-link" to="/admin">
          Open the control room <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}
export function NotFoundPage() {
  return (
    <div className="container section center">
      <span className="eyebrow">404 / PAGE NOT FOUND</span>
      <h1>This page left the queue.</h1>
      <Link to="/" className="button">
        Back to launchpad <ArrowRight size={17} />
      </Link>
    </div>
  );
}
