"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "ecopuntos:nivel-visto";

/**
 * Sello circular del nivel (Semilla, Brote o Árbol), como de goma sobre la
 * tarjeta de puntos. Se "estampa" con animación solo la primera vez que la
 * persona ve un nivel nuevo; el resto del tiempo está quieto.
 */
export function LevelStamp({ level }: { level: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== level) {
        window.localStorage.setItem(STORAGE_KEY, level);
        ref.current?.classList.add("stamp-in");
      }
    } catch {
      // Sin almacenamiento (modo privado): el sello se queda quieto.
    }
  }, [level]);

  return (
    <div
      ref={ref}
      aria-label={`Nivel ${level}`}
      className="grid size-24 shrink-0 -rotate-8 place-items-center rounded-full border-[3px] border-double border-points-ink/80 text-center text-points-ink"
    >
      <div className="leading-none">
        <span className="block text-[0.65rem] font-bold tracking-wide">Nivel</span>
        <span className="mt-0.5 block font-heading text-lg font-extrabold">{level}</span>
      </div>
    </div>
  );
}
