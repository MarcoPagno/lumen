import useSWR from "swr";

async function fetchAPI(key) {
  const response = await fetch(key);
  return response.json();
}

export default function StatusPage() {
  return (
    <>
      <h1>Status</h1>
      <DatabaseData />
    </>
  );
}

function DatabaseData() {
  const { isLoading, data } = useSWR("/api/v1/status", fetchAPI, {
    refreshInterval: 2000,
  });

  return (
    <>
      <h2>Database</h2>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div>Version: {data.dependencies.database.version}</div>
          <div>
            Max Connections: {data.dependencies.database.max_connections}
          </div>
          <div>
            Opened Connections: {data.dependencies.database.opened_connections}
          </div>
          <br />
          <div>
            Last update: {new Date(data.updated_at).toLocaleString("pt-br")}
          </div>
        </>
      )}
    </>
  );
}
