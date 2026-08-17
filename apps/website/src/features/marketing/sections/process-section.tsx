const steps = [
  {
    number: "01",
    visual: "capture",
    title: "Capture",
    text: "Use the same Page and Locator objects already in your Playwright suite. Mask dynamic regions and set tolerances per assertion.",
    code: 'await expect(page).toMatchVisualSnapshot(\n  "checkout", { fullPage: true }\n);',
  },
  {
    number: "02",
    visual: "compare",
    title: "Compare",
    text: "Pixels are compared in the test process. Only the baseline, actual, and useful diff artifacts move to your cloud.",
  },
  {
    number: "03",
    visual: "review",
    title: "Review",
    text: "Inspect side-by-side, slider, and diff views. Approve one change or promote the whole build as a new baseline.",
  },
];

export function ProcessSection() {
  return (
    <section className="process-section" id="how-it-works">
      <header className="section-heading">
        <p className="eyebrow">
          <span>02</span> The review loop
        </p>
        <h2>From test run to shared confidence.</h2>
      </header>
      <div className="process-grid">
        {steps.map((step) => (
          <article className="process-card" key={step.number}>
            <span>{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <StepVisual kind={step.visual} code={step.code} />
          </article>
        ))}
      </div>
    </section>
  );
}

function StepVisual({ kind, code }: { kind: string; code?: string }) {
  if (kind === "capture") {
    return (
      <pre className="process-visual">
        <code>{code}</code>
      </pre>
    );
  }

  if (kind === "compare") {
    return (
      <div className="process-visual compare-visual" aria-label="Baseline and actual comparison">
        <span>
          <small>Baseline</small>
          <i />
        </span>
        <b>284 px</b>
        <span>
          <small>Actual</small>
          <i />
        </span>
      </div>
    );
  }

  return (
    <div className="process-visual review-visual" aria-label="Approved visual change">
      <span className="status-chip pending">change</span>
      <strong>Checkout / confirmation</strong>
      <span className="review-decision">Approved ✓</span>
    </div>
  );
}
