import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '@/consts';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.subtitle ?? '',
      pubDate: post.data.pubDate,
      link: `${base}/articles/${post.slug}/`,
      categories: post.data.tags,
    })),
    customData: `<language>${SITE.language}</language>`,
  });
}
