import { QueryClient } from '@tanstack/react-query';

/**
 * Cliente global de TanStack Query. Defaults conservadores: 1 min de staleTime,
 * desativa refetch ao focar (UI dispara explicitamente quando precisa) e
 * retries só em GET para evitar duplicar mutações.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
