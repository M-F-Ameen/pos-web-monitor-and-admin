/**
 * API Client
 * Handles all API requests with proper error handling and types
 * Auto-injects JWT auth headers from AuthContext
 */

import { ApiResponse } from '@/types/api';

const BASE_URL = process.env.NEXT_PUBLIC_CLOUD_API_URL || 'http://localhost:4000/api';
const TIMEOUT = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000');

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  timeout?: number;
}

class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private getAuthHeaders: (() => Record<string, string>) | null = null;

  constructor(baseUrl: string = BASE_URL, timeout: number = TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /** Inject auth header getter after AuthContext is available */
  setAuthHeaderProvider(fn: () => Record<string, string>) {
    this.getAuthHeaders = fn;
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, String(v)));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      });
    }

    return url.toString();
  }

  /**
   * Make a request with timeout
   */
  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const extraHeaders: Record<string, string> = {};
    if (this.getAuthHeaders) {
      Object.assign(extraHeaders, this.getAuthHeaders());
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Language': 'ar',
          ...extraHeaders,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`API Error: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`);
      }

      const json = await response.json() as any;

      // Unwrap { success: true, data: ... } / { success: true, items: ... }
      if (json && typeof json === 'object' && json.success === true) {
        if ('data' in json) return json.data as T;
        if ('items' in json) return json.items as T;
      }

      return json as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    return this.request<T>(url, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    return this.request<T>(url, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing/custom instances
export default ApiClient;

/**
 * API Endpoints Structure (placeholders - ready for implementation)
 * These are the endpoint patterns expected from the backend API
 */

export const endpoints = {
  // Overview/Dashboard
  overview: {
    summary: '/overview/summary',
  },

  // Sales
  sales: {
    list: '/sales',
    detail: (id: string) => `/sales/${id}`,
  },

  // Returns
  returns: {
    list: '/returns',
    detail: (id: string) => `/returns/${id}`,
  },

  // Treasury
  treasury: {
    summary: '/treasury/summary',
  },

  // Shifts
  shifts: {
    list: '/shifts',
    detail: (id: string) => `/shifts/${id}`,
    open: '/shifts/open',
  },

  // Reports
  reports: {
    summary: '/reports/summary',
  },

  // Customers
  customers: {
    list: '/customers',
    detail: (id: string) => `/customers/${id}`,
  },

  // Inventory
  inventory: {
    summary: '/inventory/summary',
  },

  // Auth (placeholder)
  auth: {
    login: '/auth/login',
  },
};
