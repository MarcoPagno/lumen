import { useRouter } from "next/router";
import { TextInput, Button, FormControl, Link, Banner } from "@primer/react";
import { useUser } from "hooks/useUser.js";
import sessionService from "services/sessionService.js";
import { parseApiError } from "utils/api.js";
import { useForm } from "hooks/useForm.js";

export default function LoginPage() {
  const router = useRouter();
  const { fetchUser } = useUser();

  const {
    formData,
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
    handleChange,
  } = useForm({ email: "", password: "" });

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const response = await sessionService.createSession(formData);

      if (response.ok) {
        await fetchUser();
        router.push("/");
        return;
      }

      setErrorMessage(await parseApiError(response));
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
