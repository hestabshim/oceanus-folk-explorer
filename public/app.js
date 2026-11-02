(() => {
  const data = window.GRAPH_DATA;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const tooltip = $('#tooltip');
  const typeLabels = ['In style of','Interpolates','Lyrical reference','Cover','Direct sample'];
  const typeColors = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4'];
  const seriesColors = ['#2a78d6','#eb6834','#1baf7a'];
  const relations = {by:{label:'Influenced them',color:'#2a78d6'},collab:{label:'Collaborators',color:'#1baf7a'},out:{label:'They influenced',color:'#eb6834'},indirect:{label:'Indirectly influenced',color:'#eb6834'}};
  const genreSlots = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300'], otherColor = '#a3b0b3';
  const genreColors = {};
  ['outbound','inbound'].forEach(direction => {
    const totals = new Map(); data.evidence[direction].forEach(([genre]) => totals.set(genre, (totals.get(genre) || 0) + 1));
    genreColors[direction] = new Map([...totals].sort((a, b) => b[1] - a[1]).slice(0, genreSlots.length).map(([genre], i) => [genre, genreSlots[i]]));
  });
  const eras = [
    {label:'Before Ivy Echos', short:'BEFORE IVY ECHOS', start:data.years[0], end:data.milestones.ivyEchos - 1},
    {label:'Ivy Echos era', short:'IVY ECHOS', start:data.milestones.ivyEchos, end:data.milestones.sailorSolo - 1},
    {label:'Sailor solo', short:'SAILOR SOLO', start:data.milestones.sailorSolo, end:data.years[1]}
  ];
  const folk = data.genres.indexOf(data.focus);
  const artists = data.artists;
  const findArtist = name => artists.findIndex(artist => artist.n === name);
  const outward = artists.map(() => []);
  artists.forEach((artist, a) => (artist.i || []).forEach(([b, first, ...types]) => outward[b].push([a, first, ...types])));
  const collaborators = artist => { const pairs = []; for (let i = 0; i < (artist.c || []).length; i += 2) pairs.push([artist.c[i], artist.c[i + 1]]); return pairs; };
  const isFolk = artists.map(artist => artist.w.some(work => work[1] === folk));
  const workYears = artists.flatMap(artist => artist.w.map(work => work[0]).filter(Boolean));
  const recent = [2036, 2040];
  const recentCount = artist => artist.w.filter(work => work[0] >= recent[0] && work[0] <= recent[1]).length;
  const state = {
    view:'influence', direction:'outbound', types:new Set([0, 1, 2, 3, 4]),
    years:{influence:{min:data.years[0], max:data.years[1]}, candidates:{min:Math.min(...workYears), max:Math.max(...workYears)}},
    layers:new Set(Object.keys(relations)), center:findArtist('Sailor Shift'),
    compare:['Copper Canyon Ghosts','The Brine Choir',"Selkie's Hollow"].map(findArtist).map(index => index >= 0 ? index : null),
    query:'', folkOnly:false, sort:'notoriety', metric:'releases', cumulative:true
  };
  Object.values(state.years).forEach(range => { range.start = range.min; range.end = range.max; });
  state.years.candidates.start = state.years.candidates.default = 2015;
  let tips = [], acts = [];
  const devMode = ['localhost','127.0.0.1'].includes(location.hostname) || new URLSearchParams(location.search).has('dev');
  let feedbackPins = [];
  let feedbackSelected = null;
  let feedbackPlacing = false;

  function feedbackKey() { return `oceanus-feedback:${location.pathname}:${state.view}`; }
  function feedbackLoad() {
    if (!devMode) return;
    try { feedbackPins = JSON.parse(localStorage.getItem(feedbackKey()) || '[]'); } catch { feedbackPins = []; }
    feedbackSelected = null;
    feedbackRender();
  }
  function feedbackStore() { localStorage.setItem(feedbackKey(), JSON.stringify(feedbackPins)); }
  function feedbackMarkdown() {
    const lines = [`# Page feedback`, '', `Page: ${location.pathname}`, ''];
    ['influence','careers','candidates'].forEach(view => {
      let pins = [];
      try { pins = JSON.parse(localStorage.getItem(`oceanus-feedback:${location.pathname}:${view}`) || '[]'); } catch {}
      lines.push(`## ${view[0].toUpperCase()}${view.slice(1)} view`, '');
      if (!pins.length) lines.push('_No pins._', '');
      pins.forEach((pin, index) => lines.push(`### ${index + 1}. ${pin.title || 'Untitled pin'}`, '', `- Position: ${pin.x.toFixed(1)}% from left, ${pin.y.toFixed(1)}% from top`, `- Feedback: ${pin.note || 'None'}`, ''));
    });
    return lines.join('\n');
  }
  function feedbackRenderMarkers() {
    const layer = $('#feedbackPins');
    if (!layer) return;
    layer.innerHTML = feedbackPins.map((pin, index) => `<button class="feedback-marker ${pin.id === feedbackSelected ? 'selected' : ''}" style="left:${pin.x}%;top:${pin.y}%" data-feedback-id="${pin.id}" aria-label="Feedback pin ${index + 1}"><span>${index + 1}</span></button>`).join('');
    $$('.feedback-marker', layer).forEach(marker => marker.addEventListener('click', event => { event.stopPropagation(); feedbackSelect(Number(marker.dataset.feedbackId)); }));
  }
  function feedbackRenderList() {
    const list = $('#feedbackList');
    if (!list) return;
    list.innerHTML = feedbackPins.length ? feedbackPins.map((pin, index) => `<button class="feedback-row ${pin.id === feedbackSelected ? 'selected' : ''}" data-feedback-id="${pin.id}"><span class="feedback-row-number">${index + 1}</span><span><strong>${esc(pin.title || 'Untitled pin')}</strong><small>${esc(pin.note || 'No feedback yet')}</small></span></button>`).join('') : '<p class="feedback-empty">No pins on this view.</p>';
    $$('.feedback-row', list).forEach(row => row.addEventListener('click', () => feedbackSelect(Number(row.dataset.feedbackId))));
  }
  function feedbackRenderEditor() {
    const pin = feedbackPins.find(item => item.id === feedbackSelected);
    $('#feedbackEditor').hidden = !pin;
    $('#feedbackPinLabel').textContent = pin ? `Pin ${feedbackPins.indexOf(pin) + 1}` : 'Select a pin';
    if (pin) { $('#feedbackTitle').value = pin.title || ''; $('#feedbackNote').value = pin.note || ''; }
  }
  function feedbackRender() {
    if (!devMode) return;
    feedbackRenderMarkers();
    feedbackRenderList();
    feedbackRenderEditor();
  }
  function feedbackSelect(id) { feedbackSelected = id; feedbackRender(); $('#feedbackOverlay').hidden = false; }
  function feedbackStartPlacing() { feedbackPlacing = true; $('#feedbackOverlay').hidden = true; $('#feedbackCapture').hidden = false; document.body.classList.add('placing-feedback'); }
  function feedbackCancelPlacing() { feedbackPlacing = false; $('#feedbackCapture').hidden = true; document.body.classList.remove('placing-feedback'); }
  function feedbackCaptureClick(event) {
    if (!feedbackPlacing || event.target.closest('#feedbackOverlay') || event.target.closest('#feedbackLauncher')) return;
    event.preventDefault(); event.stopPropagation();
    const width = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    const height = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    feedbackPins.push({id:Date.now(), x:event.pageX / width * 100, y:event.pageY / height * 100, title:'', note:''});
    feedbackSelected = feedbackPins.at(-1).id;
    feedbackCancelPlacing(); feedbackStore(); feedbackRender(); $('#feedbackOverlay').hidden = false; $('#feedbackNote').focus();
  }
  async function feedbackSaveFile() {
    const contents = feedbackMarkdown();
    try {
      const response = await fetch('/__feedback', {method:'POST', headers:{'Content-Type':'text/markdown'}, body:contents}).catch(() => null);
      if (response?.ok) { alert('Saved feedback.md to the repo.'); return; }
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({suggestedName:`${location.hostname}-feedback.md`,types:[{description:'Markdown',accept:{'text/markdown':['.md']}}]});
        const writable = await handle.createWritable(); await writable.write(contents); await writable.close();
      } else {
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([contents], {type:'text/markdown'})); link.download = 'page-feedback.md'; link.click(); URL.revokeObjectURL(link.href);
      }
    } catch (error) { if (error.name !== 'AbortError') alert('Could not save feedback.'); }
  }
  function feedbackInit() {
    if (!devMode) return;
    $('#feedbackLauncher').hidden = false;
    $('#feedbackLauncher').addEventListener('click', () => { feedbackLoad(); $('#feedbackOverlay').hidden = false; });
    $('#closeFeedback').addEventListener('click', () => { $('#feedbackOverlay').hidden = true; });
    $('#addFeedback').addEventListener('click', feedbackStartPlacing);
    $('#saveFeedback').addEventListener('click', feedbackSaveFile);
    $('#doneFeedback').addEventListener('click', () => { feedbackSelected = null; feedbackRender(); });
    $('#deleteFeedback').addEventListener('click', () => { feedbackPins = feedbackPins.filter(pin => pin.id !== feedbackSelected); feedbackSelected = null; feedbackStore(); feedbackRender(); });
    $('#feedbackTitle').addEventListener('input', event => { const pin=feedbackPins.find(item=>item.id===feedbackSelected); if(pin){pin.title=event.target.value;feedbackStore();feedbackRenderList();} });
    $('#feedbackNote').addEventListener('input', event => { const pin=feedbackPins.find(item=>item.id===feedbackSelected); if(pin){pin.note=event.target.value;feedbackStore();feedbackRenderList();} });
    document.addEventListener('click', feedbackCaptureClick, true);
    document.addEventListener('keydown', event => { if(event.key==='Escape') feedbackCancelPlacing(); });
    feedbackLoad();
  }

  function showTooltip(html, event) {
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.style.left = `${Math.min(window.innerWidth - tooltip.offsetWidth - 14, event.clientX + 12)}px`;
    tooltip.style.top = `${Math.max(10, event.clientY - tooltip.offsetHeight - 12)}px`;
  }
  function hideTooltip() { tooltip.style.display = 'none'; }
  function text(x, y, value, attrs='') { return `<text x="${x}" y="${y}" ${attrs}>${esc(value)}</text>`; }
  function tip(html) { tips.push(html); return `data-tip="${tips.length - 1}"`; }
  function act(fn) { acts.push(fn); return `data-act="${acts.length - 1}"`; }
  function short(name, length = 20) { return name.length > length ? `${name.slice(0, length - 1)}…` : name; }
  function linkCount(link) { return link.slice(2).reduce((sum, value, type) => sum + (state.types.has(type) ? value : 0), 0); }
  function typeSummary(types) { return types.map((value, type) => value && state.types.has(type) ? `${value} ${typeLabels[type].toLowerCase()}` : '').filter(Boolean).join(' · '); }
  function artistMeta(index) {
    const artist = artists[index];
    return [artist.g ? 'Group' : 'Person', `${artist.k[0]} works`, isFolk[index] ? 'Oceanus Folk' : ''].filter(Boolean).join(' · ');
  }
  function artistLink(index, extra = '') { return `<button class="artist-link" data-artist="${index}">${esc(artists[index].n)}</button>${extra}`; }
  function workLabel(ref) {
    const [name, year, genre, owners] = data.works[ref];
    return `<b>${esc(name)}</b> (${esc(data.genres[genre] || 'Unknown')}, ${year || '?'})${owners.length ? ` by ${owners.slice(0, 2).map(index => artistLink(index)).join(', ')}${owners.length > 2 ? ` +${owners.length - 2}` : ''}` : ''}`;
  }
  function evidenceRows(rows, limit = 40) {
    const list = rows.slice(0, limit).map(([, , type, from, to]) => `<div><i style="color:${typeColors[type]}">●</i><span>${workLabel(from)}<br><em>${typeLabels[type]} →</em> ${workLabel(to)}</span></div>`).join('');
    return list + (rows.length > limit ? `<p class="list-note">Showing ${limit} of ${rows.length} references.</p>` : '');
  }
  function inspector(stateLabel, html) { $('#inspectorState').textContent = stateLabel; $('#inspectorContent').innerHTML = html; }

  // Filters
  function renderTypeFilters() {
    $('#typeFilters').innerHTML = typeLabels.map((label, type) => `<button class="genre-chip ${state.types.has(type) ? 'active' : ''}" data-type="${type}"><i style="background:${typeColors[type]}"></i>${label}</button>`).join('');
    $$('#typeFilters .genre-chip').forEach(chip => chip.addEventListener('click', () => {
      const type = Number(chip.dataset.type);
      if (state.types.has(type) && state.types.size > 1) state.types.delete(type); else state.types.add(type);
      renderTypeFilters(); render();
    }));
  }
  function syncYears() {
    const range = state.years[state.view];
    if (!range) return;
    ['yearStart','yearEnd'].forEach(id => { $(`#${id}`).min = range.min; $(`#${id}`).max = range.max; });
    $('#yearStart').value = range.start; $('#yearEnd').value = range.end;
    $('#yearMin').textContent = range.min; $('#yearMax').textContent = range.max;
    $('#yearOutput').value = `${range.start} — ${range.end}`;
  }
  function updateYears() {
    const range = state.years[state.view];
    let start = Number($('#yearStart').value), end = Number($('#yearEnd').value);
    if (start > end) [start, end] = [end, start];
    range.start = start; range.end = end; syncYears(); render();
  }
  function artistMatches() {
    const query = state.query.trim().toLowerCase();
    const matches = [];
    artists.forEach((artist, index) => { if ((!query || artist.n.toLowerCase().includes(query)) && (!state.folkOnly || isFolk[index])) matches.push(index); });
    const by = {notoriety:(a, b) => artists[b].s - artists[a].s, recent:(a, b) => recentCount(artists[b]) - recentCount(artists[a]) || artists[b].s - artists[a].s, name:(a, b) => artists[a].n.localeCompare(artists[b].n)}[state.sort];
    return matches.sort(by);
  }
  function renderArtistList() {
    if (state.view === 'influence') return;
    const matches = artistMatches(), shown = matches.slice(0, 150);
    $('#compareNote').textContent = 'Pick an artist to see their network.';
    $('#artistList').innerHTML = shown.map(index => {
      const active = index === state.center;
      const metric = state.sort === 'recent' ? `${recentCount(artists[index])} new` : artists[index].s;
      return `<button class="artist-row ${active ? 'active' : ''}" data-pick="${index}" aria-pressed="${active}"><span><strong>${esc(artists[index].n)}</strong><small>${artistMeta(index)}</small></span><b class="score-pill" title="${state.sort === 'recent' ? `Releases ${recent.join('–')}` : 'Notoriety score'}">${metric}</b></button>`;
    }).join('') + (matches.length > shown.length ? `<p class="list-note">Showing ${shown.length} of ${matches.length.toLocaleString()}. Search to narrow the list.</p>` : '') + (!matches.length ? '<p class="list-note">No artists match.</p>' : '');
    $$('#artistList .artist-row').forEach(row => row.addEventListener('click', () => { state.center = Number(row.dataset.pick); render(); }));
  }
  // Candidates: three artist slots above the chart
  function compared() { return state.compare.map((index, slot) => ({index, slot})).filter(item => item.index !== null); }
  function slotMatches(query, slot) {
    const needle = query.trim().toLowerCase(), taken = new Set(state.compare.filter((index, other) => other !== slot && index !== null));
    const matches = [];
    for (const [index, artist] of artists.entries()) if (!taken.has(index) && (!needle || artist.n.toLowerCase().includes(needle))) matches.push(index);
    return matches.sort((a, b) => artists[b].s - artists[a].s).slice(0, 8);
  }
  function renderSlots() {
    $('#compareSlots').innerHTML = state.compare.map((index, slot) => `<div class="slot ${index === null ? 'empty' : ''}" data-slot="${slot}"><i class="artist-swatch" style="background:${seriesColors[slot]}"></i><input class="slot-input" type="text" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="Artist ${slot + 1}" autocomplete="off" placeholder="Add artist ${slot + 1}…" value="${index === null ? '' : esc(artists[index].n)}"/>${index === null ? '' : `<button class="slot-clear" aria-label="Remove ${esc(artists[index].n)}">×</button>`}<div class="slot-menu" role="listbox" hidden></div></div>`).join('');
    $$('#compareSlots .slot').forEach(box => {
      const slot = Number(box.dataset.slot), input = $('.slot-input', box), menu = $('.slot-menu', box);
      let options = [], active = 0;
      const close = () => { menu.hidden = true; input.setAttribute('aria-expanded', 'false'); };
      const choose = index => { state.compare[slot] = index; renderSlots(); render(); };
      const show = () => {
        options = slotMatches(input.value === (state.compare[slot] === null ? '' : artists[state.compare[slot]].n) ? '' : input.value, slot);
        active = Math.min(active, Math.max(options.length - 1, 0));
        menu.innerHTML = options.map((index, i) => `<div class="slot-option ${i === active ? 'active' : ''}" role="option" aria-selected="${i === active}" data-index="${index}"><span><strong>${esc(artists[index].n)}</strong><small>${artistMeta(index)}</small></span><b class="score-pill" title="Notoriety score">${artists[index].s}</b></div>`).join('') || '<p class="list-note">No artists match.</p>';
        menu.hidden = false; input.setAttribute('aria-expanded', 'true');
        $$('.slot-option', menu).forEach(option => option.addEventListener('mousedown', event => { event.preventDefault(); choose(Number(option.dataset.index)); }));
      };
      input.addEventListener('focus', () => { input.select(); active = 0; show(); });
      input.addEventListener('input', () => { active = 0; show(); });
      input.addEventListener('blur', () => { close(); input.value = state.compare[slot] === null ? '' : artists[state.compare[slot]].n; });
      input.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); active = (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % Math.max(options.length, 1); show(); }
        else if (event.key === 'Enter' && options.length) { event.preventDefault(); choose(options[active]); }
        else if (event.key === 'Escape') input.blur();
      });
      $('.slot-clear', box)?.addEventListener('click', () => choose(null));
    });
  }
  function openArtist(index) { state.center = index; setView('careers'); }

  // Influence: Oceanus Folk references by genre and year
  function influenceRows() {
    const range = state.years.influence;
    return data.evidence[state.direction].filter(([, year, type]) => year >= range.start && year <= range.end && state.types.has(type));
  }
  function erasInRange(range) {
    return eras.map(era => ({...era, start:Math.max(era.start, range.start), end:Math.min(era.end, range.end)})).filter(era => era.start <= era.end);
  }
  function renderInfluence() {
    const range = state.years.influence, rows = influenceRows(), colors = genreColors[state.direction];
    const years = Array.from({length:range.end - range.start + 1}, (_, i) => range.start + i);
    const keys = [...colors.keys(), 'other'], counts = new Map(keys.map(key => [key, years.map(() => 0)]));
    rows.forEach(([genre, year]) => counts.get(colors.has(genre) ? genre : 'other')[year - range.start] += 1);
    const series = keys.filter(key => counts.get(key).some(Boolean)).map(key => ({key, name:key === 'other' ? 'Other genres' : data.genres[key], color:key === 'other' ? otherColor : colors.get(key), values:counts.get(key)}));
    const totals = years.map((_, i) => series.reduce((sum, item) => sum + item.values[i], 0));
    const periods = erasInRange(range).map(era => ({...era, rows:rows.filter(row => row[1] >= era.start && row[1] <= era.end)}));
    $('#axisTitle').textContent = state.direction === 'outbound' ? 'REFERENCES TO OCEANUS FOLK' : 'OCEANUS FOLK REFERENCES';
    $('#viewDescription').textContent = eraSummary(periods, years, totals);
    if (!rows.length) { $('#viz').innerHTML = '<p class="viz-empty">No references match these filters.</p>'; $('#legend').innerHTML = ''; return; }
    const W = 1000, H = 500, left = 34, right = 16, top = 62, bottom = 26;
    const gap = years.length < 2 ? 0 : (W - left - right) / (years.length - 1);
    const x = i => years.length < 2 ? (W + left - right) / 2 : left + i * gap;
    const peak = Math.max(...totals, 1), step = Math.max(1, Math.ceil(peak / 4)), max = Math.ceil(peak / step) * step;
    const y = value => H - bottom - value / max * (H - top - bottom);
    const bands = periods.map((era, p) => {
      const x0 = p ? x(era.start - range.start) : left, x1 = p < periods.length - 1 ? x(periods[p + 1].start - range.start) : W - right;
      const span = era.end - era.start + 1, rate = era.rows.length / span;
      const label = `${text(x0 + 7, 16, era.short, 'class="chart-heading"')}${text(x0 + 7, 30, era.start === era.end ? era.start : `${era.start}–${String(era.end).slice(-2)}`, 'class="chart-label"')}${text(x0 + 7, 44, `${rate.toFixed(1)}/yr`, 'class="era-rate"')}`;
      return `<g class="era" ${tip(`<strong>${esc(era.label)}</strong><br>${era.start}–${era.end} · ${era.rows.length} references<br>${rate.toFixed(1)} per year`)} ${act(() => inspectInfluence(`${era.label}, ${era.start}–${era.end}`, 'PERIOD', era.rows))}><rect x="${x0}" y="0" width="${x1 - x0}" height="${H - bottom}" fill="${p % 2 ? '#f5f8f8' : '#fff'}"/>${label}</g>${p ? `<line class="era-line" x1="${x0}" x2="${x0}" y1="0" y2="${H - bottom}"/>` : ''}`;
    }).join('');
    const ticks = Array.from({length:max / step + 1}, (_, i) => i * step);
    const grid = ticks.map(value => `<line class="chart-grid" x1="${left}" x2="${W - right}" y1="${y(value)}" y2="${y(value)}"/>${text(left - 8, y(value) + 3, value, 'text-anchor="end" class="chart-label"')}`).join('');
    let base = years.map(() => 0);
    const layers = series.map(item => {
      const topLine = item.values.map((value, i) => base[i] + value);
      const points = `${topLine.map((value, i) => `${x(i)},${y(value)}`).join(' ')} ${base.map((value, i) => `${x(i)},${y(value)}`).reverse().join(' ')}`;
      base = topLine;
      return `<polygon class="area-layer" points="${points}" fill="${item.color}"/>`;
    }).join('');
    const labels = years.map((year, i) => (i === 0 || i === years.length - 1 || year % 5 === 0) ? text(x(i), H - 6, year, 'text-anchor="middle" class="chart-label"') : '').join('');
    const hits = years.map((year, i) => `<rect class="year-hit" x="${x(i) - gap / 2}" y="${top}" width="${gap || W - left - right}" height="${H - top - bottom}" ${tip(`<strong>${year}</strong> · ${totals[i]} references${series.filter(item => item.values[i]).map(item => `<br><span style="color:${item.color}">●</span> ${esc(item.name)}: ${item.values[i]}`).join('')}`)} ${act(() => inspectInfluence(`${year}`, 'YEAR', rows.filter(row => row[1] === year)))} data-cross="${x(i)}"/>`).join('');
    $('#viz').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Oceanus Folk references by year and genre, split at Ivy Echos and Sailor Shift's solo debut">${bands}<g>${grid}</g>${layers}<line class="crosshair" id="crosshair" x1="0" x2="0" y1="${top}" y2="${H - bottom}" visibility="hidden"/>${labels}${hits}</svg>`;
    $('#legend').innerHTML = series.map(item => `<span class="legend-button static"><i class="legend-swatch" style="background:${item.color}"></i>${esc(item.name)}</span>`).join('');
    $('#chartHint').textContent = `Periods split at Ivy Echos' first release (${data.milestones.ivyEchos}) and Sailor Shift's solo debut (${data.milestones.sailorSolo}). Click a year or a period heading to list the songs behind it.`;
  }
  function eraSummary(periods, years, totals) {
    if (!totals.some(Boolean)) return 'No references in this range.';
    const peak = totals.indexOf(Math.max(...totals));
    return `References per year: ${periods.map(era => `${era.label} ${(era.rows.length / (era.end - era.start + 1)).toFixed(1)}`).join(' · ')}. Peak in ${years[peak]} (${totals[peak]}).`;
  }
  function topArtists(rows, side) {
    const counts = new Map();
    rows.forEach(row => data.works[row[side]][3].forEach(index => counts.set(index, (counts.get(index) || 0) + 1)));
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }
  function topGenre(rows) {
    const counts = new Map(); rows.forEach(([genre]) => counts.set(genre, (counts.get(genre) || 0) + 1));
    const best = [...counts].sort((a, b) => b[1] - a[1])[0];
    return best ? data.genres[best[0]] : null;
  }
  function influenceSummary() {
    const rows = influenceRows(), outbound = state.direction === 'outbound';
    const genres = new Map();
    rows.forEach(([genre]) => genres.set(genre, (genres.get(genre) || 0) + 1));
    const topGenres = [...genres].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const people = topArtists(rows, outbound ? 3 : 4);
    inspector('SUMMARY', `<span class="selection-kicker">${outbound ? 'OCEANUS FOLK → OTHER GENRES' : 'OTHER GENRES → OCEANUS FOLK'}</span><h2 class="selection-title">${outbound ? 'Who it influenced' : 'What it draws from'}</h2><p class="selection-meta">Counts songs and albums that reference another work through the selected relationship types, by the referencing work's release year.</p><div class="detail-stat"><span>REFERENCES IN RANGE</span><strong>${rows.length}</strong></div><div class="evidence-list"><h3>BY PERIOD</h3>${erasInRange(state.years.influence).map(era => { const eraRows = rows.filter(row => row[1] >= era.start && row[1] <= era.end), genre = topGenre(eraRows); return `<div><i>●</i><span>${era.label}, ${era.start}–${era.end}<br><b>${eraRows.length}</b> references · ${(eraRows.length / (era.end - era.start + 1)).toFixed(1)}/yr${genre ? ` · mostly ${esc(genre)}` : ''}</span></div>`; }).join('')}</div><div class="evidence-list"><h3>TOP GENRES</h3>${topGenres.map(([genre, count]) => `<div><i>●</i><span>${esc(data.genres[genre])}<br><b>${count}</b></span></div>`).join('') || '<p class="list-note">None.</p>'}</div><div class="evidence-list"><h3>${outbound ? 'ARTISTS IT INFLUENCED MOST' : 'ARTISTS IT DRAWS ON MOST'}</h3>${people.map(([index, count]) => `<div><i>●</i><span>${artistLink(index)}<br><b>${count}</b> reference${count === 1 ? '' : 's'}</span></div>`).join('') || '<p class="list-note">None.</p>'}</div>`);
  }
  function inspectInfluence(title, kind, rows) {
    inspector(kind, `<span class="selection-kicker">${state.direction === 'outbound' ? 'REFERENCES TO OCEANUS FOLK' : 'OCEANUS FOLK REFERENCING'}</span><h2 class="selection-title">${esc(title)}</h2><div class="detail-stat"><span>REFERENCES</span><strong>${rows.length}</strong></div><div class="evidence-list"><h3>EVIDENCE</h3>${evidenceRows(rows)}</div><button class="text-button" data-summary>← Back to summary</button>`);
  }

  // Careers: ego network around one artist
  function egoGroups(center) {
    const rank = links => links.map(link => ({a:link[0], first:link[1], types:link.slice(2), n:linkCount(link)})).filter(item => item.n > 0).sort((a, b) => b.n - a.n || artists[b.a].s - artists[a.a].s);
    const by = rank(artists[center].i || []), out = rank(outward[center]);
    const collab = collaborators(artists[center]).map(([a, n]) => ({a, n})).sort((a, b) => b.n - a.n || artists[b.a].s - artists[a.a].s);
    const seen = new Set([center, ...out.map(item => item.a)]), indirect = [];
    out.forEach(parent => rank(outward[parent.a]).forEach(item => { if (!seen.has(item.a)) { seen.add(item.a); indirect.push({...item, parent:parent.a}); } }));
    return {by, collab, out, indirect};
  }
  function renderCareers() {
    const center = state.center, groups = egoGroups(center);
    const W = 1000, H = 640, cx = W / 2, cy = 300, rx = 250, ry = 190, limit = 12;
    const sectors = {by:[180, 112], collab:[90, 100], out:[0, 112]};
    const positions = new Map();
    const place = (items, [angle, span], rx, ry) => items.map((item, i) => {
      const a = (angle + (items.length < 2 ? 0 : (i / (items.length - 1) - .5) * span)) * Math.PI / 180;
      return {...item, x:cx + Math.cos(a) * rx, y:cy + Math.sin(a) * ry, cos:Math.cos(a), sin:Math.sin(a)};
    });
    const ring = {};
    ['by','collab','out'].forEach(key => { ring[key] = state.layers.has(key) ? place(groups[key].slice(0, limit), sectors[key], rx, ry) : []; ring[key].forEach(node => positions.set(node.a, node)); });
    let outer = [];
    if (state.layers.has('indirect') && state.layers.has('out')) {
      ring.out.forEach(parent => {
        const kids = groups.indirect.filter(item => item.parent === parent.a).slice(0, 3);
        const base = Math.atan2((parent.y - cy) / ry, (parent.x - cx) / rx) * 180 / Math.PI;
        outer.push(...place(kids, [base, kids.length * 4.5], rx + 150, ry + 60).map(node => ({...node, from:parent})));
      });
    }
    const radius = index => 4 + artists[index].s / 100 * 7;
    const nodeTip = (item, key) => `<strong>${esc(artists[item.a].n)}</strong><br>${relations[key].label}${key === 'collab' ? ` · ${item.n} shared credits` : ` · ${typeSummary(item.types) || `${item.n} references`}`}${item.first ? `<br>First reference ${item.first}` : ''}<br>Notoriety ${artists[item.a].s}${isFolk[item.a] ? ' · Oceanus Folk' : ''}`;
    const edges = ['by','collab','out'].flatMap(key => ring[key].map(node => `<line class="net-edge" x1="${cx}" y1="${cy}" x2="${node.x}" y2="${node.y}" stroke="${relations[key].color}" stroke-width="${1 + Math.min(node.n, 6) * .5}"/>`)).join('') + outer.map(node => `<line class="net-edge indirect" x1="${node.from.x}" y1="${node.from.y}" x2="${node.x}" y2="${node.y}" stroke="${relations.indirect.color}"/>`).join('');
    const nodes = ['by','collab','out'].flatMap(key => ring[key].map(node => {
      const right = node.cos >= 0, angle = Math.atan2(node.sin, node.cos) * 180 / Math.PI + (right ? 0 : 180);
      const label = text(node.x + (right ? 1 : -1) * (radius(node.a) + 6), node.y + 3.5, short(artists[node.a].n), `text-anchor="${right ? 'start' : 'end'}" class="net-label" transform="rotate(${angle.toFixed(1)} ${node.x} ${node.y})"`);
      return `<g class="net-node" ${tip(nodeTip(node, key))} ${act(() => inspectRelation(node, key))} data-center="${node.a}"><circle cx="${node.x}" cy="${node.y}" r="${radius(node.a)}" fill="${relations[key].color}" class="${isFolk[node.a] ? 'folk' : ''}"/>${label}</g>`;
    })).join('') + outer.map(node => `<g class="net-node" ${tip(`${nodeTip(node, 'indirect')}<br>via ${esc(artists[node.from.a].n)}`)} ${act(() => inspectRelation(node, 'indirect'))} data-center="${node.a}"><circle cx="${node.x}" cy="${node.y}" r="${radius(node.a) * .8}" fill="#fff" stroke="${relations.indirect.color}" stroke-width="2" class="${isFolk[node.a] ? 'folk' : ''}"/></g>`).join('');
    const empties = ['by','collab','out'].filter(key => state.layers.has(key) && !groups[key].length).map(key => { const a = sectors[key][0] * Math.PI / 180; return text(cx + Math.cos(a) * 170, cy + Math.sin(a) * 140, key === 'collab' ? 'No collaborators' : key === 'by' ? 'No recorded influences' : 'Influenced no one directly', 'text-anchor="middle" class="chart-label"'); }).join('');
    const hub = `<g class="net-node" ${tip(`<strong>${esc(artists[center].n)}</strong><br>Notoriety ${artists[center].s}`)} ${act(() => inspector('ARTIST', profileHtml(center)))}><circle cx="${cx}" cy="${cy}" r="20" fill="#13212a" class="${isFolk[center] ? 'folk-hub' : ''}"/>${text(cx, cy - 32, artists[center].n, 'text-anchor="middle" class="net-center-label"')}</g>`;
    $('#axisTitle').textContent = 'EGO NETWORK';
    $('#viewTitle').textContent = artists[center].n;
    $('#viewDescription').textContent = `${groups.by.length} influences · ${groups.collab.length} collaborators · ${groups.out.length} influenced directly · ${groups.indirect.length} indirectly. Largest ${limit} per group shown.`;
    $('#viz').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Influence network for ${esc(artists[center].n)}">${edges}${empties}${nodes}${hub}</svg>`;
    $('#legend').innerHTML = Object.entries(relations).map(([key, relation]) => `<button class="legend-button ${state.layers.has(key) ? '' : 'off'}" data-layer="${key}"><i class="legend-dot ${key === 'indirect' ? 'hollow' : ''}" style="--c:${relation.color}"></i>${relation.label} (${groups[key].length})</button>`).join('') + '<span class="legend-button static"><i class="legend-dot folk-key"></i>Oceanus Folk artist</span>';
    $$('[data-layer]').forEach(button => button.addEventListener('click', () => { const key = button.dataset.layer; state.layers.has(key) ? state.layers.delete(key) : state.layers.add(key); render(); }));
    $('#chartHint').textContent = 'Size = notoriety. Click an artist for evidence; double-click to centre on them.';
    inspector('ARTIST', profileHtml(center));
  }
  function profileHtml(index) {
    const artist = artists[index], groups = egoGroups(index);
    const years = artist.w.map(work => work[0]).filter(Boolean);
    const genres = new Map(); artist.w.forEach(work => work[1] >= 0 && genres.set(work[1], (genres.get(work[1]) || 0) + 1));
    const folkShare = list => `${list.filter(item => isFolk[item.a]).length} of ${list.length} are Oceanus Folk`;
    const section = (title, list, note) => `<div class="evidence-list"><h3>${title} · ${list.length}</h3>${list.slice(0, 5).map(item => `<div><i>●</i><span>${artistLink(item.a)}<br><b>${item.n}</b> ${item.n === 1 ? note.replace(/s$/, '') : note}</span></div>`).join('') || '<p class="list-note">None recorded.</p>'}${list.length ? `<p class="list-note">${folkShare(list)}.</p>` : ''}</div>`;
    return `<span class="selection-kicker">ARTIST PROFILE</span><h2 class="selection-title">${esc(artist.n)}</h2><p class="selection-meta">${artistMeta(index)}${years.length ? ` · active ${Math.min(...years)}–${Math.max(...years)}` : ''}</p><div class="detail-stat"><span>NOTORIETY</span><strong>${artist.s} / 100</strong><small>${artist.k[0]} works · ${artist.k[1]} notable · influenced ${artist.k[2]} artists${artist.f ? ` · first notable ${artist.f}` : ''}</small></div><div class="evidence-list"><h3>GENRES</h3><p class="list-note">${[...genres].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([genre, count]) => `${esc(data.genres[genre])} (${count})`).join(', ') || 'Unknown'}</p></div>${section('INFLUENCED THEM', groups.by, 'references')}${section('COLLABORATORS', groups.collab, 'shared credits')}${section('THEY INFLUENCED', groups.out, 'references')}${section('INDIRECTLY INFLUENCED', groups.indirect, 'references')}`;
  }
  function inspectRelation(node, key) {
    const center = artists[state.center].n, other = artists[node.a].n;
    const sentence = {by:`${other} influenced ${center}.`, collab:`${other} shares ${node.n} credits with ${center}.`, out:`${center} influenced ${other}.`, indirect:`${center} reached ${other} through ${node.from ? artists[node.from.a].n : 'an artist they influenced'}.`}[key];
    inspector('LINK', `<span class="selection-kicker">${relations[key].label.toUpperCase()}</span><h2 class="selection-title">${esc(other)}</h2><p class="selection-meta">${esc(sentence)}</p>${key === 'collab' ? '' : `<div class="detail-stat"><span>REFERENCES</span><strong>${node.n}</strong><small>${typeSummary(node.types)}${node.first ? ` · first ${node.first}` : ''}</small></div>`}<div class="detail-stat"><span>NOTORIETY</span><strong>${artists[node.a].s} / 100</strong><small>${artistMeta(node.a)}</small></div><button class="button primary" data-artist="${node.a}">Centre network on ${esc(short(other, 24))}</button><button class="text-button" data-profile>← Back to ${esc(short(center, 24))}</button>`);
  }

  // Candidates: compare cumulative careers
  const dataEnd = state.years.candidates.max, future = [1, 2, 3, 4, 5].map(k => dataEnd + k);
  const firstRelease = index => { const years = artists[index].w.map(work => work[0]).filter(Boolean); return years.length ? Math.min(...years) : null; };
  const lifetimeRate = (events, index) => { const first = firstRelease(index); return first ? events.filter(year => year && year <= dataEnd).length / (dataEnd - first + 1) : 0; };
  function notorietyAt(index, year, extraYears = 0) {
    const first = firstRelease(index);
    if (!first || year < first) return 0;
    const parts = [artists[index].w.map(work => work[0]), artists[index].w.filter(work => work[2]).map(work => work[0]), outward[index].map(link => link[1])];
    const counts = parts.map(list => list.filter(when => !when || when <= year).length + lifetimeRate(list, index) * extraYears);
    return Math.round(100 * counts.reduce((sum, count, i) => sum + Math.log1p(count) / data.notorietyPeaks[i], 0) / 3);
  }
  const eventMetric = (label, axis, note, years) => ({label, axis, note, years,
    value:(index, year, cumulative) => years(index).filter(when => when && (cumulative ? when <= year : when === year)).length,
    project:(index, year, cumulative) => { const rate = lifetimeRate(years(index), index); return cumulative ? years(index).filter(when => when && when <= dataEnd).length + rate * (year - dataEnd) : rate; }
  });
  const metrics = {
    releases:eventMetric('Releases', 'RELEASES', 'Filled dots mark notable releases.', index => artists[index].w.map(work => work[0])),
    notable:eventMetric('Notable releases', 'NOTABLE RELEASES', 'Counted by release year.', index => artists[index].w.filter(work => work[2]).map(work => work[0])),
    folk:eventMetric('Oceanus Folk releases', 'OCEANUS FOLK RELEASES', 'Releases in the Oceanus Folk genre only.', index => artists[index].w.filter(work => work[1] === folk).map(work => work[0])),
    influenced:eventMetric('Artists they influenced', 'ARTISTS INFLUENCED', 'Each artist counted once, in the year they first referenced this artist.', index => outward[index].filter(link => linkCount(link)).map(link => link[1])),
    influences:eventMetric('Artists who influenced them', 'INFLUENCES', 'Each artist counted once, in the year this artist first referenced them.', index => (artists[index].i || []).filter(link => linkCount(link)).map(link => link[1])),
    notoriety:{label:'Notoriety', axis:'NOTORIETY', level:true, note:'Score out of 100 as of each year, from releases, notable releases and artists influenced so far.', value:index => 0, project:index => 0}
  };
  metrics.notoriety.value = (index, year) => notorietyAt(index, year);
  metrics.notoriety.project = (index, year) => notorietyAt(index, dataEnd, year - dataEnd);
  function renderCandidates() {
    const range = state.years.candidates, chosen = compared(), metric = metrics[state.metric];
    const cumulative = state.cumulative || !!metric.level, projecting = range.end === dataEnd;
    const years = Array.from({length:range.end - range.start + 1}, (_, i) => range.start + i), ahead = projecting ? future : [], all = [...years, ...ahead];
    const fmt = value => Number.isInteger(value) ? value : value.toFixed(1);
    $$('[data-cumulative]').forEach(button => { button.disabled = !!metric.level; });
    const series = chosen.map(({index, slot}) => {
      const works = artists[index].w;
      return {index, color:seriesColors[slot], values:years.map(year => metric.value(index, year, cumulative)), projected:ahead.map(year => metric.project(index, year, cumulative)), notable:state.metric === 'releases' && cumulative ? works.filter(work => work[2] && work[0] >= range.start && work[0] <= range.end) : []};
    });
    $('#axisTitle').textContent = metric.level ? metric.axis : `${cumulative ? 'CUMULATIVE' : 'YEARLY'} ${metric.axis}`;
    $('#viewDescription').textContent = `${metric.label}${metric.level ? '' : `, ${cumulative ? 'added up over time' : 'per year'}`}. ${metric.note} ${projecting ? `Dashed lines project ${future[0]}–${future.at(-1)} at each artist's lifetime average, from first release to ${dataEnd}.` : `Set the end year to ${dataEnd} to see projections.`}`;
    if (!series.length) { $('#viz').innerHTML = '<p class="viz-empty">Choose artists in the boxes above to compare them.</p>'; $('#legend').innerHTML = ''; inspector('IDLE', compareHtml()); return; }
    const W = 1000, H = 500, left = 34, right = 200, top = 30, bottom = 26;
    const peak = metric.level ? 100 : Math.max(...series.flatMap(item => [...item.values, ...item.projected]), 1), step = metric.level ? 25 : Math.max(1, Math.ceil(peak / 4)), max = Math.ceil(peak / step) * step;
    const gap = all.length < 2 ? 0 : (W - left - right) / (all.length - 1);
    const x = i => left + i * gap, y = value => H - bottom - value / max * (H - top - bottom);
    const ticks = Array.from({length:max / step + 1}, (_, i) => i * step);
    const grid = ticks.map(value => `<line class="chart-grid" x1="${left}" x2="${W - right}" y1="${y(value)}" y2="${y(value)}"/>${text(left - 8, y(value) + 3, value, 'text-anchor="end" class="chart-label"')}`).join('');
    const zone = projecting ? `<rect class="projection-zone" x="${x(years.length - 1)}" y="${top - 22}" width="${x(all.length - 1) - x(years.length - 1)}" height="${H - bottom - top + 22}"/>${text(x(years.length - 1) + 7, top - 9, `PROJECTED ${future[0]}–${String(future.at(-1)).slice(-2)}`, 'class="chart-heading"')}` : '';
    const labels = all.map((year, i) => (i === 0 || i === all.length - 1 || year % 5 === 0) ? text(x(i), H - 6, year, 'text-anchor="middle" class="chart-label"') : '').join('');
    const lines = series.map(item => {
      const last = years.length - 1;
      const solid = `<polyline class="line-series" points="${item.values.map((value, i) => `${x(i)},${y(value)}`).join(' ')}" stroke="${item.color}"/>`;
      const dashed = item.projected.length ? `<polyline class="line-series projected" points="${[[last, item.values[last]], ...item.projected.map((value, k) => [last + 1 + k, value])].map(([i, value]) => `${x(i)},${y(value)}`).join(' ')}" stroke="${item.color}"/>` : '';
      return solid + dashed + item.notable.map(work => `<circle class="point" cx="${x(work[0] - range.start)}" cy="${y(item.values[work[0] - range.start])}" r="4.5" fill="${item.color}"/>`).join('');
    }).join('');
    const ends = series.map(item => ({item, value:item.projected.length ? item.projected.at(-1) : item.values.at(-1)})).map(end => ({...end, y:y(end.value)})).sort((a, b) => a.y - b.y);
    ends.forEach((end, i) => { if (i && end.y - ends[i - 1].y < 15) end.y = ends[i - 1].y + 15; });
    const endLabels = ends.map(end => text(W - right + 10, end.y + 4, `${short(artists[end.item.index].n, 18)} · ${fmt(end.item.values.at(-1))}${end.item.projected.length ? ` → ${fmt(end.value)}` : ''}`, 'class="end-label"')).join('');
    const hits = all.map((year, i) => { const projected = i >= years.length; return `<rect class="year-hit" x="${x(i) - gap / 2}" y="${top}" width="${gap || W - left - right}" height="${H - top - bottom}" ${tip(`<strong>${year}${projected ? ' · projected' : ''}</strong><br>${series.map(item => `<span style="color:${item.color}">●</span> ${esc(artists[item.index].n)}: ${fmt(projected ? item.projected[i - years.length] : item.values[i])}`).join('<br>')}`)} data-cross="${x(i)}"/>`; }).join('');
    $('#viz').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(metric.label)} by artist, with projections">${zone}<g>${grid}</g><line class="crosshair" id="crosshair" x1="0" x2="0" y1="${top}" y2="${H - bottom}" visibility="hidden"/>${lines}${labels}${endLabels}${hits}</svg>`;
    $('#legend').innerHTML = series.map(item => `<button class="legend-button" data-artist="${item.index}"><i class="legend-swatch" style="background:${item.color}"></i>${esc(artists[item.index].n)}</button>`).join('') + (series.some(item => item.notable.length) ? '<span class="legend-button static"><i class="legend-dot" style="--c:#71828b"></i>Notable release</span>' : '') + (projecting ? '<span class="legend-button static"><i class="legend-dash"></i>Projected at lifetime average</span>' : '');
    $('#chartHint').textContent = 'Click a name in the legend or table to open their network.';
    inspector('COMPARE', compareHtml());
  }
  function compareHtml() {
    const chosen = compared();
    if (!chosen.length) return '<div class="empty-inspector"><span class="empty-mark">+</span><h2>Pick artists</h2><p>Choose up to three artists above the chart to compare their careers.</p></div>';
    const years = index => artists[index].w.map(work => work[0]).filter(Boolean);
    const rows = [
      ['Notoriety', index => artists[index].s],
      ['Releases', index => artists[index].k[0]],
      ['Notable releases', index => artists[index].k[1]],
      ['First release', index => Math.min(...years(index)) || '—'],
      ['First notable', index => artists[index].f || '—'],
      [`Releases ${recent.join('–')}`, index => recentCount(artists[index])],
      ['Oceanus Folk releases', index => artists[index].w.filter(work => work[1] === folk).length],
      ['Artists influenced', index => artists[index].k[2]],
      ['Releases / yr, lifetime', index => lifetimeRate(artists[index].w.map(work => work[0]), index).toFixed(1)],
      [`Projected releases by ${future.at(-1)}`, index => metrics.releases.project(index, future.at(-1), true).toFixed(1)],
      [`Projected notoriety ${future.at(-1)}`, index => notorietyAt(index, dataEnd, future.length)]
    ];
    return `<span class="selection-kicker">RISING-STAR CHECK</span><h2 class="selection-title">Side by side</h2><p class="selection-meta">Rising stars pair recent releases with early notability and a growing circle of artists they influence.</p><table class="compare-table"><thead><tr><th></th>${chosen.map(({index, slot}) => `<th><i class="artist-swatch" style="background:${seriesColors[slot]}"></i>${artistLink(index)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, value]) => `<tr><td>${label}</td>${chosen.map(({index}) => `<td>${value(index)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  // Views
  const views = {
    influence:['INFLUENCE / OCEANUS FOLK','Influence across genres'],
    careers:['CAREERS / EGO NETWORK','Artist network'],
    candidates:['CANDIDATES / 2041—45','Rising-star comparison']
  };
  function setView(view) {
    state.view = view;
    $$('.view-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
    $('#viewKicker').textContent = views[view][0]; $('#viewTitle').textContent = views[view][1];
    $$('[data-views]').forEach(group => { group.hidden = !group.dataset.views.split(' ').includes(view); });
    syncYears(); render();
    if (view === 'candidates') renderSlots();
    if (devMode) feedbackLoad();
  }
  function render() {
    tips = []; acts = []; hideTooltip();
    if (state.view === 'influence') { renderInfluence(); influenceSummary(); }
    else if (state.view === 'careers') renderCareers();
    else renderCandidates();
    renderArtistList();
  }
  function reset() {
    if (state.view === 'influence') { state.direction = 'outbound'; state.types = new Set([0, 1, 2, 3, 4]); $$('[data-direction]').forEach(item => item.classList.toggle('active', item.dataset.direction === 'outbound')); renderTypeFilters(); }
    if (state.view === 'candidates') { state.metric = 'releases'; state.cumulative = true; $('#compareMetric').value = 'releases'; $$('[data-cumulative]').forEach(item => item.classList.toggle('active', item.dataset.cumulative === 'true')); }
    if (state.view === 'careers') { state.types = new Set([0, 1, 2, 3, 4]); state.layers = new Set(Object.keys(relations)); renderTypeFilters(); }
    const range = state.years[state.view]; if (range) { range.start = range.default || range.min; range.end = range.max; syncYears(); }
    state.query = ''; state.folkOnly = false; $('#artistSearch').value = ''; $('#folkOnly').checked = false;
    render();
  }

  $('#viz').addEventListener('mousemove', event => {
    const target = event.target.closest('[data-tip]');
    if (target) showTooltip(tips[target.dataset.tip], event); else hideTooltip();
    const cross = $('#crosshair');
    if (cross) { const at = event.target.closest('[data-cross]'); cross.setAttribute('visibility', at ? 'visible' : 'hidden'); if (at) { cross.setAttribute('x1', at.dataset.cross); cross.setAttribute('x2', at.dataset.cross); } }
  });
  $('#viz').addEventListener('mouseleave', hideTooltip);
  $('#viz').addEventListener('click', event => { const target = event.target.closest('[data-act]'); if (target) acts[target.dataset.act](); });
  $('#viz').addEventListener('dblclick', event => { const target = event.target.closest('[data-center]'); if (target) { state.center = Number(target.dataset.center); render(); } });
  document.addEventListener('click', event => {
    if (!event.target.closest('#inspectorContent, #legend')) return;
    const artist = event.target.closest('[data-artist]');
    if (artist) openArtist(Number(artist.dataset.artist));
    if (event.target.closest('[data-summary]')) influenceSummary();
    if (event.target.closest('[data-profile]')) inspector('ARTIST', profileHtml(state.center));
  });
  $$('.view-tab').forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.view)));
  $$('[data-direction]').forEach(segment => segment.addEventListener('click', () => { state.direction = segment.dataset.direction; $$('[data-direction]').forEach(item => item.classList.toggle('active', item === segment)); render(); }));
  $('#compareMetric').addEventListener('change', event => { state.metric = event.target.value; render(); });
  $$('[data-cumulative]').forEach(segment => segment.addEventListener('click', () => { state.cumulative = segment.dataset.cumulative === 'true'; $$('[data-cumulative]').forEach(item => item.classList.toggle('active', item === segment)); render(); }));
  $('#yearStart').addEventListener('input', updateYears); $('#yearEnd').addEventListener('input', updateYears);
  $('#clearFilters').addEventListener('click', reset);
  $('#artistSearch').addEventListener('input', event => { state.query = event.target.value; renderArtistList(); });
  $('#folkOnly').addEventListener('change', event => { state.folkOnly = event.target.checked; renderArtistList(); });
  $('#artistSort').addEventListener('change', event => { state.sort = event.target.value; renderArtistList(); });
  $('#artistSearch').placeholder = `Search ${artists.length.toLocaleString()} artists`;
  $('#exportButton').addEventListener('click', () => {
    const range = state.years[state.view];
    const detail = {influence:`Direction: ${state.direction}\nRelationship types: ${[...state.types].map(type => typeLabels[type]).join(', ')}`, careers:`Centre: ${artists[state.center].n}`, candidates:`Comparing: ${compared().map(({index}) => artists[index].n).join(', ')}`}[state.view];
    const blob = new Blob([`Oceanus Folk — ${state.view}\n${detail}${range ? `\nYears: ${range.start}—${range.end}` : ''}\n${$('#viewDescription').textContent}\nSource: VAST Challenge 2025 MC1 knowledge graph.`], {type:'text/plain'});
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'oceanus-folk-exploration.txt'; link.click(); URL.revokeObjectURL(link.href);
  });
  const startView = new URLSearchParams(location.search).get('view');
  feedbackInit(); renderTypeFilters(); setView(views[startView] ? startView : 'influence');
})();
