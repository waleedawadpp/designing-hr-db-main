// OMR has 3 decimal places; the API returns money as strings.
export function formatOMR(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return `${n.toFixed(3)} ر.ع`;
}
