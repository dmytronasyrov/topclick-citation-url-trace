import {inspect,toJSON,toCSV,CASES} from './model.mjs';
const $=id=>document.getElementById(id);
const names=['recordId','context','prompt','capturedAt','inspectedAt','label','rawHref','artifactRef','finalUrl','canonicalUrl','hops'];
let current;
function load(record){for(const n of names)$(n).value=n==='hops'?JSON.stringify(record[n],null,2):record[n]??'';update();}
function update(){
  const data=Object.fromEntries(names.map(n=>[n,$(n).value]));
  current=inspect(data);
  const labels={INPUT_CONSISTENT:'Input consistent',INCOMPLETE:'Incomplete evidence',CONTRADICTORY:'Contradictory input'};
  $('classification').textContent=labels[current.classification];$('classification').dataset.state=current.classification;
  $('reasons').replaceChildren();
  const reasons=[...current.errors,...current.gaps];
  for(const message of reasons.length?reasons:['The supplied rows connect to the declared final URL. This is an input check only.']){const li=document.createElement('li');li.textContent=message;$('reasons').append(li);}
  $('route').replaceChildren();
  for(const row of current.route){const tr=document.createElement('tr');for(const v of [row.step,row.url,row.status??'Unknown',row.location||'Not recorded',row.resolvedNext||'—']){const td=document.createElement('td');td.textContent=v;tr.append(td);}$('route').append(tr);}
  $('record-preview').textContent=toJSON(current);
}
$('evidence-form').addEventListener('submit',e=>{e.preventDefault();update();$('classification').focus();});
$('evidence-form').addEventListener('input',update);
$('case').addEventListener('change',()=>load(CASES.find(c=>c.id===$('case').value).record));
$('reset').addEventListener('click',()=>{$('case').value='direct';load(CASES[0].record);$('message').textContent='Fictional direct-response case restored.';});
function download(format){update();const content=format==='json'?toJSON(current):toCSV(current);const blob=new Blob([content],{type:format==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`citation-url-trace.${format}`;a.click();URL.revokeObjectURL(url);$('message').textContent=`${format.toUpperCase()} downloaded. The record contains supplied evidence, not a live verification.`;}
$('json').addEventListener('click',()=>download('json'));$('csv').addEventListener('click',()=>download('csv'));
$('copy').addEventListener('click',async()=>{update();try{await navigator.clipboard.writeText(toJSON(current));$('message').textContent='JSON copied.';}catch{$('message').textContent='Copy unavailable. Select the JSON preview or download the file.';}});
load(CASES[0].record);
