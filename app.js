(() => {
"use strict";
const $ = id => document.getElementById(id);
const attractions = {
  tdl:[['beauty','美女と野獣“魔法のものがたり”'],['baymax','ベイマックスのハッピーライド'],['splash','スプラッシュ・マウンテン'],['bigthunder','ビッグサンダー・マウンテン'],['haunted','ホーンテッドマンション'],['pooh','プーさんのハニーハント'],['monsters','モンスターズ・インク“ライド＆ゴーシーク！”']],
  tds:[['frozen','アナとエルサのフローズンジャーニー'],['tangled','ラプンツェルのランタンフェスティバル'],['peterpan','ピーターパンのネバーランドアドベンチャー'],['soaring','ソアリン：ファンタスティック・フライト'],['toy','トイ・ストーリー・マニア！'],['tot','タワー・オブ・テラー'],['journey','センター・オブ・ジ・アース'],['raging','レイジングスピリッツ'],['indiana','インディ・ジョーンズ・アドベンチャー']]
};
let dataset = {records:[],aggregateBenchmarks:[],datasetUpdatedAt:null};
function fillAttractions(){const el=$('sim-attraction'),old=el.value;el.innerHTML='';for(const [id,name] of attractions[$('sim-park').value]){const o=document.createElement('option');o.value=id;o.textContent=name;el.append(o);}if([...el.options].some(o=>o.value===old))el.value=old;}
function dayType(date){const d=new Date(date+'T12:00:00');return [0,6].includes(d.getDay())?'weekend':'weekday';}
function parseTime(t){if(!t||!/^[0-2]\d:[0-5]\d$/.test(t))return null;const [h,m]=t.split(':').map(Number);return h*60+m;}
function fmtTime(n){if(!Number.isFinite(n))return '—';n=Math.round(n);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function median(values){const a=[...values].sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function predict(){
 const date=$('sim-date').value,park=$('sim-park').value,id=$('sim-attraction').value;
 if(!date){alert('来園日を選択してください。');return;}
 const out=$('prediction');out.style.display='block';
 const rows=dataset.records.filter(r=>r.park===park&&r.attractionId===id&&r.sourceType==='observed');
 const confirmed=rows.filter(r=>['sold_out','available_close'].includes(r.status));
 const sold=confirmed.filter(r=>r.status==='sold_out'),available=confirmed.filter(r=>r.status==='available_close');
 const probability=$('probability');
 if(confirmed.length>=10&&sold.length>=3&&available.length>=3){probability.textContent=Math.round((sold.length+1)/(confirmed.length+2)*100)+'%';$('prediction-summary').textContent='過去の記録をもとにした参考値です。';}
 else {probability.textContent='まだ予測できません';$('prediction-summary').textContent='売り切れた日と、閉園まで販売されていた日の記録がまだ十分に集まっていないため、売り切れ確率は表示できません。';}
 // Use recorded disappearance/end-of-sales times only as a rough time-of-day reference, not as confirmed sellouts.
 const usable=rows.filter(r=>['sales_ended_or_unavailable','near_close_or_sales_ended','sold_out'].includes(r.status)&&parseTime(r.observedEndTime||r.selloutTime)!==null);
 const wanted=usable.filter(r=>dayType(r.date)===dayType(date));
 const sample=wanted.length>=3?wanted:usable;
 const mins=sample.map(r=>parseTime(r.observedEndTime||r.selloutTime));
 const med=median(mins);
 $('median-time').textContent=med===null?'—':'約'+fmtTime(med);
 if(med!==null){$('prediction-summary').textContent+=' 販売が終了・受付終了した時刻の過去記録を参考にした目安です。売り切れ時刻と異なる場合があります。';}
 $('prediction-caveat').textContent='売り切れ時刻は目安です。購入前に公式アプリで販売状況をご確認ください。';
}
async function loadData(){try{const response=await fetch('./data/dpa-history.json',{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const incoming=await response.json();if(!Array.isArray(incoming.records)||!Array.isArray(incoming.aggregateBenchmarks))throw new Error('Invalid data format');dataset=incoming;}catch(e){dataset={records:[],aggregateBenchmarks:[],datasetUpdatedAt:null};console.error('DPA data could not be loaded',e);}}
function init(){const now=new Date();$('sim-date').value=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');fillAttractions();$('sim-park').addEventListener('change',fillAttractions);$('predict-btn').addEventListener('click',predict);loadData();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));}
init();
})();
