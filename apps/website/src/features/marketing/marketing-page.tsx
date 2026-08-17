import { Logo } from "../../components/brand/logo";
import { SiteHeader } from "../../components/layout/site-header";
import { routeHref } from "../../lib/router";
import type { User } from "../../lib/types";
import { FeatureSection } from "./sections/feature-section";
import { HeroSection } from "./sections/hero-section";
import { ProcessSection } from "./sections/process-section";
import { WorkflowSection } from "./sections/workflow-section";

export function MarketingPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  return (
    <div className="marketing-page">
      <SiteHeader user={user} onLogout={onLogout} marketing />
      <main>
        <HeroSection user={user} />
        <section className="proof-strip" aria-label="Product benefits">
          <p>
            <strong>Playwright native</strong>
            <span>One matcher. Every browser.</span>
          </p>
          <p>
            <strong>Review-gated</strong>
            <span>Approve intentional change.</span>
          </p>
          <p>
            <strong>Cloudflare scale</strong>
            <span>D1 metadata. R2 images.</span>
          </p>
          <p>
            <strong>Yours to run</strong>
            <span>Open code. Open protocol.</span>
          </p>
        </section>
        <ProcessSection />
        <FeatureSection />
        <WorkflowSection />
        <section className="open-source-section" id="open-source">
          <Logo compact />
          <p className="eyebrow">The honest cloud</p>
          <h2>
            Own the service.
            <br />
            Own the artifacts.
            <br />
            <span>Own the decision.</span>
          </h2>
          <a className="button button-primary" href={routeHref({ kind: "app" })}>
            {user ? "Go to dashboard" : "Get started"}
          </a>
        </section>
      </main>
      <footer className="marketing-footer">
        <Logo />
        <p>Open-source visual review for Playwright.</p>
        <span>Apache-2.0</span>
      </footer>
    </div>
  );
}
