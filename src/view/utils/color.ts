export function parseColor(color: string): number {
  if (!color) {
    return 0;
  }

  const normalized = color.trim().replace(/^#/, '');
  const value = Number.parseInt(normalized, 16);

  if (Number.isNaN(value)) {
    return 0;
  }

  return value;
}
