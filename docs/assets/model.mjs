export const VERSION = '2026-11-14.1';
const REDIRECTS = new Set([301,302,303,307,308]);
export function httpURL(value, base) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\u007f]/.test(value.trim())) throw new Error('Enter an HTTP(S) URL without spaces or control characters.');
  const url = base ? new URL(value.trim(), base) : new URL(value.trim());
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('Only HTTP(S) URLs without embedded credentials are supported.');
  return url;
}
const key = value => { const u=httpURL(value);u.hash='';return u.href; };
const required = ['recordId','context','prompt','capturedAt','inspectedAt','label','rawHref','artifactRef'];
export function inspect(input) {
  const record=structuredClone(input), errors=[], gaps=[], route=[];
  for(const f of required) if(typeof record[f]!=='string'||!record[f].trim()) gaps.push(`Missing ${f}.`);
  for(const f of ['capturedAt','inspectedAt']) if(record[f] && (!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(record[f]) || !Number.isFinite(Date.parse(record[f])))) errors.push(`${f} must be an ISO date-time with a time zone.`);
  if(record.capturedAt && record.inspectedAt && Date.parse(record.inspectedAt)<Date.parse(record.capturedAt)) errors.push('Inspection precedes answer capture.');
  let expected=null;
  if(record.rawHref) {try{expected=key(record.rawHref);}catch(e){errors.push(`Original URL: ${e.message}`);}}
  if(record.finalUrl) {try{httpURL(record.finalUrl);}catch(e){errors.push(`Final URL: ${e.message}`);}}
  if(record.canonicalUrl) {try{httpURL(record.canonicalUrl);}catch(e){errors.push(`Canonical note: ${e.message}`);}}
  let hops=record.hops;
  if(typeof hops==='string') {try{hops=JSON.parse(hops);}catch{errors.push('Response chain must be a JSON array.');hops=[];}}
  if(!Array.isArray(hops)){errors.push('Response chain must be a JSON array.');hops=[];}
  if(hops.length>30){errors.push('This worksheet accepts at most 30 response rows.');hops=[];}
  if(!hops.length)gaps.push('No response chain supplied.');
  const visited=new Set();let terminal=null, stopped=false;
  for(let i=0;i<hops.length;i++) {
    const h=hops[i];
    if(!h||typeof h!=='object'||Array.isArray(h)){errors.push(`Response ${i+1} must be an object.`);continue;}
    let url;
    try{url=key(h.url);}catch(e){errors.push(`Response ${i+1} URL: ${e.message}`);continue;}
    if(stopped) errors.push(`Response ${i+1} follows a terminal or unresolved response.`);
    if(expected && url!==expected)errors.push(`Response ${i+1} does not match the expected next URL.`);
    if(visited.has(url))errors.push(`Response ${i+1} repeats an earlier URL: possible loop in the supplied chain.`);
    visited.add(url);
    const status=h.status;
    if(status!==null && (!Number.isInteger(status)||status<100||status>599)){errors.push(`Response ${i+1} status must be an integer from 100 to 599, or null for unknown.`);}
    let next=null;
    if(REDIRECTS.has(status)) {
      if(typeof h.location!=='string'||!h.location.trim()){gaps.push(`Response ${i+1} is a redirect without a recorded Location.`);stopped=true;}
      else try{next=key(httpURL(h.location,h.url).href);}catch(e){errors.push(`Response ${i+1} Location: ${e.message}`);stopped=true;}
      if(next && visited.has(next))errors.push(`Response ${i+1} redirects to an earlier URL: possible loop in the supplied chain.`);
      if(i===hops.length-1 && next)gaps.push('The next URL has no recorded response.');
    } else {
      stopped=true;
      if(Number.isInteger(status)&&status>=200&&status<=299)terminal=url;
      else gaps.push(`Response ${i+1} has no successful terminal response; destination remains unresolved.`);
    }
    route.push({step:i+1,url:h.url,status:status??null,location:h.location??'',resolvedNext:next});
    expected=next;
  }
  if(!record.finalUrl?.trim())gaps.push('No observed final URL supplied.');
  if(terminal && record.finalUrl)try{if(key(record.finalUrl)!==terminal)errors.push('Declared final URL differs from the terminal response URL.');}catch{/* already reported */}
  const unique=xs=>[...new Set(xs)];
  return {ruleVersion:VERSION,record,classification:errors.length?'CONTRADICTORY':gaps.length?'INCOMPLETE':'INPUT_CONSISTENT',errors:unique(errors),gaps:unique(gaps),route,terminalUrl:terminal,canonicalUsedForRoute:false,liveVerificationPerformed:false,sourceSupportChecked:false};
}
export function toJSON(result){return JSON.stringify(result,null,2)+'\n';}
export function toCSV(result){
  const safe=x=>{let s=String(x??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const fields=['record_id','classification','context','prompt','captured_at','inspected_at','display_label','raw_href','artifact_ref','declared_final_url','canonical_note','step','response_url','status','location','resolved_next','errors','gaps'];
  const r=result.record;
  const rows=(result.route.length?result.route:[{}]).map(h=>[r.recordId,result.classification,r.context,r.prompt,r.capturedAt,r.inspectedAt,r.label,r.rawHref,r.artifactRef,r.finalUrl,r.canonicalUrl,h.step,h.url,h.status,h.location,h.resolvedNext,result.errors.join(' | '),result.gaps.join(' | ')]);
  return [fields,...rows].map(row=>row.map(safe).join(',')).join('\r\n')+'\r\n';
}
const base={recordId:'C-73',context:'Illustrative engine / US / EN',prompt:'Fictional query: how should a buyer compare these providers?',capturedAt:'2026-11-13T10:00:00Z',inspectedAt:'2026-11-13T10:05:00Z',label:'publisher.example / guide',rawHref:'https://publisher.example/guide?ref=answer',artifactRef:'fictional-answer-c73.txt',finalUrl:'https://publisher.example/guide?ref=answer',canonicalUrl:''};
export const CASES=[
  {id:'direct',name:'Direct response',record:{...base,hops:[{url:base.rawHref,status:200}]}},
  {id:'redirect',name:'Relative redirect',record:{...base,finalUrl:'https://publisher.example/archive/guide?ref=answer',hops:[{url:base.rawHref,status:301,location:'/archive/guide?ref=answer'},{url:'https://publisher.example/archive/guide?ref=answer',status:200}]}},
  {id:'missing',name:'Missing Location',record:{...base,finalUrl:'',hops:[{url:base.rawHref,status:302}]}},
  {id:'loop',name:'Recorded loop',record:{...base,finalUrl:'',hops:[{url:base.rawHref,status:302,location:'/other'},{url:'https://publisher.example/other',status:302,location:base.rawHref}]}},
  {id:'mismatch',name:'Different final URL',record:{...base,finalUrl:'https://different.example/product',canonicalUrl:'https://different.example/product',hops:[{url:base.rawHref,status:200}]}}
];
