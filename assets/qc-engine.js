/* QC Engine 4.0.1 — deterministic QC calculations; configure only under the laboratory SOP. */
(function (g) {
  'use strict';
  const numeric = v => v !== null && v !== undefined && typeof v !== 'boolean' && String(v).trim() !== '' && Number.isFinite(Number(v));
  const n = v => Number(v);
  const KNOWN = new Set(['1_2s','1_3s','2_2s','R_4s','4_1s','10x','7t','8x']);

  function zScore(value, mean, sd) {
    if (!numeric(value) || !numeric(mean) || !numeric(sd) || n(sd) <= 0) {
      throw new Error('القيم يجب أن تكون رقمية وSD أكبر من صفر');
    }
    return (n(value) - n(mean)) / n(sd);
  }

  function cv(sd, mean) {
    if (!numeric(sd) || !numeric(mean) || n(sd) < 0 || n(mean) === 0) return null;
    return Math.abs(n(sd) / n(mean)) * 100;
  }

  function ordered(points) {
    return [...points].sort((a,b) => Date.parse(a.runAt || 0) - Date.parse(b.runAt || 0));
  }

  function evaluate({ results = [], history = [], rules = ['1_2s','1_3s','2_2s','R_4s','4_1s','10x'], policyName = 'سياسة غير مسماة' } = {}) {
    if (!Array.isArray(results) || results.length === 0) {
      return { status:'incomplete', results:[], rules:[], reasons:['لا توجد قراءات'], policyName, engineVersion:'4.0.1' };
    }
    if (!Array.isArray(history) || !Array.isArray(rules)) throw new Error('صيغة سجل QC أو السياسة غير صحيحة');
    const unknown = rules.filter(rule => !KNOWN.has(rule));
    if (unknown.length) throw new Error('قواعد QC غير معروفة: ' + unknown.join(', '));
    const out = results.map(r => ({ ...r, z:zScore(r.value,r.mean,r.sd), violations:[], warnings:[] }));
    const checks = [];
    const add = (rule,state,detail,scope='per-level') => checks.push({rule,state,detail,scope});

    for (const r of out) {
      const az = Math.abs(r.z);
      if (rules.includes('1_3s')) {
        const hit = az >= 3;
        if (hit) r.violations.push('1_3s');
        add('1_3s',hit?'violation':'pass',hit?`|Z|=${az.toFixed(2)} ≥ 3`:`|Z|=${az.toFixed(2)} لا يتجاوز 3`);
      }
      if (rules.includes('1_2s')) {
        const hit = az > 2 && az < 3;
        if (hit) r.warnings.push('1_2s');
        add('1_2s',hit?'warning':'pass',hit?`|Z|=${az.toFixed(2)} يتجاوز 2SD؛ إنذار فقط`:'لا يوجد تجاوز منفرد 2SD');
      }
      if (numeric(r.lower) && n(r.value) < n(r.lower)) {
        r.violations.push('حد أدنى'); add('حد أدنى','violation',`${r.value} < ${r.lower}`);
      }
      if (numeric(r.upper) && n(r.value) > n(r.upper)) {
        r.violations.push('حد أعلى'); add('حد أعلى','violation',`${r.value} > ${r.upper}`);
      }
    }

    for (const r of out) {
      const seq = ordered(history.filter(h => h.targetId === r.targetId && numeric(h.z))).map(h => n(h.z));
      const z = r.z;
      const checkSeq = (rule,count,predicate,label,classification='violation') => {
        if (!rules.includes(rule)) return;
        const values = seq.slice(-(count-1)).concat(z);
        if (values.length < count) {
          add(rule,'not_evaluated',`بيانات غير كافية: ${values.length}/${count}`);
          return;
        }
        const hit = predicate(values);
        if (hit) {
          if (classification === 'warning') r.warnings.push(rule);
          else r.violations.push(rule);
        }
        add(rule,hit?classification:'pass',hit?label:`لا تتحقق ${rule} في آخر ${count} قراءات`);
      };
      checkSeq('2_2s',2,a => a.every(v => Math.abs(v)>2) && a.every(v => Math.sign(v)===Math.sign(a[0])),'قراءتان متتاليتان تتجاوزان 2SD على الجانب نفسه');
      checkSeq('4_1s',4,a => a.every(v => Math.abs(v)>1) && a.every(v => Math.sign(v)===Math.sign(a[0])),'أربع قراءات متتالية تتجاوز 1SD على الجانب نفسه');
      checkSeq('10x',10,a => a.every(v => v!==0 && Math.sign(v)===Math.sign(a[0])),'عشر قراءات متتالية على جانب واحد من المتوسط');
      checkSeq('7t',7,a => a.every((v,i)=>i===0||v>a[i-1]) || a.every((v,i)=>i===0||v<a[i-1]),'سبع نقاط متتالية متصاعدة أو متناقصة','warning');
      checkSeq('8x',8,a => a.every(v => v!==0 && Math.sign(v)===Math.sign(a[0])),'ثماني قراءات متتالية على جانب واحد من المتوسط','warning');
    }

    if (rules.includes('R_4s')) {
      const levels = new Set(out.map(r => r.level).filter(v => v !== undefined && v !== null && v !== ''));
      const contextFields = ['targetProduct','product','lot','analyte','kind'];
      const mixed = contextFields.some(k => new Set(out.map(r=>r[k]).filter(v=>v!==undefined)).size > 1);
      if (levels.size < 2 || mixed) {
        add('R_4s','not_evaluated',mixed?'مستويات QC ليست من سياق مادة/LOT/تحليل/نوع هدف واحد':'يلزم مستويان مختلفان على الأقل في التشغيل نفسه','within-run-between-levels');
      } else {
        const high = out.some(r=>r.z>2), low = out.some(r=>r.z< -2);
        const hit = high && low;
        if (hit) out.forEach(r=>r.violations.push('R_4s'));
        add('R_4s',hit?'violation':'pass',hit?'مستوى أعلى من +2SD وآخر أدنى من −2SD ضمن التشغيل نفسه':'لا تتحقق R₄s بين المستويات المدخلة','within-run-between-levels');
      }
    }

    const rejected = out.some(r=>r.violations.length>0);
    const warning = out.some(r=>r.warnings.length>0);
    const incomplete = checks.some(c=>c.state==='not_evaluated');
    const status = rejected?'rejected':incomplete?'incomplete':warning?'warning':'accepted';
    const reasons = checks.filter(c=>['violation','warning','not_evaluated'].includes(c.state)).map(c=>`${c.rule}: ${c.detail}`);
    if (!reasons.length) reasons.push('لا توجد مخالفة ضمن القواعد التي تم تقييمها.');
    return {status,results:out,rules:checks,reasons,policyName,engineVersion:'4.0.1'};
  }

  function summarize(points) {
    const p = ordered(points.filter(x=>numeric(x.z)));
    const z = p.map(x=>n(x.z)), count=z.length;
    if (!count) return {n:0,meanZ:null,sdZ:null,cvZ:null,bias:'غير متاح',trend:false,shift:false,note:'لا توجد نقاط صالحة.'};
    const mean=z.reduce((a,b)=>a+b,0)/count;
    const sd=count>1?Math.sqrt(z.reduce((a,b)=>a+(b-mean)**2,0)/(count-1)):null;
    const tail7=z.slice(-7),tail8=z.slice(-8);
    return {
      n:count,meanZ:mean,sdZ:sd,cvZ:sd!==null&&mean!==0?Math.abs(sd/mean)*100:null,
      bias:mean>0?'انحياز موجب محتمل':mean<0?'انحياز سالب محتمل':'متوسط Z يساوي صفراً',
      trend:tail7.length===7&&(tail7.every((v,i)=>i===0||v>tail7[i-1])||tail7.every((v,i)=>i===0||v<tail7[i-1])),
      shift:tail8.length===8&&tail8.every(v=>v!==0&&Math.sign(v)===Math.sign(tail8[0])),
      note:'إحصاء وصفي لسلسلة Z فقط؛ لا يثبت سبب الخطأ ولا يحدد صلاحية الأداء دون مواصفات أداء معتمدة.'
    };
  }
  g.QCEngine={zScore,cv,evaluate,summarize};
})(window);
