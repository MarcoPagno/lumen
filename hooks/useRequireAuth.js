import { useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "hooks/useUser";

export function useRequireAuth(isPublic) {
  const router = useRouter();
  const { getUser, fetchUser, clearUser } = useUser();

  useEffect(() => {
    const user = getUser();
    const isLoggedIn = !!user;

    if (isPublic && isLoggedIn) {
      router.push("/");
      return;
    }

    if (!isPublic && !isLoggedIn) {
      router.push("/login");
      return;
    }

    if (!isPublic && isLoggedIn) {
      fetchUser().catch(() => {
        clearUser();
        router.push("/login");
      });
    }
  }, [router.pathname]);
}
