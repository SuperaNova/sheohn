import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { id: "home", label: "Home", path: "/" },
  { id: "about", label: "About", path: "/about" },
  { id: "resume", label: "Resume", path: "/resume.pdf", external: true },
];

export default function HeaderNav() {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    // Simple static active state based on current page
    const path = window.location.pathname;
    if (path === "/" || path === "/index.html") {
      setActiveId("home");
    } else if (path.startsWith("/about")) {
      setActiveId("about");
    }
  }, []);

  return (
    <header className="absolute inset-x-0 top-0 z-50 border-b-2 border-[var(--color-on-surface-muted)] bg-[var(--color-surface)]">
      <div className="mx-auto flex h-16 w-full max-w-[90rem] items-center justify-between px-6 md:px-10">
        <a href="/" className="font-display text-xl font-bold tracking-wide text-[var(--color-on-surface)]">
          sheohn<span className="text-[var(--color-tertiary)]">.dev</span>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((section) => {
            const isActive = activeId === section.id;
            return (
              <a
                key={section.id}
                href={section.path}
                target={section.external ? "_blank" : undefined}
                rel={section.external ? "noreferrer" : undefined}
                className={`text-sm font-medium transition hover:text-[var(--color-on-surface)] ${
                  isActive ? "text-[var(--color-on-surface)] underline underline-offset-8 decoration-2 decoration-[var(--color-tertiary)]" : "text-[var(--color-on-surface-muted)]"
                }`}
              >
                {section.label}
              </a>
            );
          })}
        </nav>

        <ThemeToggle compact />
      </div>
    </header>
  );
}
