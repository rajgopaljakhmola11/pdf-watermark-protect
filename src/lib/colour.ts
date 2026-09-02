export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let value = hex.trim();
  if (value.startsWith("#")) value = value.slice(1);
  if (value.length === 3) {
    const r = value[0]!;
    const g = value[1]!;
    const b = value[2]!;
    value = r + r + g + g + b + b;
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return { r: 0.5, g: 0.5, b: 0.5 };
  }
  const n = parseInt(value, 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

export function hexToCss(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const to = (c: number) => Math.round(c * 255).toString(16).padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}
