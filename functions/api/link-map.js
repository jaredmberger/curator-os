const SITE='https://oceanliners.net';
const CACHE_KEY='curatoros-link-map-v1';
const CACHE_TTL_SECONDS=60*60*6;
const MAX_PAGES=1200;

export async function onRequestGet(context){
  try{
    const requestUrl=new URL(context.request.url);
    const force=requestUrl.searchParams.get('refresh')==='1';
    const cache=context.env.CURATOROS_LINK_MAP||context.env.CURATOROS_RECORDS||null;
    if(!force&&cache){
      const cached=await cache.get(CACHE_KEY,'json');
      if(cached?.generatedAt&&Array.isArray(cached.pages)&&Array.isArray(cached.edges)){
        const age=Date.now()-new Date(cached.generatedAt).getTime();
        if(Number.isFinite(age)&&age<CACHE_TTL_SECONDS*1000)return json(cached,200);
      }
    }
    const result=await crawlSite();
    if(cache)await cache.put(CACHE_KEY,JSON.stringify(result),{expirationTtl:CACHE_TTL_SECONDS});
    return json(result,200);
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
}

async function crawlSite(){
  const discovered=new Set(['/']);
  const queue=[];
  const sitemapUrls=await getSitemapUrls();
  sitemapUrls.forEach(u=>discovered.add(u));
  queue.push(...discovered);

  const pages=[];
  const edgeKeys=new Set();
  const edges=[];
  let cursor=0;
  const workers=Array.from({length:8},()=>worker());
  await Promise.all(workers);

  async function worker(){
    while(true){
      const index=cursor++;
      if(index>=queue.length||pages.length>=MAX_PAGES)return;
      const path=queue[index];
      const url=new URL(path,SITE).href;
      let res;
      try{res=await fetch(url,{headers:{'user-agent':'CuratorOS-LinkMap/1.0 (+https://oceanliners.net/)','accept':'text/html,application/xhtml+xml'}})}catch{continue}
      const type=res.headers.get('content-type')||'';
      if(!res.ok||!type.includes('text/html'))continue;
      const html=await res.text();
      const title=extractTitle(html)||friendlyTitle(path);
      const canonical=normalizeUrl(extractCanonical(html)||url);
      if(!canonical)continue;
      const links=extractLinks(html,url);
      const outgoing=[];
      for(const link of links){
        const normalized=normalizeUrl(link);
        if(!normalized)continue;
        outgoing.push(normalized);
        const key=`${canonical}>${normalized}`;
        if(!edgeKeys.has(key)){edgeKeys.add(key);edges.push({source:canonical,target:normalized})}
        const p=new URL(normalized).pathname+new URL(normalized).search;
        if(!discovered.has(p)&&discovered.size<MAX_PAGES){discovered.add(p);queue.push(p)}
      }
      pages.push({url:canonical,title,status:res.status,outgoingCount:new Set(outgoing).size});
    }
  }

  const pageUrls=new Set(pages.map(p=>p.url));
  const internalEdges=edges.filter(e=>pageUrls.has(e.source)&&pageUrls.has(e.target));
  pages.sort((a,b)=>a.url.localeCompare(b.url));
  internalEdges.sort((a,b)=>a.source.localeCompare(b.source)||a.target.localeCompare(b.target));
  return {site:SITE,generatedAt:new Date().toISOString(),pages,edges:internalEdges,limits:{maxPages:MAX_PAGES},source:'live-crawl'};
}

async function getSitemapUrls(){
  const candidates=['/sitemap.xml','/sitemap_index.xml'];
  const out=new Set();
  for(const candidate of candidates){
    try{
      const res=await fetch(new URL(candidate,SITE),{headers:{'user-agent':'CuratorOS-LinkMap/1.0'}});
      if(!res.ok)continue;
      const xml=await res.text();
      const locs=[...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m=>decodeEntities(m[1].trim()));
      for(const loc of locs){
        if(loc.endsWith('.xml')){
          try{
            const child=await fetch(loc,{headers:{'user-agent':'CuratorOS-LinkMap/1.0'}});
            if(!child.ok)continue;
            const childXml=await child.text();
            for(const m of childXml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)){
              const n=normalizeUrl(decodeEntities(m[1].trim()));if(n)out.add(new URL(n).pathname+new URL(n).search);
            }
          }catch{}
        }else{
          const n=normalizeUrl(loc);if(n)out.add(new URL(n).pathname+new URL(n).search);
        }
      }
      if(out.size)break;
    }catch{}
  }
  return [...out].slice(0,MAX_PAGES);
}

function extractLinks(html,base){
  const links=[];
  const re=/<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  for(const m of html.matchAll(re)){
    const raw=(m[1]??m[2]??m[3]??'').trim();
    if(!raw||raw.startsWith('#')||/^(mailto:|tel:|javascript:|data:)/i.test(raw))continue;
    try{links.push(new URL(decodeEntities(raw),base).href)}catch{}
  }
  return [...new Set(links)];
}

function normalizeUrl(value){
  try{
    const u=new URL(value,SITE);
    if(!['http:','https:'].includes(u.protocol))return null;
    if(u.hostname!=='oceanliners.net'&&u.hostname!=='www.oceanliners.net')return null;
    u.protocol='https:';u.hostname='oceanliners.net';u.hash='';
    for(const key of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(key))u.searchParams.delete(key);
    let path=u.pathname.replace(/\/index\.html?$/i,'/').replace(/\/{2,}/g,'/');
    if(path.length>1)path=path.replace(/\/$/,'');
    if(/\.(?:jpg|jpeg|png|gif|webp|svg|pdf|zip|xml|json|js|css|ico|txt|mp4|webm|mp3|woff2?|ttf)$/i.test(path))return null;
    u.pathname=path||'/';
    return u.href;
  }catch{return null}
}

function extractTitle(html){const m=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);return m?stripTags(decodeEntities(m[1])).replace(/\s+/g,' ').trim():''}
function extractCanonical(html){const m=html.match(/<link\b[^>]*rel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i)||html.match(/<link\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/i);return m?decodeEntities(m[1]):''}
function stripTags(s){return s.replace(/<[^>]*>/g,'')}
function decodeEntities(s){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function friendlyTitle(path){if(path==='/')return'Ocean Liner Curator';return path.split('/').filter(Boolean).pop().replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function json(value,status){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
