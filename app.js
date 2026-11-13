const DB_NAME="alisraa_qc_manager", DB_VERSION=3;
const stores=["devices","targets","runs","calibrations","eqa","updates","aps","policies","audit"];
let db;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID();
const nowLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;stores.forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:"id"})})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function all(store){return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function put(store,obj){return new Promise((resolve,reject)=>{const tx=db.transaction(store,"readwrite");tx.objectStore(store).put(obj);tx.oncomplete=async()=>{if(store!=="audit"){try{await new Promise((res,rej)=>{const a=db.transaction("audit","readwrite");a.objectStore("audit").put({id:uid(),action:"UPSERT",objectType:store,objectId:obj.id,afterState:JSON.stringify(obj),actor:"local-manager",at:new Date().toISOString()});a.oncomplete=res;a.onerror=()=>rej(a.error)})}catch(err){console.warn("Audit append failed",err)}}resolve(obj)};tx.onerror=()=>reject(tx.error)})}
function seedDevices(){return all("devices").then(async rows=>{if(rows.length)return;const data=[
{id:"access2",name:"Beckman Coulter Access 2",manufacturer:"Beckman Coulter",model:"Access 2",status:"active"},
{id:"c111",name:"Roche cobas c111",manufacturer:"Roche",model:"cobas c111",status:"active"},
{id:"vidas",name:"bioMérieux VIDAS",manufacturer:"bioMérieux",model:"VIDAS",status:"active"},
{id:"e411",name:"Roche cobas e 411",manufacturer:"Roche",model:"cobas e 411",status:"planned"}];for(const x of data)await put("devices",x)})}
function showView(name){$$(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+name));$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===name));window.scrollTo(0,0);render()}
document.addEventListener("click",e=>{const n=e.target.closest("[data-view]");if(n)showView(n.dataset.view);const g=e.target.closest("[data-go]");if(g)showView(g.dataset.go)});
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmtDate(s){return s?new Date(s).toLocaleString("ar-IQ"):"—"}
function statusLabel(s){return ({accepted:"مقبول",warning:"تحذير",rejected:"مرفوض",pending_review:"مراجعة"})[s]||s}
async function render(){
 const [devices,targets,runs,cals,eqa,updates,aps,policies,audit]=await Promise.all(stores.map(all)); window._targetsCache=targets;
 $("#stat-total").textContent=runs.length;$("#stat-accepted").textContent=runs.filter(x=>x.status==="accepted").length;$("#stat-warning").textContent=runs.filter(x=>x.status==="warning").length;$("#stat-rejected").textContent=runs.filter(x=>x.status==="rejected").length;
 $("#device-summary").innerHTML=devices.map(d=>`<div class="device-row"><span>${esc(d.name)}</span><span class="tag">${d.status==="planned"?"مخطط":d.status==="active"?"فعال":"غير فعال"}</span></div>`).join("")||'<div class="empty">لا توجد أجهزة</div>';
 const recent=[...runs].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);$("#recent-runs").innerHTML=table(["الوقت","التحليل","القراءات","الحالة"],recent.map(r=>[fmtDate(r.runAt),esc(r.analyte||""),esc((r.results||[{value:r.value}]).map(x=>x.value).join(" / ")),statusLabel(r.status)]));
 $("#devices-table").innerHTML=table(["الجهاز","الشركة","الموديل","الحالة"],devices.map(d=>[esc(d.name),esc(d.manufacturer),esc(d.model),d.status==="planned"?"مخطط للإدخال":d.status==="active"?"فعال":"غير فعال"]));
 $("#targets-table").innerHTML=table(["الجهاز","المنتج / LOT","التحليل","المستوى","نوع الهدف","Mean ± SD","الحدود","الوحدة","المصدر","الاعتماد"],targets.map(t=>[esc(devices.find(d=>d.id===t.deviceId)?.name||""),`${esc(t.product)} / ${esc(t.lot)}`,esc(t.analyte),esc(t.level),t.targetType==="manufacturer"?"الشركة":"المختبر",`${t.mean} ± ${t.sd}`,`${t.lowerLimit??"—"} إلى ${t.upperLimit??"—"}`,esc(t.unit),esc(t.source),t.approved?"معتمد":`<button class="approval-btn" data-approve-target="${t.id}">اعتماد</button>`]));
 $("#history-table").innerHTML=table(["التفاصيل","الوقت","الجهاز","التحليل","المستويات والقراءات","الحالة","القواعد","السياسة"],[...runs].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r=>[`<button class="approval-btn" data-run-detail="${esc(r.id)}">فتح التفاصيل</button>`,fmtDate(r.runAt),esc(devices.find(d=>d.id===r.deviceId)?.name||""),esc(r.analyte||""),(r.results||[{level:r.level,value:r.value,unit:"",z:r.z}]).map(x=>`${esc(x.level)}: ${esc(x.value)} ${esc(x.unit||"")} (Z=${Number(x.z).toFixed(2)})`).join("<br>"),statusLabel(r.status),esc((r.rules||[]).join(", ")||"—"),esc(r.policy||"—")]));
 const detailHost=$("#runDetailPanel");
 if(detailHost && !detailHost.dataset.ready){detailHost.dataset.ready="1";detailHost.innerHTML='<div class="panel-head"><h2>تفاصيل التشغيل المحدد</h2><button type="button" class="ghost" id="closeRunDetail">إغلاق التفاصيل</button></div><div id="runDetailContent" class="empty">اختر تشغيلًا من السجل لعرض التفاصيل والمخطط التاريخي.</div>'; }
 const opts=devices.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join("");$("#targetDevice").innerHTML=opts;$$(".deviceSelect").forEach(s=>s.innerHTML=opts);
 const activeDevices=devices.filter(d=>d.status==="active");
 $("#runDevice").innerHTML=activeDevices.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join("");
 updateRunSelectors();
 $("#apsTable").innerHTML=table(["التحليل","المواصفة","النموذج","TEa","المصدر","الحالة"],aps.map(a=>[esc(a.analyte),esc(a.name),esc(a.model),`${a.tea} ${esc(a.unit)}`,esc(a.source),a.status==="approved"?"معتمد":`<button class="approval-btn" data-approve-aps="${a.id}">اعتماد</button>`]));
 $("#calEqaList").innerHTML=table(["النوع","التفاصيل","التاريخ"],[...cals.map(x=>["معايرة",`${esc(x.deviceName)} · ${esc(x.analyte)} · ${esc(x.status)}`,x.date]),...eqa.map(x=>["EQA",`${esc(x.provider)} · ${esc(x.analyte)} · Z=${esc(x.zscore)}`,x.createdAt])]);
 $("#updatesList").innerHTML=table(["المصدر","التحديث","التاريخ","الحالة"],updates.map(x=>[esc(x.source),x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`:esc(x.title),esc(x.date||"—"),"بانتظار المراجعة"]));
 $("#dbStatus").textContent=`قاعدة البيانات المحلية جاهزة · ${targets.length} هدف QC · ${runs.length} تشغيل · ${audit.length} سجل تدقيق`;
 $("#policyTable").innerHTML=table(["الجهاز","التحليل","الإصدار","القواعد","المرجع","الحالة"],policies.map(p=>[esc(devices.find(d=>d.id===p.deviceId)?.name||""),esc(p.analyte),esc(p.version),esc(p.rules.join(", ")),esc(p.reference),p.active?"فعال":"غير فعال"]));
 $("#auditTable").innerHTML=table(["التاريخ","العملية","الكيان","المعرف","المستخدم"],[...audit].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,100).map(a=>[fmtDate(a.at),esc(a.action),esc(a.objectType),esc(a.objectId),esc(a.actor)]));
 
}
function updateRunSelectors(){
 const dev=$("#runDevice")?.value, targetsCache=window._targetsCache||[];
 const analytes=[...new Set(targetsCache.filter(t=>t.deviceId===dev&&t.approved).map(t=>t.analyte))];
 $("#runAnalyte").innerHTML=analytes.map(a=>`<option>${esc(a)}</option>`).join("")||'<option value="">لا توجد أهداف معتمدة</option>';
 updateLotSelector();
}
function updateLotSelector(){
 const dev=$("#runDevice")?.value, analyte=$("#runAnalyte")?.value, ts=window._targetsCache||[];
 const groups=[...new Map(ts.filter(t=>t.deviceId===dev&&t.analyte===analyte&&t.approved).map(t=>[t.product+"|"+t.lot,t])).values()];
 $("#runLot").innerHTML=groups.map(t=>`<option value="${esc(t.product)}|${esc(t.lot)}">${esc(t.product)} · ${esc(t.lot)}</option>`).join("")||'<option value="">لا توجد LOTs معتمدة</option>';
 renderRunLevelInputs();
}
async function applyActivePolicy(){
 const dev=$("#runDevice")?.value, analyte=$("#runAnalyte")?.value;
 const policy=(await all("policies")).find(p=>p.active&&p.deviceId===dev&&p.analyte===analyte);
 window._activePolicy=policy||null;
 $$('input[name="rules"]').forEach(c=>c.checked=!!policy?.rules.includes(c.value));
 const ref=$("#runForm [name=policy]");if(ref)ref.value=policy?`${policy.reference} · ${policy.version}`:"";
}
function renderRunLevelInputs(){
 const dev=$("#runDevice")?.value, analyte=$("#runAnalyte")?.value, key=$("#runLot")?.value, ts=window._targetsCache||[];
 const [product,lot]=(key||"|").split("|");
 const matches=ts.filter(t=>t.deviceId===dev&&t.analyte===analyte&&t.product===product&&t.lot===lot&&t.approved);
 $("#runLevelInputs").innerHTML=matches.length?matches.map(t=>`<div class="level-card"><strong>${esc(t.level)} · Mean ${t.mean} · SD ${t.sd} ${esc(t.unit)}</strong><label>القراءة<input type="number" step="any" data-level-target="${t.id}" required></label></div>`).join(""):'<div class="empty">لا توجد مستويات QC معتمدة لهذا الاختيار</div>';
}
document.addEventListener("change",e=>{
 if(["runDevice","runAnalyte","runLot"].includes(e.target.id)){
  if(e.target.id==="runDevice"){updateRunSelectors();applyActivePolicy();}
  else if(e.target.id==="runAnalyte"){updateLotSelector();applyActivePolicy();}
  else renderRunLevelInputs();
 }
});
document.addEventListener("click",async e=>{
 const b=e.target.closest("[data-approve-target]");
 if(b){const t=(await all("targets")).find(x=>x.id===b.dataset.approveTarget);if(!t)return;
  t.approved=true;t.approvedAt=new Date().toISOString();t.approvedBy="local-manager";await put("targets",t);toast("تم اعتماد الهدف محلياً");render();}
 const a=e.target.closest("[data-approve-aps]");
 if(a){const spec=(await all("aps")).find(x=>x.id===a.dataset.approveAps);if(!spec)return;spec.status="approved";spec.approvedAt=new Date().toISOString();await put("aps",spec);toast("تم اعتماد المواصفة محلياً");render();}
});
function table(headers,rows){if(!rows.length)return '<div class="empty">لا توجد بيانات مسجلة بعد</div>';return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v??"—"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}
$("#deviceForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);await put("devices",{id:uid(),name:f.get("name"),manufacturer:f.get("manufacturer"),model:f.get("model"),status:f.get("status")});e.target.reset();toast("تم حفظ الجهاز");render()});
const UNIT_OPTIONS=["U/L","IU/L","µkat/L","mg/dL","g/dL","g/L","mmol/L","µmol/L","nmol/L","pmol/L","mIU/L","µIU/mL","ng/mL","pg/mL","ng/dL","%","fL","pg","10^9/L","10^12/L","cells/µL","mEq/L","sec","ratio","index","copies/mL"];
function unitOptions(){return UNIT_OPTIONS.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join("")}
function analyteRowHTML(){return `<div class="analyte-row">
  <label>اسم التحليل<input data-field="analyte" required placeholder="كما في شيت الشركة" autocomplete="off"></label>
  <label>الوحدة
    <select data-field="unitPreset" required><option value="" selected disabled>اختر الوحدة</option>${unitOptions()}<option value="__custom__">وحدة أخرى…</option></select>
    <input data-field="unitCustom" placeholder="اكتب الوحدة كما في النشرة" hidden>
  </label>
  <label>Mean<input data-field="mean" type="number" step="any" required inputmode="decimal"></label>
  <label>SD<input data-field="sd" type="number" step="any" min="0" required inputmode="decimal"></label>
  <label>الحد الأدنى<input data-field="lowerLimit" type="number" step="any" placeholder="اختياري" inputmode="decimal"></label>
  <label>الحد الأعلى<input data-field="upperLimit" type="number" step="any" placeholder="اختياري" inputmode="decimal"></label>
  <button type="button" class="remove-analyte" aria-label="حذف التحليل">حذف</button>
</div>`}
function addAnalyteRow(){const wrap=$("#analyteRows");if(wrap)wrap.insertAdjacentHTML("beforeend",analyteRowHTML())}
$("#addAnalyteRow")?.addEventListener("click",addAnalyteRow);
$("#analyteRows")?.addEventListener("click",e=>{const b=e.target.closest(".remove-analyte");if(!b)return;const rows=$$("#analyteRows .analyte-row");if(rows.length===1){toast("يجب الإبقاء على تحليل واحد على الأقل");return}b.closest(".analyte-row").remove()});
addAnalyteRow();
$("#levelPreset")?.addEventListener("change",e=>{const custom=$("#levelCustom");const isCustom=e.target.value==="__custom__";custom.hidden=!isCustom;custom.required=isCustom;if(isCustom)custom.focus()});
$("#analyteRows")?.addEventListener("change",e=>{const select=e.target.closest('[data-field="unitPreset"]');if(!select)return;const custom=select.parentElement.querySelector('[data-field="unitCustom"]');const isCustom=select.value==="__custom__";custom.hidden=!isCustom;custom.required=isCustom;if(isCustom)custom.focus()});
$("#targetForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.target), rows=$$("#analyteRows .analyte-row");
 if(!rows.length){toast("أضف تحليلاً واحداً على الأقل");return}
 const levelPreset=f.get("levelPreset"), level=levelPreset==="__custom__"?String(f.get("levelCustom")||"").trim():String(levelPreset||"").trim();
 if(!level){toast("اختر المستوى أو أدخل اسماً مخصصاً له");return}
 const shared={deviceId:f.get("deviceId"),product:f.get("product").trim(),qcManufacturer:f.get("qcManufacturer").trim(),lot:f.get("lot").trim(),expiry:f.get("expiry"),level,targetType:f.get("targetType"),source:f.get("source").trim()};
 const records=[];
 for(const row of rows){const v=Object.fromEntries([...row.querySelectorAll("[data-field]")].map(x=>[x.dataset.field,x.value.trim()]));const unit=v.unitPreset==="__custom__"?v.unitCustom:v.unitPreset;const mean=Number(v.mean),sd=Number(v.sd);
  if(!v.analyte||!unit||!Number.isFinite(mean)||!(sd>0)){toast("تحقق من اسم التحليل والوحدة وMean وSD؛ يجب أن تكون SD أكبر من صفر");return}
  const lowerLimit=v.lowerLimit===""?null:Number(v.lowerLimit),upperLimit=v.upperLimit===""?null:Number(v.upperLimit);
  if((lowerLimit!==null&&!Number.isFinite(lowerLimit))||(upperLimit!==null&&!Number.isFinite(upperLimit))||(lowerLimit!==null&&upperLimit!==null&&lowerLimit>upperLimit)){toast("تحقق من الحدود الدنيا والعليا");return}
  records.push({id:uid(),...shared,analyte:v.analyte,mean,sd,unit,lowerLimit,upperLimit,createdAt:new Date().toISOString(),approved:false});
 }
 for(const record of records)await put("targets",record);
 e.target.reset();$("#analyteRows").innerHTML="";addAnalyteRow();toast(`حُفظت المادة مع ${records.length} تحليل/تحاليل؛ الأهداف غير معتمدة بعد`);render();
});
$("#runForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const f=new FormData(e.target), devId=f.get("deviceId"), analyte=f.get("analyte"), lotKey=f.get("lotKey");
 const [product,lot]=(lotKey||"|").split("|"), targets=await all("targets");
 const matched=targets.filter(t=>t.deviceId===devId&&t.analyte===analyte&&t.product===product&&t.lot===lot&&t.approved);
 const inputs=$$("#runLevelInputs [data-level-target]");
 if(!matched.length||inputs.length!==matched.length){toast("لا توجد مستويات معتمدة مكتملة");return}
 const results=[];
 for(const inp of inputs){
  const target=matched.find(t=>t.id===inp.dataset.levelTarget), value=Number(inp.value);
  if(!target||!Number.isFinite(value)){toast("أدخل قراءة صحيحة لكل مستوى");return}
  const history=(await all("runs")).flatMap(r=>(r.deviceId===devId&&r.analyte===analyte&&r.lot===lot?(r.results||[]):[]))
    .filter(x=>x.targetId===target.id).map(x=>({z:x.z,runAt:x.runAt}));
  const rules=f.getAll("rules").filter(x=>x!=="R_4S");
  const ev=window.AlIsraaQCEngine.evaluateSingleLevel({value,target:{mean:target.mean,sd:target.sd},history,enabledRules:rules});
  results.push({targetId:target.id,level:target.level,value,z:ev.z,status:ev.status,violations:ev.violations,warnings:ev.warnings,evidence:ev.evidence,unit:target.unit,targetSnapshot:{mean:target.mean,sd:target.sd,source:target.source,targetType:target.targetType}});
 }
 const allRules=f.getAll("rules"), r4sEnabled=allRules.includes("R_4S");
 let r4s={triggered:false};
 if(r4sEnabled){
  r4s=window.AlIsraaQCEngine.evaluateR4sSameRun(results.map((r,i)=>({levelId:r.targetId,value:r.value,mean:matched.find(t=>t.id===r.targetId).mean,sd:matched.find(t=>t.id===r.targetId).sd})));
  if(r4s.triggered){results.forEach(r=>{r.violations=[...r.violations,"R_4S"];r.status="rejected";r.evidence={...r.evidence,R_4S:r4s.levels}})}
 }
 const status=results.some(r=>r.status==="rejected")?"rejected":results.some(r=>r.status==="warning")?"warning":"accepted";
 const run={id:uid(),deviceId:devId,analyte,product,lot,runAt:f.get("runAt"),results,status,rules:allRules,policy:f.get("policy"),policySnapshot:window._activePolicy||{reference:f.get("policy"),rules:allRules},notes:f.get("notes"),r4sEvidence:r4s,engineVersion:"0.4.0-prevalidation",createdAt:new Date().toISOString()};
 await put("runs",run);
 const statusTitle=status==="accepted"?"مقبول — Accept":status==="warning"?"تحذير — Warning":"مرفوض — Reject";
 const reasons=results.flatMap(r=>[...(r.violations||[]).map(x=>`${x} — قاعدة رفض متحققة في ${r.level}`),...(r.warnings||[]).map(x=>`${x} — تجاوز حد التحذير في ${r.level}`)]);
 const targetCards=results.map(r=>{const t=matched.find(x=>x.id===r.targetId);return `<article class="result-metric"><span>${esc(r.level)} · القراءة</span><strong>${r.value} ${esc(r.unit)}</strong><small>Mean ${t.mean} · SD ${t.sd} · Z ${r.z.toFixed(2)}</small><b class="mini-status ${r.status}">${statusLabel(r.status)}</b></article>`}).join("");
 const points=results.map((r,k)=>{const x=54+k*220/Math.max(1,results.length-1),y=Math.max(18,Math.min(170,94-r.z*21));return `<circle cx="${x}" cy="${y}" r="5" fill="${Math.abs(r.z)>=2?'#b7791f':'#16845b'}"/><text x="${x}" y="185" text-anchor="middle" font-size="9" fill="#52647a">${esc(r.level)}</text>`}).join("");
 const chart=`<svg viewBox="0 0 340 192" role="img" aria-label="مخطط Z score"><rect x="38" y="12" width="290" height="164" rx="8" fill="#f8fafc"/><rect x="38" y="48" width="290" height="92" fill="#e8f5ee"/><line x1="38" y1="94" x2="328" y2="94" stroke="#294d78" stroke-width="1.5"/><line x1="38" y1="58" x2="328" y2="58" stroke="#d49b32" stroke-dasharray="4 3"/><line x1="38" y1="130" x2="328" y2="130" stroke="#d49b32" stroke-dasharray="4 3"/><line x1="38" y1="30" x2="328" y2="30" stroke="#bd4650" stroke-dasharray="4 3"/><line x1="38" y1="158" x2="328" y2="158" stroke="#bd4650" stroke-dasharray="4 3"/><text x="5" y="34" font-size="9">+3SD</text><text x="5" y="62" font-size="9">+2SD</text><text x="5" y="98" font-size="9">Mean</text><text x="5" y="134" font-size="9">−2SD</text><text x="5" y="162" font-size="9">−3SD</text>${points}</svg>`;
 $("#evaluationResult").innerHTML=`<section class="qc-result ${status}"><header class="qc-result-head"><div><small>الحكم النهائي على التشغيل</small><h2>${statusTitle}</h2></div><span class="qc-status-mark">${status==="accepted"?"✓":status==="warning"?"!":"×"}</span></header><div class="result-metrics">${targetCards}</div><article class="result-reason"><h3>سبب التقييم</h3><p>${reasons.length?reasons.map(esc).join("، "):"لم تتحقق أي قاعدة تحذير أو رفض مفعّلة ضمن البيانات المتاحة."}</p><small>${status==="accepted"?"مقبول وفق القواعد المفعّلة والقراءات المتاحة فقط.":status==="warning"?"التحذير وحده لا يعني رفض التشغيل؛ راجع القراءة وراقب الاتجاه.":"توجد قاعدة رفض متحققة؛ اتبع إجراء المختبر للتحقيق والتصحيح."}</small></article><article class="result-chart"><h3>مخطط Z-score لهذا التشغيل</h3><p>حدود ±1 و±2 و±3 SD</p>${chart}<small>مخطط هذا التشغيل فقط؛ يلزم سجل تاريخي كافٍ لبناء مخطط Levey–Jennings الزمني الكامل لكل مستوى.</small></article><article class="result-reason"><h3>قواعد Westgard</h3>${allRules.map(x=>`<div class="rule-result"><span>${esc(x)}</span><b>${results.some(r=>(r.violations||[]).includes(x))?"مخالفة":results.some(r=>(r.warnings||[]).includes(x))?"تحذير":"لم تتحقق / بيانات غير كافية"}</b></div>`).join("")}<div class="rule-result"><span>R₄s</span><b>${r4sEnabled?(r4s.triggered?"مخالفة بين مستويين":r4s.reason||"لم تتحقق"):"غير مفعّلة"}</b></div></article><footer>الجهاز ${esc(devId)} · التحليل ${esc(analyte)} · LOT ${esc(lot)} · ${fmtDate(run.runAt)}</footer></section>`;
 toast("تم حفظ التشغيل");render();
});
$("#calForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target),dev=(await all("devices")).find(x=>x.id===f.get("deviceId"));await put("calibrations",{id:uid(),deviceId:f.get("deviceId"),deviceName:dev?.name,analyte:f.get("analyte"),date:f.get("date"),lot:f.get("lot"),status:f.get("status"),notes:f.get("notes")});e.target.reset();toast("تم حفظ سجل المعايرة");render()});
$("#eqaForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);await put("eqa",{id:uid(),provider:f.get("provider"),analyte:f.get("analyte"),sample:f.get("sample"),result:f.get("result"),assigned:f.get("assigned"),unit:f.get("unit"),zscore:f.get("zscore"),createdAt:new Date().toISOString()});e.target.reset();toast("تم حفظ سجل EQA");render()});
$("#updateForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);await put("updates",{id:uid(),source:f.get("source"),title:f.get("title"),url:f.get("url"),date:f.get("date"),summary:f.get("summary"),status:"pending_review"});e.target.reset();toast("أضيف التحديث للمراجعة");render()});
async function exportData(){const data={format:"alisraa-qc-backup",version:1,exportedAt:new Date().toISOString(),data:{}};for(const s of stores)data.data[s]=await all(s);const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Al-Israa-QC-Backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast("تم إنشاء النسخة الاحتياطية")}
$("#backupBtn").onclick=exportData;$("#exportBtn2").onclick=exportData;
$("#importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.format!=="alisraa-qc-backup")throw Error("format");for(const s of stores){for(const item of data.data?.[s]||[])await put(s,item)}toast("تم استيراد النسخة");render()}catch{toast("ملف النسخة غير صالح")}e.target.value=""});
let pendingWorker=null,refreshingForUpdate=false;
function showUpdateNotice(){const notice=$("#updateNotice");if(notice)notice.hidden=false}
function hideUpdateNotice(){const notice=$("#updateNotice");if(notice)notice.hidden=true}
async function activateAppUpdate(){if(!pendingWorker)return;const button=$("#updateNow");if(button){button.disabled=true;button.textContent="جارٍ التحديث…"}pendingWorker.postMessage({type:"SKIP_WAITING"})}
if("serviceWorker" in navigator){
 window.addEventListener("load",async()=>{
  try{
   const registration=await navigator.serviceWorker.register("./sw.js");
   if(registration.waiting&&navigator.serviceWorker.controller){pendingWorker=registration.waiting;showUpdateNotice()}
   registration.addEventListener("updatefound",()=>{const installing=registration.installing;if(!installing)return;installing.addEventListener("statechange",()=>{if(installing.state==="installed"&&navigator.serviceWorker.controller){pendingWorker=registration.waiting||installing;showUpdateNotice()}})});
   const checkForUpdate=()=>{if(navigator.onLine)registration.update().catch(()=>{})};
   checkForUpdate();document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkForUpdate()});
  }catch(error){console.warn("Service worker registration/update check failed",error)}
 });
 navigator.serviceWorker.addEventListener("controllerchange",()=>{if(refreshingForUpdate)return;refreshingForUpdate=true;window.location.reload()});
}
$("#updateNow")?.addEventListener("click",activateAppUpdate);
$("#updateLater")?.addEventListener("click",hideUpdateNotice);
(async()=>{db=await openDB();await seedDevices();$("#runForm [name=runAt]").value=nowLocal();await render();await applyActivePolicy();if(!navigator.onLine)$("#connection").textContent="دون إنترنت";window.addEventListener("online",()=>$("#connection").textContent="محلي");window.addEventListener("offline",()=>$("#connection").textContent="دون إنترنت")})().catch(err=>{console.error(err);toast("تعذر فتح قاعدة البيانات المحلية")});

$("#policyForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target),deviceId=f.get("deviceId"),analyte=f.get("analyte");for(const p of await all("policies")){if(p.deviceId===deviceId&&p.analyte===analyte&&p.active){p.active=false;await put("policies",p)}}await put("policies",{id:uid(),deviceId,analyte,version:f.get("version"),reference:f.get("reference"),rules:f.getAll("policyRules"),active:true,approvedAt:new Date().toISOString()});toast("تم حفظ سياسة الجهاز والتحليل");render()});
$("#apsForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);await put("aps",{id:uid(),analyte:f.get("analyte"),name:f.get("name"),model:f.get("model"),tea:Number(f.get("tea")),unit:f.get("unit"),source:f.get("source"),year:f.get("year"),status:"pending_review",createdAt:new Date().toISOString()});e.target.reset();toast("حُفظت المواصفة بانتظار المراجعة");render()});
$("#sigmaForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.target);try{const sigma=window.AlIsraaQCEngine.calculateSigma({teaPercent:Number(f.get("tea")),biasPercent:Number(f.get("bias")),cvPercent:Number(f.get("cv"))});$("#sigmaResult").innerHTML=`<div class="result-card"><strong>Sigma = ${sigma.toFixed(2)}</strong><p>الحساب: (TEa − |Bias|) ÷ CV</p><small>تأكد من توافق الوحدات والمصدر والنموذج قبل تفسير النتيجة.</small></div>`}catch(err){toast("تحقق من المدخلات")}}); 

$("#biasForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.target);try{const bias=window.AlIsraaQCEngine.calculatePercentBias({measuredMean:Number(f.get("measured")),comparisonValue:Number(f.get("comparison"))});$("#biasResult").innerHTML=`<div class="result-card"><strong>Bias = ${bias.toFixed(2)}%</strong><p>قيمة المقارنة: ${f.get("comparison")}</p></div>`}catch(err){toast("تحقق من القيم المدخلة")}}); 


document.addEventListener("click", async e=>{
 const open=e.target.closest("[data-run-detail]");
 if(open){
  const runs=await all("runs"), devices=await all("devices"), targets=await all("targets");
  const run=runs.find(x=>x.id===open.dataset.runDetail); if(!run)return;
  const host=$("#runDetailContent"); if(!host)return;
  const statusName=statusLabel(run.status);
  const dev=devices.find(x=>x.id===run.deviceId)?.name||run.deviceId;
  const results=run.results||[{level:run.level,value:run.value,z:run.z,unit:"",violations:[],warnings:[]}];
  const pointsByLevel=results.map(result=>{
    const hist=runs.filter(x=>x.deviceId===run.deviceId&&x.analyte===run.analyte&&x.lot===run.lot)
      .flatMap(x=>(x.results||[]).filter(y=>y.targetId===result.targetId).map(y=>({at:x.runAt||x.createdAt,z:Number(y.z),id:x.id,selected:x.id===result.id})))
      .filter(p=>Number.isFinite(p.z)).sort((a,b)=>new Date(a.at)-new Date(b.at));
    if(!hist.some(p=>p.at===run.runAt&&p.z===Number(result.z)))hist.push({at:run.runAt,z:Number(result.z),selected:true});
    hist.sort((a,b)=>new Date(a.at)-new Date(b.at));
    const W=320,H=150,L=28,R=10,T=12,B=28, min=Math.min(-3,...hist.map(p=>p.z)),max=Math.max(3,...hist.map(p=>p.z));
    const y=v=>T+(max-v)/(max-min)*(H-T-B), x=i=>L+(hist.length<2?0:i*(W-L-R)/(hist.length-1));
    const bands=[3,2,1,0,-1,-2,-3].map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="${v===0?'#31577e':Math.abs(v)===3?'#c44':'#d5a13a'}" stroke-dasharray="${v===0?'':'4 3'}"/><text x="2" y="${y(v)+3}" font-size="8" fill="#52647a">${v>0?'+':''}${v}SD</text>`).join("");
    const poly=hist.map((p,i)=>`${x(i)},${y(p.z)}`).join(" ");
    const dots=hist.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.z)}" r="${p.selected?5:3.5}" fill="${Math.abs(p.z)>=3?'#bd4650':Math.abs(p.z)>=2?'#c18a22':'#16845b'}"><title>${esc(fmtDate(p.at))}: Z=${p.z.toFixed(2)}</title></circle>`).join("");
    return `<article class="result-chart"><h3>${esc(result.level)} — Levey–Jennings</h3><p>النقاط التاريخية لنفس الجهاز والتحليل وLOT والمستوى فقط · عدد النقاط: ${hist.length}</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Levey Jennings ${esc(result.level)}">${bands}<polyline points="${poly}" fill="none" stroke="#31577e" stroke-width="2"/>${dots}</svg>${hist.length<2?'<small>نقطة واحدة فقط؛ يتطلب تقييم الاتجاه عدة تشغيلات متتابعة.</small>':''}</article>`;
  }).join("");
  const metrics=results.map(r=>{const t=targets.find(x=>x.id===r.targetId)||{};return `<article class="result-metric"><span>${esc(r.level)} · القراءة</span><strong>${esc(r.value)} ${esc(r.unit||t.unit||"")}</strong><small>Mean ${esc(t.mean??r.targetSnapshot?.mean??"—")} · SD ${esc(t.sd??r.targetSnapshot?.sd??"—")} · Z ${Number(r.z).toFixed(2)}</small><b class="mini-status ${esc(r.status||run.status)}">${statusLabel(r.status||run.status)}</b></article>`}).join("");
  const rules=(run.rules||[]).map(rule=>{const violation=results.some(r=>(r.violations||[]).includes(rule));const warning=results.some(r=>(r.warnings||[]).includes(rule));return `<div class="rule-result"><span>${esc(rule)}</span><b>${violation?'مخالفة':warning?'تحذير':'لم تتحقق / لا توجد أدلة كافية'}</b></div>`}).join("");
  host.innerHTML=`<section class="qc-result ${esc(run.status)}"><header class="qc-result-head"><div><small>تفاصيل التشغيل المحفوظ</small><h2>${statusName}</h2></div></header><p>${esc(dev)} · ${esc(run.analyte)} · LOT ${esc(run.lot)} · ${fmtDate(run.runAt)}</p><div class="result-metrics">${metrics}</div><article class="result-reason"><h3>سبب التقييم</h3><p>${results.flatMap(r=>[...(r.violations||[]).map(x=>`${x} — مخالفة في ${r.level}`),...(r.warnings||[]).map(x=>`${x} — تحذير في ${r.level}`)]).map(esc).join("، ")||"لا توجد مخالفة ضمن القواعد المفعّلة المسجلة لهذا التشغيل."}</p></article><article class="result-reason"><h3>قواعد Westgard</h3>${rules||'<p>لا توجد قواعد محفوظة لهذا التشغيل.</p>'}</article>${pointsByLevel}<footer>السياسة: ${esc(run.policy||"—")} · ملاحظات: ${esc(run.notes||"—")}</footer></section>`;
  $("#runDetailPanel")?.scrollIntoView({behavior:"smooth",block:"start"});
 }
 if(e.target.closest("#closeRunDetail"))$("#runDetailContent").innerHTML='<div class="empty">اختر تشغيلًا من السجل لعرض التفاصيل والمخطط التاريخي.</div>';
});
