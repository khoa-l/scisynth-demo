import type { ComputedRef, InjectionKey } from "vue";

// A node of the workflow a component can show, as it is now
export interface Source {
  nodeId: string;
  kind: SourceKind;
  name: string;
  request?: SourceRequest; // none while nothing is connected to the node
}

// What the components of a task need from the page that shows them
export interface TaskContext {
  taskId: ComputedRef<number | undefined>;
  sources: ComputedRef<Source[]>;
  // saves the task now: the backend runs a component's copy from what it has saved
  flush: () => Promise<void>;
}

export const TASK_CONTEXT: InjectionKey<TaskContext> = Symbol("task");

// The tasks that use each node of the study as a source (node id -> task ids), for the canvas
export const NODE_TASKS: InjectionKey<Record<string, number[]>> = Symbol("node-tasks");
