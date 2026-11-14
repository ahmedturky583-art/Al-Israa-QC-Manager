/* QC Engine 4.0.0 — deterministic calculations; rules are configurable and require local SOP approval. */
(function(g){'use strict';
const finite=(v,n)=>Number.isFinite(Number(v))&&String(v).trim()!=='';
function zScore(value,mean,sd){if(!finite(value)||!finite(mean)||!finite(sd)||Number(sd)<=0)throw Error('القيم يجب أن تكون رقمية وSD أكبر من صفر');return (Number(value)-Number(mean))/Number(sd)}
function cv(sd,mean){if(!finite(sd)||!finite(mean)||Number(mean)===0) return null;return Math.abs(Number(sd)/Number(mean))*100}
function ordered(a){return [...a].sort((x,y)=>new Date(x.runAt)-new Date(y.runAt))}
function evaluate({results=[],history=[],rules=['1_2s','1_3s','2_2s','R_4s','4_1s','10x'],policyName='سياسة غير مسماة'}={}){
 if(!Array.isArray(results)||!results.length)return {status:'incomplete',results:[],rules:[],reasons:['لا توجد قراءات'],policyName};
 const out=results.map(r=>({...r,z:zScore(r.value,r.mean,r.sd),violations:[],warnings:[]}));const checks=[];
 const add=(rule,state,detail,scope='per-level')=>checks.push({rule,state,detail,scope});
 for(const r of out){const az=Math.abs(r.z);if(rules.includes('1_3s')){const hit=az>=3;if(hit)r.violations.push('1_3s');add('1_3s',hit?'violation':'pass',hit?`|Z|=${az.toFixed(2)} ≥ 3`:`|Z|=${az.toFixed(2)} < 3`)}
 if(rules.includes('1_2s')){const hit=az>=2&&az<3;if(hit)r.warnings.push('1_2s');add('1_2s',hit?'warning':'pass',hit?`|Z|=${az.toFixed(2)} بين 2 و3؛ إنذار فقط`:'لا يوجد تجاوز منفرد ±2SD')}
 if(r.lower!==''&&r.lower!==null&&r.lower!==undefined&&finite(r.lower)&&Number(r.value)<Number(r.lower)){r.violations.push('حد أدنى');add('حد أدنى','violation',`${r.value} < ${r.lower}`)}
 if(r.upper!==''&&r.upper!==null&&r.upper!==undefined&&finite(r.upper)&&Number(r.value)>Number(r.upper)){r.violations.push('حد أعلى');add('حد أعلى','violation',`${r.value} > ${r.upper}`)}}
 for(const r of out){const seq=ordered(history.filter(h=>h.targetId===r.targetId&&finite(h.z))).map(h=>Number(h.z));const z=Number(r.z);const checkSeq=(rule,n,pred,label)=>{if(!rules.includes(rule))return;const a=seq.slice(-(n-1)).concat(z);if(a.length<n){add(rule,'not_evaluated',`بيانات غير كافية: ${a.length}/${n}`);return}const hit=pred(a);if(hit){(['1_2s','7t','8x'].includes(rule)?r.warnings:r.violations).push(rule)}add(rule,hit?'violation':'pass',hit?label:`لا تتحقق ${rule} في آخر ${n} قراءات`)};
 checkSeq('2_2s',2,a=>a.every(v=>Math.abs(v)>=2)&&a.every(v=>Math.sign(v)===Math.sign(z)),'قراءتان متتاليتان ≥2SD على الجانب نفسه');
 checkSeq('4_1s',4,a=>a.every(v=>Math.abs(v)>=1)&&a.every(v=>Math.sign(v)===Math.sign(z)),'أربع قراءات متتالية ≥1SD على الجانب نفسه');
 checkSeq('10x',10,a=>a.every(v=>Math.sign(v)===Math.sign(z))&&Math.sign(z)!==0,'عشر قراءات متتالية على جانب واحد من المتوسط');
 checkSeq('7t',7,a=>a.every((v,i)=>i===0||v>a[i-1])||a.every((v,i)=>i===0||v<a[i-1]),'سبع نقاط متتالية متصاعدة أو متناقصة','');
 checkSeq('8x',8,a=>a.every(v=>Math.sign(v)===Math.sign(z))&&Math.sign(z)!==0,'ثماني قراءات متتالية على جانب واحد من المتوسط');}
 if(rules.includes('R_4s')){if(new Set(out.map(x=>x.level)).size<2)add('R_4s','not_evaluated','يلزم مستويان مختلفان على الأقل في التشغيل نفسه','within-run-between-levels');else{const zs=out.map(x=>x.z);const hit=Math.max(...zs)-Math.min(...zs)>=4&&zs.some(x=>x>=2)&&zs.some(x=>x<=-2);if(hit)out.forEach(r=>r.violations.push('R_4s'));add('R_4s',hit?'violation':'pass',hit?'فرق ≥4SD بين مستويين متعاكسين ضمن التشغيل نفسه':'لا تتحقق R₄s في المستويات المدخلة','within-run-between-levels')}}
 const rejected=out.some(r=>r.violations.length),warn=out.some(r=>r.warnings.length)||checks.some(x=>x.state==='warning'),incomplete=checks.some(x=>x.state==='not_evaluated');
 const status=rejected?'rejected':incomplete?'incomplete':warn?'warning':'accepted';const reasons=checks.filter(x=>['violation','warning','not_evaluated'].includes(x.state)).map(x=>`${x.rule}: ${x.detail}`);if(!reasons.length)reasons.push('لا توجد مخالفة ضمن القواعد التي تم تقييمها.');
 return {status,results:out,rules:checks,reasons,policyName,engineVersion:'4.0.0'};
}
function summarize(points){const p=ordered(points.filter(x=>finite(x.z)));const z=p.map(x=>Number(x.z));const n=z.length;if(!n)return {n:0,meanZ:null,sdZ:null,cvZ:null,bias:'غير متاح'};const mean=z.reduce((a,b)=>a+b,0)/n;const sd=n>1?Math.sqrt(z.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)):null;return {n,meanZ:mean,sdZ:sd,cvZ:sd!==null&&mean!==0?Math.abs(sd/mean)*100:null,bias:mean>0?'انحياز موجب محتمل':mean<0?'انحياز سالب محتمل':'متوسط Z يساوي صفراً',trend:n>=7&&(z.slice(-7).every((v,i,a)=>i===0||v>a[i-1])||z.slice(-7).every((v,i,a)=>i===0||v<a[i-1])),shift:n>=8&&(z.slice(-8).every(v=>v>0)||z.slice(-8).every(v=>v<0)),note:'إحصاء وصفي لسلسلة Z فقط؛ لا يثبت سبب الخطأ ولا يحدد صلاحية الأداء دون مواصفات أداء معتمدة.'}}
g.QCEngine={zScore,cv,evaluate,summarize};
})(window);