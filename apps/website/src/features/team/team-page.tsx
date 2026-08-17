import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Member, Workspace } from "../../lib/types";

export function TeamPage({ workspace }: { workspace: Workspace }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api
      .members(workspace.id)
      .then((result) => {
        if (live) {
          setMembers(result.members);
        }
      })
      .catch((cause: Error) => setError(cause.message));

    return () => {
      live = false;
    };
  }, [workspace.id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.invite(
        workspace.id,
        String(form.get("email") || ""),
        String(form.get("role")) as Member["role"],
      );
      setInviteUrl(result.inviteUrl);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <span>Team</span> workspace access
          </p>
          <h1>Reviewing is a team sport.</h1>
          <p>Invite the people who can decide whether a visual change belongs.</p>
        </div>
      </div>
      <div className="team-layout">
        <section className="member-panel">
          <header>
            <h2>Members</h2>
            <span>{members.length}</span>
          </header>
          <div className="member-list">
            {members.map((member) => (
              <article className="member-row" key={member.id}>
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" />
                ) : (
                  <span>{member.name.slice(0, 1)}</span>
                )}
                <div>
                  <strong>{member.name}</strong>
                  <small>{member.email}</small>
                </div>
                <em>{member.role}</em>
              </article>
            ))}
          </div>
        </section>
        {workspace.role === "owner" ? (
          <section className="invite-panel">
            <p className="eyebrow">Invite someone</p>
            <h2>Add a reviewer</h2>
            <p>The invite is valid for seven days and only works for the specified account.</p>
            <form className="stack-form" onSubmit={(event) => void submit(event)}>
              <label>
                Email address
                <input type="email" name="email" required placeholder="reviewer@example.com" />
              </label>
              <label>
                Role
                <select name="role" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <button className="button button-primary" type="submit">
                Create invite link
              </button>
            </form>
            {inviteUrl ? <InviteReveal url={inviteUrl} /> : null}
          </section>
        ) : null}
      </div>
      {error ? <p className="notice error">{error}</p> : null}
    </section>
  );
}

function InviteReveal({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="invite-reveal">
      <code>{url}</code>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true))}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
