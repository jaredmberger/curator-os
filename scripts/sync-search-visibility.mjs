#!/usr/bin/env node
// Daily read-only Search Console performance import into CuratorOS.
// Needs service account authorized for the Search Console property.
import {createSign} from 'node:crypto';
const config=JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON||'null');
const ingestToken=process.env.SEARCH_VISIBILITY_INGEST_TOKEN;
if(!config?.client_email||!config?.private_key||!ingestToken)throw Error('Missing GSC_SERVICE_ACCOUNT_JSON or SEARCH_VISIBILITY_INGEST_TOKEN');
const property='sc-domain:oceanliners.net';
const endpoint='https://curator-os.pages.dev/api/search-visibility';
const base64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
const t=Math.floor(Date.now()/1000);
const claim={iss:config.client_email,scope:'https://www.googleapis.com/auth/webmasters.readonly',aud:'https://oauth2.googleapis.com/token',iat:t,exp:t+3600};
const unsigned=base64({alg:'RS256',typ:'JWT'})+'.'+base64(claim);
const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();
const jwt=unsigned+'.'+signer.sign(config.private_key,'base64url');
const tokenResult=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
 body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(15000)});
if(!tokenResult.ok)throw Error('Google OAuth request rejected with HTTP '+tokenResult.status);
const {access_token}=await tokenResult.json();
if(!access_token)throw Error('Google did not return an access token');
const end=new Date();end.setUTCDate(end.getUTCDate()-3);
const start=new Date(end);start.setUTCDate(start.getUTCDate()-34);
const date=d=>d.toISOString().slice(0,10);
const search=await fetch('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(property)+'/searchAnalytics/query',{
 method:'POST',headers:{Authorization:'Bearer '+access_token,'content-type':'application/json'},
 body:JSON.stringify({startDate:date(start),endDate:date(end),dimensions:['date'],rowLimit:1000,dataState:'final'}),
 signal:AbortSignal.timeout(20000)});
if(!search.ok)throw Error('Search Console query rejected with HTTP '+search.status+'; ensure the service account has property access');
const result=await search.json();
const rows=(result.rows||[]).map(x=>({date:x.keys?.[0],clicks:x.clicks,impressions:x.impressions,average_position:x.position}));
if(rows.length===0)throw Error('No final GSC rows returned; refusing to overwrite dashboard freshness');
const delivered=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+ingestToken,'content-type':'application/json'},
 body:JSON.stringify({property,source:'google-search-console-api',rows}),signal:AbortSignal.timeout(20000)});
if(!delivered.ok)throw Error('CuratorOS ingest rejected with HTTP '+delivered.status);
const ack=await delivered.json();if(!ack.ok)throw Error('CuratorOS did not acknowledge ingestion');
console.log(JSON.stringify({importedRows:rows.length,firstDate:rows[0].date,lastDate:rows.at(-1).date,storedRows:ack.rows,version:ack.version}));
