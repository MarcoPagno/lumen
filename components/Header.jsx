import Link from "next/link";
import { LogOut } from "lucide-react";
import { useRouter } from "next/router";
import { useUser } from "hooks/useUser";
import { Button } from "#components/ui/button";

export default function Header({ onOpenSidebar, user }) {
  const router = useRouter();
  const { clearUser } = useUser();

  async function handleLogout() {
    await fetch("/api/v1/sessions", { method: "DELETE" });
    clearUser();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 h-14 border-b border-border bg-background">
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenSidebar}
        aria-label="Abrir menu"
      >
        ☰
      </Button>

      <Link href="/" className="font-semibold text-lg">
        Lumen
      </Link>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <span className="text-sm font-medium truncate max-w-24">
              {user.username}
            </span>
            <Button variant="outline" size="xs" onClick={handleLogout}>
              <LogOut />
            </Button>
          </>
        ) : (
          <Link href="/login" className="text-sm font-medium hover:underline">
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
