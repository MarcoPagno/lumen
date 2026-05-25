import { useState } from "react";
import { useRouter } from "next/router";
import { TextInput, Button, FormControl, Banner } from "@primer/react";
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from "utils/validators";

export default function CadastroPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState({
    username: null,
    email: null,
    password: null,
  });

  function handleChange(event) {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const newErrors = {
      username: validateUsername(formData.username),
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
    };

    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((error) => error !== null);
    if (hasErrors) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        router.push("/cadastro/confirmar");
        return;
      }
      const { message, action } = await response.json();
      setErrorMessage({ message, action });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormControl required>
        <FormControl.Label>Username</FormControl.Label>
        <TextInput
          name="username"
          value={formData.username}
          onChange={handleChange}
          validationStatus={errors.username ? "error" : undefined}
        />
        {errors.username && (
          <FormControl.Validation variant="error">
            {errors.username}
          </FormControl.Validation>
        )}
      </FormControl>

      <FormControl required>
        <FormControl.Label>Email</FormControl.Label>
        <TextInput
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          validationStatus={errors.email ? "error" : undefined}
        />
        {errors.email && (
          <FormControl.Validation variant="error">
            {errors.email}
          </FormControl.Validation>
        )}
      </FormControl>

      <FormControl required>
        <FormControl.Label>Senha</FormControl.Label>
        <TextInput
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          validationStatus={errors.password ? "error" : undefined}
        />
        {errors.password && (
          <FormControl.Validation variant="error">
            {errors.password}
          </FormControl.Validation>
        )}
      </FormControl>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Criando conta..." : "Criar conta"}
      </Button>

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

CadastroPage.title = "Cadastro";
CadastroPage.isPublic = true;
