import type { Variants } from "motion/react";

// Variantes de animación compartidas (entrada escalonada de bloques).
export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };
export const rise: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(5px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.65, ease: [0.22, 0.7, 0.2, 1] } },
};
