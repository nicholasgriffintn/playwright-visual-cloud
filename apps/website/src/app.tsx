import { AuthGate } from "./features/auth/auth-gate";
import { AuthenticatedApp } from "./features/app/authenticated-app";
import { MarketingPage } from "./features/marketing/marketing-page";
import { useRoute } from "./hooks/use-route";
import { useSession } from "./hooks/use-session";
import "./styles.css";

export function App() {
  const route = useRoute();
  const session = useSession();

  if (session.loading) {
    return (
      <div className="app-loading">
        <span />
        <p>Calibrating pixels…</p>
      </div>
    );
  }

  if (route.kind === "marketing") {
    return <MarketingPage user={session.user} onLogout={session.logout} />;
  }

  if (!session.user) {
    return <AuthGate />;
  }

  return <AuthenticatedApp route={route} user={session.user} onLogout={session.logout} />;
}

export default App;
