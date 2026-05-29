/**
 * Gemini REST wrapper.
 * Uses native structured-output (responseMimeType + responseSchema).
 * Retries up to 2x on schema-violation with the validation error appended.
 */

const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

const BANNED_PHRASES = [
  /\bdelve\b/i,
  /\bin conclusion\b/i,
  /\bin today's (fast[- ]paced )?world\b/i,
  /\bnavigate (the|this)\b/i,
  /\bgame[- ]changer\b/i,
  /\bunlock your potential\b/i,
  /\bat the end of the day\b/i,
  /\bharness the power\b/i,
];

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/**
 * Validate a generated draft. Returns { ok: true } or { ok: false, error: string }.
 */
export function validateDraft(draft) {
  if (!draft || typeof draft !== 'object') return { ok: false, error: 'not an object' };

  const required = ['title', 'subtitle', 'slug', 'tags', 'epigraph', 'bodyMdx', 'imageQuery'];
  for (const k of required) {
    if (!(k in draft)) return { ok: false, error: `missing field: ${k}` };
  }

  if (typeof draft.title !== 'string' || draft.title.length < 8 || draft.title.length > 120) {
    return { ok: false, error: 'title must be 8-120 chars' };
  }
  if (typeof draft.subtitle !== 'string' || draft.subtitle.length > 180) {
    return { ok: false, error: 'subtitle must be ≤180 chars' };
  }
  if (!/^[a-z0-9-]{3,80}$/.test(draft.slug)) {
    return { ok: false, error: 'slug must be kebab-case [a-z0-9-]' };
  }
  if (!Array.isArray(draft.tags) || draft.tags.length < 1 || draft.tags.length > 5) {
    return { ok: false, error: 'tags must be 1-5 lowercase strings' };
  }
  if (!draft.epigraph || typeof draft.epigraph.text !== 'string' || typeof draft.epigraph.attribution !== 'string') {
    return { ok: false, error: 'epigraph must have text + attribution' };
  }
  if (typeof draft.bodyMdx !== 'string' || draft.bodyMdx.length < 600) {
    return { ok: false, error: 'bodyMdx too short (need ≥600 chars / ~250 words)' };
  }
  // Required section headers
  const required_sections = ['## The Idea', '## One Question', '## Today\'s Action', '## Go Deeper'];
  for (const sec of required_sections) {
    if (!draft.bodyMdx.includes(sec)) {
      return { ok: false, error: `bodyMdx missing required section header: ${sec}` };
    }
  }

  // Banned phrases check (in body + title)
  const corpus = `${draft.title}\n${draft.subtitle}\n${draft.bodyMdx}`;
  for (const re of BANNED_PHRASES) {
    if (re.test(corpus)) {
      return { ok: false, error: `contains banned phrase: ${re}` };
    }
  }
  if (EMOJI_RE.test(corpus)) {
    return { ok: false, error: 'contains emoji (forbidden)' };
  }

  return { ok: true };
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['title', 'subtitle', 'slug', 'tags', 'epigraph', 'bodyMdx', 'imageQuery', 'themeAlignmentNote'],
  properties: {
    title: { type: 'STRING' },
    subtitle: { type: 'STRING' },
    slug: { type: 'STRING' },
    tags: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      minItems: 1,
      maxItems: 5,
    },
    epigraph: {
      type: 'OBJECT',
      required: ['text', 'attribution'],
      properties: {
        text: { type: 'STRING' },
        attribution: { type: 'STRING' },
      },
    },
    bodyMdx: { type: 'STRING' },
    imageQuery: { type: 'STRING' },
    themeAlignmentNote: { type: 'STRING' },
    sources: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['label', 'url'],
        properties: {
          label: { type: 'STRING' },
          url: { type: 'STRING' },
        },
      },
    },
  },
};

async function withTimeout(promise, ms) {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, t]);
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(prompt, apiKey) {
  const res = await withTimeout(
    fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    }),
    TIMEOUT_MS,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Gemini JSON parse failed: ${err.message}`);
  }
}

export async function generateDraft({ prompt, apiKey }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  let lastError = null;
  let activePrompt = prompt;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const draft = await callGemini(activePrompt, apiKey);
      const v = validateDraft(draft);
      if (v.ok) return draft;
      lastError = v.error;
      // Re-prompt with the validation error for the next attempt
      activePrompt = `${prompt}\n\n---\nYour previous output failed validation: ${v.error}\nReturn ONLY the corrected JSON. Do not explain. Fix only the violation; keep everything else the same in spirit.`;
    } catch (err) {
      lastError = err.message;
      // exponential backoff for transient failures
      if (attempt < MAX_RETRIES) {
        const wait = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw new Error(`Gemini failed after ${MAX_RETRIES + 1} attempts: ${lastError}`);
}
