/**
 * Recent-topics rolling-window state.
 * Persists at content/state/recent-topics.json so the generator can avoid
 * repeating tags/concepts in the last N posts.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const PATH = 'content/state/recent-topics.json';
const MAX_WINDOW = 30;

export async function readRecent() {
  if (!existsSync(PATH)) return { window: [] };
  try {
    const text = await readFile(PATH, 'utf-8');
    return JSON.parse(text);
  } catch (err) {
    console.warn(`[recent-topics] could not parse ${PATH}: ${err.message}`);
    return { window: [] };
  }
}

export async function appendRecent(entry) {
  const state = await readRecent();
  state.window = [entry, ...state.window].slice(0, MAX_WINDOW);
  await writeFile(PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  return state;
}

export function summarize(recent) {
  if (!recent?.window?.length) return 'None yet — this is one of the first issues.';
  return recent.window
    .map((e, i) => `  ${i + 1}. (${e.date}) [${(e.tags || []).join(', ')}] — ${e.conceptSummary}`)
    .join('\n');
}
