export default defineNuxtRouteMiddleware((to) => {
  const { role } = useSession();

  if (to.path === "/") return navigateTo(role.value ? home(role.value) : "/login");
  if (to.path === "/login") return role.value ? navigateTo(home(role.value)) : undefined;
  if (!role.value) return navigateTo("/login");

  const required = to.path.startsWith("/admin") ? "admin" : "user";
  if (required !== role.value) return navigateTo(home(role.value));
});

function home(role: Role) {
  return role === "admin" ? "/admin" : "/app";
}
