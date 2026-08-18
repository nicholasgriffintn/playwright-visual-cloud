import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { routeHref } from "../../lib/router";
import { Link, useNavigate } from "react-router-dom";

export function InvitePage({ token }: { token: string }) {
  const navigate = useNavigate();
  const [state, setState] = useState<"accepting" | "accepted" | "error">("accepting");
  const [message, setMessage] = useState("Joining workspace…");

  useEffect(() => {
    api
      .acceptInvite(token)
      .then((result) => {
        setState("accepted");
        setMessage("You are in. Opening the workspace…");
        window.setTimeout(() => {
          navigate(routeHref({ kind: "app", workspaceId: result.workspaceId }));
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
        <Link className="button button-ink" to={routeHref({ kind: "app" })}>
          Return to app
        </Link>
      ) : null}
    </div>
  );
}
