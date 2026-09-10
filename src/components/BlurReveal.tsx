import { motion, useReducedMotion } from 'motion/react';

type BlurRevealProps = {
  lines: string[];
  className?: string;
};

export function BlurReveal({ lines, className }: BlurRevealProps) {
  const reduceMotion = useReducedMotion();
  let wordIndex = 0;

  return (
    <span className={className}>
      {lines.map((line, lineIndex) => (
        <span className="blur-reveal-line" key={line}>
          {line.split(' ').map((word) => {
            const delay = wordIndex * 0.2;
            wordIndex += 1;

            return (
              <motion.span
                className="blur-reveal-word"
                key={`${lineIndex}-${wordIndex}-${word}`}
                initial={reduceMotion ? false : { opacity: 0, filter: 'blur(12px)', y: 8 }}
                animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                transition={{ duration: 0.85, delay: reduceMotion ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
              >
                {word}
              </motion.span>
            );
          })}
        </span>
      ))}
    </span>
  );
}
