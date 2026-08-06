import { useState } from "react";
import useSWR from "swr";
import { Button } from "src/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";

async function fetchMigrations() {
  const response = await fetch("/api/v1/migrations");
  if (!response.ok) throw new Error("Erro ao carregar migrations");
  return response.json();
}

export default function MigrationPage() {
  const {
    data: migrations,
    isLoading,
    mutate,
  } = useSWR("/api/v1/migrations", fetchMigrations);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  async function handleRunMigrations() {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/v1/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        setErrorMessage({
          message: "Erro ao executar migrations",
          action: "Verifique os logs e tente novamente",
        });
        return;
      }
      await mutate();
      setSuccessMessage("Migrations executadas com sucesso!");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Migrations</h1>

      <Button
        onClick={handleRunMigrations}
        disabled={isSubmitting || isLoading}
        className="w-full"
      >
        {isSubmitting ? "Executando..." : "Executar migrations"}
      </Button>

      {successMessage && (
        <Alert>
          <AlertTitle>Sucesso</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>{errorMessage.message}</AlertTitle>
          <AlertDescription>{errorMessage.action}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !migrations?.length ? (
        <p className="text-muted-foreground">Nenhuma migration pendente.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {migrations.map((migration) => (
            <div
              key={migration.timestamp || migration.name}
              className="rounded-lg border border-border px-4 py-3 flex flex-col gap-1"
            >
              <span className="text-sm font-medium">
                Name: {migration.name}
              </span>
              <span className="text-xs text-muted-foreground">
                Path: {migration.path}
              </span>
              <span className="text-xs text-muted-foreground">
                Timestamp: {migration.timestamp}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

MigrationPage.title = "Migrations";
