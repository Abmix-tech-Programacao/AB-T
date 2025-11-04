import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Função para obter a base URL da API baseada no local atual
function getApiBaseUrl(): string {
  const currentPath = window.location.pathname;
  
  // Se estamos em um subpath (ex: /abmix-ligacao/), usar esse subpath
  if (currentPath.startsWith('/abmix-ligacao/')) {
    return '/abmix-ligacao';
  }
  
  // Caso contrário, usar raiz
  return '';
}

// Função para construir URL completa da API
function buildApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  
  // Garantir que o endpoint comece com /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  return `${baseUrl}${normalizedEndpoint}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Construir URL completa com base URL
  const fullUrl = buildApiUrl(url);
  
  console.log(`[API] ${method} ${url} -> ${fullUrl}`); // Debug
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Construir URL com base URL
    const endpoint = queryKey.join("/") as string;
    const fullUrl = buildApiUrl(endpoint);
    
    console.log(`[QUERY] ${endpoint} -> ${fullUrl}`); // Debug
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
