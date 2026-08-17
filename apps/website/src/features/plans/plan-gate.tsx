import { Logo } from "../../components/brand/logo";
import type { User } from "../../lib/types";

type PlanGateProps = {
  user: User;
  onLogout: () => Promise<void>;
};

export function PlanGate({ user, onLogout }: PlanGateProps) {
  return (
    <main className="plan-gate">
      <header className="plan-gate-header">
        <a href="/">
          <Logo />
        </a>
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
          <p>
            Billing is not connected yet. This account needs to be assigned the Pro plan before it
            can use Visual Cloud.
          </p>
          <a className="button button-primary" href="/">
            Back to site
          </a>
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
