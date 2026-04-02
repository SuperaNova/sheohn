import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";

type Project = {
  title: string;
  category: string;
  summary: string;
  stack: string[];
  status: string;
  href?: string;
};

/**
 * PROJECT DATA SOURCE
 * -------------------
 * Add future projects inside this array.
 *
 * Example:
 * {
 *   title: "Cloud Native Orchestration",
 *   category: "Systems / Infra",
 *   summary: "Built a distributed orchestration layer for container workloads.",
 *   stack: ["Go", "Kubernetes", "AWS"],
 *   status: "In Progress",
 *   href: "https://github.com/your-repo"
 * }
 */
const projects: Project[] = [
  {
    title: "<Project Title 1>",
    category: "<Category 1>",
    summary:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    stack: ["<Tech 1>", "<Tech 2>", "<Tech 3>"],
    status: "<Status>",
    href: "https://github.com/",
  },
  {
    title: "<Project Title 2>",
    category: "<Category 2>",
    summary:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    stack: ["<Tech 1>", "<Tech 2>", "<Tech 3>"],
    status: "<Status>",
    href: "https://github.com/",
  },
  {
    title: "<Project Title 3>",
    category: "<Category 3>",
    summary:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    stack: ["<Tech 1>", "<Tech 2>", "<Tech 3>"],
    status: "<Status>",
    href: "https://github.com/",
  },
  {
    title: "<Project Title 4>",
    category: "<Category 4>",
    summary:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    stack: ["<Tech 1>", "<Tech 2>", "<Tech 3>"],
    status: "<Status>",
    href: "https://github.com/",
  },
];

export default function FeaturedProjects() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const startDragging = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const stopDragging = () => {
    setIsDragging(false);
  };

  const onDrag = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const scrollByAmount = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const amount = scrollContainerRef.current.clientWidth * 0.75;
    scrollContainerRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const floatY = useSpring(useTransform(scrollYProgress, [0, 1], [24, -24]), {
    stiffness: 100,
    damping: 30,
  });

  return (
    <section ref={sectionRef} id="projects" className="content-wrap section-space scroll-mt-24 flex min-h-[100svh] flex-col snap-center py-24">
      <motion.div
        style={{ y: floatY }}
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="font-display text-3xl text-[var(--color-on-surface)] sm:text-4xl">Featured Projects</h2>
            <span className="mt-2 block text-xs uppercase tracking-[0.2em] text-[var(--color-on-surface-muted)]">Selected Work</span>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={() => scrollByAmount("left")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)] transition hover:bg-[var(--color-surface-container-highest)] active:scale-95"
              aria-label="Scroll left"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button
              onClick={() => scrollByAmount("right")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)] transition hover:bg-[var(--color-surface-container-highest)] active:scale-95"
              aria-label="Scroll right"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          onMouseDown={startDragging}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
          onMouseMove={onDrag}
          className={`-mx-6 flex gap-6 overflow-x-auto px-6 pb-12 pt-4 md:-mx-10 md:px-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${isDragging ? "cursor-grabbing snap-none" : "cursor-grab snap-x snap-mandatory"}`}
        >
          {projects.map((project) => (
            <motion.article
              key={project.title}
              whileHover={{ y: -4, scale: 1.006 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="flex w-[85vw] max-w-[500px] shrink-0 snap-center flex-col justify-between rounded-2xl bg-[var(--color-surface-container-high)] p-6 md:p-8 relative"
            >
              <div>
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <span className="rounded-md bg-[color-mix(in_srgb,var(--color-tertiary-container)_28%,transparent)] px-3 py-1 text-xs font-medium text-[var(--color-tertiary)]">
                    {project.status}
                  </span>
                  <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-on-surface-muted)]">{project.category}</span>
                </div>

                <h3 className="text-2xl font-semibold text-[var(--color-on-surface)]">{project.title}</h3>
                <p className="mt-4 leading-relaxed text-[var(--color-on-surface-muted)]">{project.summary}</p>
              </div>

              <div>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {project.stack.map((tool) => (
                    <li
                      key={`${project.title}-${tool}`}
                      className="rounded-md bg-[var(--color-surface-container)] px-3 py-1 text-xs tracking-wide text-[var(--color-on-surface-muted)]"
                    >
                      {tool}
                    </li>
                  ))}
                </ul>

                {project.href ? (
                  <a
                    className="mt-7 inline-flex text-sm text-[var(--color-primary-container)] underline-offset-4 transition hover:text-[var(--color-tertiary)] hover:underline before:absolute before:inset-0"
                    href={project.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Project
                  </a>
                ) : null}
              </div>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
