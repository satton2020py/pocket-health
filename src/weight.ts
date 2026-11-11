export type WeightEntry = {
  id: string;
  kg: number;
  recordedAt: Date;
};

// Accepts "62.45", "62,45" or "62" and returns kg rounded to 2 decimal places.
// Returns null when the input is not a plausible body weight.
export function parseWeightInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null;
  const kg = Number(normalized);
  if (kg < 20 || kg > 300) return null;
  return Math.round(kg * 100) / 100;
}

export function formatWeight(kg: number): string {
  return kg.toFixed(2);
}
