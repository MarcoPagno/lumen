import { Button } from "#components/ui/button";
import { useRouter } from "next/router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "src/components/ui/sheet";

const links = [{ href: "/falar-com-deus", label: "Falar com Deus" }];

export default function Sidebar({ isOpen, onClose, isDark, onToggleDark }) {
  const router = useRouter();
  function handleNavigation(href) {
    onClose();
    router.push(href);
  }
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="left"
        className="w-64 flex flex-col"
        aria-describedby={undefined}
      >
        <SheetHeader>
          <SheetTitle>Lumen</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-2 mt-6">
          {links.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => handleNavigation(link.href)}
            >
              {link.label}
            </Button>
          ))}
        </nav>
        <div className="mt-auto pt-6">
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
