import "./main.css";

import { createApp } from "vue";
import { VueQueryPlugin } from "@tanstack/vue-query";

import App from "@/App.vue";
import { client } from "@/client/client.gen";
import { queryClient } from "@/lib/query-client";
import { signOutWhenSessionEnds } from "@/lib/session";
import router from "@/router";

client.interceptors.response.use(signOutWhenSessionEnds(queryClient, router));

const app = createApp(App);

app.use(VueQueryPlugin, { queryClient });
app.use(router);

app.mount("#app");
