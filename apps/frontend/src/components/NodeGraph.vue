<script setup lang="ts">
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";

import { Background } from "@vue-flow/background";
import { VueFlow, useVueFlow } from "@vue-flow/core";

import { NODE_KIND_MIME, findNodeKind } from "@/lib/node-kinds";

const { addNodes, onNodesInitialized, screenToFlowCoordinate, updateNode } = useVueFlow();

function onDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes(NODE_KIND_MIME)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

function onDrop(event: DragEvent) {
  const kind = findNodeKind(event.dataTransfer?.getData(NODE_KIND_MIME) ?? "");
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
    type: kind.type,
    position: screenToFlowCoordinate({ x: event.clientX, y: event.clientY }),
    data: { label: kind.label, kind: kind.name },
  });
}
</script>

<template>
  <VueFlow
    aria-label="Node graph"
    class="bg-muted inset-shadow-sm"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <Background variant="lines" color="#dcdcdc" />
  </VueFlow>
</template>
