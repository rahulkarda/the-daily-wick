/**
 * Gemini REST wrapper.
 * Uses native structured-output (responseMimeType + responseSchema).
 * Retries up to 2x on schema-violation with the validation error appended.
 */

const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const TIMEOUT_MS = 45_000;
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

const FORMAT_SECTIONS = {
  micro: ['## The Idea', '## One Question', "## Today's Action", '## Go Deeper'],
  essay: [
    '## The Question',
    '## The Argument',
    '## The Counterpoint',
    '## What To Do With It',
  ],
};

// Word ranges enforced by the validator. Kept in lockstep with the spec
// in content/prompts/daily-post.md and src/consts.ts FORMATS.
//   micro: 200-400 words (target 200-350, hard ceiling 400)
//   essay: 800-1700 words (target 900-1500, hard ceiling 1700)
// The min for essay is intentionally loose at 800 because the model
// reliably lands around 800-900 even when targeting 900 — the practical
// floor is "long enough to feel like an essay" and we'd rather ship at
// 850 than crash the pipeline. The max is a hard ceiling, not a target.
const FORMAT_WORDS = {
  micro: { min: 200, max: 400 },
  essay: { min: 800, max: 1700 },
};

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validate a generated draft against a target format.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export function validateDraft(draft, format = 'micro') {
  if (!draft || typeof draft !== 'object') return { ok: false, error: 'not an object' };

  const required = ['title', 'subtitle', 'slug', 'tags', 'epigraph', 'bodyMdx', 'imageQueries'];
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
  if (typeof draft.bodyMdx !== 'string') {
    return { ok: false, error: 'bodyMdx must be a string' };
  }

  // Format-specific section + word-count check.
  const sections = FORMAT_SECTIONS[format] ?? FORMAT_SECTIONS.micro;
  for (const sec of sections) {
    if (!draft.bodyMdx.includes(sec)) {
      return { ok: false, error: `bodyMdx missing required ${format} section header: ${sec}` };
    }
  }
  const wc = wordCount(draft.bodyMdx);
  const range = FORMAT_WORDS[format];
  if (wc < range.min) {
    return { ok: false, error: `bodyMdx too short for ${format}: ${wc} words (need ≥${range.min})` };
  }
  if (wc > range.max) {
    return { ok: false, error: `bodyMdx too long for ${format}: ${wc} words (max ${range.max})` };
  }

  // imageQueries shape: 3 distinct concrete strings.
  const queries = draft.imageQueries;
  if (!Array.isArray(queries) || queries.length !== 3) {
    return { ok: false, error: 'imageQueries must be exactly 3 strings' };
  }
  const seen = new Set();
  for (const q of queries) {
    if (typeof q !== 'string' || q.trim().length < 3 || q.trim().length > 60) {
      return { ok: false, error: 'each imageQuery must be 3-60 chars' };
    }
    const norm = q.trim().toLowerCase();
    if (seen.has(norm)) return { ok: false, error: 'imageQueries must be distinct' };
    seen.add(norm);
  }

  // furtherReading is optional; if present, basic shape check.
  if (draft.furtherReading != null) {
    if (!Array.isArray(draft.furtherReading)) {
      return { ok: false, error: 'furtherReading must be an array' };
    }
    for (const fr of draft.furtherReading) {
      if (!fr || typeof fr.label !== 'string' || typeof fr.url !== 'string') {
        return { ok: false, error: 'furtherReading items need {label,url}' };
      }
      if (!/^https?:\/\/[^\s"'<>`]+$/i.test(fr.url)) {
        return { ok: false, error: 'furtherReading url must be a clean http(s) URL' };
      }
    }
  }

  // Banned phrases check (in body + title + subtitle)
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
  required: ['title', 'subtitle', 'slug', 'tags', 'epigraph', 'bodyMdx', 'imageQueries', 'themeAlignmentNote'],
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
    imageQueries: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      minItems: 3,
      maxItems: 3,
    },
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
    furtherReading: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['label', 'url', 'kind'],
        properties: {
          label: { type: 'STRING' },
          url: { type: 'STRING' },
          kind: { type: 'STRING' },
          note: { type: 'STRING' },
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

async function callGemini(prompt, apiKey, format) {
  // Essay format needs more headroom — 1500 words plus JSON escaping
  // is close to the 8k token cap.
  const maxTokens = format === 'essay' ? 16384 : 8192;

  const res = await withTimeout(
    fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
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
    try {
      return JSON.parse(repairJson(text));
    } catch (err2) {
      if (process.env.DEBUG_GEMINI) {
        console.error('[gemini] raw response (first 1200 chars):');
        console.error(text.slice(0, 1200));
      }
      throw new Error(`Gemini JSON parse failed: ${err.message}`);
    }
  }
}

/**
 * Best-effort repair for common LLM JSON issues:
 *  - strip ```json fences if present
 *  - escape raw newlines/tabs that appear *inside* string values
 *  - drop trailing commas
 */
function repairJson(text) {
  let s = text.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }

  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        out += '\\u' + code.toString(16).padStart(4, '0');
        continue;
      }
    }
    out += ch;
  }

  out = out.replace(/,\s*([}\]])/g, '$1');
  return out;
}

export async function generateDraft({ prompt, apiKey, format = 'micro' }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  let lastError = null;
  let activePrompt = prompt;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const draft = await callGemini(activePrompt, apiKey, format);
      const v = validateDraft(draft, format);
      if (v.ok) return draft;
      lastError = v.error;
      activePrompt = `${prompt}\n\n---\nYour previous output failed validation: ${v.error}\nReturn ONLY the corrected JSON. Do not explain. Fix only the violation; keep everything else the same in spirit.`;
    } catch (err) {
      lastError = err.message;
      if (attempt < MAX_RETRIES) {
        const wait = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw new Error(`Gemini failed after ${MAX_RETRIES + 1} attempts: ${lastError}`);
}
