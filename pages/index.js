import Link from "next/link";
import useSWR from "swr";
import { BookOpen, Sun } from "lucide-react";
import { Button } from "src/components/ui/button";
import { ReadingMetaBadges } from "components/ReadingBadges.jsx";
import DiaryForm from "components/DiaryForm.jsx";
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
    throw new Error(`Failed to load ${key}`);
  }
  return response.json();
}

function Home() {
  const { user, isLoading: isUserLoading } = useUser();
  const canRead = user?.features?.includes("read:reading");
  const canReview = user?.features?.includes("read:queue:self");
  const canWriteDiary = user?.features?.includes("create:diary_entry");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Hoje</h1>

      {canRead && <QuickReadingCard />}

      <Link
        href="/falar-com-deus"
        className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
      >
        <Sun className="size-5 shrink-0" />
        <div>
          <p className="font-medium">Meditação do dia</p>
          <p className="text-sm text-muted-foreground">Falar com Deus</p>
        </div>
      </Link>

      {canWriteDiary && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Diário</h2>
            <Link
              href="/diario"
              className="text-sm text-muted-foreground underline"
            >
              Ver anotações
            </Link>
          </div>
          <DiaryForm placeholder="Como foi o dia?" />
        </section>
      )}

      {!isUserLoading && !user && (
        <p className="text-muted-foreground">
          Entre na sua conta para ver suas leituras e revisões de hoje.
        </p>
      )}

      {canReview && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Revisões</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/temas/novo">Estudar tema novo</Link>
            </Button>
          </div>
          <DailyQueue />
        </section>
      )}
    </div>
  );
}

function QuickReadingCard() {
  const { data, error, isLoading } = useSWR("/api/v1/readings/next", fetchAPI, {
    revalidateOnFocus: false,
  });

  if (isLoading || error || !data) {
    return null;
  }

  return (
    <Link
      href="/leituras"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BookOpen className="size-4" />
        Leitura rápida
      </div>
      <div>
        <p className="font-serif text-xl font-semibold leading-tight">
          {data.title}
        </p>
        <p className="text-sm text-muted-foreground">{data.author.name}</p>
      </div>
      <ReadingMetaBadges reading={data} />
      {data.reason && (
        <p className="text-sm text-muted-foreground">{data.reason}</p>
      )}
    </Link>
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

Home.title = "Hoje";
Home.isPublic = true;

export default Home;
