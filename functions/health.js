export async function onRequest(context) {
  const request = context.request;
  const origin = request.headers.get("Origin") || "";

  const allowedOrigins = new Set([
    "https://oceanliners.net",
    "https://www.oceanliners.net"
  ]);

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff"
  });

  if (allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    headers.set("Allow", "GET, HEAD, OPTIONS");
    return new Response(
      request.method === "HEAD"
        ? null
        : JSON.stringify({ ok: false, service: "CuratorOS", error: "method_not_allowed" }),
      { status: 405, headers }
    );
  }

  const payload = {
    ok: true,
    service: "CuratorOS",
    status: "online",
    checkedAt: new Date().toISOString()
  };

  return new Response(
    request.method === "HEAD" ? null : JSON.stringify(payload),
    { status: 200, headers }
  );
}
