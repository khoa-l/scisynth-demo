import type { ComputedRef, InjectionKey } from "vue";

// A workflow node a component can show, as it is now
export interface Source {
  nodeId: string;
  kind: SourceKind;
  name: string;
  request?: SourceRequest; // none while nothing is connected
}

// What a task's components need from the page
export interface TaskContext {
  taskId: ComputedRef<number | undefined>;
  sources: ComputedRef<Source[]>;
  // saves the task now: the backend runs a component's saved copy
  flush: () => Promise<void>;
}

export const TASK_CONTEXT: InjectionKey<TaskContext> = Symbol("task");

// The tasks using each node as a source (node id to task ids)
export const NODE_TASKS: InjectionKey<Record<string, number[]>> = Symbol("node-tasks");
