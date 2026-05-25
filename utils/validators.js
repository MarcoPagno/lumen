export function validateUsername(username) {
  if (username.length < 3 || username.length > 30) {
    return "Username precisa ter entre 3 e 30 caracteres";
  }
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return "Username só pode conter letras e números";
  }
  return null;
}

export function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Informe um email válido";
  }
  return null;
}

export function validatePassword(password) {
  if (password.length < 6 || password.length > 72) {
    return "Senha precisa ter entre 6 e 72 caracteres";
  }
  return null;
}
