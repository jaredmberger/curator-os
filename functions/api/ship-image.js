const SITE_ORIGIN = 'https://www.oceanliners.net';
const TIMEOUT_MS = 15000;

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const src = requestUrl.searchParams.get('src') || '';

  let source;
  try {
    source = new URL(src, SITE_ORIGIN);
  } catch {
    return text('Invalid image URL.', 400);
  }

  const host = source.hostname.toLowerCase();
  if (
    source.protocol !== 'https:' ||
    !['oceanliners.net', 'www.oceanliners.net'].includes(host) ||
    !/^\/ships\//.test(source.pathname) ||
    !/\.(?:jpe?g|png|webp)$/i.test(source.pathname)
  ) {
    return text('Image URL is not an allowed Ship Archive image.', 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(source.toString(), {
      method: 'GET',
      headers: {
        accept: 'image/jpeg,image/*;q=0.8',
        'user-agent': 'CuratorOS-Hardware-Ship-Image/1.0 (+https://curator.oceanliners.net/)'
      },
      signal: controller.signal,
      cf: {
        cacheTtl: 3600,
        cacheEverything: true,
        image: {
          width: 420,
          height: 190,
          fit: 'cover',
          gravity: 'center',
          quality: 72,
          format: 'jpeg'
        }
      }
    });

    if (!upstream.ok) {
      return text(`Image upstream returned HTTP ${upstream.status}.`, 502);
    }

    const headers = new Headers();
    headers.set('content-type', upstream.headers.get('content-type') || 'image/jpeg');
    headers.set('cache-control', 'public, max-age=3600');
    headers.set('access-control-allow-origin', '*');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('x-robots-tag', 'noindex, nofollow, noarchive');

    const length = upstream.headers.get('content-length');
    if (length) headers.set('content-length', length);

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'Image request timed out.'
      : (error?.message || String(error));
    return text(message, 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

function text(value, status) {
  return new Response(value, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow, noarchive'
    }
  });
}
