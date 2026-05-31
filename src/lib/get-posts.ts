import { getCollection } from 'astro:content';

const today = new Date();
today.setUTCHours(23, 59, 59, 999);

export function getPosts() {
  return getCollection(
    'posts',
    ({ data }) => !data.draft && data.pubDate <= today,
  );
}
