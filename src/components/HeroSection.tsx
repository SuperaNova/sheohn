import { motion, useScroll, useSpring, useTransform, type Variants } from "framer-motion";
import { useRef } from "react";
import DecoderText from "./DecoderText";

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.12,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Gentle parallax for a "glide" feel while scrolling.
  const parallaxY = useSpring(useTransform(scrollYProgress, [0, 1], [0, -40]), {
    stiffness: 110,
    damping: 28,
  });

  // TODO: add more information about me and my roles
  return (
    <section ref={sectionRef} id="home" className="content-wrap section-space scroll-mt-24 flex min-h-[100svh] items-center pt-24">
      <motion.div
        style={{ y: parallaxY }}
        className="grid w-full items-end gap-12 lg:grid-cols-[1.2fr_0.8fr]"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
        variants={containerVariants}
      >
        <div>
          <motion.p variants={itemVariants} className="mb-5 text-xs uppercase tracking-[0.24em] text-[var(--color-on-surface-muted)]">
            <DecoderText text="Executive Portfolio" delay={1800} />
          </motion.p>

          <motion.h1
            variants={itemVariants}
            className="font-display text-5xl leading-[1.02] text-[var(--color-on-surface)] sm:text-6xl md:text-7xl"
          >
            Jared Sheohn L. Acebes
          </motion.h1>

          <motion.p variants={itemVariants} className="mt-6 text-lg text-[var(--color-on-surface)] md:text-xl font-mono tracking-tight">
            <DecoderText text="wǒ cào nǐ mā" delay={2400} />
          </motion.p>

          <motion.div variants={itemVariants} className="mt-6 flex items-center gap-3">
            <div className="relative flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </div>
            <span className="text-sm font-medium tracking-wide text-[var(--color-on-surface)]">Available for Opportunities</span>
          </motion.div>

          <motion.p variants={itemVariants} className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-on-surface-muted)] md:text-lg">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-10">
            <motion.a
              href="#footer"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
              className="inline-flex rounded-lg bg-[radial-gradient(circle_at_top_left,var(--color-primary-container),var(--color-primary))] px-6 py-3 text-sm font-semibold tracking-wide text-slate-100 shadow-[0_18px_34px_rgba(28,28,25,0.22)]"
            >
              Initiate Strategic Engagement

            </motion.a>
          </motion.div>
        </div>

        <motion.aside
          variants={itemVariants}
          className="group relative rounded-2xl border border-[var(--color-surface-container-highest)] bg-[color-mix(in_srgb,var(--color-surface-container-high)_50%,transparent)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-outline-variant)] hover:shadow-[4px_4px_0_0_var(--color-surface-container-highest)] dark:hover:shadow-[4px_4px_0_0_var(--color-primary-container)]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-tertiary)]">Strategic Note</p>
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-on-surface-muted)]">
            Dedicated to driving unhindered technical innovation. Specializing in highly optimized architectures and uncompromising visual precision.
          </p>
        </motion.aside>
      </motion.div>
    </section>
  );
}
