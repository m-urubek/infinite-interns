import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

interface GlowContainerProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  className?: string;
  animate?: boolean;
  delay?: number;
}

export function GlowContainer({
  children,
  className = '',
  animate = false,
  delay = 0,
  ...props
}: GlowContainerProps) {
  return (
    <motion.div
      className={`glow-container ${animate ? 'animate-glow' : ''} ${className}`}
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
        delay,
      }}
      whileHover={{
        scale: 1.005,
        transition: { duration: 0.2 },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
