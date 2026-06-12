import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { AxiosError } from "axios";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { handleServerError } from "@/lib/handle-server-error";
import { DirectionProvider } from "./context/direction-provider";
import { FontProvider } from "./context/font-provider";
import { ThemeProvider } from "./context/theme-provider";
import { routeTree } from "./routeTree.gen";
import "./styles/index.css";
import { useRegisterSW } from "virtual:pwa-register/react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (import.meta.env.DEV) console.log({ failureCount, error });

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
      console.log("SW Registered:", swUrl, registration);
    },
    onRegisterError(error: Error) {
      console.error("SW Registration Error:", error);
    },
  });

  return null;
}
