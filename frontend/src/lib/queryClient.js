import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes fresh
      gcTime: 1000 * 60 * 10,   // 10 minutes cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});