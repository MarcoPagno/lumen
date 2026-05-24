import { useState } from "react";
import { useRouter } from "next/router";
import { TextInput, Button, FormControl } from "@primer/react";
import { useUser } from "hooks/useUser";

export default function LoginPage() {
  const router = useRouter();
  const { fetchUser } = useUser();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(event) {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);

    const response = await fetch("/api/v1/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      await fetchUser();
      router.push("/");
    }

    setIsLoading(false);
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
    </form>
  );
}

LoginPage.title = "Login";
