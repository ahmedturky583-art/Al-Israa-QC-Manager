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
 $("#targets-table").innerHTML=table(["الجهاز","المنتج / LOT","التحليل","المستوى","نوع الهدف","Mean ± SD","المصدر","الاعتماد"],targets.map(t=>[esc(devices.find(d=>d.id===t.deviceId)?.name||""),`${esc(t.product)} / ${esc(t.lot)}`,esc(t.analyte),esc(t.level),t.targetType==="manufacturer"?"الشركة":"المختبر",`${t.mean} ± ${t.sd} ${esc(t.unit)}`,esc(t.source),t.approved?"معتمد":`<button class="approval-btn" data-approve-target="${t.id}">اعتماد</button>`]));
 $("#history-table").innerHTML=table(["الوقت","الجهاز","التحليل","المستويات والقراءات","الحالة","القواعد","السياسة"],[...runs].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r=>[fmtDate(r.runAt),esc(devices.find(d=>d.id===r.deviceId)?.name||""),esc(r.analyte||""),(r.results||[{level:r.level,value:r.value,unit:"",z:r.z}]).map(x=>`${esc(x.level)}: ${esc(x.value)} ${esc(x.unit||"")} (Z=${Number(x.z).toFixed(2)})`).join("<br>"),statusLabel(r.status),esc((r.rules||[]).join(", ")||"—"),esc(r.policy||"—")]));
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
$("#targetForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);const mean=Number(f.get("mean")),sd=Number(f.get("sd"));if(!(sd>0)){toast("يجب أن تكون SD أكبر من صفر");return}await put("targets",{id:uid(),deviceId:f.get("deviceId"),product:f.get("product"),lot:f.get("lot"),expiry:f.get("expiry"),analyte:f.get("analyte"),level:f.get("level"),targetType:f.get("targetType"),mean,sd,unit:f.get("unit"),source:f.get("source"),createdAt:new Date().toISOString(),approved:false});e.target.reset();toast("حُفظ الهدف بحالة غير معتمد؛ راجع بياناته قبل الاستخدام");render()});
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
 $("#evaluationResult").innerHTML=`<div class="result-card ${status}"><strong>نتيجة التشغيل: ${statusLabel(status)}</strong><div class="result-lines">${results.map(r=>`<div>${esc(r.level)}: ${r.value} ${esc(r.unit)} · Z=${r.z.toFixed(2)} · ${statusLabel(r.status)} · ${(r.violations||[]).join(", ")||"لا مخالفة"}</div>`).join("")}</div><p>R₄s: ${r4sEnabled?(r4s.triggered?"مخالفة بين مستويين":(r4s.reason||"لم تتحقق شروط المخالفة")):"غير مفعّل"}</p><small>تم حفظ Snapshot للأهداف ومصادرها والقواعد وإصدار المحرك. راجع السياسة المعتمدة قبل الاستخدام.</small></div>`;
 toast("تم حفظ التشغيل");render();
});
$("#calForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target),dev=(await all("devices")).find(x=>x.id===f.get("deviceId"));await put("calibrations",{id:uid(),deviceId:f.get("deviceId"),deviceName:dev?.name,analyte:f.get("analyte"),date:f.get("date"),lot:f.get("lot"),status:f.get("status"),notes:f.get("notes")});e.target.reset();toast("تم حفظ سجل المعايرة");render()});
$("#eqaForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);await put("eqa",{id:uid(),provider:f.get("provider"),analyte:f.get("analyte"),sample:f.get("sample"),result:f.get("result"),assigned:f.get("assigned"),unit:f.get("unit"),zscore:f.get("zscore"),createdAt:new Date().toISOString()});e.target.reset();toast("تم حفظ سجل EQA");render()});
$("#updateForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);await put("updates",{id:uid(),source:f.get("source"),title:f.get("title"),url:f.get("url"),date:f.get("date"),summary:f.get("summary"),status:"pending_review"});e.target.reset();toast("أضيف التحديث للمراجعة");render()});
async function exportData(){const data={format:"alisraa-qc-backup",version:1,exportedAt:new Date().toISOString(),data:{}};for(const s of stores)data.data[s]=await all(s);const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Al-Israa-QC-Backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast("تم إنشاء النسخة الاحتياطية")}
$("#backupBtn").onclick=exportData;$("#exportBtn2").onclick=exportData;
$("#importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.format!=="alisraa-qc-backup")throw Error("format");for(const s of stores){for(const item of data.data?.[s]||[])await put(s,item)}toast("تم استيراد النسخة");render()}catch{toast("ملف النسخة غير صالح")}e.target.value=""});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
(async()=>{db=await openDB();await seedDevices();$("#runForm [name=runAt]").value=nowLocal();await render();await applyActivePolicy();if(!navigator.onLine)$("#connection").textContent="دون إنترنت";window.addEventListener("online",()=>$("#connection").textContent="محلي");window.addEventListener("offline",()=>$("#connection").textContent="دون إنترنت")})().catch(err=>{console.error(err);toast("تعذر فتح قاعدة البيانات المحلية")});

$("#policyForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target),deviceId=f.get("deviceId"),analyte=f.get("analyte");for(const p of await all("policies")){if(p.deviceId===deviceId&&p.analyte===analyte&&p.active){p.active=false;await put("policies",p)}}await put("policies",{id:uid(),deviceId,analyte,version:f.get("version"),reference:f.get("reference"),rules:f.getAll("policyRules"),active:true,approvedAt:new Date().toISOString()});toast("تم حفظ سياسة الجهاز والتحليل");render()});
$("#apsForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);await put("aps",{id:uid(),analyte:f.get("analyte"),name:f.get("name"),model:f.get("model"),tea:Number(f.get("tea")),unit:f.get("unit"),source:f.get("source"),year:f.get("year"),status:"pending_review",createdAt:new Date().toISOString()});e.target.reset();toast("حُفظت المواصفة بانتظار المراجعة");render()});
$("#sigmaForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.target);try{const sigma=window.AlIsraaQCEngine.calculateSigma({teaPercent:Number(f.get("tea")),biasPercent:Number(f.get("bias")),cvPercent:Number(f.get("cv"))});$("#sigmaResult").innerHTML=`<div class="result-card"><strong>Sigma = ${sigma.toFixed(2)}</strong><p>الحساب: (TEa − |Bias|) ÷ CV</p><small>تأكد من توافق الوحدات والمصدر والنموذج قبل تفسير النتيجة.</small></div>`}catch(err){toast("تحقق من المدخلات")}}); 

$("#biasForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.target);try{const bias=window.AlIsraaQCEngine.calculatePercentBias({measuredMean:Number(f.get("measured")),comparisonValue:Number(f.get("comparison"))});$("#biasResult").innerHTML=`<div class="result-card"><strong>Bias = ${bias.toFixed(2)}%</strong><p>قيمة المقارنة: ${f.get("comparison")}</p></div>`}catch(err){toast("تحقق من القيم المدخلة")}}); 
