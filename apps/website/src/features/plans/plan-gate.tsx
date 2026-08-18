import { Logo } from "../../components/brand/logo";
import type { User } from "../../lib/types";
import { Link } from "react-router-dom";

type PlanGateProps = {
  user: User;
  onLogout: () => Promise<void>;
};

export function PlanGate({ user, onLogout }: PlanGateProps) {
  return (
    <main className="plan-gate">
      <header className="plan-gate-header">
        <Link to="/">
          <Logo />
        </Link>
        <button className="text-link" type="button" onClick={() => void onLogout()}>
          Sign out
        </button>
      </header>
      <section className="plan-gate-card">
        <div className="plan-gate-copy">
          <p className="eyebrow">
            <span>Account</span> {user.plan} plan
          </p>
          <h1>Pro access required.</h1>
          <p>Your account does not currently have access to Visual Cloud.</p>
          <Link className="button button-primary" to="/">
            Back to site
          </Link>
        </div>
        <dl className="plan-gate-details">
          <div>
            <dt>Signed in as</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Current plan</dt>
            <dd>{user.plan}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
