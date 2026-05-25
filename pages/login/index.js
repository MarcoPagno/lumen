import { useState } from "react";
import { useRouter } from "next/router";
import { TextInput, Button, FormControl, Link, Banner } from "@primer/react";
import { useUser } from "hooks/useUser.js";

export default function LoginPage() {
  const router = useRouter();
  const { fetchUser } = useUser();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function handleChange(event) {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchUser();
        router.push("/");
        return;
      }

      const { message, action } = await response.json();
      setErrorMessage({ message, action });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FormControl required>
        <FormControl.Label>Email</FormControl.Label>
        <TextInput
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
        />
      </FormControl>

      <FormControl required>
        <FormControl.Label>Senha</FormControl.Label>
        <TextInput
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
        />
      </FormControl>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Entrando..." : "Entrar"}
      </Button>

      <p>
        Não tem uma conta? <Link href="/cadastro">Cadastre-se</Link>
      </p>

      {errorMessage && (
        <Banner
          variant="critical"
          title={errorMessage.message}
          description={errorMessage.action}
        />
      )}
    </form>
  );
}

LoginPage.title = "Login";
LoginPage.isPublic = true;
