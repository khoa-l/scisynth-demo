export interface Study {
  id: number;
  name: string;
}

const STORAGE_KEY = "scisynth.studies";

function load(): Study[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Study[]) : [];
  } catch {
    return [];
  }
}

export function useStudies() {
  const studies = useState<Study[]>("studies", load);

  if (import.meta.client) {
    watch(
      studies,
      (value) => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        } catch {
          // storage unavailable; studies last until reload
        }
      },
      { deep: true },
    );
  }

  function add() {
    const id = studies.value.reduce((max, s) => Math.max(max, s.id), 0) + 1;
    studies.value.push({ id, name: `Study ${id}` });
  }

  function remove(id: number) {
    studies.value = studies.value.filter((s) => s.id !== id);
  }

  function get(id: number) {
    return studies.value.find((s) => s.id === id);
  }

  return { studies, add, remove, get };
}
