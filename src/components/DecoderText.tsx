import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';

interface DecoderTextProps {
  text: string;
  delay?: number;
  className?: string;
}

export default function DecoderText({
  text,
  delay = 0,
  className = '',
}: DecoderTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);

  useEffect(() => {
    // Wait for the initial delay (e.g. loader completion)
    const timeout = setTimeout(() => {
      setIsDecoding(true);
      let iteration = 0;
      const length = text.length;

      const interval = setInterval(() => {
        setDisplayText(() => {
          return text
            .split('')
            .map((letter, index) => {
              if (index < iteration) {
                return text[index];
              }
              return CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join('');
        });

        if (iteration >= length) {
          clearInterval(interval);
          setIsDecoding(false);
        }

        iteration += 1 / 3; // slower deciphering
      }, 30);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <motion.span
      className={`inline-block ${className} ${isDecoding ? 'text-[var(--color-primary-container)]' : ''}`}
      animate={{ opacity: 1 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {displayText || text.replace(/./g, '\u00A0')}
    </motion.span>
  );
}
