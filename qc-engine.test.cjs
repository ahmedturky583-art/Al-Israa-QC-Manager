const assert=require('node:assert/strict');global.window=global;require('../assets/qc-engine.js');const E=global.QCEngine;let passed=0;function test(name,fn){fn();passed++;console.log('PASS',name)}
test('Z score',()=>assert.equal(E.zScore(12,10,2),1));test('CV percent',()=>assert.equal(E.cv(2,100),2));test('reject SD zero',()=>assert.throws(()=>E.zScore(1,1,0)));
const r=(z,id='t',level='L1')=>({targetId:id,level,value:10+z,mean:10,sd:1});
test('incomplete takes priority over warning when required sequence unavailable',()=>assert.equal(E.evaluate({results:[r(2.2)],rules:['1_2s','10x']}).status,'incomplete'));
test('1-2s warning only',()=>{const x=E.evaluate({results:[r(2.2)],rules:['1_2s']});assert.equal(x.status,'warning');assert.deepEqual(x.results[0].violations,[])});
test('1-3s rejection',()=>assert.equal(E.evaluate({results:[r(3.1)],rules:['1_3s']}).status,'rejected'));
test('2-2s same side consecutive',()=>assert.equal(E.evaluate({results:[r(2.1)],history:[{targetId:'t',z:2.2,runAt:'2026-01-01'}],rules:['2_2s']}).status,'rejected'));
test('2-2s opposite side does not reject',()=>assert.equal(E.evaluate({results:[r(2.1)],history:[{targetId:'t',z:-2.2,runAt:'2026-01-01'}],rules:['2_2s']}).status,'accepted'));
test('R4s requires opposite +/-2SD levels',()=>assert.equal(E.evaluate({results:[r(2.1,'a','L1'),r(-2.2,'b','L2')],rules:['R_4s']}).status,'rejected'));
test('R4s does not evaluate duplicate same-level records',()=>assert.equal(E.evaluate({results:[r(2.1,'a','L1'),r(-2.2,'b','L1')],rules:['R_4s']}).status,'incomplete'));
test('R4s does not flag same side',()=>assert.equal(E.evaluate({results:[r(2.1,'a','L1'),r(2.2,'b','L2')],rules:['R_4s']}).status,'accepted'));
test('4-1s needs four same-side results',()=>assert.equal(E.evaluate({results:[r(1.2)],history:[{targetId:'t',z:1.1,runAt:'2026-01-01'},{targetId:'t',z:1.3,runAt:'2026-01-02'},{targetId:'t',z:1.4,runAt:'2026-01-03'}],rules:['4_1s']}).status,'rejected'));
test('10x needs ten same-side points',()=>assert.equal(E.evaluate({results:[r(.2)],history:Array.from({length:9},(_,i)=>({targetId:'t',z:.3,runAt:`2026-01-${String(i+1).padStart(2,'0')}`})),rules:['10x']}).status,'rejected'));
test('trend seven monotonic',()=>assert.equal(E.evaluate({results:[r(1.6)],history:[1,1.1,1.2,1.3,1.4,1.5].map((z,i)=>({targetId:'t',z,runAt:`2026-01-${i+1}`})),rules:['7t']}).status,'warning'));
test('insufficient sequential data flagged incomplete',()=>assert.equal(E.evaluate({results:[r(.1)],rules:['10x']}).status,'incomplete'));
test('summary meanZ',()=>assert.equal(E.summarize([{z:1,runAt:'2026-01-01'},{z:3,runAt:'2026-01-02'}]).meanZ,2));console.log(`${passed} tests passed`);