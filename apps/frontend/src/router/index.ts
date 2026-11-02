import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from "vue-router";

import { meQueryOptions } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
  }
}

function projectIdProp(route: RouteLocationNormalized) {
  return { projectId: String(route.params.projectId) };
}

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: () => import("@/layouts/AppLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        name: "home",
        component: () => import("@/views/DashboardView.vue"),
      },
      {
        path: "project/:projectId",
        name: "project",
        component: () => import("@/views/ProjectOverviewView.vue"),
        props: projectIdProp,
      },
      {
        path: "project/:projectId/data",
        name: "project-data",
        component: () => import("@/views/ProjectDataView.vue"),
        props: projectIdProp,
      },
      {
        path: "project/:projectId/survey",
        name: "project-survey",
        component: () => import("@/views/ProjectSurveyView.vue"),
        props: projectIdProp,
      },
      {
        path: "project/:projectId/results",
        name: "project-results",
        component: () => import("@/views/ProjectResultsView.vue"),
        props: projectIdProp,
      },
    ],
  },
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/LoginView.vue"),
    meta: { guestOnly: true },
  },
  {
    path: "/register",
    name: "register",
    component: () => import("@/views/RegisterView.vue"),
    meta: { guestOnly: true },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const user = await queryClient.ensureQueryData(meQueryOptions);
  if (to.meta.requiresAuth && !user) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.meta.guestOnly && user) {
    return { name: "home" };
  }
});

export default router;
