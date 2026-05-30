#!/usr/bin/env node
/**
 * Topic queue CLI — manage content/state/topic-queue.json from the terminal.
 *
 * Usage (run from the automated-blog/ directory):
 *
 *   List the current queue:
 *     node scripts/queue-topic.mjs --list
 *
 *   Add a micro post:
 *     node scripts/queue-topic.mjs "Why boredom is your most useful emotion" \
 *       "Boredom is a signal that your attention pattern needs redesign, not another distraction." \
 *       micro
 *
 *   Add an essay (format is optional — omitting it uses the calendar rotation):
 *     node scripts/queue-topic.mjs "The hidden cost of versatility" \
 *       "Being good at everything means being great at nothing."
 *
 *   Add with tags:
 *     node scripts/queue-topic.mjs "The seduction of starting over" \
 *       "Every restart delays the real work: learning to make the imperfect thing better." \
 *       micro \
 *       habits,craft,resilience
 *
 *   Remove item at index 0 (the next one up):
 *     node scripts/queue-topic.mjs --remove 0
 *
 *   Clear the entire queue:
 *     node scripts/queue-topic.mjs --clear
 *
 * Or use the npm shortcut: npm run queue -- [args]
 */

import { readQueue, enqueue, removeAt } from './lib/topic-queue.mjs';

const args = process.argv.slice(2);

async function main() {
  // --list
  if (args.length === 0 || args[0] === '--list') {
    const { queue } = await readQueue();
    if (queue.length === 0) {
      console.log('Queue is empty. The cron will auto-generate topics.');
      return;
    }
    console.log(`\n${queue.length} topic${queue.length === 1 ? '' : 's'} queued:\n`);
    queue.forEach((entry, i) => {
      const fmt = entry.format ? ` [${entry.format}]` : '';
      const tags = entry.tags?.length ? ` (${entry.tags.join(', ')})` : '';
      console.log(`  ${i}. "${entry.title}"${fmt}${tags}`);
      if (entry.angle) console.log(`     → ${entry.angle}`);
      console.log(`     added: ${entry.addedAt}`);
    });
    console.log();
    return;
  }

  // --remove <index>
  if (args[0] === '--remove') {
    const idx = parseInt(args[1], 10);
    if (isNaN(idx)) {
      console.error('Usage: --remove <index>  (e.g. --remove 0)');
      process.exit(1);
    }
    const removed = await removeAt(idx);
    console.log(`Removed: "${removed.title}"`);
    return;
  }

  // --clear
  if (args[0] === '--clear') {
    const { queue } = await readQueue();
    if (queue.length === 0) {
      console.log('Queue is already empty.');
      return;
    }
    const { writeFile } = await import('node:fs/promises');
    await writeFile('content/state/topic-queue.json', JSON.stringify({ queue: [] }, null, 2) + '\n');
    console.log(`Cleared ${queue.length} item${queue.length === 1 ? '' : 's'} from the queue.`);
    return;
  }

  // Add: <title> <angle> [format] [tags]
  const title = args[0];
  const angle = args[1] ?? '';
  const format = args[2] && ['micro', 'essay'].includes(args[2].toLowerCase())
    ? args[2].toLowerCase()
    : undefined;
  const tags = args[3]?.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) ?? [];

  if (!title) {
    console.error('Usage: node scripts/queue-topic.mjs "<title>" "<angle>" [micro|essay] [tag1,tag2]');
    process.exit(1);
  }

  const total = await enqueue([{ title, angle, format, tags }]);
  const fmt = format ? ` as a ${format}` : '';
  console.log(`✓ Added "${title}"${fmt} to the queue. Queue length: ${total}`);
  if (!format) {
    console.log('  (format not specified — will use the calendar rotation: micro Mon/Wed/Fri, essay Tue/Thu)');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
