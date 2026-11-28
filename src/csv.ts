import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { WeightEntry } from './weight';

const pad = (n: number) => String(n).padStart(2, '0');

// "2026-11-13 07:30" in the phone's time zone, easy to read in a spreadsheet.
const stamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Builds the CSV text: a header line, then one weight per line, oldest first.
export function weightsToCsv(entries: WeightEntry[]): string {
  const rows = [...entries]
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
    .map((e) => `${stamp(e.recordedAt)},${e.kg.toFixed(2)}`);
  return ['日時,体重(kg)', ...rows].join('\n') + '\n';
}

// Reads date and weight from CSV text. Accepts this app's own file and most other apps'
// files: the first column that looks like a date and the first number from 20 to 300 are
// used, so extra columns (body fat, notes) are ignored. Lines that cannot be read are counted.
export function csvToWeights(text: string): { list: { kg: number; recordedAt: Date }[]; skipped: number } {
  const list: { kg: number; recordedAt: Date }[] = [];
  let skipped = 0;
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  for (const line of lines) {
    const cells = line.split(/[,\t;]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    let date: Date | null = null;
    let kg: number | null = null;
    for (const c of cells) {
      if (!date) {
        const m = c.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
        if (m) {
          date = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 7, m[5] ? +m[5] : 0);
          continue;
        }
      }
      if (kg === null && /^\d{2,3}([.,]\d+)?$/.test(c)) {
        const v = Number(c.replace(',', '.'));
        if (v >= 20 && v <= 300) kg = Math.round(v * 100) / 100;
      }
    }
    if (date && kg !== null && !isNaN(date.getTime())) list.push({ kg, recordedAt: date });
    else skipped++;
  }
  // The header line is not counted as a skipped line.
  if (skipped > 0 && lines.length > 0 && !/\d{4}[-/.]\d/.test(lines[0])) skipped--;
  return { list, skipped };
}

// Writes the CSV to the app's cache and opens the phone's share screen (Drive, mail, etc.).
export async function shareWeightsCsv(entries: WeightEntry[]): Promise<void> {
  const now = new Date();
  const file = new File(Paths.cache, `pocket-health-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.csv`);
  if (file.exists) file.delete();
  file.create();
  // A byte order mark so Excel opens the Japanese header correctly.
  file.write('﻿' + weightsToCsv(entries));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: '体重の記録を書き出す' });
}

// Lets the user pick a CSV file and reads the weights in it. Null when cancelled.
export async function pickWeightsCsv(): Promise<ReturnType<typeof csvToWeights> | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const text = await new File(result.assets[0].uri).text();
  return csvToWeights(text);
}
