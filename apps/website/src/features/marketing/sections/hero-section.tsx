import type { User } from "../../../lib/types";
import { routeHref } from "../../../lib/router";
import { Link } from "react-router-dom";

export function HeroSection({ user }: { user: User | null }) {
  return (
    <section className="hero">
      <div className="hero-copy reveal">
        <p className="eyebrow">
          <span>01</span> Open-source visual testing
        </p>
        <h1>
          See every pixel.
          <br />
          <em>Ship the right ones.</em>
        </h1>
        <p className="hero-lede">
          A visual review workflow built for Playwright. Capture in your tests, compare before
          merge, and keep every screenshot inside your own Cloudflare account.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" to={routeHref({ kind: "app" })}>
            {user ? "Open your workspace" : "Get started"}
          </Link>
          <a className="text-link" href="#how-it-works">
            Explore the workflow <span>↓</span>
          </a>
        </div>
        <p className="hero-note">Apache-2.0 · self-hosted · no per-snapshot pricing</p>
      </div>
      <VisualReviewDemo />
    </section>
  );
}

function VisualReviewDemo() {
  return (
    <div className="hero-demo reveal reveal-delay">
      <div className="demo-topline">
        <span className="demo-status-dot" /> checkout-flow.spec.ts <span>PR #184</span>
      </div>
      <div className="demo-toolbar">
        <strong>Checkout / confirmation</strong>
        <span className="status-chip pending">change</span>
      </div>
      <div className="demo-canvas">
        <div className="demo-browser baseline">
          <span />
          <i />
          <b>ORDER CONFIRMED</b>
          <small>Baseline</small>
        </div>
        <div className="demo-browser actual">
          <span />
          <i />
          <b>ORDER COMPLETE</b>
          <small>Actual</small>
        </div>
        <div className="demo-scanline" />
      </div>
      <div className="demo-footer">
        <span>284 px changed · 0.82%</span>
        <button type="button">Approve change</button>
      </div>
    </div>
  );
}
