const ARCHIVE_SOURCE_URL = 'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/ships/ships.html';
const REPO_RAW_BASE = 'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main';
const SITE_ORIGIN = 'https://www.oceanliners.net';
const TIMEOUT_MS = 10000;

export async function onRequestGet() {
  try {
    const archive = await fetchText(ARCHIVE_SOURCE_URL);
    const ships = parseArchiveCards(archive);

    if (!ships.length) {
      return json({ ok: false, error: 'No Ship Archive cards could be parsed.' }, 502);
    }

    // Try several random candidates so one unusual page cannot break the screensaver.
    const order = shuffledIndexes(ships.length);
    let lastError = null;

    for (const index of order.slice(0, 12)) {
      const ship = ships[index];
      try {
        const pageUrl = absoluteSiteUrl(ship.href);
        const sourceUrl = rawRepoUrl(ship.href);
        const pageHtml = await fetchText(sourceUrl);
        const imagePath = parseHeroImage(pageHtml);
        if (!imagePath) continue;

        const image = absoluteSiteUrl(imagePath);
        const imageSmall = `https://curator.oceanliners.net/api/ship-image?src=${encodeURIComponent(image)}`;

        return json({
          ok: true,
          service: 'CuratorOS Random Ship',
          generatedAt: new Date().toISOString(),
          ship: {
            name: ship.name,
            line: ship.line,
            year: ship.year,
            meta: [ship.line, ship.year].filter(Boolean).join(' · '),
            page: pageUrl,
            image,
            imageSmall
          }
        });
      } catch (error) {
        lastError = error;
      }
    }

    return json({
      ok: false,
      error: lastError?.message || 'Could not find a random ship with a usable archive image.'
    }, 502);
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 502);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function parseArchiveCards(html) {
  const rows = [];
  const cardRe = /<article\b[^>]*class=["'][^"']*guide-card[^"']*["'][^>]*data-line=["']([^"']*)["'][^>]*data-year=["']([^"']*)["'][^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = cardRe.exec(html))) {
    const line = decodeHtml(stripTags(match[1])).trim();
    const year = decodeHtml(stripTags(match[2])).trim();
    const body = match[3];
    const link = body.match(/<a\b[^>]*class=["'][^"']*guide-title[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;

    const href = decodeHtml(link[1]).trim();
    const name = decodeHtml(stripTags(link[2])).replace(/\s+/g, ' ').trim();
    if (!href.startsWith('/ships/') || !name) continue;

    rows.push({ href, name, line, year });
  }

  return rows;
}

function parseHeroImage(html) {
  const preferred = [
    /<img\b[^>]*class=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/i,
    /<img\b[^>]*class=["'][^"']*(?:hero-img|ship-photo)[^"']*["'][^>]*src=["']([^"']+)["']/i,
    /<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
  ];

  for (const re of preferred) {
    const match = html.match(re);
    if (match?.[1]) {
      const src = decodeHtml(match[1]).trim();
      if (isAllowedImage(src)) return src;
    }
  }
  return null;
}

function isAllowedImage(value) {
  try {
    const url = new URL(value, SITE_ORIGIN);
    if (url.protocol !== 'https:') return false;
    if (!['oceanliners.net', 'www.oceanliners.net'].includes(url.hostname.toLowerCase())) return false;
    return /\.(?:jpe?g|png|webp)(?:$|\?)/i.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

function absoluteSiteUrl(value) {
  const url = new URL(value, SITE_ORIGIN);
  if (url.protocol !== 'https:') throw new Error('Non-HTTPS Ship Archive URL rejected.');
  const host = url.hostname.toLowerCase();
  if (!['oceanliners.net', 'www.oceanliners.net'].includes(host)) {
    throw new Error('Ship Archive URL host rejected.');
  }
  url.hash = '';
  return url.toString();
}

function rawRepoUrl(href) {
  const path = String(href || '').replace(/^\/+/, '');
  if (!path.startsWith('ships/')) throw new Error('Unexpected ship page path.');
  return `${REPO_RAW_BASE}/${path}`;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'text/plain,text/html,*/*;q=0.8',
        'user-agent': 'CuratorOS-Random-Ship/1.1 (+https://curator.oceanliners.net/)'
      },
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function shuffledIndexes(length) {
  const values = Array.from({ length }, (_, i) => i);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]*>/g, '');
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow, noarchive'
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders()
    }
  });
}
