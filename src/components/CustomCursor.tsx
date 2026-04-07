import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CustomCursor() {
  const [isVisible, setIsVisible] = useState(false);
  const [isGreenHover, setIsGreenHover] = useState(false);

  // Use motion values for zero-latency tracking
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Spring physics for smooth but fast follow
  const springConfig = { damping: 30, stiffness: 700, mass: 0.1 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const isGreen =
        target.hasAttribute('data-cursor-green') ||
        target.closest('[data-cursor-green]');
      setIsGreenHover(!!isGreen);
    };

    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', updateMousePosition);
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mouseout', () => {});
    document.body.addEventListener('mouseleave', handleMouseLeave);
    document.body.addEventListener('mouseenter', () => setIsVisible(true));

    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mouseout', () => {});
      document.body.removeEventListener('mouseleave', handleMouseLeave);
      document.body.removeEventListener('mouseenter', () => setIsVisible(true));
    };
  }, [isVisible, mouseX, mouseY]);

  return (
    <>
      <style>{`
        @media (pointer: fine) {
          *, body, a, button, input {
            cursor: none !important;
          }
        }
      `}</style>

      {/* Single solid instant cursor */}
      <motion.div
        className={`pointer-events-none fixed top-0 left-0 z-[9999] hidden rounded-full transition-colors duration-200 md:block ${isGreenHover ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'bg-[var(--color-on-surface)] shadow-[0_2px_8px_rgba(0,0,0,0.15)]'}`}
        style={{
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          width: 20,
          height: 20,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      />
    </>
  );
}
