(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PARKS = {
    tdl: { name: '東京ディズニーランド', rides: [
      ['beauty','美女と野獣“魔法のものがたり”'], ['baymax','ベイマックスのハッピーライド'], ['splash','スプラッシュ・マウンテン'], ['bigthunder','ビッグサンダー・マウンテン'], ['haunted','ホーンテッドマンション'], ['pooh','プーさんのハニーハント'], ['monsters','モンスターズ・インク“ライド＆ゴーシーク！”']
    ]},
    tds: { name: '東京ディズニーシー', rides: [
      ['frozen','アナとエルサのフローズンジャーニー'], ['tangled','ラプンツェルのランタンフェスティバル'], ['peterpan','ピーターパンのネバーランドアドベンチャー'], ['soaring','ソアリン：ファンタスティック・フライト'], ['toy','トイ・ストーリー・マニア！'], ['journey','センター・オブ・ジ・アース'], ['raging','レイジングスピリッツ']
    ]}
  };
  const DATA_URL = './data/dpa-history.json';
  let dataset = { records: [], aggregateBenchmarks: [], datasetUpdatedAt: null };
  let loaded = false;

  function parseTime(value) {
    if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
    const [h, m] = value.split(':').map(Number);
    return h <= 23 && m <= 59 ? h * 60 + m : null;
  }
  function fmtTime(minutes) {
    if (!Number.isFinite(minutes)) return '—';
    const rounded = Math.round(minutes);
    return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
  }
  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  function dateDayType(date) {
    if (!date) return 'weekday';
    const day = new Date(`${date}T12:00:00`).getDay();
    return day === 0 || day === 6 ? 'weekend' : 'weekday';
  }
  function selectedDayType() {
    const selected = document.querySelector('input[name="daytype"]:checked')?.value || 'auto';
    return selected === 'auto' ? dateDayType($('visit-date').value) : selected;
  }
  function displayDate(date) {
    if (!date) return '—';
    const [y, m, d] = date.split('-');
    return `${y}/${m}/${d}`;
  }
  function benchmarkFor(park, id, dayType) {
    const kind = dayType === 'weekend' ? 'weekend_median' : 'weekday_median';
    return dataset.aggregateBenchmarks.find(item => item.park === park && item.attractionId === id && item.kind === kind && parseTime(item.value) !== null) || null;
  }
  function recordEstimate(park, id, dayType) {
    const rows = dataset.records.filter(row => row.park === park && row.attractionId === id && row.sourceType === 'observed' && ['sales_ended_or_unavailable', 'near_close_or_sales_ended', 'sold_out'].includes(row.status) && parseTime(row.observedEndTime || row.selloutTime) !== null);
    const matching = rows.filter(row => dateDayType(row.date) === dayType);
    const use = matching.length >= 3 ? matching : rows;
    return { time: median(use.map(row => parseTime(row.observedEndTime || row.selloutTime))), sampleDays: use.length, dayMatched: matching.length >= 3, sourceName: '日付別記録', kind: 'record' };
  }
  function estimate(park, id, dayType) {
    const benchmark = benchmarkFor(park, id, dayType);
    if (benchmark) return { time: parseTime(benchmark.value), sampleDays: Number(benchmark.sampleDays) || null, sourceName: benchmark.sourceName || '公開集計', kind: 'benchmark' };
    const fallback = recordEstimate(park, id, dayType);
    if (fallback.time !== null) return fallback;
    return { time: null, sampleDays: 0, sourceName: '—', kind: 'none' };
  }
  function makeRideCard(ride, rank, estimateInfo, hasEstimate, parkName) {
    const article = document.createElement('article');
    article.className = 'ride';
    const rankEl = document.createElement('div'); rankEl.className = 'rank'; rankEl.textContent = hasEstimate ? String(rank) : '—';
    const body = document.createElement('div');
    const top = document.createElement('div'); top.className = 'ride-top';
    const title = document.createElement('h3'); title.textContent = ride.name;
    const badge = document.createElement('span'); badge.className = 'badge';
    if (!hasEstimate) { badge.classList.add('unknown'); badge.textContent = '目安なし'; }
    else if (rank <= 3) badge.textContent = '先に検討';
    else { badge.classList.add('later'); badge.textContent = '比較候補'; }
    top.append(title, badge);
    const time = document.createElement('div'); time.className = 'ride-time'; time.textContent = hasEstimate ? `約 ${fmtTime(estimateInfo.time)}` : '時刻データ不足';
    const desc = document.createElement('p'); desc.className = 'ride-desc';
    if (!hasEstimate) desc.textContent = '過去の時刻データが不足しているため、順番を推定していません。';
    else if (estimateInfo.kind === 'benchmark') desc.textContent = `過去の${estimateInfo.sourceName}集計の中央値。販売終了・受付終了時刻の目安です。`;
    else desc.textContent = `同じ曜日区分の記録を優先した参考中央値（記録 ${estimateInfo.sampleDays} 件）。${estimateInfo.dayMatched ? '' : '同じ曜日区分の記録が少ないため、全記録を使用。'}`;
    const meta = document.createElement('div'); meta.className = 'ride-meta';
    const source = document.createElement('span'); source.className = 'chip'; source.textContent = estimateInfo.kind === 'benchmark' ? `集計対象 ${estimateInfo.sampleDays ?? '不明'} 日` : estimateInfo.kind === 'record' ? `使用記録 ${estimateInfo.sampleDays} 件` : '時刻データなし';
    const kind = document.createElement('span'); kind.className = 'chip'; kind.textContent = estimateInfo.kind === 'benchmark' ? '公開集計' : estimateInfo.kind === 'record' ? '日付別記録から算出' : '比較対象外';
    meta.append(source, kind); body.append(top, time, desc, meta); article.append(rankEl, body);
    return article;
  }
  function render() {
    const park = $('park').value;
    const date = $('visit-date').value;
    const dayType = selectedDayType();
    const parkData = PARKS[park];
    const query = $('search').value.trim().toLocaleLowerCase('ja');
    const dayLabel = dayType === 'weekend' ? '土日祝日として比較' : '平日として比較';
    $('day-label').textContent = `${displayDate(date)} · ${dayLabel}`;
    const rides = parkData.rides.map(([id, name]) => ({ id, name, estimate: estimate(park, id, dayType) }))
      .filter(ride => !query || ride.name.toLocaleLowerCase('ja').includes(query));
    rides.sort((a, b) => {
      const at = a.estimate.time, bt = b.estimate.time;
      if (at === null && bt === null) return a.name.localeCompare(b.name, 'ja');
      if (at === null) return 1;
      if (bt === null) return -1;
      return at - bt || a.name.localeCompare(b.name, 'ja');
    });
    const known = rides.filter(ride => ride.estimate.time !== null);
    $('count-total').textContent = `${rides.length}施設`;
    $('count-known').textContent = `${known.length}施設`;
    $('updated').textContent = dataset.datasetUpdatedAt ? displayDate(dataset.datasetUpdatedAt) : '不明';
    $('results').replaceChildren();
    if (!rides.length) {
      const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '一致するアトラクションがありません。検索語を変えてください。'; $('results').append(empty); return;
    }
    rides.forEach((ride, index) => $('results').append(makeRideCard(ride, index + 1, ride.estimate, ride.estimate.time !== null, parkData.name)));
    $('data-details').textContent = `同梱データ更新日：${displayDate(dataset.datasetUpdatedAt)}。日付別記録 ${dataset.records.length} 件、公開集計 ${dataset.aggregateBenchmarks.length} 件。集計値と日付別記録は区別して扱っています。`;
  }
  async function loadData() {
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const incoming = await response.json();
      if (!Array.isArray(incoming.records) || !Array.isArray(incoming.aggregateBenchmarks)) throw new Error('データ形式が不正です');
      dataset = incoming; loaded = true;
      $('load-status').textContent = `データ読込済み · 日付別記録 ${dataset.records.length} 件 / 公開集計 ${dataset.aggregateBenchmarks.length} 件`;
      $('error').classList.add('hidden');
    } catch (error) {
      console.error('DPA data load failed', error);
      $('load-status').textContent = 'データを読み込めませんでした';
      $('error').textContent = 'データファイルを読み込めません。通信状態を確認して再読み込みしてください。';
      $('error').classList.remove('hidden');
    }
    render();
  }
  function init() {
    const now = new Date();
    $('visit-date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    $('refresh').addEventListener('click', render);
    $('park').addEventListener('change', render);
    $('visit-date').addEventListener('change', () => { if (document.querySelector('input[name="daytype"]:checked')?.value === 'auto') render(); else render(); });
    document.querySelectorAll('input[name="daytype"]').forEach(input => input.addEventListener('change', render));
    $('search').addEventListener('input', render);
    $('reset').addEventListener('click', () => {
      $('visit-date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      $('park').value = 'tdl'; $('search').value = '';
      document.querySelector('input[name="daytype"][value="auto"]').checked = true;
      render();
    });
    render(); loadData();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker registration failed', error)));
    }
  }
  init();
})();
