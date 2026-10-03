// A tint of the node's category color (set as --cat-fg by the .cat-* classes), as a CSS color
export const catTint = (percent: number) =>
  `color-mix(in oklab, var(--cat-fg) ${percent}%, transparent)`;
