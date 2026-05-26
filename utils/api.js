export async function parseApiError(response) {
  const { message, action } = await response.json();
  return { message, action };
}
