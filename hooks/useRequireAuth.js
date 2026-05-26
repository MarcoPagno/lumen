import { useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "hooks/useUser";

export function useRequireAuth(isPublic, redirectIfAuthenticated) {
  const router = useRouter();
  const { user, isLoading, fetchUser, clearUser } = useUser();

  useEffect(() => {
    if (isLoading) return;

    const isLoggedIn = !!user;

    if (redirectIfAuthenticated && isLoggedIn) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname, isLoading, isPublic]);
}
