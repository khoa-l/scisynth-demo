// A user study task made from a study's workflow
export interface Task {
  id: number;
  name: string;
}

export interface Study {
  id: number;
  name: string;
  tasks: Task[];
}

export function useStudies() {
  const studies = useState<Study[]>("studies", () => []);

  async function load() {
    studies.value = await $fetch<Study[]>("/api/studies");
  }

  async function add() {
    const study = await $fetch<Omit<Study, "tasks">>("/api/studies", { method: "POST" });
    studies.value.push({ ...study, tasks: [] });
  }

  // Studies whose tasks are hidden (in memory only)
  const collapsed = useState<number[]>("collapsed-studies", () => []);
  const isCollapsed = (id: number) => collapsed.value.includes(id);
  function toggleCollapsed(id: number) {
    collapsed.value = isCollapsed(id)
      ? collapsed.value.filter((x) => x !== id)
      : [...collapsed.value, id];
  }

  async function addTask(study: Study) {
    study.tasks.push(await $fetch<Task>(`/api/studies/${study.id}/tasks`, { method: "POST" }));
    collapsed.value = collapsed.value.filter((x) => x !== study.id); // show the new task
  }

  async function renameTask(task: Task) {
    await $fetch(`/api/tasks/${task.id}`, { method: "PATCH", body: { name: task.name } });
  }

  async function moveStudy(from: number, to: number) {
    studies.value = moveItem(studies.value, from, to);
    await $fetch("/api/studies/order", {
      method: "PUT",
      body: { ids: studies.value.map((s) => s.id) },
    });
  }

  // Save a study's task order, and show it on the home list if loaded
  async function saveTaskOrder(studyId: number, tasks: Task[]) {
    const home = studies.value.find((s) => s.id === studyId);
    if (home) {
      const byId = new Map(home.tasks.map((t) => [t.id, t]));
      home.tasks = tasks.map((t) => byId.get(t.id) ?? t);
    }
    await $fetch(`/api/studies/${studyId}/tasks/order`, {
      method: "PUT",
      body: { ids: tasks.map((t) => t.id) },
    });
  }

  async function moveTask(study: Study, from: number, to: number) {
    study.tasks = moveItem(study.tasks, from, to);
    await saveTaskOrder(study.id, study.tasks);
  }

  async function removeTask(study: Study, task: Task) {
    await $fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    study.tasks = study.tasks.filter((t) => t.id !== task.id);
  }

  async function rename(study: Study) {
    await $fetch(`/api/studies/${study.id}`, { method: "PATCH", body: { name: study.name } });
  }

  async function remove(id: number) {
    await $fetch(`/api/studies/${id}`, { method: "DELETE" });
    studies.value = studies.value.filter((s) => s.id !== id);
  }

  return {
    studies,
    load,
    add,
    rename,
    remove,
    isCollapsed,
    toggleCollapsed,
    addTask,
    renameTask,
    removeTask,
    moveStudy,
    moveTask,
    saveTaskOrder,
  };
}
