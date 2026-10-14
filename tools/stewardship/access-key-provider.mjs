// Cloudflare Access operator-authorizer factory. Not wired to any route or
// binding. All policy values come from trusted configuration, never a request.
import { verifyStewardshipAccessJwt } from './access-jwt-verifier.mjs';

export function createStewardshipOperatorAuthorizer({policy, fetchKeys = fetch, timeoutMs = 4000}) {
 if (!policy || typeof policy.issuer !== 'string' ||
     !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(policy.issuer) ||
     typeof policy.audience !== 'string' || !policy.audience ||
     !Array.isArray(policy.allowedEmails) || !policy.allowedEmails.length ||
     !policy.allowedEmails.every(x => typeof x === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) ||
     typeof fetchKeys !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000)
   throw new TypeError('Invalid trusted Access authorizer configuration');

 const fixedUrl = policy.issuer + '/cdn-cgi/access/certs';
 return Object.freeze({
  async authorize(request) {
   try {
    if (!request || !(request.headers instanceof Headers)) return false;
    // Duplicate assertions, ambiguous comma-joined values and non-GET are denied.
    if (request.method !== 'GET') return false;
    // Pages Functions may receive a signed Cloudflare Access session cookie
    // rather than the assertion header. Either source must pass the SAME
    // cryptographic issuer, audience, expiry, and operator-email checks below.
    const header = request.headers.get('Cf-Access-Jwt-Assertion');
    const cookieHeader = request.headers.get('cookie') || '';
    const matches = [...cookieHeader.matchAll(/(?:^|;\s*)CF_Authorization=([^;]*)/g)];
    // Reject ambiguous/conflicting credentials, duplicate session cookies,
    // and malformed JWT material. Never authorize on cookie presence alone.
    if (matches.length > 1 || (header && matches.length)) return false;
    const assertion = header || (matches.length === 1 ? matches[0][1] : null);
    if (!assertion || assertion.includes(',') || assertion.length > 16384 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(assertion)) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
     response = await Promise.race([fetchKeys(fixedUrl, {
      method: 'GET', headers: {accept: 'application/json'},
      redirect: 'manual', signal: controller.signal,
     }), new Promise((_, reject) => { controller.signal.addEventListener('abort', () => reject(new Error('key fetch timeout')), {once:true}); })]);
     if (!response || response.status !== 200 ||
         !(response.headers.get('content-type') || '').toLowerCase().includes('application/json'))
       return false;
     const size = Number(response.headers.get('content-length'));
     if (Number.isFinite(size) && size > 65536) return false;
     const text = await response.text();
     if (text.length > 65536) return false;
     const keys = JSON.parse(text);
     if (!keys || !Array.isArray(keys.keys) || keys.keys.length > 20) return false;
     return await verifyStewardshipAccessJwt(assertion, policy, keys);
    } finally { clearTimeout(timer); }
   } catch { return false; }
  },
 });
}
