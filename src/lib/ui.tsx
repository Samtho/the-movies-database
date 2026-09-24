import { useEffect, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate, useReducedMotion, type Variants } from "motion/react";

export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };
export const rise: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(5px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.65, ease: [0.22, 0.7, 0.2, 1] } },
};

export function Bloque({ kicker, titulo, children, intro }: {
  kicker?: string; titulo?: ReactNode; children?: ReactNode; intro?: ReactNode;
}) {
  return (
    <motion.section variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}
      className="max-w-[1500px] mx-auto px-6 md:px-12 py-14">
      {kicker && <motion.p variants={rise} className="kicker mb-3">{kicker}</motion.p>}
      {titulo && (
        <motion.h2 variants={rise} className="font-display font-semibold leading-[1.05]"
          style={{ fontSize: "clamp(2rem, 4.2vw, 3.6rem)" }}>{titulo}</motion.h2>
      )}
      {intro && <motion.p variants={rise} className="mt-4 text-lg text-ivory-dim max-w-3xl leading-relaxed">{intro}</motion.p>}
      {children}
    </motion.section>
  );
}

export function Item({ children, className }: { children: ReactNode; className?: string }) {
  // se dispara solo (el contenido asíncrono monta después de que el padre anime)
  return (
    <motion.div variants={rise} initial="hidden" animate="show" className={className}>{children}</motion.div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={rise} initial="hidden" animate="show"
      className={`rounded-2xl border border-hairline bg-stage-soft p-6 ${className ?? ""}`}>
      {children}
    </motion.div>
  );
}

export function CountUp({ to, decimals = 0, suffix = "", className, delay = 0.3, duration = 1.6 }: {
  to: number; decimals?: number; suffix?: string; className?: string; delay?: number; duration?: number;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(reduced ? to : 0);
  const text = useTransform(mv, (v: number) =>
    v.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix);
  useEffect(() => {
    if (reduced) { mv.set(to); return; }
    const c = animate(mv, to, { duration, delay, ease: "circOut" });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, reduced]);
  return <motion.span className={className}>{text}</motion.span>;
}
