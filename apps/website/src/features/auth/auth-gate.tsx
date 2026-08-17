import { useEffect } from "react";
import { githubSignInHref } from "../../lib/router";

export function AuthGate() {
  const signInHref = githubSignInHref();

  useEffect(() => {
    window.location.replace(signInHref);
  }, [signInHref]);

  return (
    <div className="app-loading">
      <span />
      <p>Opening sign in…</p>
      <a href={signInHref}>Continue</a>
    </div>
  );
}
