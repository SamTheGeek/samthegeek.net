// Refuse the crawlers that robots.txt already bans from the whole site.
//
// robots.txt is voluntary, and Meta's crawlers kept pulling photos through
// the Netlify image CDN after it went up, which is what blew through the
// team's monthly bandwidth. A 403 from the edge costs a few hundred bytes
// instead of a ~1 MB image.
//
// The list mirrors the `Disallow: /` group in public/robots.txt (a test keeps
// the two in step). facebookexternalhit is deliberately absent: it fetches
// link previews when someone shares a page, not a crawl.
//
// Plain JavaScript, no imports, so Netlify's Deno runtime and the Node unit
// tests can both load it.

export const BLOCKED_AGENTS = [
  'meta-externalagent',
  'meta-externalfetcher',
  'meta-webindexer',
  'FacebookBot',
  'GPTBot',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'PerplexityBot',
  'Amazonbot',
  'cohere-ai',
  'Diffbot',
  'ImagesiftBot',
  'Omgilibot',
  'Timpibot',
  'PetalBot',
  'ant-html',
];

const blockedPattern = new RegExp(
  BLOCKED_AGENTS.map((agent) => agent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i',
);

/** True when the User-Agent header names one of the blocked crawlers. */
export function isBlockedCrawler(userAgent) {
  return Boolean(userAgent) && blockedPattern.test(userAgent);
}

export default function blockCrawlers(request) {
  if (!isBlockedCrawler(request.headers.get('user-agent'))) {
    return; // fall through to the site
  }
  return new Response('Forbidden\n', {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const config = {
  path: '/*',
  // Crawlers still need to read the rules they are being refused under.
  excludedPath: ['/robots.txt'],
  // A crash here must never take the site down; skip the check instead.
  onError: 'bypass',
};
