<script setup lang="ts">
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";

import { useQuery } from "@tanstack/vue-query";
import { Background } from "@vue-flow/background";
import { VueFlow, useVueFlow, type ValidConnectionFunc } from "@vue-flow/core";
import { markRaw } from "vue";

import CatalogNode from "@/components/CatalogNode.vue";
import {
  NODE_KIND_MIME,
  canConnect,
  defaultParams,
  findKind,
  nodeCatalogQuery,
  type CatalogNodeData,
} from "@/lib/nodes/catalog";

const nodeTypes = { catalog: markRaw(CatalogNode) };
const defaultEdgeOptions = { style: { strokeWidth: 2 } };

const { data: catalog } = useQuery(nodeCatalogQuery);
const { addEdges, addNodes, onConnect, onNodesInitialized, screenToFlowCoordinate, updateNode } =
  useVueFlow();

onConnect(addEdges);

const isValidConnection: ValidConnectionFunc = (connection, { sourceNode, targetNode }) =>
  !!catalog.value &&
  connection.source !== connection.target &&
  canConnect(catalog.value, {
    sourceKind: (sourceNode.data as CatalogNodeData).kind,
    sourcePort: connection.sourceHandle,
    targetKind: (targetNode.data as CatalogNodeData).kind,
    targetPort: connection.targetHandle,
  });

function onDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes(NODE_KIND_MIME)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

function onDrop(event: DragEvent) {
  const name = event.dataTransfer?.getData(NODE_KIND_MIME) ?? "";
  const kind = catalog.value && findKind(catalog.value, name);
  if (!kind) return;
  event.preventDefault();
  const id = crypto.randomUUID();
  const { off } = onNodesInitialized(() => {
    off();
    updateNode(id, (node) => ({
      position: {
        x: node.position.x - node.dimensions.width / 2,
        y: node.position.y - node.dimensions.height / 2,
      },
    }));
  });
  addNodes({
    id,
    type: "catalog",
    position: screenToFlowCoordinate({ x: event.clientX, y: event.clientY }),
    data: { kind: kind.name, params: defaultParams(kind) } satisfies CatalogNodeData,
  });
}
</script>

<template>
  <VueFlow
    aria-label="Node graph"
    class="bg-muted inset-shadow-sm"
    :node-types="nodeTypes"
    :default-edge-options="defaultEdgeOptions"
    :is-valid-connection="isValidConnection"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <Background variant="lines" color="#dcdcdc" />
  </VueFlow>
</template>
