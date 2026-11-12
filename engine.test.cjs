const fs=require("fs"),vm=require("vm"),assert=require("assert");
const sandbox={window:{},console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("assets/qc-engine.js","utf8"),sandbox);
const E=sandbox.window.AlIsraaQCEngine;
assert(Math.abs(E.zScore(12,10,1)-2)<1e-12);
let r=E.evaluateSingleLevel({value:12,target:{mean:10,sd:1},history:[],enabledRules:["1_2S"]});
assert.equal(r.status,"warning");assert.deepEqual(Array.from(r.warnings),["1_2S"]);
r=E.evaluateSingleLevel({value:13,target:{mean:10,sd:1},history:[],enabledRules:["1_3S"]});
assert.equal(r.status,"rejected");
const stats=E.calculateStatistics([2,4,6]);
assert.equal(stats.mean,4);assert.equal(stats.sd,2);assert.equal(stats.cvPercent,50);
assert.equal(E.calculateSigma({teaPercent:10,biasPercent:2,cvPercent:2}),4);
const ten=Array.from({length:9},(_,i)=>({z:1.2,runAt:new Date(2025,0,i+1).toISOString()}));
r=E.evaluateSingleLevel({value:11.2,target:{mean:10,sd:1},history:ten,enabledRules:["10X"]});
assert(r.violations.includes("10X"));
const mixed=ten.slice();mixed[0]={z:-1.2,runAt:"2025-01-01T00:00:00Z"};
r=E.evaluateSingleLevel({value:11.2,target:{mean:10,sd:1},history:mixed,enabledRules:["10X"]});
assert(!r.violations.includes("10X"));
let threw=false;try{E.calculateSigma({teaPercent:10,biasPercent:1,cvPercent:0})}catch(e){threw=true}assert(threw);

const r4=E.evaluateR4sSameRun([
 {levelId:"L1",value:13,mean:10,sd:1},
 {levelId:"L2",value:7,mean:10,sd:1}
]);
assert.equal(r4.triggered,true);
const noR4=E.evaluateR4sSameRun([
 {levelId:"L1",value:12,mean:10,sd:1},
 {levelId:"L2",value:11,mean:10,sd:1}
]);
assert.equal(noR4.triggered,false);
const nearR4=E.evaluateR4sSameRun([{levelId:"L1",value:13.9,mean:10,sd:1},{levelId:"L2",value:9.9,mean:10,sd:1}]);
assert.equal(nearR4.triggered,false);
assert(Math.abs(E.calculatePercentBias({measuredMean:102,comparisonValue:100})-2)<1e-12);
const snap=E.globalExportSnapshot({deviceId:"D",analyteId:"A",lotId:"LOT",targets:[{mean:1}],rules:["1_3S"],policyReference:"POL-1",engineVersion:"test"});
assert.equal(snap.engineVersion,"test");assert.equal(snap.targets.length,1);
console.log("PASS: 10 engine test groups");
