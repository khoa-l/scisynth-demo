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
    projectSection?: "overview" | "datasets" | "surveys";
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
        meta: { projectSection: "overview" },
      },
      {
        path: "project/:projectId/dataset",
        name: "project-datasets",
        component: () => import("@/views/ProjectDatasetsView.vue"),
        props: projectIdProp,
        meta: { projectSection: "datasets" },
      },
      {
        path: "project/:projectId/dataset/:datasetId",
        name: "project-dataset",
        component: () => import("@/views/ProjectDatasetView.vue"),
        props: (route) => ({
          ...projectIdProp(route),
          datasetId: String(route.params.datasetId),
        }),
        meta: { projectSection: "datasets" },
      },
      {
        path: "project/:projectId/survey",
        name: "project-surveys",
        component: () => import("@/views/ProjectSurveysView.vue"),
        props: projectIdProp,
        meta: { projectSection: "surveys" },
      },
      {
        path: "project/:projectId/survey/:surveyId",
        name: "project-survey",
        component: () => import("@/views/ProjectSurveyView.vue"),
        props: (route) => ({
          ...projectIdProp(route),
          surveyId: String(route.params.surveyId),
        }),
        meta: { projectSection: "surveys" },
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
