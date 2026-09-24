import type { Variants } from "motion/react";

const EASE = [0.22, 0.7, 0.2, 1] as const;

// Variantes de animación compartidas (entrada escalonada de bloques).
export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };
export const rise: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(5px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.65, ease: EASE } },
};

// Igual que `rise`, pero cada elemento se anima por su cuenta con un retraso según su
// posición (custom = 0, 1, 2...). Sirve para lo que se monta DESPUÉS de que el padre
// ya animó (p. ej. el titular que aparece cuando llegan los datos): con `rise`
// heredado se quedaría invisible, porque el padre ya no vuelve a disparar la animación.
export const aparece: Variants = {
  hidden: rise.hidden,
  show: (i: number = 0) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.65, ease: EASE, delay: 0.1 + i * 0.08 } }),
};
