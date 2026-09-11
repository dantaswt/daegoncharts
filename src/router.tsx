import { ErrorComponent, PendingComponent } from "./routes/__root";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultErrorComponent: ErrorComponent,
    defaultPendingComponent: PendingComponent,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
