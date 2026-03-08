import { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  preset?: "fade" | "blur-slide" | "scale" | "slide-up";
  delay?: number;
  once?: boolean;
}

const presetVariants: Record<string, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.6 } },
  },
  "blur-slide": {
    hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring", bounce: 0.3, duration: 1.2 },
    },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.92 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring", bounce: 0.2, duration: 0.8 },
    },
  },
  "slide-up": {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", bounce: 0.25, duration: 1 },
    },
  },
};

export function ScrollReveal({
  children,
  className,
  preset = "blur-slide",
  delay = 0,
  once = true,
}: ScrollRevealProps) {
  const variants = presetVariants[preset];

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-60px" }}
      variants={{
        hidden: variants.hidden,
        visible: {
          ...variants.visible,
          transition: {
            ...(variants.visible as any)?.transition,
            delay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Wrap multiple children and stagger their reveal on scroll */
interface ScrollRevealGroupProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  preset?: "fade" | "blur-slide" | "scale" | "slide-up";
  once?: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export function ScrollRevealGroup({
  children,
  className,
  stagger = 0.1,
  preset = "blur-slide",
  once = true,
}: ScrollRevealGroupProps) {
  const itemVariant = presetVariants[preset];

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-60px" }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: stagger },
        },
      }}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div key={i} variants={itemVariant}>
              {child}
            </motion.div>
          ))
        : <motion.div variants={itemVariant}>{children}</motion.div>
      }
    </motion.div>
  );
}
