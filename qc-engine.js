/* Al-Israa QC engine 3.2.0
   Rule implementation is an auditable screening aid, not a validated medical-device decision engine.
   Confirm rule scope, run frequency and thresholds against the laboratory's approved SOP before use. */
(function(g){
"use strict";
const zScore=(value,mean,sd)=>{
 const v=Number(value),m=Number(mean),s=Number(sd);
 if(!Number.isFinite(v)||!Number.isFinite(m)||!Number.isFinite(s)||s<=0)
  throw Error("يجب إدخال قراءة وMean وSD رقمية، وأن تكون SD أكبر من صفر");
 return (v-m)/s;
};
const ordered=a=>a.slice().sort((x,y)=>new Date(x.runAt)-new Date(y.runAt));
const sign=v=>v>0?1:v<0?-1:0;
function evaluate({results=[],history=[],policy="Westgard Multi-rules"}={}){
 if(!Array.isArray(results)||!results.length)return {status:"incomplete",results:[],rules:[],reasons:["لا توجد قراءات"],policy};
 const multi=/Westgard/i.test(policy);
 const out=results.map(r=>({...r,z:zScore(r.value,r.mean,r.sd),violations:[],warnings:[]}));
 const rules=[];
 const add=(rule,state,detail,level="—",scope="within-level")=>rules.push({rule,state,detail,level,scope});
 out.forEach(r=>{
  const az=Math.abs(r.z);
  if(az>=3){r.violations.push("1_3s");add("1_3s","violation",`|Z| ${az.toFixed(2)} ≥ 3`,r.level)}
  else add("1_3s","pass",`|Z| ${az.toFixed(2)} < 3`,r.level);
  if(az>=2&&az<3){r.warnings.push("1_2s");add("1_2s","warning",`|Z| ${az.toFixed(2)} بين 2 و3؛ إنذار لا رفض منفرد`,r.level)}
  else add("1_2s","pass","لا يوجد تجاوز منفرد لحد ±2SD",r.level);
  if(r.lower!==null&&r.lower!==undefined&&r.lower!==""&&Number(r.value)<Number(r.lower)){
   r.violations.push("Configured lower limit");add("حد المختبر الأدنى","violation",`${r.value} < ${r.lower}`,r.level);
  }
  if(r.upper!==null&&r.upper!==undefined&&r.upper!==""&&Number(r.value)>Number(r.upper)){
   r.violations.push("Configured upper limit");add("حد المختبر الأعلى","violation",`${r.value} > ${r.upper}`,r.level);
  }
 });
 if(multi){
  for(const r of out){
   const prev=ordered(history.filter(h=>h.targetId===r.targetId&&Number.isFinite(Number(h.z))));
   const z=prev.map(x=>Number(x.z));
   const current=Number(r.z);
   const last2=z.slice(-1).concat(current);
   if(last2.length===2&&last2.every(v=>Math.abs(v)>=2)&&sign(last2[0])===sign(last2[1])){
    r.violations.push("2_2s");add("2_2s","violation","قراءتان متتاليتان ≥2SD على الجانب نفسه",r.level);
   }else add("2_2s",prev.length?"pass":"not_evaluated",prev.length?"لا تتحقق القاعدة في آخر قراءتين":"لا توجد قراءة سابقة لنفس الهدف",r.level);
   const seq4=z.slice(-3).concat(current);
   if(seq4.length===4&&seq4.every(v=>Math.abs(v)>=1)&&seq4.every(v=>sign(v)===sign(current))){
    r.violations.push("4_1s");add("4_1s","violation","أربع نتائج متتالية ≥1SD على الجانب نفسه",r.level);
   }else add("4_1s",seq4.length===4?"pass":"not_evaluated",seq4.length===4?"لا تتحقق القاعدة في آخر أربع قراءات":`المتاح ${seq4.length}/4`,r.level);
   const seq10=z.slice(-9).concat(current);
   if(seq10.length===10&&seq10.every(v=>sign(v)===sign(current))&&sign(current)!==0){
    r.violations.push("10x");add("10x","violation","عشر نتائج متتالية على جانب واحد من المتوسط",r.level);
   }else add("10x",seq10.length===10?"pass":"not_evaluated",seq10.length===10?"لا تتحقق القاعدة في آخر عشر قراءات":`المتاح ${seq10.length}/10`,r.level);
   // Trend: seven successive strictly increasing or decreasing control values.
   const seq7=z.slice(-6).concat(current);
   const inc=seq7.length===7&&seq7.every((v,i)=>i===0||v>seq7[i-1]);
   const dec=seq7.length===7&&seq7.every((v,i)=>i===0||v<seq7[i-1]);
   if(inc||dec){r.warnings.push("7T");add("7T","warning",inc?"سبع نقاط متتالية متصاعدة":"سبع نقاط متتالية متناقصة",r.level)}
   else add("7T",seq7.length===7?"pass":"not_evaluated",seq7.length===7?"لا يظهر اتجاه رتيب من سبع نقاط":`المتاح ${seq7.length}/7`,r.level);
   // Shift: eight consecutive values on one side; explicitly distinct from 10x.
   const seq8=z.slice(-7).concat(current);
   if(seq8.length===8&&seq8.every(v=>sign(v)===sign(current))&&sign(current)!==0){
    r.warnings.push("8x");add("8x","warning","ثماني نقاط متتالية على جانب واحد من المتوسط",r.level);
   }else add("8x",seq8.length===8?"pass":"not_evaluated",seq8.length===8?"لا يظهر Shift وفق معيار 8x":"يلزم ثماني نقاط متتالية",r.level);
  }
  if(out.length>=2){
   const zs=out.map(r=>r.z),hasPos=zs.some(v=>v>=2),hasNeg=zs.some(v=>v<=-2);
   if(hasPos&&hasNeg&&Math.max(...zs)-Math.min(...zs)>=4){
    out.forEach(r=>r.violations.push("R_4s"));
    add("R_4s","violation","فرق ≥4SD بين نتائج مستويات مختلفة ضمن التشغيل نفسه","عدة مستويات","within-run-between-levels");
   }else add("R_4s","pass","لا يظهر فرق ≥4SD بين المستويات المدخلة","عدة مستويات","within-run-between-levels");
  }else add("R_4s","not_evaluated","يلزم قياسان على الأقل لمستويين في التشغيل نفسه","عدة مستويات","within-run-between-levels");
 }
 const rejected=out.some(r=>r.violations.length);
 const warned=out.some(r=>r.warnings.length)||rules.some(x=>x.state==="warning");
 const incomplete=rules.some(x=>x.state==="not_evaluated");
 const status=rejected?"rejected":warned?"warning":incomplete?"incomplete":"accepted";
 const reasons=rules.filter(x=>["violation","warning","not_evaluated"].includes(x.state))
  .map(x=>`${x.rule}: ${x.state==="violation"?"مخالفة":x.state==="warning"?"تحذير": "لم يُقيّم"} — ${x.detail}${x.level!=="—"?" ("+x.level+")":""}`);
 if(!reasons.length)reasons.push("لم تتحقق مخالفة في القواعد التي تم تقييمها.");
 return {status,results:out,rules,reasons,policy,engineVersion:"3.2.0"};
}
function analyzeSeries(points){
 const p=ordered(points.filter(x=>Number.isFinite(Number(x.z))));
 const z=p.map(x=>Number(x.z));
 const n=z.length,mean=n?z.reduce((a,b)=>a+b,0)/n:null;
 const sd=n>1?Math.sqrt(z.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)):null;
 const biasDirection=mean===null?"غير متاح":mean>0?"Positive bias محتمل":mean<0?"Negative bias محتمل":"لا يوجد انحياز متوسط";
 const trend=n>=7&&(z.slice(-7).every((v,i,a)=>i===0||v>a[i-1])||z.slice(-7).every((v,i,a)=>i===0||v<a[i-1]));
 const tail8=z.slice(-8);
 const shift=n>=8&&(tail8.every(v=>v>0)||tail8.every(v=>v<0));
 return {n,meanZ:mean,sdZ:sd,biasDirection,trend:!!trend,shift:!!shift,
  randomError:n<2?"بيانات غير كافية":sd>1.5?"تشتت Z مرتفع نسبياً — يحتاج تحقيقاً":"لا يظهر ارتفاع واضح في SD(Z) وفق هذا المؤشر الوصفي",
  note:"تحليل وصفي استكشافي فقط؛ لا يثبت سبب الخطأ ولا يستبدل حدود الأداء التحليلي أو إجراء المختبر."};
}
g.QCEngine={zScore,evaluate,analyzeSeries};
})(window);
