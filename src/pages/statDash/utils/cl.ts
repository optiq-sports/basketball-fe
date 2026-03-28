/** Fluid sizing helper matching reference dashboard (clamp). */
export const cl = (min: string, mid: string, max: string) =>
  `clamp(${min}, ${mid}, ${max})`;
