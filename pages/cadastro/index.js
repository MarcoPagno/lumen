import { useState } from "react";
import { useRouter } from "next/router";
import { TextInput, Button, FormControl } from "@primer/react";

export default function CadastroPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
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

    const response = await fetch("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      router.push("/cadastro/confirmar");
    }

    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <FormControl required>
        <FormControl.Label>Username</FormControl.Label>
        <TextInput
          name="username"
          value={formData.username}
          onChange={handleChange}
        />
      </FormControl>

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
        {isLoading ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}

CadastroPage.title = "Cadastro";
