export type Role = "user" | "admin";

const STORAGE_KEY = "scisynth.role";

function load(): Role | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "user" || value === "admin" ? value : null;
  } catch {
    return null;
  }
}

export function useSession() {
  const role = useState<Role | null>("role", load);

  function login(next: Role) {
    role.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable
    }
  }

  function logout() {
    role.value = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  return { role, login, logout };
}
