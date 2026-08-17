import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { routeHref } from "../../lib/router";

export function InvitePage({ token }: { token: string }) {
  const [state, setState] = useState<"accepting" | "accepted" | "error">("accepting");
  const [message, setMessage] = useState("Joining workspace…");

  useEffect(() => {
    api
      .acceptInvite(token)
      .then((result) => {
        setState("accepted");
        setMessage("You are in. Opening the workspace…");
        window.setTimeout(() => {
          window.location.assign(routeHref({ kind: "app", workspaceId: result.workspaceId }));
        }, 800);
      })
      .catch((cause: Error) => {
        setState("error");
        setMessage(cause.message);
      });
  }, [token]);

  return (
    <div className={`invite-status ${state}`}>
      <span>{state === "accepted" ? "✓" : state === "error" ? "!" : "···"}</span>
      <h1>{message}</h1>
      {state === "error" ? (
        <a className="button button-ink" href={routeHref({ kind: "app" })}>
          Return to app
        </a>
      ) : null}
    </div>
  );
}
