import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/** Shared follows query; same key as the feed so React Query dedups. */
export function useSupporterFollowing() {
  const { user, token, isAuthenticated } = useAuth();
  const enabled = !!(isAuthenticated && token && user?.accountType === "supporter");
  const query = useQuery({
    queryKey: ["follows", "my", token],
    queryFn: () => api.getMyFollows(token as string),
    enabled,
  });
  return { ...query, enabled };
}
