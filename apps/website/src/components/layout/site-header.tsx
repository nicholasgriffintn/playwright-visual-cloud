import { Logo } from "../brand/logo";
import { routeHref } from "../../lib/router";
import type { User } from "../../lib/types";
import { Link } from "react-router-dom";

type SiteHeaderProps = {
  user: User | null;
  onLogout: () => Promise<void>;
  marketing?: boolean;
};

export function SiteHeader({ user, onLogout, marketing = false }: SiteHeaderProps) {
  return (
    <header className={`site-header ${marketing ? "site-header-marketing" : ""}`}>
      <Link to={routeHref({ kind: "marketing" })}>
        <Logo />
      </Link>
      {marketing ? (
        <nav className="marketing-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#open-source">Open source</a>
        </nav>
      ) : (
        <span className="environment-pill">visual review</span>
      )}
      <div className="header-actions">
        {user ? (
          <>
            <Link className="button button-small button-ink" to={routeHref({ kind: "app" })}>
              Open app
            </Link>
            {!marketing ? (
              <button
                className="avatar-button"
                onClick={() => void onLogout()}
                title="Sign out"
                type="button"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" />
                ) : (
                  user.name.slice(0, 1).toUpperCase()
                )}
              </button>
            ) : null}
          </>
        ) : (
          <Link className="button button-small button-ink" to={routeHref({ kind: "app" })}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
