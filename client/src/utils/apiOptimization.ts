/**
 * API Optimization Utilities
 * Provides compression, caching, and performance utilities for API calls
 */

// Cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

/**
 * Generate cache key from URL and options
 */
const getCacheKey = (url: string, options?: RequestInit): string => {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
};

/**
 * Check if cached data is still valid
 */
const isCacheValid = (timestamp: number, ttl: number): boolean => {
    return Date.now() - timestamp < ttl;
};

/**
 * Optimized fetch with caching and compression support
 */
export const optimizedFetch = async <T = any>(
    url: string,
    options?: RequestInit & { cacheTTL?: number; skipCache?: boolean }
): Promise<T> => {
    const { cacheTTL = 5 * 60 * 1000, skipCache = false, ...fetchOptions } = options || {};
    const cacheKey = getCacheKey(url, fetchOptions);

    // Check cache for GET requests
    if (!skipCache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
        const cached = apiCache.get(cacheKey);
        if (cached && isCacheValid(cached.timestamp, cached.ttl)) {
            console.log(`[Cache HIT] ${url}`);
            return cached.data as T;
        }
    }

    // Add compression headers
    const headers = new Headers(fetchOptions.headers);
    headers.set('Accept-Encoding', 'gzip, deflate, br');
    headers.set('Accept', 'application/json');

    // Make request
    console.log(`[Cache MISS] ${url}`);
    const response = await fetch(url, {
        ...fetchOptions,
        headers,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Cache GET requests
    if (!skipCache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
        apiCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
            ttl: cacheTTL,
        });
    }

    return data as T;
};

/**
 * Clear API cache
 */
export const clearApiCache = (pattern?: string) => {
    if (!pattern) {
        apiCache.clear();
        console.log('[Cache] Cleared all cache');
        return;
    }

    const keysToDelete: string[] = [];
    apiCache.forEach((_, key) => {
        if (key.includes(pattern)) {
            keysToDelete.push(key);
        }
    });

    keysToDelete.forEach(key => apiCache.delete(key));
    console.log(`[Cache] Cleared ${keysToDelete.length} entries matching "${pattern}"`);
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;

    apiCache.forEach((value) => {
        if (isCacheValid(value.timestamp, value.ttl)) {
            validEntries++;
        } else {
            expiredEntries++;
        }
        totalSize += JSON.stringify(value.data).length;
    });

    return {
        totalEntries: apiCache.size,
        validEntries,
        expiredEntries,
        totalSize,
        totalSizeKB: (totalSize / 1024).toFixed(2),
    };
};

/**
 * Clean expired cache entries
 */
export const cleanExpiredCache = () => {
    const keysToDelete: string[] = [];

    apiCache.forEach((value, key) => {
        if (!isCacheValid(value.timestamp, value.ttl)) {
            keysToDelete.push(key);
        }
    });

    keysToDelete.forEach(key => apiCache.delete(key));
    console.log(`[Cache] Cleaned ${keysToDelete.length} expired entries`);

    return keysToDelete.length;
};

/**
 * Batch API requests to reduce network overhead
 */
export const batchRequests = async <T = any>(
    requests: Array<{ url: string; options?: RequestInit }>
): Promise<T[]> => {
    console.log(`[Batch] Processing ${requests.length} requests`);

    const results = await Promise.allSettled(
        requests.map(({ url, options }) => optimizedFetch<T>(url, options))
    );

    return results.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            console.error(`[Batch] Request ${index} failed:`, result.reason);
            throw result.reason;
        }
    });
};

/**
 * Debounce function for API calls
 */
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

/**
 * Throttle function for API calls
 */
export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean = false;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
};

/**
 * Retry failed requests with exponential backoff
 */
export const retryWithBackoff = async <T = any>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> => {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            const delay = baseDelay * Math.pow(2, i);
            console.log(`[Retry] Attempt ${i + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
};

/**
 * Compress large payloads before sending
 */
export const compressPayload = (data: any): string => {
    // For now, just stringify. In production, use actual compression library
    // like pako or lz-string for client-side compression
    return JSON.stringify(data);
};

/**
 * Decompress received payloads
 */
export const decompressPayload = (compressed: string): any => {
    // For now, just parse. In production, use actual decompression
    return JSON.parse(compressed);
};

/**
 * Monitor API performance
 */
export const monitorApiCall = async <T = any>(
    name: string,
    fn: () => Promise<T>
): Promise<T> => {
    const startTime = performance.now();

    try {
        const result = await fn();
        const duration = performance.now() - startTime;

        console.log(`[Performance] ${name} completed in ${duration.toFixed(2)}ms`);

        // Log slow requests
        if (duration > 1000) {
            console.warn(`[Performance] SLOW REQUEST: ${name} took ${duration.toFixed(2)}ms`);
        }

        return result;
    } catch (error) {
        const duration = performance.now() - startTime;
        console.error(`[Performance] ${name} failed after ${duration.toFixed(2)}ms`, error);
        throw error;
    }
};

// Auto-clean expired cache every 5 minutes
if (typeof window !== 'undefined') {
    setInterval(() => {
        cleanExpiredCache();
    }, 5 * 60 * 1000);
}

export default {
    optimizedFetch,
    clearApiCache,
    getCacheStats,
    cleanExpiredCache,
    batchRequests,
    debounce,
    throttle,
    retryWithBackoff,
    compressPayload,
    decompressPayload,
    monitorApiCall,
};
