import { useState, type ReactNode } from "react";
import { urlImagen, type AnchoImagen } from "../lib/data";

// Imagen de TMDB (póster o foto). Si no hay ruta o la imagen falla al cargar,
// muestra el respaldo (o nada): nunca un icono de imagen rota.
export function Poster({ ruta, ancho = 154, alt, className, diferida = true, respaldo = null }: {
  ruta: string | null | undefined;
  ancho?: AnchoImagen;
  alt: string;
  className?: string;
  diferida?: boolean;
  respaldo?: ReactNode;
}) {
  const src = urlImagen(ruta, ancho);
  const [fallida, setFallida] = useState<string | null>(null);
  if (!src || fallida === src) return <>{respaldo}</>;
  return (
    <img src={src} alt={alt} className={className} loading={diferida ? "lazy" : "eager"} decoding="async"
      onError={() => setFallida(src)} />
  );
}

// Foto redonda de una persona, o su inicial si no hay foto.
export function Avatar({ ruta, nombre, tamano, className = "", ancho = 92 }: {
  ruta: string | null | undefined;
  nombre: string;
  tamano: string; // clases de alto y ancho, p. ej. "h-12 w-12"
  className?: string;
  ancho?: AnchoImagen;
}) {
  const inicial = <span aria-hidden="true" className={`${tamano} rounded-full bg-stage grid place-items-center text-faint border border-hairline shrink-0 ${className}`}>{nombre.trim().charAt(0) || "?"}</span>;
  return (
    <Poster ruta={ruta} ancho={ancho} alt={nombre} respaldo={inicial}
      className={`${tamano} rounded-full object-cover border border-hairline shrink-0 ${className}`} />
  );
}
