import type { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

type SectionRevealProps = PropsWithChildren<{
  id?: string;
  className?: string;
}>;

export default function SectionReveal({
  id,
  className = '',
  children,
}: SectionRevealProps) {
  return (
    <motion.section
      id={id}
      className={className}
      initial={{ opacity: 0, y: 32, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.section>
  );
}
