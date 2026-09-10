import { motion, useReducedMotion } from 'motion/react';

type ShiningTextProps = {
  text: string;
};

export function ShiningText({ text }: ShiningTextProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.strong
      key={text}
      className="shining-text"
      initial={{ backgroundPosition: '200% 0', opacity: 0, y: 3 }}
      animate={{
        backgroundPosition: reduceMotion ? '0% 0' : '-200% 0',
        opacity: 1,
        y: 0,
      }}
      transition={{
        backgroundPosition: {
          repeat: reduceMotion ? 0 : Infinity,
          duration: 2,
          ease: 'linear',
        },
        opacity: { duration: 0.25 },
        y: { duration: 0.25 },
      }}
    >
      {text}
    </motion.strong>
  );
}
