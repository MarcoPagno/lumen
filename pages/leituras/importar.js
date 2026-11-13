import { useRef, useState } from "react";
import useSWR from "swr";
import { Button } from "src/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";
import readingService from "services/readingService.js";
import { parseApiError } from "utils/api.js";

async function fetchAPI(key) {
  const response = await fetch(key);
  if (!response.ok) {
    throw new Error("Failed to load import status");
  }
  return response.json();
}

function describeResult(result) {
  if (result.step === "discover") {
    return `${result.author}: ${result.discovered} textos encontrados`;
  }
  return `${result.processed} processados · ${result.ready} prontos · ${result.rejected} descartados`;
}

export default function ImportarLeiturasPage() {
  const { data, isLoading, mutate } = useSWR(
    "/api/v1/readings/imports",
    fetchAPI,
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Importar leituras</h1>
        <p className="text-sm text-muted-foreground">
          A importação roda em lotes. Você pode parar e continuar depois de onde
          parou.
        </p>
      </div>

      {(data ?? []).map((source) => (
        <SourceImporter key={source.source} source={source} onUpdate={mutate} />
      ))}
    </div>
  );
}

function SourceImporter({ source, onUpdate }) {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState(source.stats);
  const [log, setLog] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const shouldStop = useRef(false);

  async function runImport() {
    setIsRunning(true);
    setErrorMessage(null);
    shouldStop.current = false;

    try {
      while (!shouldStop.current) {
        const response = await readingService.importNext(source.source);
        if (!response.ok) {
          setErrorMessage(await parseApiError(response));
          break;
        }

        const result = await response.json();
        setStats(result.stats);
        setLog((current) => [describeResult(result), ...current].slice(0, 8));

        if (result.done) break;
      }
    } finally {
      setIsRunning(false);
      onUpdate();
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="font-medium">{source.name}</h2>
        <p className="text-xs text-muted-foreground">
          {source.authors.join(", ")}
        </p>
      </div>

      <p className="text-sm">
        {stats.ready} prontos · {stats.pending} na fila · {stats.rejected}{" "}
        descartados
      </p>

      {isRunning ? (
        <Button variant="outline" onClick={() => (shouldStop.current = true)}>
          Parar
        </Button>
      ) : (
        <Button onClick={runImport}>Importar</Button>
      )}

      {log.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {log.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>{errorMessage.message}</AlertTitle>
          <AlertDescription>{errorMessage.action}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

ImportarLeiturasPage.title = "Importar leituras";
