import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function Loader() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Disable scroll while loading
    document.body.style.overflow = "hidden";

    const duration = 1200; // 1.2s rapid counting
    const intervalTime = 20;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const easeOutQuart = 1 - Math.pow(1 - currentStep / steps, 4);
      const nextProgress = Math.min(Math.round(easeOutQuart * 100), 100);
      setProgress(nextProgress);

      if (currentStep >= steps) {
        clearInterval(interval);
        setTimeout(() => {
          setIsLoading(false);
          document.body.style.overflow = "";
        }, 400); // Tiny pause at 100%
      }
    }, intervalTime);

    return () => {
      clearInterval(interval);
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="loader"
          initial={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-[var(--color-surface)] p-6 md:p-12 text-[var(--color-on-surface)]"
        >
          {/* Faint Architectural Grid Backdrop for loader */}
          <div className="pointer-events-none absolute inset-0 opacity-20 transition-opacity"
            style={{
              backgroundImage: `linear-gradient(to right, var(--color-on-surface-muted) 1px, transparent 1px), linear-gradient(to bottom, var(--color-on-surface-muted) 1px, transparent 1px)`,
              backgroundSize: '4rem 4rem'
            }}
          />

          <div className="relative z-10 flex w-full items-end justify-between">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-xs uppercase tracking-[0.24em] text-[var(--color-on-surface-muted)]"
            >
              System Initialization
            </motion.div>
            <div className="font-display text-7xl md:text-9xl leading-none tracking-tighter">
              {progress}%
            </div>
          </div>
          
          <div className="relative z-10 mt-6 h-[1px] w-full bg-[var(--color-surface-container-highest)] overflow-hidden">
            <motion.div 
               className="h-full bg-[var(--color-on-surface)]"
               style={{ width: `${progress}%` }}
               transition={{ duration: 0.1, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
