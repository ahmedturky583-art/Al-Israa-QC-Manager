const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../assets/qc-engine.js','utf8'),context);
const E=context.window.QCEngine;
const mk=(z,targetId='T',day=1)=>({targetId,z,runAt:`2026-11-${String(day).padStart(2,'0')}T10:00:00Z`});
function evaluate(zs,history=[],levels=['L1']){
 return E.evaluate({policy:'Westgard Multi-rules',history,results:zs.map((z,i)=>({level:levels[i],targetId:'T'+i,value:10+z*2,mean:10,sd:2}))});
}
assert.strictEqual(E.zScore(12,10,2),1);
assert.throws(()=>E.zScore(1,1,0));
assert.throws(()=>E.zScore('x',1,2));
let r=evaluate([2.2]);assert.strictEqual(r.status,'warning');assert(r.results[0].warnings.includes('1_2s'));
r=evaluate([3]);assert.strictEqual(r.status,'rejected');assert(r.results[0].violations.includes('1_3s'));
r=evaluate([2.3],[mk(2.2,'T0')]);assert(r.results[0].violations.includes('2_2s'));
r=evaluate([2,-2],[],['L1','L2']);assert(r.results.every(x=>x.violations.includes('R_4s')));
const hist4=[-1.2,-1.3,-1.1].map((z,i)=>mk(z,'T0',i+1));
r=evaluate([-1.4],hist4);assert(r.results[0].violations.includes('4_1s'));
const hist10=Array.from({length:9},(_,i)=>mk(.2,'T0',i+1));
r=evaluate([.3],hist10);assert(r.results[0].violations.includes('10x'));
r=evaluate([0]);assert.strictEqual(r.status,'incomplete');
const hist7=[.1,.2,.3,.4,.5,.6].map((z,i)=>mk(z,'T0',i+1));
r=evaluate([.7],hist7);assert(r.results[0].warnings.includes('7T'));
const hist8=Array.from({length:7},(_,i)=>mk(.1,'T0',i+1));
r=evaluate([.2],hist8);assert(r.results[0].warnings.includes('8x'));
const series=E.analyzeSeries([mk(.2),mk(.3),mk(.4),mk(.5),mk(.6),mk(.7),mk(.8),mk(.9)]);
assert.strictEqual(series.n,8);assert.strictEqual(series.trend,true);assert.strictEqual(series.shift,true);
console.log('PASS: 13 QC engine assertions');
