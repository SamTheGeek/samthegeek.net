import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import blockCrawlers, {
  BLOCKED_AGENTS,
  config,
  isBlockedCrawler,
} from '../../netlify/edge-functions/block-crawlers.js';

const robots = await readFile(new URL('../../public/robots.txt', import.meta.url), 'utf8');

/** User-agent tokens in the robots.txt group that disallows the whole site. */
const robotsSiteWideAgents = () => {
  const groups = robots.split(/\n\s*\n/).map((block) => block.split('\n').filter((l) => l && !l.startsWith('#')));
  const group = groups.find((lines) => lines.some((l) => l.trim() === 'Disallow: /'));
  return group.filter((l) => l.startsWith('User-agent:')).map((l) => l.slice(11).trim());
};

describe('isBlockedCrawler', () => {
  const blocked = [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 (compatible; meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))',
    'meta-webindexer/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    'CCBot/2.0 (https://commoncrawl.org/faq/)',
    'mozilla/5.0 (compatible; bytespider)',
  ];
  for (const ua of blocked) {
    test(`blocks ${ua.slice(0, 60)}…`, () => assert.equal(isBlockedCrawler(ua), true));
  }

  const allowed = [
    // Link previews when a page is shared, not crawls.
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'NetworkingExtension/8626.1.17 Network/6681.60.37 iOS/27.3',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.3 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
    '',
    null,
  ];
  for (const ua of allowed) {
    test(`allows ${String(ua).slice(0, 60) || '(empty)'}`, () => assert.equal(isBlockedCrawler(ua), false));
  }
});

describe('blockCrawlers edge function', () => {
  const request = (ua) => new Request('https://samthegeek.net/.netlify/images?url=%2Fimages%2Fx.webp&w=1200', {
    headers: ua ? { 'user-agent': ua } : {},
  });

  test('answers a blocked crawler with a small uncached 403', async () => {
    const response = blockCrawlers(request('meta-externalagent/1.1'));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok((await response.text()).length < 100);
  });

  test('passes everyone else through to the site', () => {
    assert.equal(blockCrawlers(request('Mozilla/5.0 (Macintosh) Safari/604.1')), undefined);
    assert.equal(blockCrawlers(request()), undefined);
  });

  test('runs on every path except robots.txt, and never fails the request', () => {
    assert.equal(config.path, '/*');
    assert.deepEqual(config.excludedPath, ['/robots.txt']);
    assert.equal(config.onError, 'bypass');
  });

  test('blocks exactly the crawlers robots.txt bans from the whole site', () => {
    assert.deepEqual([...BLOCKED_AGENTS].sort(), robotsSiteWideAgents().sort());
  });
});
