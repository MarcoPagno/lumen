async function createUser(userData) {
  const response = await fetch("/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
  return response;
}

const userService = { createUser };

export default userService;
