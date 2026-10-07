<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <!-- A section of a sidebar: a labelled bar over a scrolling list, set off from the one above by a
       stronger line. The list sits on the page's own background, so the cards in it stand out
       against the sidebar. -->
  <section class="flex min-h-0 flex-1 flex-col border-t border-accented">
    <h2
      class="border-b border-default bg-accented/60 px-4 py-1.5 text-xs uppercase tracking-wide text-muted"
    >
      {{ title }}
    </h2>
    <div class="min-h-0 flex-1 overflow-y-auto bg-default p-4">
      <slot />
    </div>
  </section>
</template>
