/* Al-Israa QC Manager 4.0.2 — analysis-series isolation patch */
(function () {
  'use strict';
  const DB = 'alisraa-qc-manager-v4';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let database;
  function openDB() {
    if (database) return Promise.resolve(database);
    return new Promise((resolve, reject) => {
      const q = indexedDB.open(DB, 1);
      q.onsuccess = () => { database = q.result; resolve(database); };
      q.onerror = () => reject(q.error);
    });
  }
  function read(store) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const q = db.transaction(store, 'readonly').objectStore(store).getAll();
      q.onsuccess = () => resolve(q.result || []);
      q.onerror = () => reject(q.error);
    }));
  }
  function selectOptions(el, values, first) {
    const old = el.value;
    el.innerHTML = `<option value="">${first}</option>` + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (values.includes(old)) el.value = old;
  }
  function cv(values) {
    if (values.length < 2) return null;
    const mean = values.reduce((a,b) => a+b, 0) / values.length;
    if (!Number.isFinite(mean) || mean === 0) return null;
    const sd = Math.sqrt(values.reduce((a,b) => a + (b-mean)**2, 0) / (values.length-1));
    return Math.abs(sd/mean)*100;
  }
  function draw(points) {
    const canvas = $('#lj'); if (!canvas) return;
    const ctx = canvas.getContext('2d'), w=canvas.width, h=canvas.height, pad=55, mid=h/2, scale=(h-2*pad)/6;
    ctx.clearRect(0,0,w,h); ctx.strokeStyle='#dce5ef'; ctx.lineWidth=1;
    for(let z=-3;z<=3;z++){const y=mid-z*scale;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-20,y);ctx.stroke();ctx.fillStyle='#60758e';ctx.font='16px sans-serif';ctx.fillText((z>0?'+':'')+z+'SD',8,y+5);}
    if(!points.length){ctx.fillStyle='#687b94';ctx.font='18px sans-serif';ctx.fillText('اختر جهازاً وتحليلاً وLOT ومستوى ونوع هدف واحد',pad,mid);return;}
    const step=(w-2*pad)/Math.max(points.length-1,1);
    ctx.strokeStyle='#245a96';ctx.lineWidth=2;ctx.beginPath();
    points.forEach((p,i)=>{const x=pad+i*step,y=mid-Math.max(-3.5,Math.min(3.5,p.z))*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
    points.forEach((p,i)=>{const x=pad+i*step,y=mid-Math.max(-3.5,Math.min(3.5,p.z))*scale;ctx.fillStyle=Math.abs(p.z)>=3?'#b42318':Math.abs(p.z)>=2?'#b7791f':'#245a96';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();});
  }
  async function renderStrict() {
    const ids=['ana-device','ana-analyte','ana-lot','ana-level','ana-kind'];
    if(ids.some(id=>!$('#'+id))) return;
    const [runs, targets] = await Promise.all([read('runs'), read('targets')]);
    const targetById = new Map(targets.map(t=>[t.id,t]));
    const d=$('#ana-device').value, a=$('#ana-analyte').value, lot=$('#ana-lot').value, level=$('#ana-level').value, kind=$('#ana-kind').value;
    if(!d||!a||!lot||!level||!kind){
      $('#series-stats').innerHTML='<p class="notice">لمنع خلط سلاسل QC، اختر جهازاً واحداً وتحليلاً واحداً وLOT واحداً ومستوى واحداً ونوع هدف واحداً.</p>';
      $('#history-list').innerHTML='<p class="empty">أكمل محددات السلسلة لعرض السجل.</p>';draw([]);return;
    }
    const rows=[];
    runs.filter(r=>r.deviceId===d&&r.analyte===a&&r.lot===lot).forEach(r=>r.measurements.forEach(m=>{
      const t=targetById.get(m.targetId); const actualKind=m.kind||t?.kind;
      if(m.level===level&&actualKind===kind&&Number.isFinite(Number(m.value))&&Number.isFinite(Number(m.z))) rows.push({...m,runAt:r.runAt,status:r.evaluation?.status||'—'});
    }));
    rows.sort((x,y)=>x.runAt.localeCompare(y.runAt));
    const vals=rows.map(x=>Number(x.value)), seriesCV=cv(vals), mean=vals.length?vals.reduce((x,y)=>x+y,0)/vals.length:null;
    const z=rows.map(x=>Number(x.z)), meanZ=z.length?z.reduce((x,y)=>x+y,0)/z.length:null;
    $('#series-stats').innerHTML=`<p>عدد النقاط: <b>${rows.length}</b> · متوسط Z: <b>${meanZ===null?'—':meanZ.toFixed(3)}</b> · متوسط القراءة: <b>${mean===null?'—':mean.toFixed(4)}</b> · CV السلسلة: <b>${seriesCV===null?'غير متاح (يلزم نقطتان على الأقل ومتوسط غير صفري)':seriesCV.toFixed(2)+'%'}</b></p><p class="muted">CV السلسلة محسوب من القراءات المسجلة باستخدام الانحراف المعياري للعينة؛ لا يفسر وحده قبول الأداء أو رفضه.</p>`;
    draw(rows);
    $('#history-list').innerHTML=rows.slice().reverse().map(r=>`<div class="tablewrap"><table><tbody><tr><th>التاريخ</th><td>${esc(new Date(r.runAt).toLocaleString('ar-IQ'))}</td><th>القراءة</th><td>${r.value}</td><th>Z</th><td>${Number(r.z).toFixed(2)}</td><th>التقييم</th><td>${esc(r.status)}</td></tr></tbody></table></div>`).join('')||'<p class="empty">لا توجد نقاط لهذه السلسلة المحددة.</p>';
  }
  function install() {
    const device=$('#ana-device'), analyte=$('#ana-analyte'), lot=$('#ana-lot'), level=$('#ana-level');
    if(!device||!analyte||!lot||!level||$('#ana-kind')) return false;
    const label=document.createElement('label');label.textContent='نوع الهدف';
    const kind=document.createElement('select');kind.id='ana-kind';kind.innerHTML='<option value="">اختر نوع الهدف</option><option value="manufacturer">الشركة المصنعة</option><option value="lab">المختبر</option>';
    label.appendChild(kind);level.parentElement.insertAdjacentElement('afterend',label);
    [device,analyte,lot,level,kind].forEach(el=>el.addEventListener('change',()=>{renderStrict().catch(console.error);}));
    const runResult=$('#run-result');
    if(runResult){new MutationObserver(()=>{runResult.querySelectorAll('p').forEach(p=>{if(p.textContent.includes('CV='))p.textContent=p.textContent.replace(/CV=/g,'CV الهدف (نظري)=');});}).observe(runResult,{childList:true,subtree:true});}
    renderStrict().catch(console.error);return true;
  }
  const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(!install())observer.observe(document.body,{childList:true,subtree:true});});
  else if(!install())observer.observe(document.body,{childList:true,subtree:true});
})();
