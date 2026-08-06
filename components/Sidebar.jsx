import Link from "next/link";
import { Button } from "#components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "src/components/ui/sheet";
import { useRouter } from "next/router.js";
import { useUser } from "hooks/useUser.js";

const links = [
  { href: "/", label: "Fila de hoje", feature: "read:queue:self" },
  {
    href: "/temas/novo",
    label: "Estudar tema novo",
    feature: "create:topic",
  },
  { href: "/falar-com-deus", label: "Falar com Deus" },
  { href: "/status", label: "Status", feature: "read:status:all" },
  { href: "/migrations", label: "Migrations", feature: "read:migration" },
];

export default function Sidebar({ isOpen, onClose, isDark, onToggleDark }) {
  const router = useRouter();
  const { user } = useUser();

  const visibleLinks = links.filter(
    (link) => !link.feature || user?.features?.includes(link.feature),
  );

  function handleNavigation(href) {
    onClose();
    router.push(href);
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="left"
        className="w-64 flex flex-col gap-0 p-0"
        aria-describedby={undefined}
      >
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle asChild>
            <Link
              href="/"
              onClick={onClose}
              className="font-semibold text-lg hover:opacity-80 transition-opacity"
            >
              Lumen
            </Link>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 p-2 flex-1">
          {visibleLinks.map((link) => (
            <Button
              key={link.href}
              variant={router.pathname === link.href ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => handleNavigation(link.href)}
            >
              {link.label}
            </Button>
          ))}
        </nav>

        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={onToggleDark}
          >
            {isDark ? "☀️ Modo claro" : "🌙 Modo escuro"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
