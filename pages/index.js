import Link from "next/link";
import useSWR from "swr";
import { Button } from "src/components/ui/button";
import { useUser } from "hooks/useUser.js";

const TYPE_LABELS = {
  initial_study: "Novo",
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

async function fetchAPI(key) {
  const response = await fetch(key);
  if (!response.ok) {
    throw new Error("Failed to load daily queue");
  }
  return response.json();
}

function Home() {
  const { user, isLoading: isUserLoading } = useUser();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Fila de hoje</h1>
        <Button asChild>
          <Link href="/temas/novo">Estudar tema novo</Link>
        </Button>
      </div>

      {!isUserLoading && !user && (
        <p className="text-muted-foreground">
          Entre na sua conta para ver sua fila de revisões de hoje.
        </p>
      )}

      {user && <DailyQueue />}
    </div>
  );
}

function DailyQueue() {
  const { data, isLoading } = useSWR("/api/v1/topics/queue", fetchAPI);

  if (isLoading) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  const queue = data?.queue ?? [];

  return (
    <div className="flex flex-col gap-4">
      {data?.fundamental_active_count > 0 && (
        <p className="text-sm text-muted-foreground">
          {data.fundamental_active_count} tema(s) fundamental(is) em manutenção
        </p>
      )}

      {queue.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhuma revisão pendente hoje. Bom trabalho!
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {queue.map((item) => (
            <li key={item.review_id}>
              <Link
                href={`/temas/${item.topic_id}/revisar`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="font-medium">{item.title}</span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                  {TYPE_LABELS[item.type] ?? item.type}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

Home.title = "Início";
Home.isPublic = true;

export default Home;
