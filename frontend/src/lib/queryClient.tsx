"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createNexusQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute fresh cache
        gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
        retry: 1, // At most 1 fast retry
        refetchOnWindowFocus: false, // Prevent jitter
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Global client for browser reuse
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return createNexusQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = createNexusQueryClient();
    return browserQueryClient;
  }
}

export const NexusQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
