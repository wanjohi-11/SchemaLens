const sampleSQL = `CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE products (
  id BIGINT PRIMARY KEY,
  sku VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(220) NOT NULL,
  price FLOAT NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE orders (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(50) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id BIGINT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE audit_log (
  id BIGINT PRIMARY KEY,
  actor_id BIGINT,
  payload TEXT,
  created_at TIMESTAMP
);`;

const $ = (id) => document.getElementById(id);
const sqlInput = $('sqlInput');
sqlInput.value = sampleSQL;

function stripComments(sql){return sql.replace(/\/\*[\s\S]*?\*\//g,'').replace(/--.*$/gm,'');}
function splitColumns(body){
  const out=[]; let depth=0,start=0;
  for(let i=0;i<body.length;i++){
    const c=body[i]; if(c==='(') depth++; else if(c===')') depth--; else if(c===','&&depth===0){out.push(body.slice(start,i).trim());start=i+1;}
  }
  out.push(body.slice(start).trim()); return out.filter(Boolean);
}
function parseSchema(sql){
  sql=stripComments(sql); const tables=[]; const tableRegex=/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"\[]?([\w.]+)[`"\]]?\s*\(([\s\S]*?)\)\s*;/gi; let m;
  while((m=tableRegex.exec(sql))){
    const table={name:m[1],columns:[],fks:[],indexes:[],raw:m[0]}; const parts=splitColumns(m[2]);
    parts.forEach(part=>{
      const p=part.trim();
      let fk=p.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"\[]?([\w.]+)[`"\]]?\s*\(([^)]+)\)/i);
      if(fk){table.fks.push({column:clean(fk[1]),refTable:clean(fk[2]),refColumn:clean(fk[3])});return;}
      let idx=p.match(/(?:INDEX|KEY)\s+(?:[`"\[]?[\w-]+[`"\]]?\s*)?\(([^)]+)\)/i);
      if(idx&&!/PRIMARY\s+KEY/i.test(p)){table.indexes.push(...idx[1].split(',').map(clean));return;}
      if(/^(PRIMARY|UNIQUE|CONSTRAINT|CHECK)\b/i.test(p)) return;
      const cm=p.match(/^[`"\[]?([\w-]+)[`"\]]?\s+([\w]+(?:\s*\([^)]*\))?)([\s\S]*)$/i);
      if(cm){table.columns.push({name:cm[1],type:cm[2].toUpperCase(),rest:cm[3],pk:/PRIMARY\s+KEY/i.test(cm[3]),unique:/\bUNIQUE\b/i.test(cm[3]),notNull:/NOT\s+NULL/i.test(cm[3])});}
    });
    const tablePk=m[2].match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i); if(tablePk){tablePk[1].split(',').map(clean).forEach(k=>{const c=table.columns.find(x=>x.name===k);if(c)c.pk=true;});}
    tables.push(table);
  }
  return tables;
}
function clean(v){return v.trim().replace(/[`"\[\]]/g,'');}
function analyze(tables){
  const findings=[]; let indexes=0; tables.forEach(t=>indexes+=t.indexes.length);
  if(!tables.length){return {score:0,indexes,findings:[{type:'warn',title:'No CREATE TABLE statements detected',text:'Paste a SQL DDL schema containing CREATE TABLE statements and run the analysis again.'}]};}
  tables.forEach(t=>{
    if(!t.columns.some(c=>c.pk)) findings.push({type:'warn',title:`${t.name}: no primary key detected`,text:'A stable primary key usually simplifies relationships, updates and pagination.'});
    t.fks.forEach(fk=>{if(!t.indexes.includes(fk.column)&&!t.columns.find(c=>c.name===fk.column)?.pk) findings.push({type:'info',title:`${t.name}.${fk.column}: review indexing`,text:`This foreign-key column points to ${fk.refTable}.${fk.refColumn} but no explicit index was detected.`});});
    t.columns.forEach(c=>{
      if(/FLOAT|DOUBLE|REAL/.test(c.type)&&/(price|amount|total|balance|cost|fee|tax)/i.test(c.name)) findings.push({type:'warn',title:`${t.name}.${c.name}: floating type for money`,text:`${c.type} can introduce binary rounding behavior. DECIMAL/NUMERIC is often safer for currency values.`});
      if(/^id$/i.test(c.name)&&/VARCHAR|CHAR|TEXT/.test(c.type)) findings.push({type:'info',title:`${t.name}.id: string identifier`,text:'This may be intentional (UUID/ULID), but confirm length, indexing and generation strategy.'});
      if(/password/i.test(c.name)&&/TEXT/i.test(c.type)) findings.push({type:'warn',title:`${t.name}.${c.name}: credential field review`,text:'Store only strong password hashes and ensure the field never contains raw credentials.'});
      if(/created_at|updated_at/i.test(c.name)&&!/DATE|TIME/.test(c.type)) findings.push({type:'info',title:`${t.name}.${c.name}: timestamp type review`,text:`The detected type is ${c.type}; verify it matches your database timezone and precision strategy.`});
    });
  });
  const known=new Set(tables.map(t=>t.name)); tables.forEach(t=>t.fks.forEach(fk=>{if(!known.has(fk.refTable))findings.push({type:'warn',title:`${t.name}: unresolved relationship`,text:`${fk.refTable} is referenced but its CREATE TABLE statement was not found in this input.`});}));
  if(findings.length===0)findings.push({type:'good',title:'No obvious heuristic issues detected',text:'This is not a formal database audit. Review constraints, workloads, query plans and data behavior separately.'});
  const penalty=findings.reduce((s,f)=>s+(f.type==='warn'?9:f.type==='info'?4:0),0); return {score:Math.max(35,100-penalty),indexes,findings};
}
function render(){
  const tables=parseSchema(sqlInput.value); const result=analyze(tables); const relations=tables.reduce((n,t)=>n+t.fks.length,0);
  $('tableCount').textContent=tables.length; $('relationCount').textContent=relations; $('indexCount').textContent=result.indexes; $('issueCount').textContent=result.findings.filter(f=>f.type!=='good').length;
  $('scoreValue').textContent=tables.length?result.score:'—'; $('scoreRing').style.setProperty('--score',tables.length?result.score:0);
  $('scoreLabel').textContent=tables.length?(result.score>=85?'Strong':result.score>=70?'Review':'Needs review'):'Ready';
  $('scoreTitle').textContent=tables.length?`${tables.length} table${tables.length===1?'':'s'} detected`:'Load a schema';
  $('scoreText').textContent=tables.length?`${relations} relationship${relations===1?'':'s'} found. Review the findings below before treating this structure as production-ready.`:'SchemaLens will summarize structure and flag patterns worth reviewing.';
  const map=$('tableMap');
  if(!tables.length){map.className='table-map empty-state';map.textContent='No tables detected. Check the SQL syntax and try again.';} else {
    map.className='table-map'; map.innerHTML=tables.map(t=>`<article class="schema-card"><h3>${esc(t.name)}</h3><ul>${t.columns.map(c=>{const fk=t.fks.find(x=>x.column===c.name);return `<li><span class="${c.pk?'key':fk?'fk':''}">${c.pk?'◆ ':fk?'↗ ':''}${esc(c.name)}</span><span>${esc(c.type)}${c.notNull?' · NN':''}</span></li>`}).join('')}</ul></article>`).join('');
  }
  const findings=$('findings'); findings.className='findings'; findings.innerHTML=result.findings.map(f=>`<div class="finding ${f.type}"><div><span class="tag">${f.type.toUpperCase()}</span><strong>${esc(f.title)}</strong></div><p>${esc(f.text)}</p></div>`).join('');
  window.currentReport={generatedAt:new Date().toISOString(),summary:{tables:tables.length,relations,indexes:result.indexes,score:result.score},tables,findings:result.findings};
}
function esc(v){return String(v).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));}
function loadSample(){sqlInput.value=sampleSQL;render();}
$('loadSample').onclick=loadSample; $('loadSampleTop').onclick=()=>{loadSample();document.querySelector('#workspace').scrollIntoView({behavior:'smooth'});};
$('clearSql').onclick=()=>{sqlInput.value='';render();}; $('analyzeBtn').onclick=render;
$('sqlFile').addEventListener('change',e=>{const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{sqlInput.value=r.result;render();};r.readAsText(f);});
$('exportReport').onclick=()=>{const blob=new Blob([JSON.stringify(window.currentReport||{},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='schemalens-report.json';a.click();URL.revokeObjectURL(a.href);};
render();
