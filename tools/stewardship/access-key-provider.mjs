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
    const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!assertion || assertion.includes(',') || assertion.length > 16384) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
     response = await fetchKeys(fixedUrl, {
      method: 'GET', headers: {accept: 'application/json'},
      redirect: 'manual', signal: controller.signal,
     });
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
