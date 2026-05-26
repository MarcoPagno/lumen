import { useState } from "react";
import { useRouter } from "next/router";
import { TextInput, Button, FormControl, Banner } from "@primer/react";
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from "utils/validators.js";
import userService from "services/userService.js";
import { parseApiError } from "utils/api.js";
import { useForm } from "hooks/useForm.js";

export default function CadastroPage() {
  const router = useRouter();

  const {
    formData,
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
    handleChange,
  } = useForm({
    username: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({
    username: null,
    email: null,
    password: null,
  });

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
      const response = await userService.createUser(formData);
      if (response.ok) {
        router.push("/cadastro/confirmar");
        return;
      }
      setErrorMessage(await parseApiError(response));
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
