(() => {
  'use strict';
  const APP_VERSION = '17';
  const $ = id => document.getElementById(id);
  const PARKS = {
    tdl: { name: '東京ディズニーランド', rides: [
      ['beauty','美女と野獣“魔法のものがたり”'], ['baymax','ベイマックスのハッピーライド'], ['splash','スプラッシュ・マウンテン'], ['bigthunder','ビッグサンダー・マウンテン'], ['haunted','ホーンテッドマンション'], ['pooh','プーさんのハニーハント'], ['monsters','モンスターズ・インク“ライド＆ゴーシーク！”']
    ]},
    tds: { name: '東京ディズニーシー', rides: [
      ['frozen','アナとエルサのフローズンジャーニー'], ['tangled','ラプンツェルのランタンフェスティバル'], ['peterpan','ピーターパンのネバーランドアドベンチャー'], ['soaring','ソアリン：ファンタスティック・フライト'], ['toy','トイ・ストーリー・マニア！'], ['journey','センター・オブ・ジ・アース'], ['raging','レイジングスピリッツ']
    ]}
  };
  // Minimum height restrictions from the official Tokyo Disney Resort FAQ (checked 2026-10-28).
  // 0 means no minimum-height restriction listed; other ride rules may still apply.
  const HEIGHT_LIMITS = {
    tdl: { baymax: 81, splash: 90, bigthunder: 102 },
    tds: { soaring: 102, peterpan: 102, journey: 117, raging: 117 }
  };
  const HEIGHT_MAX = { tds: { raging: 195 } };
  const DATA_URL = new URL('./data/dpa-history.json', window.location.href).toString();
  let dataset = { records: [], aggregateBenchmarks: [], datasetUpdatedAt: null };
  let fetchState = 'loading';


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
  // Japanese public holiday calculation (no external API required).
  // Includes fixed-date holidays, Happy Monday holidays, equinoxes, citizen holidays,
  // substitute holidays, and the one-off Olympic/imperial dates in 2019-2021.
  function dateKey(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  function vernalEquinoxDay(year) {
    if (year < 1980 || year > 2099) return null;
    return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  function autumnalEquinoxDay(year) {
    if (year < 1980 || year > 2099) return null;
    return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  function nthMonday(year, month, nth) {
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return 1 + ((8 - (firstDay || 7)) % 7) + (nth - 1) * 7;
  }
  function japaneseHolidays(year) {
    const holidays = new Set();
    const add = (month, day) => holidays.add(dateKey(year, month, day));
    const addNthMonday = (month, nth) => add(month, nthMonday(year, month, nth));
    if (year < 1948) return holidays;

    // New Year's Day and National Foundation Day
    add(1, 1);
    if (year >= 1967) add(2, 11);
    if (year >= 2020) add(2, 23); // Emperor's Birthday

    // Coming of Age Day: Jan 15 until 1999, second Monday since 2000
    if (year <= 1999) add(1, 15); else addNthMonday(1, 2);
    // Vernal equinox
    const vernal = vernalEquinoxDay(year); if (vernal) add(3, vernal);

    add(4, 29); // Greenery Day through 2006; Showa Day since 2007
    add(5, 3);  // Constitution Memorial Day
    if (year >= 2007) add(5, 4); // Greenery Day
    add(5, 5);  // Children's Day

    // Marine Day, with Olympic-year exceptions
    if (year === 2020) add(7, 23);
    else if (year === 2021) add(7, 22);
    else if (year >= 2003) addNthMonday(7, 3);
    else add(7, 20);

    if (year >= 2016) {
      if (year === 2020) add(8, 10);
      else if (year === 2021) add(8, 8);
      else add(8, 11);
    }

    // Respect for the Aged Day
    if (year >= 2003) addNthMonday(9, 3); else add(9, 15);
    const autumnal = autumnalEquinoxDay(year); if (autumnal) add(9, autumnal);

    // Sports Day / Health and Sports Day
    if (year === 2020) add(7, 24);
    else if (year === 2021) add(7, 23);
    else if (year >= 2000) addNthMonday(10, 2);
    else add(10, 10);

    add(11, 3); // Culture Day
    add(11, 23); // Labor Thanksgiving Day

    // One-off holidays surrounding the imperial succession in 2019
    if (year === 2019) { add(5, 1); add(10, 22); }

    // Citizen holidays: a weekday between two national holidays becomes a holiday.
    // Iterate to account for consecutive holiday chains.
    let changed = true;
    while (changed) {
      changed = false;
      for (let month = 1; month <= 12; month++) {
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        for (let day = 2; day < daysInMonth; day++) {
          const key = dateKey(year, month, day);
          if (holidays.has(key)) continue;
          const prev = dateKey(year, month, day - 1), next = dateKey(year, month, day + 1);
          const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
          if (weekday !== 0 && holidays.has(prev) && holidays.has(next)) {
            holidays.add(key); changed = true;
          }
        }
      }
    }

    // Substitute holiday: when a national holiday falls on Sunday, the next day
    // that is not already a holiday is observed (rules in effect since 2007).
    const originals = Array.from(holidays).sort();
    for (const key of originals) {
      const [y, m, d] = key.split('-').map(Number);
      if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) continue;
      let candidate = new Date(Date.UTC(y, m - 1, d + 1));
      let candidateKey = dateKey(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, candidate.getUTCDate());
      while (holidays.has(candidateKey)) {
        candidate = new Date(candidate.getTime() + 86400000);
        candidateKey = dateKey(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, candidate.getUTCDate());
      }
      if (candidate.getUTCFullYear() === year) holidays.add(candidateKey);
    }
    return holidays;
  }
  function isJapaneseHoliday(date) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const year = Number(date.slice(0, 4));
    return japaneseHolidays(year).has(date);
  }
  function dateDayType(date) {
    if (!date) return 'weekday';
    const [year, month, dayOfMonth] = date.split('-').map(Number);
    const day = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();
    return day === 0 || day === 6 || isJapaneseHoliday(date) ? 'weekend' : 'weekday';
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
    return { time: median(use.map(row => parseTime(row.observedEndTime || row.selloutTime))), sampleDays: use.length, dayMatched: matching.length >= 3, sourceName: '日付別記録', kind: 'record', timeMeaning: 'unverified' };
  }
  function estimate(park, id, dayType) {
    const benchmark = benchmarkFor(park, id, dayType);
    if (benchmark) return { time: parseTime(benchmark.value), sampleDays: Number(benchmark.sampleDays) || null, sourceName: '過去実績の集計', kind: 'benchmark', timeMeaning: 'unverified' };
    const fallback = recordEstimate(park, id, dayType);
    if (fallback.time !== null) return fallback;
    return { time: null, sampleDays: 0, sourceName: '—', kind: 'none' };
  }
  function makeRideCard(ride, rank, estimateInfo, hasEstimate, parkName, isPrioritySelected, childHeight) {
    const article = document.createElement('article');
    article.className = 'ride';
    const tooShort = Number.isFinite(childHeight) && ride.minHeight > 0 && childHeight < ride.minHeight;
    const tooTall = Number.isFinite(childHeight) && ride.maxHeight > 0 && childHeight >= ride.maxHeight;
    if (tooShort || tooTall) article.classList.add('height-blocked');
    const rankEl = document.createElement('div'); rankEl.className = 'rank'; rankEl.textContent = hasEstimate ? String(rank) : '—';
    const body = document.createElement('div');
    const top = document.createElement('div'); top.className = 'ride-top';
    const title = document.createElement('h3'); title.textContent = ride.name;
    const badge = document.createElement('span'); badge.className = 'badge';
    if (tooShort || tooTall) { badge.classList.add('height-warning'); badge.textContent = '身長条件に注意'; }
    if (!tooShort && !tooTall) {
      if (isPrioritySelected) badge.textContent = '指定した優先順位';
      else if (!hasEstimate) { badge.classList.add('unknown'); badge.textContent = '目安なし'; }
      else if (rank <= 3) badge.textContent = '先に検討';
      else { badge.classList.add('later'); badge.textContent = '比較候補'; }
    }
    top.append(title, badge);
    const time = document.createElement('div'); time.className = 'ride-time'; time.textContent = hasEstimate ? `約 ${fmtTime(estimateInfo.time)}` : '時刻データ不足';
    const desc = document.createElement('p'); desc.className = 'ride-desc';
    if (!hasEstimate) desc.textContent = '過去の時刻データが不足しているため、順番を推定していません。';
    else if (estimateInfo.kind === 'benchmark') desc.textContent = '既存の過去実績を集計した参考値です。初回の販売終了時刻と確認できていないため、再販後の終了などが含まれる可能性があります。';
    else desc.textContent = `未確認の販売終了記録から算出した参考中央値（記録 ${estimateInfo.sampleDays} 件）。初回終了時刻とは限りません。${estimateInfo.dayMatched ? '' : '同じ曜日区分の記録が少ないため、全記録を使用。'}`;
    const strength = document.createElement('span'); strength.className = 'chip';
    if (!hasEstimate) strength.textContent = '根拠不足';
    else if ((Number(estimateInfo.sampleDays) || 0) >= 20) strength.textContent = '対象日数が比較的多い';
    else if ((Number(estimateInfo.sampleDays) || 0) >= 8) strength.textContent = '参考データあり';
    else strength.textContent = '記録少なめ・慎重に判断';
    const meta = document.createElement('div'); meta.className = 'ride-meta';
    const source = document.createElement('span'); source.className = 'chip'; source.textContent = estimateInfo.kind === 'benchmark' ? `集計対象 ${estimateInfo.sampleDays ?? '不明'} 日` : estimateInfo.kind === 'record' ? `使用記録 ${estimateInfo.sampleDays} 件` : '時刻データなし';
    const kind = document.createElement('span'); kind.className = 'chip'; kind.textContent = estimateInfo.kind === 'benchmark' ? '過去実績の集計' : estimateInfo.kind === 'record' ? '過去の記録から算出' : '比較対象外';
    const heightChip = document.createElement('span'); heightChip.className = 'chip';
    if (ride.minHeight > 0) heightChip.textContent = `身長 ${ride.minHeight}cm以上`;
    else heightChip.textContent = '身長制限なし';
    if (ride.maxHeight > 0) heightChip.textContent += `・${ride.maxHeight}cm未満`;
    if (Number.isFinite(childHeight)) {
      if (tooShort) heightChip.textContent += `（入力身長では利用不可）`;
      else if (tooTall) heightChip.textContent += `（上限条件に注意）`;
      else heightChip.textContent += '（身長条件OK）';
    }
    if (tooShort || tooTall) heightChip.classList.add('height-chip-warning');
    meta.append(source, kind, strength, heightChip); body.append(top, time, desc, meta); article.append(rankEl, body);
    return article;
  }
  function render() {
    const park = $('park').value;
    const date = $('visit-date').value;
    const dayType = selectedDayType();
    const parkData = PARKS[park];
    const heightRaw = $('child-height').value.trim();
    const childHeight = heightRaw !== '' && Number.isFinite(Number(heightRaw)) && Number(heightRaw) >= 50 && Number(heightRaw) <= 220 ? Number(heightRaw) : null;
    const priorityIds = Array.from({length: 5}, (_, i) => $(`priority-${i + 1}`).value).filter(Boolean);
    const priorityOrder = new Map(priorityIds.map((id, index) => [id, index]));
    const mode = document.querySelector('input[name="daytype"]:checked')?.value || 'auto';
    const dayLabel = mode === 'auto'
      ? (isJapaneseHoliday(date) ? '祝日（自動判定）' : dateDayType(date) === 'weekend' ? '土日（自動判定）' : '平日（自動判定）')
      : (dayType === 'weekend' ? '土日祝日扱い（手動）' : '平日扱い（手動）');
    $('day-label').textContent = `${displayDate(date)} · ${dayLabel}`;
    const rides = parkData.rides.map(([id, name]) => ({ id, name, minHeight: HEIGHT_LIMITS[park]?.[id] || 0, maxHeight: HEIGHT_MAX[park]?.[id] || 0, estimate: estimate(park, id, dayType) }));
    rides.sort((a, b) => {
      const ap = priorityOrder.has(a.id) ? priorityOrder.get(a.id) : Infinity;
      const bp = priorityOrder.has(b.id) ? priorityOrder.get(b.id) : Infinity;
      if (ap !== bp) return ap - bp;
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
    const updatedDate = dataset.datasetUpdatedAt ? new Date(`${dataset.datasetUpdatedAt}T12:00:00`) : null;
    const ageDays = updatedDate ? Math.floor((new Date().setHours(12,0,0,0) - updatedDate.getTime()) / 86400000) : null;
    const freshness = $('freshness');
    freshness.className = 'freshness hidden';
    if (fetchState === 'error') {
      freshness.textContent = 'データの取得に失敗しました。表示中の数値が最新とは限らないため、順位は参考程度にしてください。';
      freshness.classList.remove('hidden'); freshness.classList.add('error-state');
    } else if (ageDays === null) {
      freshness.textContent = 'データ更新日を確認できません。時刻の目安は慎重に扱ってください。';
      freshness.classList.remove('hidden'); freshness.classList.add('stale');
    } else if (ageDays > 14) {
      freshness.textContent = `データ更新から ${ageDays} 日経過しています。古い可能性があるため、順位は参考程度にしてください。`;
      freshness.classList.remove('hidden'); freshness.classList.add('stale');
    }
    const verifiedCount = dataset.records.filter(row => row.firstEndVerified === true).length;
    const unverifiedCount = dataset.records.length - verifiedCount;
    $('data-counts').textContent = `過去の記録 ${dataset.records.length} 件（初回終了確認済み ${verifiedCount} 件・未確認 ${unverifiedCount} 件） · 過去実績の集計 ${dataset.aggregateBenchmarks.length} 件（参考値） · データ更新日 ${dataset.datasetUpdatedAt ? displayDate(dataset.datasetUpdatedAt) : '不明'}`;
    $('results').replaceChildren();
    if (!rides.length) {
      const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '一致するアトラクションがありません。検索語を変えてください。'; $('results').append(empty); return;
    }
    rides.forEach((ride, index) => $('results').append(makeRideCard(ride, index + 1, ride.estimate, ride.estimate.time !== null, parkData.name, priorityOrder.has(ride.id), childHeight)));
  }
  async function loadData() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      let response;
      try { response = await fetch(`${DATA_URL}?v=${APP_VERSION}`, { cache: 'no-store', signal: controller.signal }); }
      finally { clearTimeout(timeoutId); }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const incoming = await response.json();
      if (!Array.isArray(incoming.records) || !Array.isArray(incoming.aggregateBenchmarks)) throw new Error('データ形式が不正です');
      dataset = incoming; fetchState = 'loaded';
      $('load-status').textContent = '';
      $('load-status').classList.add('hidden');
      $('error').classList.add('hidden');
    } catch (error) {
      console.error('DPA data load failed', error); fetchState = 'error';
      $('load-status').textContent = '';
      $('load-status').classList.add('hidden');
      const reason = error.name === 'AbortError' ? '通信がタイムアウトしました' : (error.message || '通信エラー');
      $('error').textContent = `データを読み込めません（${reason}）。ページを再読み込みしてください。改善しない場合は、GitHub Pagesに data/dpa-history.json が公開されているか確認してください。`;
      $('error').classList.remove('hidden');
    }
    render();
  }
  function populateAttractions() {
    const park = PARKS[$('park').value] || PARKS.tdl;
    const selects = Array.from({length: 5}, (_, i) => $(`priority-${i + 1}`));
    const previous = selects.map(select => select.value);
    selects.forEach((select, index) => {
      select.replaceChildren();
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '選択しない';
      select.append(blank);
      park.rides.forEach(([id, name]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        select.append(option);
      });
      select.value = park.rides.some(([id]) => id === previous[index]) ? previous[index] : '';
    });
    updatePriorityOptions();
  }
  function updatePriorityOptions() {
    const selects = Array.from({length: 5}, (_, i) => $(`priority-${i + 1}`));
    const chosen = selects.map(select => select.value);
    selects.forEach((select, index) => {
      Array.from(select.options).forEach(option => {
        option.disabled = Boolean(option.value && chosen.includes(option.value) && select.value !== option.value);
      });
      // If a duplicate was already selected, keep the earlier priority and clear the later one.
      if (select.value && chosen.indexOf(select.value) !== index) select.value = '';
    });
  }

  function init() {
    const now = new Date();
    $('visit-date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    $('refresh').addEventListener('click', render);
    $('park').addEventListener('change', () => { populateAttractions(); render(); });
    $('visit-date').addEventListener('change', render);
    $('child-height').addEventListener('input', render);
    document.querySelectorAll('input[name="daytype"]').forEach(input => input.addEventListener('change', render));
    document.querySelectorAll('.priority-select').forEach(select => select.addEventListener('change', () => { updatePriorityOptions(); render(); }));
    $('reset').addEventListener('click', () => {
      $('visit-date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      $('park').value = 'tdl'; populateAttractions(); Array.from({length: 5}, (_, i) => $(`priority-${i + 1}`)).forEach(select => { select.value = ''; }); updatePriorityOptions();
      document.querySelector('input[name="daytype"][value="auto"]').checked = true;
      render();
    });
    populateAttractions();
    try { render(); } catch (error) { console.error('Initial render failed', error); $('load-status').textContent = '画面の初期化に失敗しました'; $('error').textContent = `画面の初期化に失敗しました（${error.message || '表示エラー'}）。ページを再読み込みしてください。`; $('error').classList.remove('hidden'); }
    loadData();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker registration failed', error)));
    }
  }
  init();
})();
