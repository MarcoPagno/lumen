import { createContext, useContext, useState, useEffect } from "react";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("lumen:user");
    if (stored) setUser(JSON.parse(stored));
    setIsLoading(false);
  }, []);

  async function fetchUser() {
    const response = await fetch("/api/v1/user");
    if (!response.ok) {
      clearUser();
      return null;
    }
    const data = await response.json();
    localStorage.setItem("lumen:user", JSON.stringify(data));
    setUser(data);
    return data;
  }

  function clearUser() {
    localStorage.removeItem("lumen:user");
    setUser(null);
  }

  return (
    <UserContext.Provider value={{ user, isLoading, fetchUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
