<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import type { SavedGroupPublic } from "@/client";
import {
  savedGroupsDeleteSavedGroupMutation,
  savedGroupsGetSavedGroupsOptions,
  savedGroupsGetSavedGroupsQueryKey,
  savedGroupsUpdateSavedGroupMutation,
} from "@/client/@tanstack/vue-query.gen";
import ItemActions from "@/components/ItemActions.vue";
import { SAVED_GROUP_MIME } from "@/lib/dataset-nodes/catalog";
import { NAME_MAX_LENGTH } from "@/lib/dataset-nodes/graph";
import { paletteItemClass, paletteListClass } from "@/lib/palette";

const queryClient = useQueryClient();
const key = savedGroupsGetSavedGroupsQueryKey();

const { data: groups, isPending, isError } = useQuery(savedGroupsGetSavedGroupsOptions());

const { mutateAsync: update } = useMutation({
  ...savedGroupsUpdateSavedGroupMutation(),
  onSuccess: (updated) =>
    queryClient.setQueryData<SavedGroupPublic[]>(key, (list) =>
      list?.map((group) => (group.id === updated.id ? updated : group)),
    ),
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: key });
  },
});

const { mutateAsync: remove } = useMutation({
  ...savedGroupsDeleteSavedGroupMutation(),
  onSuccess: (_, { path }) =>
    queryClient.setQueryData<SavedGroupPublic[]>(key, (list) =>
      list?.filter((group) => group.id !== path.group_id),
    ),
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: key });
  },
});

function startDrag(event: DragEvent, group: SavedGroupPublic) {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData(SAVED_GROUP_MIME, JSON.stringify(group.content));
  event.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
  <p v-if="isPending" class="text-sm text-muted-foreground">Loading saved groups…</p>
  <p v-else-if="isError" class="text-sm text-destructive">Couldn't load saved groups.</p>
  <p v-else-if="!groups?.length" class="text-sm text-muted-foreground">
    Save a group from its toolbar to reuse it in any dataset.
  </p>
  <ul v-else :class="paletteListClass">
    <li
      v-for="group in groups"
      :key="group.id"
      draggable="true"
      :class="paletteItemClass"
      class="group relative bg-muted"
      @dragstart="startDrag($event, group)"
    >
      <span class="truncate">{{ group.name }}</span>
      <ItemActions
        noun="saved group"
        :name="group.name"
        :max-length="NAME_MAX_LENGTH"
        :rename="(name) => update({ path: { group_id: group.id }, body: { name } })"
        :remove="() => remove({ path: { group_id: group.id } })"
        class="absolute top-1/2 right-1 -translate-y-1/2"
      />
    </li>
  </ul>
</template>
