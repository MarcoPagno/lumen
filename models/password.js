import bcrypt from "bcryptjs";

const pepper = process.env.PEPPER_PASSWORD || "";

async function hash(password) {
  const rounds = getNumberOfRounds();
  const peppedPassword = password + pepper;
  return await bcrypt.hash(peppedPassword, rounds);
}

function getNumberOfRounds() {
  return process.env.NODE_ENV === "production" ? 14 : 1;
}

async function compare(providedPassword, storedPassword) {
  const peppedPassword = providedPassword + pepper;
  return await bcrypt.compare(peppedPassword, storedPassword);
}

const passwordModel = {
  hash,
  compare,
};

export default passwordModel;
