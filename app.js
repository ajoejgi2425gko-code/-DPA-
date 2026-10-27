(() => {
"use strict";
const $ = id => document.getElementById(id);
const parkNames = {tdl:"東京ディズニーランド",tds:"東京ディズニーシー"};
const attractions = {
  tdl:[['beauty','美女と野獣“魔法のものがたり”'],['baymax','ベイマックスのハッピーライド'],['splash','スプラッシュ・マウンテン'],['bigthunder','ビッグサンダー・マウンテン'],['pooh','プーさんのハニーハント'],['monsters','モンスターズ・インク“ライド＆ゴーシーク！”']],
  tds:[['frozen','アナとエルサのフローズンジャーニー'],['tangled','ラプンツェルのランタンフェスティバル'],['peterpan','ピーターパンのネバーランドアドベンチャー'],['soaring','ソアリン：ファンタスティック・フライト'],['toy','トイ・ストーリー・マニア！'],['tot','タワー・オブ・テラー'],['journey','センター・オブ・ジ・アース'],['raging','レイジングスピリッツ'],['indiana','インディ・ジョーンズ・アドベンチャー']]
};
let dataset = {records:[],aggregateBenchmarks:[],datasetUpdatedAt:null};
const labels = Object.fromEntries(Object.values(attractions).flat().map(([id,name])=>[id,name]));
function fillAttractions(){const el=$('sim-attraction'),old=el.value;el.innerHTML='';for(const [id,name] of attractions[$('sim-park').value]){const o=document.createElement('option');o.value=id;o.textContent=name;el.append(o);}if([...el.options].some(o=>o.value===old))el.value=old;}
function dayType(date){const d=new Date(date+'T12:00:00');return [0,6].includes(d.getDay())?'weekend':'weekday';}
function parseTime(t){if(!t||!/^\d\d:\d\d$/.test(t))return null;const [h,m]=t.split(':').map(Number);return h*60+m;}
function fmtTime(n){if(!Number.isFinite(n))return '—';n=Math.round(n);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function quantile(rows,q){const sorted=[...rows].sort((a,b)=>a.mins-b.mins);return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))]?.mins;}
function predict(){const date=$('sim-date').value,park=$('sim-park').value,id=$('sim-attraction').value;if(!date){alert('来園日を選択してください。');return;}const rows=dataset.records.filter(r=>r.park===park&&r.attractionId===id&&r.sourceType==='observed'&&['sold_out','available_close'].includes(r.status));const sold=rows.filter(r=>r.status==='sold_out'),available=rows.filter(r=>r.status==='available_close');const out=$('prediction');out.style.display='block';$('probability').textContent='データ不足';$('median-time').textContent='—';$('confidence').textContent=rows.length>=30?'比較的多い':rows.length>=10?'限定的':'不足';
if(rows.length>=10&&sold.length>=3&&available.length>=3){$('probability').textContent=Math.round((sold.length+1)/(rows.length+2)*100)+'%';$('prediction-summary').textContent=`日付別の判定可能な観測 ${rows.length}日（販売終了 ${sold.length}日／閉園まで販売あり ${available.length}日）を使った簡易推定です。十分な精度検証はまだ行っていません。`;}else{$('prediction-summary').textContent=`この施設の判定可能な日付別記録は ${rows.length}日（販売終了 ${sold.length}日／閉園まで販売あり ${available.length}日）です。確率表示の目安である合計10日以上、各結果3日以上に達していません。`}
const times=sold.map(r=>({mins:parseTime(r.selloutTime),date:r.date})).filter(r=>r.mins!==null);if(times.length>=3){$('median-time').textContent=fmtTime(quantile(times,.5));}else{const kind=dayType(date)==='weekend'?'weekend_median':'weekday_median';const b=dataset.aggregateBenchmarks.find(x=>x.park===park&&x.attractionId===id&&x.kind===kind);if(b){$('median-time').textContent='約'+b.value;$('prediction-summary').textContent+=' 日付別記録が不足しているため、時刻は集計サイトの曜日別中央値を参考表示しています（'+b.sampleDays+'日分、確率推定とは別データ）。';}}
$('prediction-caveat').textContent=`売り切れ時刻は目安です。販売状況は当日の状況によって変わることがあります。購入前に公式アプリでご確認ください。`;
}
async function loadData(){try{const response=await fetch('./data/dpa-history.json',{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const incoming=await response.json();if(!Array.isArray(incoming.records)||!Array.isArray(incoming.aggregateBenchmarks))throw new Error('Invalid data format');dataset=incoming;}catch(e){dataset={records:[],aggregateBenchmarks:[],datasetUpdatedAt:null};console.error('DPA data could not be loaded',e);}}
function init(){const now=new Date();$('sim-date').value=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');fillAttractions();$('sim-park').addEventListener('change',fillAttractions);$('predict-btn').addEventListener('click',predict);loadData();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));}
init();
})();
