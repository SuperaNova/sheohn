import { motion, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';
import { usePortfolioStore } from '../store';

export type ProjectData = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  stack: string[];
  status: string;
  image?: string;
  featured?: boolean;
};

interface FeaturedProjectsProps {
  projects: ProjectData[];
  title?: string;
  subtitle?: string;
}

export default function FeaturedProjects({
  projects,
  title = 'Selected Work',
  subtitle = 'Featured Project',
}: FeaturedProjectsProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { activeFocus, overlayActive, clearFocus } = usePortfolioStore();

  return (
    <>
      <AnimatePresence>
        {overlayActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[45] cursor-pointer bg-black/80 backdrop-blur-sm"
            onClick={clearFocus}
          />
        )}
      </AnimatePresence>

      <section
        ref={sectionRef}
        id="projects"
        className="content-wrap section-space relative z-[50] flex flex-col py-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h2 className="font-display text-4xl text-[var(--color-on-surface)] sm:text-5xl">
                {title}
              </h2>
              <span className="mt-3 block text-sm font-medium tracking-[0.2em] text-[var(--color-on-surface-muted)] uppercase">
                {subtitle}
              </span>
            </div>

            <a
              href="/projects"
              className="group flex items-center gap-2 text-sm font-semibold tracking-wide text-[var(--color-tertiary)] transition hover:text-[var(--color-on-surface)]"
            >
              View All Projects
              <span className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </a>
          </div>

          <div className="grid grid-cols-1 gap-12">
            {projects.map((project, i) => {
              const isMatch = activeFocus
                ? project.stack.some((s) =>
                    s.toLowerCase().includes(activeFocus.toLowerCase()),
                  ) ||
                  project.title
                    .toLowerCase()
                    .includes(activeFocus.toLowerCase()) ||
                  project.category
                    .toLowerCase()
                    .includes(activeFocus.toLowerCase())
                : false;

              const isFocused = overlayActive && isMatch;
              const isDimmed = overlayActive && !isMatch;

              return (
                <motion.article
                  key={project.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  animate={{
                    scale: isFocused ? 1.02 : isDimmed ? 0.95 : 1,
                    opacity: isDimmed ? 0.3 : 1,
                    filter: isDimmed ? 'blur(4px)' : 'blur(0px)',
                  }}
                  transition={{
                    duration: 0.5,
                    delay: overlayActive ? 0 : i * 0.1,
                  }}
                  className={`group flex flex-col gap-8 transition-all duration-500 ease-out md:flex-row ${
                    isFocused
                      ? 'relative z-[60]'
                      : isDimmed
                        ? 'pointer-events-none relative z-30'
                        : 'relative z-10'
                  }`}
                >
                  {/* Image Container */}
                  <a
                    href={`/projects/${project.slug}`}
                    className="group/image relative isolate block aspect-video w-full overflow-hidden rounded-2xl bg-[var(--color-surface-container)] md:aspect-[4/3] md:w-3/5"
                  >
                    {project.image ? (
                      <motion.div
                        className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover/image:scale-105"
                        style={{ backgroundImage: `url(${project.image})` }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm tracking-widest text-[var(--color-on-surface-muted)] uppercase">
                        [ Demo Asset Missing ]
                      </div>
                    )}
                    <div className="absolute inset-0 z-10 bg-black/5 opacity-0 transition-opacity duration-300 group-hover/image:opacity-100" />
                  </a>

                  {/* Text Content */}
                  <div className="flex w-full flex-col justify-center py-4 md:w-2/5">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--color-tertiary-container)_28%,transparent)] px-2.5 py-1 text-[11px] font-bold tracking-wider text-[var(--color-tertiary)] uppercase">
                        {project.status}
                      </span>
                      <span className="text-xs font-medium tracking-[0.16em] text-[var(--color-on-surface-muted)] uppercase">
                        {project.category}
                      </span>
                    </div>

                    <h3 className="font-display mb-4 text-3xl font-semibold text-[var(--color-on-surface)]">
                      {project.title}
                    </h3>
                    <p className="text-base leading-relaxed text-[var(--color-on-surface-muted)]">
                      {project.summary}
                    </p>

                    <div className="mt-8 flex flex-wrap gap-2">
                      {project.stack.map((tool) => (
                        <li
                          key={`${project.title}-${tool}`}
                          className="list-none rounded bg-[var(--color-surface-container)] px-2.5 py-1.5 text-xs font-medium tracking-wide text-[var(--color-on-surface-muted)]"
                        >
                          {tool}
                        </li>
                      ))}
                    </div>

                    <a
                      className="mt-8 inline-flex items-center gap-2 self-start rounded-lg bg-[var(--color-surface-container)] px-5 py-2.5 text-sm font-semibold tracking-wide text-[var(--color-on-surface)] transition hover:bg-[var(--color-tertiary)] hover:text-black"
                      href={`/projects/${project.slug}`}
                    >
                      Read Case Study
                    </a>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </motion.div>
      </section>
    </>
  );
}
