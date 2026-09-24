import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// jsdom no implementa estas APIs del navegador; motion y los gráficos las usan.
// Los tests de datos corren en entorno node (sin window) y no las necesitan.
if (typeof window !== "undefined") {
  class ObservadorNulo {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  vi.stubGlobal("IntersectionObserver", ObservadorNulo);
  vi.stubGlobal("ResizeObserver", ObservadorNulo);
  if (!window.matchMedia) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    }));
  }
}
