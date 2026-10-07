import { Feedback, defaultPreset } from "@dnd-kit/dom";

// dnd-kit's default plugins, but the item dragged is a clone of the one grabbed, which stays in place
// (a sidebar item that is copied onto the page, not moved)
export const CLONE_PLUGINS = [
  ...defaultPreset.plugins.filter((plugin) => plugin !== Feedback),
  Feedback.configure({ feedback: "clone" }),
];
