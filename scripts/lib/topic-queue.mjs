/**
 * Topic-queue state.
 *
 * Lives at content/state/topic-queue.json. Structure:
 *   {
 *     "queue": [
 *       {
 *         "title": "Why boredom is your most useful emotion",
 *         "angle": "Boredom is a signal that something in your attention pattern needs redesign, not another distraction.",
 *         "format": "micro",          // optional — overrides the calendar rotation
 *         "tags": ["attention"],       // optional — hints for Gemini
 *         "addedAt": "2026-06-01"
 *       }
 *     ]
 *   }
 *
 * Queue entries are consumed FIFO. Each entry is removed after use.
 * The generator checks the queue before calling Gemini — if an entry is present,
 * the title + angle are injected into the prompt as a directive so Gemini writes
 * about that specific idea rather than inventing one.
 *
 * CLI usage (from the automated-blog/ directory):
 *   node scripts/queue-topic.mjs "Title here" "The angle in one sentence." [micro|essay]
 *   node scripts/queue-topic.mjs --list
 *   node scripts/queue-topic.mjs --remove 0   # remove by queue index
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const PATH = 'content/state/topic-queue.json';

export async function readQueue() {
  if (!existsSync(PATH)) return { queue: [] };
  try {
    const text = await readFile(PATH, 'utf-8');
    const data = JSON.parse(text);
    if (!Array.isArray(data.queue)) return { queue: [] };
    return data;
  } catch (err) {
    console.warn(`[topic-queue] could not parse ${PATH}: ${err.message}`);
    return { queue: [] };
  }
}

/** Returns the next queued topic without removing it, or null if empty. */
export async function peekNext() {
  const { queue } = await readQueue();
  return queue.length > 0 ? queue[0] : null;
}

/**
 * Removes and returns the next queued topic. If the queue is empty, returns null.
 * Call only after the post has been successfully written — not before.
 */
export async function popNext() {
  const data = await readQueue();
  if (data.queue.length === 0) return null;
  const [next, ...rest] = data.queue;
  data.queue = rest;
  await writeFile(PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  return next;
}

/**
 * Add one or more topics to the end of the queue.
 * Each entry should be { title, angle, format?, tags?, addedAt? }.
 */
export async function enqueue(entries) {
  const data = await readQueue();
  const today = new Date().toISOString().slice(0, 10);
  for (const e of entries) {
    data.queue.push({
      title: e.title,
      angle: e.angle ?? '',
      ...(e.format ? { format: e.format } : {}),
      ...(e.tags?.length ? { tags: e.tags } : {}),
      addedAt: e.addedAt ?? today,
    });
  }
  await writeFile(PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  return data.queue.length;
}

/** Remove a topic from the queue by 0-based index. */
export async function removeAt(index) {
  const data = await readQueue();
  if (index < 0 || index >= data.queue.length) {
    throw new Error(`Index ${index} out of range (queue has ${data.queue.length} items)`);
  }
  const [removed] = data.queue.splice(index, 1);
  await writeFile(PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  return removed;
}
