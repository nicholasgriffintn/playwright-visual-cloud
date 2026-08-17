const features = [
  [
    "A",
    "Branch-aware baselines",
    "Compare a feature branch against itself, then fall back to main.",
  ],
  ["B", "Team workspaces", "Invite reviewers and keep project ownership explicit."],
  ["C", "CI status gates", "Block merge until every changed or new snapshot is reviewed."],
  ["D", "Private by construction", "Screenshots require a user session or a scoped project token."],
];

export function FeatureSection() {
  return (
    <section className="feature-section" id="features">
      <div className="feature-statement">
        <p className="eyebrow">
          <span>03</span> Built for real teams
        </p>
        <h2>Visual testing is a conversation, not a pile of PNGs.</h2>
        <p>
          Workspaces keep teams and projects separate. Project tokens keep CI least-privileged.
          Branch baselines make pull-request changes legible.
        </p>
      </div>
      <div className="feature-ledger">
        {features.map(([index, title, detail]) => (
          <article className="feature-row" key={index}>
            <span>{index}</span>
            <h3>{title}</h3>
            <p>{detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
