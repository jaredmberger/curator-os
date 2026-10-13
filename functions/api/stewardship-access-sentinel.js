// STAGING EXPERIMENT ONLY. Never merge to main or use with real Stewardship data.
// Deliberately contains no bindings, tokens, identities, network calls or source data.
export function onRequest({request}) {
  if (request.method !== 'GET') return new Response(null, {status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});
  return new Response(JSON.stringify({kind:'stewardship-access-sentinel',environment:'staging-test-only',sensitiveData:false}), {
    status:200,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'}
  });
}
