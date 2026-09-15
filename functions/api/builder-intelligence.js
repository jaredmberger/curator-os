const SOURCE_URL='https://oceanliners.net/tools/search/builders-data.json';

export async function onRequestGet(){
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=setTimeout(()=>controller?.abort(),6000);
  try{
    const response=await fetch(SOURCE_URL,{headers:{'accept':'application/json'},redirect:'follow',signal:controller?.signal});
    if(!response.ok)throw new Error(`Source returned HTTP ${response.status}`);
    const data=await response.json();
    const summary=data?.summary||{};
    const builders=Array.isArray(data?.builders)?data.builders:[];
    const shipGuides=Number(summary.shipGuides||0);
    const guidesWithBuilder=Number(summary.guidesWithBuilder||0);
    const canonicalBuilders=Number(summary.canonicalBuilders||builders.length||0);
    const topBuilders=[...builders]
      .sort((a,b)=>Number(b?.shipCount||0)-Number(a?.shipCount||0)||String(a?.name||'').localeCompare(String(b?.name||'')))
      .slice(0,8)
      .map(builder=>({
        id:String(builder?.id||''),
        name:String(builder?.name||'Unknown builder'),
        shipCount:Number(builder?.shipCount||0),
        firstLaunchYear:builder?.firstLaunchYear||null,
        lastLaunchYear:builder?.lastLaunchYear||null,
        locations:Array.isArray(builder?.locations)?builder.locations.slice(0,6):[]
      }));

    return json({
      ok:true,
      source:'OceanLiners.net ship-guide builder dataset',
      sourceUrl:SOURCE_URL,
      generatedAt:data?.generatedAt||null,
      summary:{
        shipGuides,
        guidesWithBuilder,
        guidesMissingBuilder:Math.max(0,shipGuides-guidesWithBuilder),
        canonicalBuilders
      },
      topBuilders
    },200);
  }catch(error){
    return json({ok:false,error:'Builder intelligence feed is temporarily unavailable.',detail:String(error?.message||error)},503);
  }finally{
    clearTimeout(timer);
  }
}

function json(value,status){
  return new Response(JSON.stringify(value,null,2),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff'
    }
  });
}
