export function useUser() {
  async function fetchUser() {
    const response = await fetch("/api/v1/user");
    if (!response.ok) return null;
    const user = await response.json();
    localStorage.setItem("lumen:user", JSON.stringify(user));
    return user;
  }

  function getUser() {
    const stored = localStorage.getItem("lumen:user");
    return stored ? JSON.parse(stored) : null;
  }

  function clearUser() {
    localStorage.removeItem("lumen:user");
  }

  return { fetchUser, getUser, clearUser };
}
