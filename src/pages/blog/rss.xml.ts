import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE_URL = 'https://www.samthegeek.net';
const CREATOR = 'Sam Gross';

const formatRfc822 = (date: Date): string =>
  date.toUTCString().replace('GMT', '+0000');

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');

const wrapCdata = (value: string): string =>
  `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;

export const GET: APIRoute = async () => {
  const posts = await getCollection('blog');
  const feedPosts = posts
    .filter((post) => post.data.urlId)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const lastBuildDate = feedPosts.length
    ? formatRfc822(feedPosts[0].data.pubDate)
    : formatRfc822(new Date());

  const items = feedPosts
    .map((post) => {
      const link = `${SITE_URL}/blog/${post.data.urlId}`;
      const guid = post.data.guid ?? link;
      const title = post.data.rssTitle ?? post.data.title;
      const descriptionHtml = (post.data.rssDescription ?? post.body ?? '').trim();
      const contentHtml = (post.data.rssContent ?? '').trim();
      const categories = [
        ...(post.data.category ? [post.data.category] : []),
        ...(post.data.categories ?? []),
      ];

      return [
        '<item>',
        `<title>${escapeXml(title)}</title>`,
        `<dc:creator>${escapeXml(CREATOR)}</dc:creator>`,
        `<pubDate>${formatRfc822(post.data.pubDate)}</pubDate>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="false">${escapeXml(guid)}</guid>`,
        `<description>${wrapCdata(descriptionHtml)}</description>`,
        ...(contentHtml
          ? [`<content:encoded>${wrapCdata(contentHtml)}</content:encoded>`]
          : []),
        ...categories.map((category) => `<category>${escapeXml(category)}</category>`),
        '</item>',
      ].join('');
    })
    .join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"',
    '  xmlns:wfw="http://wellformedweb.org/CommentAPI/"',
    '  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"',
    '  xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '  xmlns:media="http://www.rssboard.org/media-rss"',
    '  version="2.0">',
    '  <channel>',
    '    <title>Blog - I am Sam</title>',
    `    <link>${SITE_URL}/blog/</link>`,
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    '    <language>en-US</language>',
    '    <generator>Astro</generator>',
    `    <description>${wrapCdata('<br />')}</description>`,
    `    ${items}`,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
