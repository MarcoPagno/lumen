import useSWR from "swr";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { ReadingMetaBadges, ThemeBadges } from "components/ReadingBadges.jsx";

async function fetchAPI(key) {
  const response = await fetch(key);
  if (!response.ok) {
    throw new Error("Failed to load reading history");
  }
  return response.json();
}

function groupByDay(logs) {
  const groups = new Map();

  for (const log of logs) {
    const day = new Date(log.created_at).toLocaleDateString("pt-br", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(log);
  }

  return [...groups.entries()];
}

export default function HistoricoPage() {
  const { data, isLoading } = useSWR("/api/v1/reading-logs", fetchAPI);

  if (isLoading) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  const logs = data ?? [];
  const totalMinutes = logs.reduce(
    (sum, log) => sum + (log.reading_minutes ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Minhas leituras</h1>
        <p className="text-sm text-muted-foreground">
          {logs.length} leitura(s) · cerca de {totalMinutes} minutos lidos
        </p>
      </div>

      {logs.length === 0 && (
        <p className="text-muted-foreground">
          Nenhuma leitura registrada ainda.
        </p>
      )}

      {groupByDay(logs).map(([day, dayLogs]) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium capitalize text-muted-foreground">
            {day}
          </h2>
          {dayLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{log.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {log.author_name}
                  </p>
                </div>
                {log.reaction === "liked" && (
                  <ThumbsUp className="size-4 shrink-0" />
                )}
                {log.reaction === "disliked" && (
                  <ThumbsDown className="size-4 shrink-0" />
                )}
              </div>
              <ReadingMetaBadges reading={log} />
              <ThemeBadges themes={log.themes} />
              {log.note && (
                <p className="text-sm whitespace-pre-wrap border-l-2 border-border pl-3">
                  {log.note}
                </p>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

HistoricoPage.title = "Minhas leituras";
