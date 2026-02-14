import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryClient';
import { getLeads } from '../services/lead-management-api';

// Types
export interface DashboardStats {
    summary: {
        totalContacts: number;
        activeLeads: number;
        newLeadsToday: number;
        pipelineValue: number;
        totalTemplates: number;
        totalCampaigns: number;
        totalFlows: number;
    };
    chartData: Array<{ date: string; sent: number; read: number }>;
    leadsChartData: Array<{ date: string; count: number }>;
    pipelineStats: Array<{
        id: string;
        name: string;
        totalLeads: number;
        stages: Array<{ name: string; count: number }>;
    }>;
    taskStats: {
        today: number;
        due: number;
        completed: number;
        breakdown: Record<string, any>;
    };
    templateStats: {
        approved: number;
        pending: number;
        rejected: number;
    };
    integrationStats: {
        total: number;
        breakdown: Record<string, number>;
    };
    connection: {
        phone: string | null;
        id: string | null;
        quality_rating?: string;
        messaging_limit?: string;
        status?: string;
        name_status?: string;
        display_phone_number?: string | null;
    };
}

export interface RevenueStats {
    totalValue: number;
    wonValue: number;
    conversionRate: string;
}

// Fetch dashboard stats from API
const fetchDashboardStats = async (): Promise<DashboardStats> => {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch('/api/dashboard/stats', {
        headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
    }

    return response.json();
};

// Fetch leads with pagination
const fetchLeads = async (limit: number = 100, offset: number = 0) => {
    // For now, use existing getLeads but in future implement pagination
    const allLeads = await getLeads();

    // Simulate pagination
    return {
        data: allLeads?.slice(offset, offset + limit) || [],
        total: allLeads?.length || 0,
        hasMore: allLeads ? offset + limit < allLeads.length : false
    };
};

// Calculate revenue stats from leads
const calculateRevenueStats = (leads: any[]): RevenueStats => {
    if (!leads || leads.length === 0) {
        return { totalValue: 0, wonValue: 0, conversionRate: '0%' };
    }

    const totalVal = leads.reduce((acc: number, lead: any) =>
        acc + (Number(lead.value) || 0), 0
    );

    const wonVal = leads
        .filter((l: any) => l.status === 'won' || (l.stage_id && l.stage_id.includes('won')))
        .reduce((acc: number, lead: any) => acc + (Number(lead.value) || 0), 0);

    const wonLeads = leads.filter((l: any) => l.status === 'won').length;
    const rate = Math.round((wonLeads / leads.length) * 100) + '%';

    return { totalValue: totalVal, wonValue: wonVal, conversionRate: rate };
};

/**
 * Hook to fetch dashboard statistics with caching
 * Data is cached for 5 minutes and automatically refetches on window focus
 */
export const useDashboardStats = () => {
    return useQuery({
        queryKey: queryKeys.dashboardStats,
        queryFn: fetchDashboardStats,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: true,
        retry: 2,
    });
};

/**
 * Hook to fetch leads with pagination and caching
 * Useful for large datasets to avoid loading everything at once
 */
export const useDashboardLeads = (limit: number = 100, offset: number = 0) => {
    return useQuery({
        queryKey: queryKeys.dashboardLeads(limit, offset),
        queryFn: () => fetchLeads(limit, offset),
        staleTime: 3 * 60 * 1000, // 3 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
        enabled: true, // Can be controlled to load on demand
    });
};

/**
 * Hook to calculate revenue stats from leads
 * Uses the leads query data to avoid duplicate fetches
 */
export const useRevenueStats = () => {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: ['dashboard', 'revenue'],
        queryFn: async () => {
            // Try to get leads from cache first
            const cachedLeads = queryClient.getQueryData(queryKeys.dashboardLeads(100, 0));

            if (cachedLeads && typeof cachedLeads === 'object' && 'data' in cachedLeads) {
                const leadsArray = (cachedLeads as { data: any[] }).data;
                return calculateRevenueStats(leadsArray);
            }

            // If not in cache, fetch fresh data
            const leadsData = await fetchLeads(100, 0);
            return calculateRevenueStats(leadsData.data);
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
};

/**
 * Hook to prefetch dashboard data
 * Call this on app initialization or route change to warm up the cache
 */
export const usePrefetchDashboard = () => {
    const queryClient = useQueryClient();

    const prefetchDashboard = async () => {
        // Prefetch dashboard stats
        await queryClient.prefetchQuery({
            queryKey: queryKeys.dashboardStats,
            queryFn: fetchDashboardStats,
            staleTime: 5 * 60 * 1000,
        });

        // Prefetch first page of leads
        await queryClient.prefetchQuery({
            queryKey: queryKeys.dashboardLeads(100, 0),
            queryFn: () => fetchLeads(100, 0),
            staleTime: 3 * 60 * 1000,
        });
    };

    return { prefetchDashboard };
};

/**
 * Hook to invalidate dashboard cache
 * Call this after mutations that affect dashboard data
 */
export const useInvalidateDashboard = () => {
    const queryClient = useQueryClient();

    const invalidateDashboard = async () => {
        await queryClient.invalidateQueries({
            queryKey: ['dashboard']
        });
    };

    const invalidateStats = async () => {
        await queryClient.invalidateQueries({
            queryKey: queryKeys.dashboardStats
        });
    };

    const invalidateLeads = async () => {
        await queryClient.invalidateQueries({
            queryKey: ['dashboard', 'leads']
        });
    };

    return {
        invalidateDashboard,
        invalidateStats,
        invalidateLeads,
    };
};

export default {
    useDashboardStats,
    useDashboardLeads,
    useRevenueStats,
    usePrefetchDashboard,
    useInvalidateDashboard,
};
