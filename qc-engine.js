/* Al-Israa QC engine — preliminary, transparent implementation.
 * This is not yet clinically validated. Rule scope is intentionally explicit.
 */
(function(global){
  "use strict";
  function zScore(value, mean, sd){
    if (![value,mean,sd].every(Number.isFinite) || sd <= 0) throw new Error("Invalid QC target/value");
    return (value-mean)/sd;
  }
  function sameSide(a,b){ return Math.sign(a) !== 0 && Math.sign(a) === Math.sign(b); }
  function evaluateSingleLevel({value,target,history=[],enabledRules=[]}){
    const z=zScore(value,target.mean,target.sd);
    const hist=[...history].sort((a,b)=>new Date(a.runAt)-new Date(b.runAt));
    const violations=[], warnings=[], evidence={};
    const enabled=new Set(enabledRules);
    if(enabled.has("1_2S") && Math.abs(z)>=2){warnings.push("1_2S");evidence["1_2S"]={z};}
    if(enabled.has("1_3S") && Math.abs(z)>=3){violations.push("1_3S");evidence["1_3S"]={z};}
    if(enabled.has("2_2S")){
      const seq=[...hist.slice(-1),{z,runAt:new Date().toISOString()}];
      if(seq.length===2 && seq.every(x=>Math.abs(x.z)>=2) && sameSide(seq[0].z,seq[1].z)){
        violations.push("2_2S");evidence["2_2S"]={zScores:seq.map(x=>x.z)};
      }
    }
    if(enabled.has("4_1S")){
      const seq=[...hist.slice(-3),{z,runAt:new Date().toISOString()}];
      if(seq.length===4 && seq.every(x=>Math.abs(x.z)>=1) && seq.every(x=>sameSide(x.z,seq[0].z))){
        violations.push("4_1S");evidence["4_1S"]={zScores:seq.map(x=>x.z)};
      }
    }
    if(enabled.has("10X")){
      const seq=[...hist.slice(-9),{z,runAt:new Date().toISOString()}];
      if(seq.length===10 && (seq.every(x=>x.z>0)||seq.every(x=>x.z<0))){
        violations.push("10X");evidence["10X"]={zScores:seq.map(x=>x.z)};
      }
    }
    const status=violations.length?"rejected":warnings.length?"warning":"accepted";
    return {z,violations,warnings,status,evidence,engineVersion:"0.2.0-prevalidation"};
  }
  function calculateStatistics(values){
    const x=values.filter(Number.isFinite);
    if(x.length<2) throw new Error("At least two numeric values are required");
    const mean=x.reduce((a,b)=>a+b,0)/x.length;
    const variance=x.reduce((a,v)=>a+(v-mean)**2,0)/(x.length-1);
    const sd=Math.sqrt(variance);
    return {n:x.length,mean,sd,cvPercent:mean===0?null:Math.abs(sd/mean)*100};
  }
  function calculateSigma({teaPercent,biasPercent,cvPercent}){
    if (![teaPercent,biasPercent,cvPercent].every(Number.isFinite) || cvPercent<=0 || teaPercent<0)
      throw new Error("Invalid or incomplete TEa/Bias/CV inputs");
    return (teaPercent-Math.abs(biasPercent))/cvPercent;
  }
  function evaluateR4sSameRun(levelResults){
    // Requires at least two distinct QC levels for the same analyte and same run.
    if(!Array.isArray(levelResults) || levelResults.length<2)
      return {triggered:false,reason:"R4S requires at least two QC levels in the same run"};
    const zs=levelResults.map(x=>({levelId:x.levelId,z:zScore(x.value,x.mean,x.sd)}));
    for(let i=0;i<zs.length;i++){
      for(let j=i+1;j<zs.length;j++){
        if(zs[i].levelId===zs[j].levelId) continue;
        if(((zs[i].z>=2 && zs[j].z<=-2)||(zs[j].z>=2 && zs[i].z<=-2)) && Math.abs(zs[i].z-zs[j].z)>=4){
          return {triggered:true,rule:"R_4S",levels:[zs[i],zs[j]]};
        }
      }
    }
    return {triggered:false,levels:zs};
  }
  function calculatePercentBias({measuredMean,comparisonValue}){
    if(!Number.isFinite(measuredMean)||!Number.isFinite(comparisonValue)||comparisonValue===0)
      throw new Error("Bias requires valid measured mean and non-zero comparison value");
    return ((measuredMean-comparisonValue)/comparisonValue)*100;
  }
  function globalExportSnapshot({deviceId,analyteId,lotId,targets,rules,policyReference,engineVersion}){
    if(!deviceId||!analyteId||!lotId||!Array.isArray(targets)||!Array.isArray(rules)||!engineVersion)
      throw new Error("Incomplete evaluation provenance");
    return Object.freeze({
      deviceId,analyteId,lotId,
      targets:targets.map(x=>({...x})),
      rules:[...rules],
      policyReference:policyReference||null,
      engineVersion,
      capturedAt:new Date().toISOString()
    });
  }
  global.AlIsraaQCEngine={zScore,evaluateSingleLevel,calculateStatistics,calculateSigma,
    evaluateR4sSameRun,calculatePercentBias,globalExportSnapshot};
})(window);
