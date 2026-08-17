import { Logo } from "../brand/logo";
import { routeHref } from "../../lib/router";
import type { User } from "../../lib/types";

type SiteHeaderProps = {
  user: User | null;
  onLogout: () => Promise<void>;
  marketing?: boolean;
};

export function SiteHeader({ user, onLogout, marketing = false }: SiteHeaderProps) {
  return (
    <header className={`site-header ${marketing ? "site-header-marketing" : ""}`}>
      <a href={routeHref({ kind: "marketing" })}>
        <Logo />
      </a>
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
            <a className="button button-small button-ink" href={routeHref({ kind: "app" })}>
              Open app
            </a>
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
          <a className="button button-small button-ink" href={routeHref({ kind: "app" })}>
            Sign in
          </a>
        )}
      </div>
    </header>
  );
}
