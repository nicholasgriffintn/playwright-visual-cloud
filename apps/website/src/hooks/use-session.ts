import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { User } from "../lib/types";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setUser((await api.session()).user);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    window.location.assign("/");
  }, []);

  return { user, loading, refresh, logout };
}
