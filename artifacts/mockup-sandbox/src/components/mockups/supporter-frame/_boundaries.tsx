import type { AnchorHTMLAttributes } from "react";
import type { FeedUpdate } from "@/lib/api";

// Isolated pre-redesign source, with empty public-feed fixtures and no requests.
export const useAuth = () => ({ isAuthenticated: false, token: null, user: null as { accountType: string } | null });
export function useQuery<T>(_options: { queryKey: unknown[]; queryFn: () => Promise<T>; enabled: boolean; staleTime?: number; refetchInterval?: number }) {
  return { data: undefined as T | undefined, isLoading: false, isError: false, refetch: async () => {} };
}
export const useQueryClient = () => ({ invalidateQueries: async (_options: unknown) => {} });
export const useMutation = (_options: { mutationFn: (id: string) => Promise<void>; onSuccess: () => void; onError: (error: unknown) => void }) =>
  ({ mutate: (_id: string) => {}, isPending: false, variables: undefined as string | undefined });
export const useLocation = () => ["/feed", (_path: string) => {}] as const;
export function Link({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} onClick={event => event.preventDefault()}>{children}</a>;
}
export const api = {
  getPublicFeed: async (): Promise<FeedUpdate[]> => [],
  getMyFeed: async (_token: string): Promise<FeedUpdate[]> => [],
  getMyFollows: async (_token: string): Promise<Array<{ _id: string }>> => [],
  followOrg: async (_orgId: string, _token: string) => {},
};
export const ContentDialog = (_props: unknown) => null;
export const useToast = () => ({ toast: (_value: unknown) => {} });
export const userErrorMessage = (_error: unknown, _action: string) => "Visual preview only.";
