import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "./ThemeToggle";

const sections = [
  { id: "home", label: "Home" },
  { id: "projects", label: "Projects" },
  { id: "stack", label: "Stack" },
  { id: "about", label: "About" },
  { id: "footer", label: "Contact" },
];

export default function HeaderNav() {
  const [activeId, setActiveId] = useState("home");

  const sectionElements = useMemo(
    () =>
      sections
        .map((section) => ({
          id: section.id,
          element: typeof window !== "undefined" ? document.getElementById(section.id) : null,
        }))
        .filter((entry) => entry.element),
    []
  );

  useEffect(() => {
    const onScroll = () => {
      const midpoint = window.scrollY + window.innerHeight * 0.35;
      let nextActive = "home";
      for (const entry of sectionElements) {
        if (!entry.element) continue;
        if (entry.element.offsetTop <= midpoint) nextActive = entry.id;
      }
      setActiveId(nextActive);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sectionElements]);

  return (
    <header className="glass-island fixed inset-x-0 top-0 z-50 border-b border-white/10">
      <div className="mx-auto flex h-16 w-full max-w-[90rem] items-center justify-between px-6 md:px-10">
        <a href="#home" className="font-display text-xl text-[var(--color-on-surface)]">
          sheohn.dev
        </a>

        <nav className="hidden items-center gap-2 md:flex">
          {sections.map((section) => {
            const isActive = activeId === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="relative rounded-md px-3 py-2 text-sm text-[var(--color-on-surface-muted)] transition hover:text-[var(--color-on-surface)]"
              >
                {isActive ? (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 -z-10 rounded-md bg-[color-mix(in_srgb,var(--color-primary)_30%,transparent)]"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                ) : null}
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
