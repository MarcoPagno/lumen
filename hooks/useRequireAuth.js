import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "hooks/useUser.js";

export function useRequireAuth(isPublic) {
  const router = useRouter();
  const { getUser, fetchUser, clearUser } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname, mounted, isPublic]);
}
