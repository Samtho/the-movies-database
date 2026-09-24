import { useEffect, useState } from "react";
import { cargar, ErrorDeDatos } from "./data";
import type { Datos, NombreArchivo } from "./schema";

export type EstadoCarga<T> =
  | { estado: "cargando" }
  | { estado: "listo"; datos: T }
  | { estado: "error"; error: ErrorDeDatos };

type DatosDe<N extends readonly NombreArchivo[]> = { [K in keyof N]: Datos<N[K]> };

// Carga uno o varios JSON y expone un único estado: "cargando" hasta que llegan todos,
// "error" si falla cualquiera (con reintento), "listo" con los datos en el mismo orden.
export function useDatos<const N extends readonly NombreArchivo[]>(nombres: N): EstadoCarga<DatosDe<N>> & { reintentar: () => void } {
  const clave = nombres.join(",");
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<{ clave: string; intento: number; estado: EstadoCarga<DatosDe<N>> } | null>(null);

  useEffect(() => {
    let vigente = true;
    Promise.all(clave.split(",").map((n) => cargar(n as NombreArchivo)))
      .then((datos) => { if (vigente) setResultado({ clave, intento, estado: { estado: "listo", datos: datos as DatosDe<N> } }); })
      .catch((e: unknown) => {
        if (!vigente) return;
        const error = e instanceof ErrorDeDatos ? e : new ErrorDeDatos(clave.split(",")[0] as NombreArchivo, "red", String(e));
        setResultado({ clave, intento, estado: { estado: "error", error } });
      });
    return () => { vigente = false; };
  }, [clave, intento]);

  // un resultado de otra clave u otro intento es de una carga anterior: mientras tanto, "cargando"
  const estado: EstadoCarga<DatosDe<N>> =
    resultado && resultado.clave === clave && resultado.intento === intento ? resultado.estado : { estado: "cargando" };
  return { ...estado, reintentar: () => setIntento((i) => i + 1) };
}
