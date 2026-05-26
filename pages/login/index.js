import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { Label } from "src/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
        />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Entrando..." : "Entrar"}
      </Button>

      <p className="text-sm text-center">
        Não tem uma conta?{" "}
        <Link href="/cadastro" className="text-primary underline">
          Cadastre-se
        </Link>
      </p>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>{errorMessage.message}</AlertTitle>
          <AlertDescription>{errorMessage.action}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

LoginPage.title = "Login";
LoginPage.isPublic = true;
