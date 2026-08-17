import { useEffect, useState } from "react";

import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import type { Build } from "../../lib/types";

type ProjectBuildState = {
  builds: Build[];
  environments: string[];
  error: string | null;
  loading: boolean;
};

export function useProjectBuilds(projectId: string, environment: string): ProjectBuildState {
  const [state, setState] = useState<ProjectBuildState>({
    builds: [],
    environments: [],
    error: null,
    loading: true,
  });

  useEffect(() => {
    let live = true;

    async function load(): Promise<void> {
      setState((current) => ({ ...current, loading: true }));

      try {
        const result = await api.builds(projectId, environment || undefined);

        if (live) {
          setState({ ...result, error: null, loading: false });
        }
      } catch (cause) {
        if (live) {
          setState((current) => ({ ...current, error: errorMessage(cause), loading: false }));
        }
      }
    }

    void load();

    return () => {
      live = false;
    };
  }, [environment, projectId]);

  return state;
}
