import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";
import activationService from "services/activationService.js";
import { parseApiError } from "utils/api.js";

export default function AtivarPage() {
  const router = useRouter();
  const { activationTokenId } = router.query;
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!activationTokenId) return;
    async function activate() {
      const response = await activationService.activate(activationTokenId);
      if (response.ok) {
        setStatus("success");
      } else {
        setErrorMessage(await parseApiError(response));
        setStatus("error");
      }
    }
    activate();
  }, [activationTokenId]);

  if (status === "loading") {
    return <p>Ativando sua conta...</p>;
  }

  if (status === "success") {
    return (
      <>
        <h1>Conta ativada!</h1>
        <p>
          Sua conta foi ativada com sucesso. Você já pode fazer{" "}
          <Link href="/login" className="text-primary underline">
            login
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Falha na ativação</h1>
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>{errorMessage.message}</AlertTitle>
          <AlertDescription>{errorMessage.action}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

AtivarPage.title = "Ativar conta";
AtivarPage.isPublic = true;
