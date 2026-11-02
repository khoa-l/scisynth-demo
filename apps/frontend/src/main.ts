import "./main.css";

import { createApp } from "vue";
import { VueQueryPlugin } from "@tanstack/vue-query";

import App from "./App.vue";
import router from "./router";
import { queryClient } from "./lib/query-client";

const app = createApp(App);

app.use(VueQueryPlugin, { queryClient });
app.use(router);

app.mount("#app");
