const THIS_DAY_SOURCE_URLS = [
  'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/assets/this-day-ocean-liners.js',
  'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/assets/this-day-ocean-liners-additions.js'
];
const ARCHIVE_SOURCE_URL = 'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/ships/ships.html';
const REPO_RAW_BASE = 'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main';
const SITE_ORIGIN = 'https://www.oceanliners.net';
const TIMEOUT_MS = 10000;

export async function onRequestGet(context) {
  try {
    const requestUrl = new URL(context.request.url);
    const requestedDate = normalizeRequestedDate(requestUrl.searchParams.get('date'));
    const dateKey = requestedDate || chicagoDateKey();

    const sources = await Promise.all(
      THIS_DAY_SOURCE_URLS.map((url) => fetchText(url, 'CuratorOS-On-This-Day/1.1'))
    );
    const events = sources.flatMap((source) => parseEventsForDate(source, dateKey));

    if (!events.length) {
      return json({
        ok: true,
        service: 'CuratorOS On This Day',
        generatedAt: new Date().toISOString(),
        dateKey,
        dateLabel: dateLabelFromKey(dateKey),
        hasEvent: false,
        event: null
      });
    }

    const event = chooseEvent(events);
    let image = '';
    let imageSmall = '';
    let page = absoluteSiteUrlOrEmpty(event.relatedUrl);

    try {
      const archiveHtml = await fetchText(ARCHIVE_SOURCE_URL, 'CuratorOS-On-This-Day/1.1');
      const ships = parseArchiveCards(archiveHtml);
      const match = findShipMatch(ships, event.ship);

      if (match) {
        const pageUrl = absoluteSiteUrl(match.href);
        const pageHtml = await fetchText(rawRepoUrl(match.href), 'CuratorOS-On-This-Day/1.1');
        const imagePath = parseHeroImage(pageHtml);

        if (imagePath) {
          image = absoluteSiteUrl(imagePath);
          imageSmall = `https://curator.oceanliners.net/api/ship-image?src=${encodeURIComponent(image)}`;
        }

        if (!page) page = pageUrl;
      }
    } catch {
      // Text event remains useful even if image enrichment fails.
    }

    return json({
      ok: true,
      service: 'CuratorOS On This Day',
      generatedAt: new Date().toISOString(),
      dateKey,
      dateLabel: dateLabelFromKey(dateKey),
      hasEvent: true,
      event: {
        year: event.year,
        title: event.title,
        ship: event.ship,
        category: event.category,
        summary: event.summary,
        whyItMatters: event.whyItMatters,
        significance: event.significance,
        page,
        image,
        imageSmall
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: error?.message || String(error)
    }, 502);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function normalizeRequestedDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(text)) {
    throw new Error('date must use MM-DD format.');
  }
  return text;
}

function chicagoDateKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!month || !day) throw new Error('Could not determine current Central date.');
  return `${month}-${day}`;
}

function dateLabelFromKey(key) {
  const [month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(2024, month - 1, day, 12));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function parseEventsForDate(source, dateKey) {
  const needle = `"${dateKey}"`;
  const keyIndex = source.indexOf(needle);
  if (keyIndex < 0) return [];

  const arrayStart = source.indexOf('[', keyIndex + needle.length);
  if (arrayStart < 0) return [];

  const arrayEnd = findMatching(source, arrayStart, '[', ']');
  if (arrayEnd < 0) return [];

  const body = source.slice(arrayStart + 1, arrayEnd);
  const objects = splitTopLevelObjects(body);
  return objects.map(parseEventObject).filter(Boolean);
}

function splitTopLevelObjects(text) {
  const objects = [];
  let inString = false;
  let escape = false;
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function findMatching(text, start, openChar, closeChar) {
  let inString = false;
  let escape = false;
  let depth = 0;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function parseEventObject(text) {
  const title = readStringField(text, 'title');
  if (!title) return null;

  return {
    year: readNumberField(text, 'year'),
    title,
    ship: readStringField(text, 'ship'),
    category: readStringField(text, 'category'),
    summary: readStringField(text, 'summary'),
    whyItMatters: readStringField(text, 'whyItMatters'),
    relatedUrl: readStringField(text, 'relatedUrl'),
    significance: readStringField(text, 'significance')
  };
}

function readStringField(text, field) {
  const re = new RegExp(`\\b${field}\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 's');
  const match = text.match(re);
  if (!match) return '';
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

function readNumberField(text, field) {
  const re = new RegExp(`\\b${field}\\s*:\\s*(\\d+)`);
  const match = text.match(re);
  return match ? Number(match[1]) : 0;
}

function chooseEvent(events) {
  const rank = { high: 3, medium: 2, low: 1 };
  return [...events].sort((a, b) => {
    const significance = (rank[b.significance] || 0) - (rank[a.significance] || 0);
    if (significance) return significance;
    return (b.year || 0) - (a.year || 0);
  })[0];
}

function parseArchiveCards(html) {
  const rows = [];
  const cardRe = /<article\b[^>]*class=["'][^"']*guide-card[^"']*["'][^>]*data-line=["']([^"']*)["'][^>]*data-year=["']([^"']*)["'][^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = cardRe.exec(html))) {
    const body = match[3];
    const link = body.match(/<a\b[^>]*class=["'][^"']*guide-title[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;

    const href = decodeHtml(link[1]).trim();
    const name = decodeHtml(stripTags(link[2])).replace(/\s+/g, ' ').trim();
    if (!href.startsWith('/ships/') || !name) continue;

    rows.push({ href, name });
  }

  return rows;
}

function findShipMatch(ships, shipName) {
  const target = normalizeShipName(shipName);
  if (!target) return null;

  return ships.find((ship) => normalizeShipName(ship.name) === target)
    || ships.find((ship) => normalizeShipName(ship.name).includes(target))
    || ships.find((ship) => target.includes(normalizeShipName(ship.name)))
    || null;
}

function normalizeShipName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:rms|ss|mv|ms|ts|tss|ps)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHeroImage(html) {
  const preferred = [
    /<img\b[^>]*class=["'][^"']*(?:hero-img|ship-photo)[^"']*["'][^>]*src=["']([^"']+)["']/i,
    /<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /<img\b[^>]*class=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/i
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

function absoluteSiteUrlOrEmpty(value) {
  if (!value) return '';
  try {
    return absoluteSiteUrl(value);
  } catch {
    return '';
  }
}

function absoluteSiteUrl(value) {
  const url = new URL(value, SITE_ORIGIN);
  if (url.protocol !== 'https:') throw new Error('Non-HTTPS OceanLiners.net URL rejected.');
  const host = url.hostname.toLowerCase();
  if (!['oceanliners.net', 'www.oceanliners.net'].includes(host)) {
    throw new Error('OceanLiners.net URL host rejected.');
  }
  url.hash = '';
  return url.toString();
}

function rawRepoUrl(href) {
  const path = String(href || '').replace(/^\/+/, '');
  if (!path.startsWith('ships/')) throw new Error('Unexpected ship page path.');
  return `${REPO_RAW_BASE}/${path}`;
}

async function fetchText(url, userAgent) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'text/plain,text/html,*/*;q=0.8',
        'user-agent': `${userAgent} (+https://curator.oceanliners.net/)`
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
