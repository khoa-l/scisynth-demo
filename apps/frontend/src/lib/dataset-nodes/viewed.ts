import type { InjectionKey, Ref } from "vue";

export const VIEWED_NODE: InjectionKey<Ref<string | null>> = Symbol("viewed node");

export const VIEWED_PREVIEW_ID = "viewed-node-preview";
