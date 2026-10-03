export interface Study {
  id: number;
  name: string;
}

export function useStudies() {
  const studies = useState<Study[]>("studies", () => []);

  async function load() {
    studies.value = await $fetch<Study[]>("/api/studies");
  }

  async function add() {
    studies.value.push(await $fetch<Study>("/api/studies", { method: "POST" }));
  }

  async function rename(study: Study) {
    await $fetch(`/api/studies/${study.id}`, { method: "PATCH", body: { name: study.name } });
  }

  async function remove(id: number) {
    await $fetch(`/api/studies/${id}`, { method: "DELETE" });
    studies.value = studies.value.filter((s) => s.id !== id);
  }

  return { studies, load, add, rename, remove };
}
