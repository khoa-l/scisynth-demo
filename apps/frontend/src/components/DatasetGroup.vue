<script setup lang="ts">
import { BookmarkPlus, Maximize2, Pencil, Trash2, Ungroup } from "@lucide/vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { Handle, Position, useVueFlow, type NodeProps } from "@vue-flow/core";
import { cn } from "cn";
import { computed, inject, ref, useTemplateRef } from "vue";

import {
  savedGroupsGetSavedGroupsQueryKey,
  savedGroupsSaveGroupMutation,
} from "@/client/@tanstack/vue-query.gen";
import NameDialog from "@/components/NameDialog.vue";
import NodeName from "@/components/NodeName.vue";
import { toggleVariants } from "@/components/ui/toggle";
import { nodeCatalogQuery } from "@/lib/dataset-nodes/catalog";
import { NAME_MAX_LENGTH, toGraph } from "@/lib/dataset-nodes/graph";
import {
  groupGraph,
  memberPorts,
  ungroupNodes,
  withGroupEdges,
  type GroupData,
} from "@/lib/dataset-nodes/groups";
import { VIEWED_GROUP, VIEWED_NODE } from "@/lib/dataset-nodes/viewed";
import { useDialogAction } from "@/lib/dialog-action";

const props = defineProps<NodeProps<GroupData>>();

const { data: catalog } = useQuery(nodeCatalogQuery);
const { edges, nodes, setEdges, setNodes, updateNodeData } = useVueFlow();
const nameField = useTemplateRef("nameField");
const viewed = inject(VIEWED_NODE, ref(null));
const viewedGroup = inject(VIEWED_GROUP, ref(null));

const memberIds = computed(() =>
  nodes.value.filter((node) => node.parentNode === props.id).map((node) => node.id),
);
const members = computed(() =>
  catalog.value ? memberPorts(nodes.value, catalog.value, props.id) : [],
);

const plainButton = cn(
  toggleVariants({ variant: "outline" }),
  "rounded-none border-l-0 px-2 first:rounded-l-lg first:border-l last:rounded-r-lg",
);

const queryClient = useQueryClient();
const { mutateAsync: saveGroup } = useMutation({
  ...savedGroupsSaveGroupMutation(),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: savedGroupsGetSavedGroupsQueryKey() });
  },
});
const { open: saveOpen, pending: isSaving, error: saveError, run } = useDialogAction();

function save(name: string) {
  const content = groupGraph(toGraph(nodes.value, edges.value), props.id);
  content.groups[0]!.name = name;
  void run(() => saveGroup({ body: { name, content } }));
}

function rename(name: string | null) {
  updateNodeData<GroupData>(props.id, { name });
}

function ungroup() {
  const ungrouped = ungroupNodes(nodes.value, props.id);
  setNodes(ungrouped);
  setEdges(withGroupEdges(ungrouped, edges.value));
}

function remove() {
  const removed = new Set([props.id, ...memberIds.value]);
  if (viewed.value && removed.has(viewed.value)) viewed.value = null;
  setNodes(nodes.value.filter((node) => !removed.has(node.id)));
  setEdges(edges.value.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)));
}
</script>

<template>
  <div
    class="relative w-64 rounded-lg border bg-background text-sm shadow-sm"
    :class="{ 'ring-2 ring-ring/50': selected }"
  >
    <div
      data-slot="group-title"
      class="flex justify-between gap-2 rounded-t-[calc(var(--radius-lg)-1px)] border-b bg-muted px-3 py-2 font-medium"
    >
      <NodeName ref="nameField" :name="data.name" fallback="Group" @rename="rename" />
      <span class="shrink-0 font-normal text-muted-foreground">
        {{ memberIds.length }} {{ memberIds.length === 1 ? "node" : "nodes" }}
      </span>
    </div>
    <div class="divide-y">
      <div
        v-for="member in members"
        :key="member.id"
        data-slot="group-member"
        class="flex flex-col gap-1 py-2"
      >
        <div class="px-3 font-medium">{{ member.label }}</div>
        <div
          v-for="port in member.inputs"
          :key="port.handle"
          class="relative px-3 text-muted-foreground"
        >
          <Handle
            :id="port.handle"
            type="target"
            :position="Position.Left"
            class="size-3.5!"
            :connectable="port.multiple ? true : 'single'"
          />
          {{ port.label }}
        </div>
        <div
          v-for="port in member.outputs"
          :key="port.handle"
          class="relative px-3 text-right text-muted-foreground"
        >
          <Handle :id="port.handle" type="source" :position="Position.Right" class="size-3.5!" />
          {{ port.label }}
        </div>
      </div>
    </div>
    <div
      role="group"
      aria-label="Group controls"
      class="nodrag absolute top-full left-1/2 mt-2 flex -translate-x-1/2 rounded-lg bg-background shadow-sm"
      @click.stop
    >
      <button type="button" aria-label="View group" :class="plainButton" @click="viewedGroup = id">
        <Maximize2 />
      </button>
      <NameDialog
        v-model:open="saveOpen"
        title="Save group"
        description="Saves a copy of this group to your account, to reuse in any dataset."
        :initial-name="data.name ?? 'untitled-group'"
        :max-length="NAME_MAX_LENGTH"
        :pending="isSaving"
        :error="saveError"
        @submit="save"
      >
        <button type="button" aria-label="Save group" :class="plainButton">
          <BookmarkPlus />
        </button>
      </NameDialog>
      <button
        type="button"
        aria-label="Rename group"
        :class="plainButton"
        @click="nameField?.edit()"
      >
        <Pencil />
      </button>
      <button type="button" aria-label="Ungroup nodes" :class="plainButton" @click="ungroup">
        <Ungroup />
      </button>
      <button type="button" aria-label="Delete group" :class="plainButton" @click="remove">
        <Trash2 />
      </button>
    </div>
  </div>
</template>
