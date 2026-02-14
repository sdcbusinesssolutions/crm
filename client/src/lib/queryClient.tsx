import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';

// Create a client with optimized defaults
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache data for 5 minutes by default
            staleTime: 5 * 60 * 1000,
            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry failed requests 2 times
            retry: 2,
            // Refetch on window focus for fresh data
            refetchOnWindowFocus: true,
            // Refetch on reconnect
            refetchOnReconnect: true,
            // Don't refetch on mount if data is fresh
            refetchOnMount: false,
        },
        mutations: {
            // Retry mutations once on failure
            retry: 1,
        },
    },
});

interface QueryProviderProps {
    children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {/* Only show devtools in development */}
            {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
            )}
        </QueryClientProvider>
    );
};

// Export query keys for consistency
export const queryKeys = {
    // Dashboard queries
    dashboardStats: ['dashboard', 'stats'] as const,
    dashboardLeads: (limit?: number, offset?: number) =>
        ['dashboard', 'leads', { limit, offset }] as const,

    // Leads queries
    leads: (filters?: any) => ['leads', filters] as const,
    lead: (id: string) => ['lead', id] as const,

    // Pipeline queries
    pipelines: ['pipelines'] as const,
    pipeline: (id: string) => ['pipeline', id] as const,
    pipelineLeads: (id: string, page?: number) =>
        ['pipeline', id, 'leads', page] as const,

    // Contact queries
    contacts: (page?: number, search?: string) =>
        ['contacts', { page, search }] as const,
    contact: (id: string) => ['contact', id] as const,

    // Campaign queries
    campaigns: ['campaigns'] as const,
    campaign: (id: string) => ['campaign', id] as const,

    // Template queries
    templates: ['templates'] as const,
    template: (id: string) => ['template', id] as const,

    // Flow queries
    flows: ['flows'] as const,
    flow: (id: string) => ['flow', id] as const,

    // Task queries
    tasks: (filters?: any) => ['tasks', filters] as const,
    task: (id: string) => ['task', id] as const,
};

export default QueryProvider;
