const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    requestId?: string;
  };
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  private async request<T = any>(
    path: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers = new Headers(options.headers);

    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(`${API_URL}${path}`, config);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // Avoid loop if already on login
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login?error=401';
          }
        }
        throw new Error('UNAUTHORIZED');
      }

      // Handle 403 Forbidden
      if (response.status === 403) {
        try {
          const clone = response.clone();
          const json = await clone.json();
          if (json && (
            json.error === 'PLAN_LIMIT_EXCEEDED' || 
            json.error === 'PLAN_FEATURE_DISABLED' || 
            json.error?.code === 'PLAN_LIMIT_EXCEEDED' || 
            json.error?.code === 'PLAN_FEATURE_DISABLED' ||
            json.error?.code === 'MUST_CHANGE_PASSWORD'
          )) {
            return json;
          }
        } catch (e) {}
        throw new Error('FORBIDDEN');
      }

      const json = await response.json();
      return json as ApiResponse<T>;
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
        return {
          success: false,
          error: {
            code: error.message,
            message:
              error.message === 'UNAUTHORIZED'
                ? 'Sessão expirada. Faça login novamente.'
                : 'Você não tem permissão para realizar esta ação.',
          },
        };
      }
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Erro ao conectar-se ao servidor.',
          details: error,
        },
      };
    }
  }

  public get<T = any>(path: string, options?: RequestInit) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T = any>(path: string, body?: any, options?: RequestInit) {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : JSON.stringify({}),
    });
  }

  public patch<T = any>(path: string, body?: any, options?: RequestInit) {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : JSON.stringify({}),
    });
  }

  public put<T = any>(path: string, body?: any, options?: RequestInit) {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : JSON.stringify({}),
    });
  }

  public delete<T = any>(path: string, options?: RequestInit) {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  public async upload<T = any>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login?error=401';
          }
        }
        throw new Error('UNAUTHORIZED');
      }

      if (response.status === 403) {
        try {
          const clone = response.clone();
          const json = await clone.json();
          if (json && (
            json.error === 'PLAN_LIMIT_EXCEEDED' || 
            json.error === 'PLAN_FEATURE_DISABLED' || 
            json.error?.code === 'PLAN_LIMIT_EXCEEDED' || 
            json.error?.code === 'PLAN_FEATURE_DISABLED' ||
            json.error?.code === 'MUST_CHANGE_PASSWORD'
          )) {
            return json;
          }
        } catch (e) {}
        throw new Error('FORBIDDEN');
      }

      const json = await response.json();
      return json as ApiResponse<T>;
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
        return {
          success: false,
          error: {
            code: error.message,
            message:
              error.message === 'UNAUTHORIZED'
                ? 'Sessão expirada. Faça login novamente.'
                : 'Você não tem permissão para realizar esta ação.',
          },
        };
      }
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Erro ao enviar arquivo ao servidor.',
          details: error,
        },
      };
    }
  }
}

export const api = new ApiClient();
