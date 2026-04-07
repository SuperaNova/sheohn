import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";

type Project = {
  title: string;
  category: string;
  summary: string;
  stack: string[];
  status: string;
  href?: string;
  image?: string;
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
// TODO: add my projects
const projects: Project[] = [
  {
    title: "Executive Dashboard",
    category: "Web App",
    summary:
      "A high-end analytics dashboard designed for creative agencies to track metrics with visual elegance.",
    stack: ["React", "Tailwind", "Framer Motion"],
    status: "Completed",
    href: "https://github.com/",
    image: "/project1.png"
  },
  {
    title: "EcoArchitecture Core",
    category: "E-Commerce",
    summary:
      "Modern architectural e-commerce platform blending natural tones with strict minimalist typography.",
    stack: ["Next.js", "TypeScript", "PostgreSQL"],
    status: "In Progress",
    href: "https://github.com/",
    image: "/project2.png"
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

  return (
    <section ref={sectionRef} id="projects" className="content-wrap section-space scroll-mt-24 flex min-h-[100svh] flex-col py-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="font-display text-4xl text-[var(--color-on-surface)] sm:text-5xl">Selected Work</h2>
            <span className="mt-3 block text-sm uppercase tracking-[0.2em] text-[var(--color-on-surface-muted)] font-medium">Projects & Architectures</span>
          </div>
        </div>

        {/* CSS GRID GALLERY */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-x-8 md:gap-y-16">
          {projects.map((project, i) => (
            <motion.article
              key={project.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group flex flex-col"
            >
              {/* Image Container */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[var(--color-surface-container)] mb-6 isolate">
                {project.image ? (
                  <motion.div
                    className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{ backgroundImage: `url(${project.image})` }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[var(--color-on-surface-muted)] text-sm tracking-widest uppercase">
                    [ Demo Asset Missing ]
                  </div>
                )}
                <div className="absolute inset-0 z-10 bg-black/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>

              {/* Text Content */}
              <div className="flex flex-col flex-grow px-2">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-md bg-[color-mix(in_srgb,var(--color-tertiary-container)_28%,transparent)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-tertiary)]">
                    {project.status}
                  </span>
                  <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-on-surface-muted)] font-medium">{project.category}</span>
                </div>

                <h3 className="text-2xl font-display font-semibold text-[var(--color-on-surface)] mb-3">{project.title}</h3>
                <p className="leading-relaxed text-[var(--color-on-surface-muted)] text-sm md:text-base">{project.summary}</p>

                <div className="mt-8 flex flex-wrap gap-2">
                  {project.stack.map((tool) => (
                     <li
                     key={`${project.title}-${tool}`}
                     className="list-none rounded bg-[var(--color-surface-container)] px-2.5 py-1 text-xs font-medium tracking-wide text-[var(--color-on-surface-muted)]"
                   >
                     {tool}
                   </li>
                  ))}
                </div>

                {project.href ? (
                  <a
                    className="mt-6 inline-flex self-start text-sm font-semibold tracking-wide text-[var(--color-on-surface)] transition hover:text-[var(--color-tertiary)] group-hover:underline underline-offset-4"
                    href={project.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Case Study
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
