const app=document.querySelector('#app');
const helpButton=document.querySelector('[data-view="help"]');
let scheduled=false;

const WORKSPACES=[
  ['Project Records','Browse and locally edit the normalized knowledge corpus. Every edit remains reviewable and reversible.'],
  ['Extract Knowledge','Turn one saved or pasted webpage into reviewed candidate facts, relationships, provenance, and Project Record changes.'],
  ['Build Corpus','Extract many saved HTML pages into a persistent batch review queue.'],
  ['Site / Knowledge Sync','Use site-index.json as the website manifest and identify new, changed, unmatched, or unextracted pages.'],
  ['Entity Resolution','Consolidate duplicate companies, organizations, and people around canonical stable IDs while preserving aliases.'],
  ['Knowledge Graph','Navigate incoming, outgoing, and second-hop relationships between Project Records.'],
  ['Knowledge Intelligence','Find builder fleets, operator fleets, classes, routes, graph hubs, and knowledge-quality gaps derived from the corpus.'],
  ['Knowledge Explorer','Query standardized records and save useful result sets as reusable knowledge collections.'],
  ['Publication Composer','Turn a saved collection into a structured publication brief and reviewable semantic HTML draft.']
];

const FAQ=[
  ['What is CuratorOS now?','CuratorOS is the structured knowledge layer underneath Ocean Liner Curator. It extracts, standardizes, connects, audits, queries, and recombines project knowledge so webpages can be generated from records rather than treated as the records themselves.'],
  ['Is site-index.json the knowledge base?','No. site-index.json is the website manifest—the inventory of what exists publicly. Project Records are the normalized knowledge corpus.'],
  ['Does a webpage equal one record?','Not necessarily. A webpage may provide evidence for one record, multiple records, or only part of a record. The page is provenance; the record represents the underlying entity or item.'],
  ['Does CuratorOS change the live website?','Not automatically. Extraction, entity resolution, local editing, intelligence, and composition are deliberately review-first. Future publishing should happen through explicit source diffs and GitHub pull requests.'],
  ['What is a knowledge collection?','A saved set of stable Project Record IDs created from a query or a derived intelligence cluster. Collections are reusable inputs to Publication Composer.'],
  ['Why resolve entities?','Canonical identities stop variants such as “Harland and Wolff” and “Harland & Wolff” from fragmenting relationships and derived fleets.'],
  ['What is Knowledge Intelligence?','It is the derived layer that notices useful groupings already implicit in standardized facts and relationships and offers them as research or publication opportunities.'],
  ['What happened to Full Workspaces?','The legacy launcher was retired after the native knowledge workflow replaced its practical role. The old modules remain in the repository only as historical/reference code.'],
  ['Where should I start?','For site-wide maintenance, start with Site / Knowledge Sync. For one page, use Extract Knowledge. For many saved pages, use Build Corpus. Once records are clean and connected, use Knowledge Explorer or Knowledge Intelligence, then Publication Composer.'],
  ['Where is the full manual?','Open Knowledge Base Guide in the sidebar for the complete architecture, workflow, safety model, and FAQ.']
];

const observer=new MutationObserver(()=>schedule());
observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
helpButton?.addEventListener('click',()=>setTimeout(renderHelp,0));
window.addEventListener('hashchange',schedule);
schedule();

function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;if(helpButton?.classList.contains('active'))renderHelp();});}

function renderHelp(){
  if(!app||!helpButton?.classList.contains('active'))return;
  if(app.dataset.currentHelp==='knowledge-system')return;
  app.dataset.currentHelp='knowledge-system';
  app.innerHTML=`
    <section class="panel hero">
      <div><span class="eyebrow">Help & FAQ</span><h3>CuratorOS is the knowledge layer beneath Ocean Liner Curator</h3><p>Use it to turn the existing website and project data into standardized, connected, reusable knowledge—then derive research collections and reviewable publication drafts from that knowledge.</p></div>
      <div class="actions"><a href="./knowledge-base-guide.html">Open full Knowledge Base Guide</a></div>
    </section>
    <section class="panel">
      <span class="eyebrow">The current pipeline</span>
      <h4>From website corpus to reusable publication knowledge</h4>
      <p><strong>OceanLiners.net → site-index.json → extraction → Project Records → entity resolution → Knowledge Graph → Knowledge Intelligence / Knowledge Explorer → Publication Composer.</strong></p>
      <p>CuratorOS is review-first: it does not silently rewrite source HTML or publish directly to the live site.</p>
    </section>
    <section class="panel">
      <span class="eyebrow">Workspace guide</span><h4>What each part is for</h4>
      <div class="findings">${WORKSPACES.map(([name,description])=>`<article class="finding"><h4>${esc(name)}</h4><p>${esc(description)}</p></article>`).join('')}</div>
    </section>
    <section class="panel">
      <span class="eyebrow">Frequently asked questions</span><h4>Common CuratorOS questions</h4>
      <div class="findings">${FAQ.map(([question,answer])=>`<article class="finding"><h4>${esc(question)}</h4><p>${esc(answer)}</p></article>`).join('')}</div>
    </section>
    <section class="panel">
      <span class="eyebrow">Command center</span><h4>Useful commands still available</h4>
      <div class="findings">
        ${command('findings','Open the Findings view.')}
        ${command('records','Open Project Records.')}
        ${command('backup','Download a full local CuratorOS backup.')}
        ${command('load catalog','Choose a supported project/catalog JSON file.')}
        ${command('import scan','Import a supported findings scan report.')}
        ${command('search <term>','Search Findings.')}
        ${command('site health','Open the Site Health tool.')}
        ${command('indexer','Open Curator Indexer.')}
        ${command('page studio','Open Page Studio.')}
      </div>
    </section>`;
}

function command(name,description){return `<article class="finding"><h4>${esc(name)}</h4><p>${esc(description)}</p></article>`;}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
