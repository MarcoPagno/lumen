import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export default function AtivarPage() {
  const router = useRouter();
  const { activationTokenId } = router.query;
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!activationTokenId) return;

    async function activate() {
      const response = await fetch(`/api/v1/activations/${activationTokenId}`, {
        method: "PATCH",
      });

      if (response.ok) {
        setStatus("success");
      } else {
        const body = await response.json();
        setErrorMessage(body.message || "Erro desconhecido.");
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
        <p>Sua conta foi ativada com sucesso. Você já pode fazer login.</p>
      </>
    );
  }

  return (
    <>
      <h1>Falha na ativação</h1>
      <p>{errorMessage}</p>
    </>
  );
}

AtivarPage.title = "Ativar conta";
AtivarPage.isPublic = true;
