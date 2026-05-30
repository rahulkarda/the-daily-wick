/**
 * Assemble frontmatter + body into an MDX file string.
 * YAML frontmatter is hand-written (no extra dep) — values are escaped strictly
 * by quoting strings and replacing internal quotes.
 */

function yamlString(s) {
  if (s == null) return '""';
  // Use double quotes; escape internal double-quotes and backslashes.
  const escaped = String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function yamlList(arr) {
  return `[${arr.map(yamlString).join(', ')}]`;
}

export function assembleMdx({
  title,
  subtitle,
  pubDate,
  tags,
  monthlyTheme,
  format, // 'micro' | 'essay'
  heroImagePath, // relative ./_images/slug.jpg
  heroAlt,
  heroCredit,
  epigraph,
  sources,
  furtherReading,
  provenance,
  body,
  curator,
}) {
  const lines = [
    '---',
    `title: ${yamlString(title)}`,
    `subtitle: ${yamlString(subtitle)}`,
    `pubDate: ${pubDate.toISOString().slice(0, 10)}`,
    `tags: ${yamlList(tags)}`,
    `monthlyTheme: ${yamlString(monthlyTheme)}`,
    `format: ${yamlString(format || 'micro')}`,
    `heroImage: ${heroImagePath}`,
    `heroAlt: ${yamlString(heroAlt)}`,
    'heroCredit:',
    `  photographer: ${yamlString(heroCredit.photographer)}`,
    `  photographerUrl: ${yamlString(heroCredit.photographerUrl)}`,
    `  unsplashUrl: ${yamlString(heroCredit.unsplashUrl)}`,
    `  source: ${yamlString(heroCredit.source || 'unsplash')}`,
  ];

  if (epigraph) {
    lines.push(
      'epigraph:',
      `  text: ${yamlString(epigraph.text)}`,
      `  attribution: ${yamlString(epigraph.attribution)}`,
    );
  }

  if (sources && sources.length > 0) {
    lines.push('sources:');
    for (const s of sources) {
      lines.push(`  - label: ${yamlString(s.label)}`);
      lines.push(`    url: ${yamlString(s.url)}`);
    }
  }

  if (furtherReading && furtherReading.length > 0) {
    lines.push('furtherReading:');
    for (const fr of furtherReading) {
      lines.push(`  - label: ${yamlString(fr.label)}`);
      lines.push(`    url: ${yamlString(fr.url)}`);
      lines.push(`    kind: ${yamlString(fr.kind || 'essay')}`);
      if (fr.note) {
        lines.push(`    note: ${yamlString(fr.note)}`);
      }
    }
  }

  if (provenance) {
    lines.push(`provenance: ${yamlString(provenance)}`);
  }

  lines.push(`aiDrafted: true`);
  lines.push(`curator: ${yamlString(curator)}`);
  lines.push('---', '', body.trim(), '');

  return lines.join('\n');
}
