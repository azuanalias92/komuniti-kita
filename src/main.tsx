import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { AxiosError } from "axios";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { useTenantStore } from "@/stores/tenant-store";
import { handleServerError } from "@/lib/handle-server-error";
import { DirectionProvider } from "./context/direction-provider";
import { FontProvider } from "./context/font-provider";
import { ThemeProvider } from "./context/theme-provider";
import { routeTree } from "./routeTree.gen";
import "./styles/index.css";
import { useRegisterSW } from "virtual:pwa-register/react";

type WindowWithKK = Window & { __kkFetchPatched?: boolean };

function installApiFetchInterceptor() {
  if (typeof window === "undefined" || (window as WindowWithKK).__kkFetchPatched) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl =
      input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(requestUrl, window.location.origin);
    } catch {
      return originalFetch(input, init);
    }

    const isApiRequest =
      parsedUrl.origin === window.location.origin && parsedUrl.pathname.startsWith("/api/");

    if (!isApiRequest) {
      return originalFetch(input, init);
    }

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    const { auth } = useAuthStore.getState();
    const { currentTenantId } = useTenantStore.getState();

    if (auth.accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${auth.accessToken}`);
    }

    const fallbackTenantId = auth.user?.role?.includes("super_admin")
      ? "*"
      : auth.user?.tenantId;
    const tenantId = currentTenantId || fallbackTenantId;

    if (tenantId && tenantId !== "*" && !headers.has("X-Tenant-ID")) {
      headers.set("X-Tenant-ID", tenantId);
    }

    return originalFetch(input, { ...init, headers });
  };

  (window as WindowWithKK).__kkFetchPatched = true;
}

installApiFetchInterceptor();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (failureCount >= 0 && import.meta.env.DEV) return false;
        if (failureCount > 3 && import.meta.env.PROD) return false;

        return !(error instanceof AxiosError && [401, 403].includes(error.response?.status ?? 0));
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10_000,
    },
    mutations: {
      onError: (error) => {
        handleServerError(error);

        if (error instanceof AxiosError && error.response?.status === 304) {
          toast.error("Content not modified!");
        }
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AxiosError) {
        switch (error.response?.status) {
          case 401:
            toast.error("Session expired!");
            useAuthStore.getState().auth.reset();
            router.navigate({ to: "/sign-in" });
            break;

          case 500:
            toast.error("Internal Server Error!");
            if (import.meta.env.PROD) router.navigate({ to: "/500" });
            break;

          case 403:
            // Access denied — optional redirect
            break;
        }
      }
    },
  }),
});

/* -------------------------------------------------------------------------------------------- */
/* Router setup */
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
/* -------------------------------------------------------------------------------------------- */

/* Render root */
const rootElement = document.getElementById("root")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <ServiceWorkerHandler />
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}
function ServiceWorkerHandler() {
  useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      void swUrl;
      void registration;
    },
    onRegisterError(error: Error) {
      void error;
    },
  });

  return null;
}
