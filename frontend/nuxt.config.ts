// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui"],

  ssr: false,

  devtools: { enabled: true },

  css: [
    "~/assets/css/main.css",
    "@vue-flow/core/dist/style.css",
    "@vue-flow/core/dist/theme-default.css",
    "@vue-flow/controls/dist/style.css",
    "@vue-flow/minimap/dist/style.css",
  ],

  nitro: {
    devProxy: { "/api": "http://127.0.0.1:8000/api" },
  },

  compatibilityDate: "2026-06-30",
});
