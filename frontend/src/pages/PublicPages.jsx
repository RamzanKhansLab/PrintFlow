import {
  ArrowRight,
  Check,
  FileText,
  Layers,
  Printer,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Heading, ErrorNotice, Loading, TextLink } from "../components/ui";
import { useResource } from "../hooks/useResource";
import { money } from "../services/api";

const steps = [
  [
    Upload,
    "Make it yours",
    "Upload a PDF or image, choose your paper, and set the finishing touches.",
  ],
  [
    Layers,
    "Find your place",
    "Your order enters a priority queue and is routed to a compatible printer.",
  ],
  [
    ShieldCheck,
    "Good to go",
    "The print desk checks the finished pages before marking your order ready.",
  ],
];
export function HomePage() {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <span className="pill">
            <span className="tiny-dot" />A smarter way to print
          </span>
          <h1>
            Big ideas.
            <br />
            Beautiful prints.
            <br />
            <em>Less waiting.</em>
          </h1>
          <p>
            From the first upload to the final quality check, keep your print
            jobs moving with a clear, connected workflow.
          </p>
          <div className="button-row">
            <Link to="/print" className="button">
              Start your print <ArrowRight size={18} />
            </Link>
            <Link to="/track" className="button secondary">
              Track an order
            </Link>
          </div>
          <div className="hero-checks">
            <span>
              <Check size={16} />
              Clear pricing
            </span>
            <span>
              <Check size={16} />
              Live order updates
            </span>
          </div>
        </div>
        <div className="hero-art" aria-label="PrintFlow workflow illustration">
          <div className="art-orbit" />
          <div className="paper-card">
            <span className="paper-logo">
              <Printer size={23} /> PrintFlow
            </span>
            <div className="paper-title">
              From idea
              <br />
              to paper.
            </div>
            <div className="paper-lines">
              <i />
              <i />
              <i />
            </div>
            <div className="paper-bottom">
              YOUR NEXT CHAPTER <span>↗</span>
            </div>
          </div>
          <div className="floating-card art-upload">
            <span className="round-icon">
              <FileText size={22} />
            </span>
            <div>
              <strong>Your document</strong>
              <small>It all starts here</small>
            </div>
          </div>
          <div className="floating-card art-quality">
            <span className="round-icon green">
              <ShieldCheck size={22} />
            </span>
            <div>
              <strong>Care in every page</strong>
              <small>Quality checks built in</small>
            </div>
          </div>
          <span className="art-note">
            A little order.
            <br />A lot of possibility.
          </span>
        </div>
      </section>
      <div className="feature-strip">
        <span>PDF & image uploads</span>
        <span>Priority scheduling</span>
        <span>Multi-printer routing</span>
        <span>Quality checked</span>
      </div>
      <section className="container section">
        <Heading
          eyebrow="The PrintFlow way"
          title="Three steps. One smooth flow."
        >
          A print desk that keeps everyone on the same page.
        </Heading>
        <div className="grid three">
          {steps.map(([Icon, title, description], index) => (
            <article className="card feature-card" key={title}>
              <div className="step-top">
                <Icon size={25} />
                <span>0{index + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="container">
        <div className="academic-banner">
          <div>
            <span className="eyebrow">Built around real data structures</span>
            <h2>Good printing has a great queue behind it.</h2>
            <p>
              A binary heap, circular printer buffers, and a linked FIFO work
              together to keep jobs moving.
            </p>
          </div>
          <TextLink to="/admin/dsa">Explore the DSA lab</TextLink>
        </div>
      </section>
    </>
  );
}
export function ServicesPage() {
  return (
    <div className="container section">
      <Heading eyebrow="Print services" title="For whatever’s next.">
        Notes, submissions, presentations, and everything in between.
      </Heading>
      <div className="grid three">
        {[
          [
            "Documents & images",
            "Upload PDFs up to 2,000 pages or a single PNG/JPEG image. Maximum file size: 10 MB.",
          ],
          [
            "Your print preferences",
            "Choose monochrome or color, A4, A3 or Letter, single or double-sided pages, and copies.",
          ],
          [
            "Finishing touches",
            "Select no binding, stapling, or spiral binding. Your choice is saved for the print operator.",
          ],
          [
            "Standard & rush",
            "Rush requests receive a higher priority score. Deadlines break ties, followed by arrival time.",
          ],
          [
            "Track every stage",
            "Follow your order from queued to printing, quality check, and ready for pickup.",
          ],
          [
            "A human quality check",
            "An operator checks each completed print. A failed job can be reprinted through the same queue.",
          ],
        ].map(([title, description]) => (
          <article className="card feature-card" key={title}>
            <Printer size={24} />
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
      <div className="center section">
        <Link className="button" to="/print">
          Configure your print <ArrowRight size={17} />
        </Link>
        <p className="muted">
          Availability depends on the printers and paper configured by your
          print desk.
        </p>
      </div>
    </div>
  );
}
export function PricingPage() {
  const { data: rules, loading, error } = useResource("/pricing");
  return (
    <div className="container section">
      <Heading eyebrow="Clear from page one" title="Your choices. Your quote.">
        Prices come directly from the print desk’s current pricing rules.
      </Heading>
      <ErrorNotice>{error}</ErrorNotice>
      {loading ? (
        <Loading />
      ) : (
        rules && (
          <>
            <div className="grid three">
              <article className="card price-card">
                <span className="eyebrow">Monochrome · A4</span>
                <h2>
                  {money(rules.basePage * 100)}
                  <small>/ page</small>
                </h2>
                <p>Base price, before binding, rush service and tax.</p>
                <TextLink to="/print">Get your exact quote</TextLink>
              </article>
              <article className="card price-card">
                <span className="eyebrow">Color · A4</span>
                <h2>
                  {money(rules.basePage * rules.colorMultiplier * 100)}
                  <small>/ page</small>
                </h2>
                <p>
                  Color multiplier: {rules.colorMultiplier}× the base page
                  price.
                </p>
                <TextLink to="/print">Choose color printing</TextLink>
              </article>
              <article className="card price-card tinted">
                <span className="eyebrow">Finishing · per copy</span>
                <div className="price-line">
                  <span>Stapling</span>
                  <strong>{money(rules.binding.staple * 100)}</strong>
                </div>
                <div className="price-line">
                  <span>Spiral binding</span>
                  <strong>{money(rules.binding.spiral * 100)}</strong>
                </div>
                <div className="price-line">
                  <span>No binding</span>
                  <strong>{money(0)}</strong>
                </div>
              </article>
            </div>
            <div className="card section">
              <h3>How your total is calculated</h3>
              <p>
                Page rate × selected pages × copies × color, paper and duplex
                multipliers, plus binding per copy. Rush service applies to that
                subtotal, followed by tax.
              </p>
              <div className="detail-grid">
                <span>A4: {rules.paperMultipliers.A4}×</span>
                <span>A3: {rules.paperMultipliers.A3}×</span>
                <span>Letter: {rules.paperMultipliers.Letter}×</span>
                <span>Duplex: {rules.duplexMultiplier}×</span>
                <span>Rush: {rules.rushMultiplier}×</span>
                <span>Tax: {rules.taxPercent}%</span>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
export function NotFoundPage() {
  return (
    <div className="container section center">
      <span className="eyebrow">404 · A missing page</span>
      <h1>This page isn’t in the queue.</h1>
      <Link to="/" className="button">
        Back to PrintFlow
      </Link>
    </div>
  );
}
