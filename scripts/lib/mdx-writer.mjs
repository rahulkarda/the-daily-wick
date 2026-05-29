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
  heroImagePath, // relative ./_images/slug.jpg
  heroAlt,
  heroCredit,
  epigraph,
  sources,
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
    `heroImage: ${heroImagePath}`,
    `heroAlt: ${yamlString(heroAlt)}`,
    'heroCredit:',
    `  photographer: ${yamlString(heroCredit.photographer)}`,
    `  photographerUrl: ${yamlString(heroCredit.photographerUrl)}`,
    `  unsplashUrl: ${yamlString(heroCredit.unsplashUrl)}`,
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

  lines.push(`aiDrafted: true`);
  lines.push(`curator: ${yamlString(curator)}`);
  lines.push('---', '', body.trim(), '');

  return lines.join('\n');
}
