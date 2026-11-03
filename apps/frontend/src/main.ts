import "./main.css";

import { createApp } from "vue";
import { VueQueryPlugin } from "@tanstack/vue-query";

import App from "./App.vue";
import { client } from "./client/client.gen";
import router from "./router";
import { queryClient } from "./lib/query-client";
import { signOutWhenSessionEnds } from "./lib/session";

client.interceptors.response.use(signOutWhenSessionEnds(queryClient, router));

const app = createApp(App);

app.use(VueQueryPlugin, { queryClient });
app.use(router);

app.mount("#app");
