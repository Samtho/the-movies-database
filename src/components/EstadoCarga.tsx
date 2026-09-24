import type { EstadoCarga as Estado } from "../lib/useDatos";

// Lo que se ve mientras llegan los datos, o si fallan (con reintento).
export function EstadoCarga({ estado, texto, onReintentar }: {
  estado: Estado<unknown>;
  texto: string;
  onReintentar: () => void;
}) {
  if (estado.estado === "error") {
    return (
      <div role="alert" className="max-w-xl mx-auto text-center py-20 px-6">
        <p className="text-ivory">No se pudieron cargar los datos.</p>
        <p className="text-xs text-faint mt-2">{estado.error.message}</p>
        <button type="button" onClick={onReintentar}
          className="mt-5 px-4 py-2 rounded-full border border-marquee text-marquee text-sm hover:bg-marquee hover:text-stage transition-colors">
          Reintentar
        </button>
      </div>
    );
  }
  return <p role="status" className="text-center text-faint py-20">{texto}</p>;
}
