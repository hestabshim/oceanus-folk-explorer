(() => {
  const data = window.GRAPH_DATA;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const tooltip = $('#tooltip');
  const typeLabels = ['In style of','Interpolates','Lyrical reference','Cover','Direct sample'];
  const typeColors = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4'];
  const seriesColors = ['#2a78d6','#eb6834','#1baf7a'];
  const relations = {by:{label:'Influenced them',color:'#2a78d6'},collab:{label:'Collaborators',color:'#1baf7a'},out:{label:'They influenced',color:'#eb6834'},indirect:{label:'Indirectly influenced',color:'#eb6834'},context:{label:'Wider network',color:'#9aabad'}};
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
  const debuts = artists.map(artist => { const years = artist.w.map(work => work[0]).filter(Boolean); return years.length ? Math.min(...years) : null; });
  const risingFrom = 2030;
  const state = {
    view:'influence', direction:'outbound', types:new Set([0, 1, 2, 3, 4]),
    years:{influence:{min:data.years[0], max:data.years[1]}, candidates:{min:Math.min(...workYears), max:Math.max(...workYears)}},
    layers:new Set(Object.keys(relations)), center:findArtist('Sailor Shift'),
    compare:[null, null, null],
    folkOnly:false, pool:'all', poolSort:'notoriety', metric:'releases', cumulative:true
  };
  Object.values(state.years).forEach(range => { range.start = range.min; range.end = range.max; });
  state.years.candidates.start = state.years.candidates.default = 2015;
  let tips = [], acts = [];

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
    if (ref < 0) return '<em>the artist (no specific song)</em>';
    const [name, year, genre, owners] = data.works[ref];
    return `<b>${esc(name)}</b> (${esc(data.genres[genre] || 'Unknown')}, ${year || '?'})${owners.length ? ` by ${owners.slice(0, 2).map(index => artistLink(index)).join(', ')}${owners.length > 2 ? ` +${owners.length - 2}` : ''}` : ''}`;
  }
  function evidenceRows(rows, limit = 40) {
    const list = rows.slice(0, limit).map(([, , type, from, to]) => `<div><i style="color:${typeColors[type]}">●</i><span>${from < 0 && to < 0 ? `<b>${typeLabels[type]}</b><br><em>Recorded between the artists themselves, not tied to a song</em>` : `${workLabel(from)}<br><em>${typeLabels[type]} →</em> ${workLabel(to)}`}</span></div>`).join('');
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
    const at = year => (year - range.min) / Math.max(range.max - range.min, 1) * 100;
    $('#yearFill').style.left = `${at(range.start)}%`; $('#yearFill').style.right = `${100 - at(range.end)}%`;
  }
  function updateYears() {
    const range = state.years[state.view];
    let start = Number($('#yearStart').value), end = Number($('#yearEnd').value);
    if (start > end) [start, end] = [end, start];
    range.start = start; range.end = end; syncYears(); render();
  }
  // Artist search: shared by the careers search bar and the three candidate slots
  function inPool(index, pool) { return pool === 'rising' ? debuts[index] >= risingFrom : pool === 'established' ? debuts[index] !== null && debuts[index] < risingFrom : true; }
  function findArtists(query, {exclude = new Set(), folkOnly = false, pool = 'all', sort = 'notoriety'} = {}) {
    const needle = query.trim().toLowerCase(), matches = [];
    for (const [index, artist] of artists.entries()) if (!exclude.has(index) && (!needle || artist.n.toLowerCase().includes(needle)) && (!folkOnly || isFolk[index]) && inPool(index, pool)) matches.push(index);
    const by = sort === 'newest' ? (a, b) => (debuts[b] || 0) - (debuts[a] || 0) || artists[b].s - artists[a].s : (a, b) => artists[b].s - artists[a].s;
    return matches.sort(by).slice(0, 30);
  }
  function combobox(box, current, search, choose) {
    const input = $('input', box), menu = $('[role="listbox"]', box);
    let options = [], active = 0;
    const name = () => current() === null ? '' : artists[current()].n;
    const close = () => { menu.hidden = true; input.setAttribute('aria-expanded', 'false'); };
    const pick = index => { close(); input.blur(); choose(index); };
    const show = () => {
      options = search(input.value === name() ? '' : input.value);
      active = Math.min(active, Math.max(options.length - 1, 0));
      menu.innerHTML = options.map((index, i) => `<div class="slot-option ${i === active ? 'active' : ''}" role="option" aria-selected="${i === active}" data-index="${index}"><span><strong>${esc(artists[index].n)}</strong><small>${artistMeta(index)}${debuts[index] ? ` · debut ${debuts[index]}` : ''}</small></span><b class="score-pill" title="Notoriety score">${artists[index].s}</b></div>`).join('') || '<p class="list-note">No artists match.</p>';
      menu.hidden = false; input.setAttribute('aria-expanded', 'true');
      $('.slot-option.active', menu)?.scrollIntoView({block:'nearest'});
      $$('.slot-option', menu).forEach(option => option.addEventListener('mousedown', event => { event.preventDefault(); pick(Number(option.dataset.index)); }));
    };
    input.addEventListener('focus', () => { input.select(); active = 0; show(); });
    input.addEventListener('input', () => { active = 0; show(); });
    input.addEventListener('blur', () => { close(); input.value = name(); });
    box.addEventListener('dismiss', () => { if (!menu.hidden) { close(); input.value = name(); input.blur(); } });
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); active = (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % Math.max(options.length, 1); show(); }
      else if (event.key === 'Enter' && options.length) { event.preventDefault(); pick(options[active]); }
      else if (event.key === 'Escape') input.blur();
    });
  }
  // Blur alone can't be trusted to close menus: an overlay that takes focus (e.g. Mesurer) means it never fires
  document.addEventListener('pointerdown', event => $$('#artistSearchBox, #compareSlots .slot').forEach(box => { if (!box.contains(event.target)) box.dispatchEvent(new Event('dismiss')); }), true);
  function setCenter(index) { state.center = index; render(); }
  // Candidates: three artist slots above the chart
  function compared() { return state.compare.map((index, slot) => ({index, slot})).filter(item => item.index !== null); }
  function renderSlots() {
    $('#compareSlots').innerHTML = state.compare.map((index, slot) => `<div class="slot ${index === null ? 'empty' : ''}" data-slot="${slot}"><i class="artist-swatch" style="background:${seriesColors[slot]}"></i><input class="slot-input" type="text" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="Artist ${slot + 1}" autocomplete="off" placeholder="Add artist ${slot + 1}…" value="${index === null ? '' : esc(artists[index].n)}"/>${index === null ? '' : `<button class="slot-clear" aria-label="Remove ${esc(artists[index].n)}">×</button>`}<div class="slot-menu" role="listbox" hidden></div></div>`).join('');
    $$('#compareSlots .slot').forEach(box => {
      const slot = Number(box.dataset.slot);
      const choose = index => { state.compare[slot] = index; renderSlots(); render(); };
      const exclude = () => new Set(state.compare.filter((index, other) => other !== slot && index !== null));
      combobox(box, () => state.compare[slot], query => findArtists(query, {exclude:exclude(), pool:state.pool, sort:state.poolSort}), choose);
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
    $('#viewDescription').textContent = 'Hover a year to see its references broken down by genre. Click a year or a period heading to list the songs behind it on the right.';
    if (!rows.length) { $('#viz').innerHTML = '<p class="viz-empty">No references match these filters.</p>'; $('#legend').innerHTML = ''; return; }
    const W = 1000, H = 500, left = 40, right = 16, top = 76, bottom = 30;
    const gap = years.length < 2 ? 0 : (W - left - right) / (years.length - 1);
    const x = i => years.length < 2 ? (W + left - right) / 2 : left + i * gap;
    const peak = Math.max(...totals, 1), step = Math.max(1, Math.ceil(peak / 4)), max = Math.ceil(peak / step) * step;
    const y = value => H - bottom - value / max * (H - top - bottom);
    const bands = periods.map((era, p) => {
      const x0 = p ? x(era.start - range.start) : left, x1 = p < periods.length - 1 ? x(periods[p + 1].start - range.start) : W - right;
      const span = era.end - era.start + 1, rate = era.rows.length / span;
      const label = `${text(x0 + 7, 18, era.short, 'class="chart-heading"')}${text(x0 + 7, 36, era.start === era.end ? era.start : `${era.start}–${String(era.end).slice(-2)}`, 'class="chart-label"')}${text(x0 + 7, 56, `${rate.toFixed(1)}/yr`, 'class="era-rate"')}`;
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
    $('#legend').innerHTML = '<h3 class="legend-title">Genres</h3>' + series.map(item => `<span class="legend-button static"><i class="legend-swatch" style="background:${item.color}"></i>${esc(item.name)}</span>`).join('');
    $('#chartHint').textContent = `Periods split at Ivy Echos' first release (${data.milestones.ivyEchos}) and Sailor Shift's solo debut (${data.milestones.sailorSolo}).`;
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
  // Song-level evidence behind one link
  const workSet = index => new Set([...artists[index].w.map(work => work[3]), ...(artists[index].p || [])]);
  function sharedWorks(a, b) { const mine = workSet(a); return [...workSet(b)].filter(ref => mine.has(ref)).sort((p, q) => data.works[p][1] - data.works[q][1]); }
  function linkEvidence(a, b) {
    const k = (artists[a].i || []).findIndex(link => link[0] === b), refs = k < 0 ? [] : artists[a].e[k], rows = [];
    for (let i = 0; i < refs.length; i += 3) if (state.types.has(refs[i])) rows.push([0, 0, refs[i], refs[i + 1], refs[i + 2]]);
    return rows.sort((p, q) => (data.works[p[3]]?.[1] || 0) - (data.works[q[3]]?.[1] || 0));
  }
  function membership(a, b) { return (artists[a].m || []).includes(b) ? `${artists[a].n} is a member of ${artists[b].n}.` : (artists[b].m || []).includes(a) ? `${artists[b].n} is a member of ${artists[a].n}.` : ''; }
  function linkEvidenceHtml(a, b) {
    const songs = sharedWorks(a, b), member = membership(a, b), shown = 20;
    const references = [[linkEvidence(a, b), `${artists[a].n} drawing on ${artists[b].n}`], [linkEvidence(b, a), `${artists[b].n} drawing on ${artists[a].n}`]]
      .filter(([rows]) => rows.length).map(([rows, title]) => `<div class="evidence-list"><h3>${esc(title)} · ${rows.length}</h3>${evidenceRows(rows, shown)}</div>`).join('');
    const credits = songs.length || member ? `<div class="evidence-list"><h3>WORKED ON TOGETHER · ${songs.length}</h3>${member ? `<p class="list-note">${esc(member)}</p>` : ''}${songs.slice(0, shown).map(ref => `<div><i>●</i><span>${workLabel(ref)}</span></div>`).join('')}${songs.length > shown ? `<p class="list-note">Showing ${shown} of ${songs.length} works.</p>` : ''}</div>` : '';
    return references + credits;
  }
  function linksOf(index) {
    const list = new Map(), add = (b, n) => { if (n > 0) list.set(b, (list.get(b) || 0) + n); };
    (artists[index].i || []).forEach(link => add(link[0], linkCount(link)));
    outward[index].forEach(link => add(link[0], linkCount(link)));
    collaborators(artists[index]).forEach(([b, n]) => add(b, n));
    return list;
  }
  // Direct links sit in loose groups (influences left, influenced right, collaborators below); the
  // wider network around them is faded. A small force layout spreads everything out from there.
  function egoNetwork(center, groups, limit) {
    const W = 1000, H = 640, cx = W / 2, cy = H / 2;
    const nodes = new Map([[center, {a:center, key:'center', x:cx, y:cy}]]), edges = [];
    const related = new Set([center, ...[...groups.by, ...groups.collab, ...groups.out].map(item => item.a)]);
    const sectors = {by:[180, 110], collab:[90, 80], out:[0, 110]};
    ['by','collab','out'].forEach(key => {
      if (!state.layers.has(key)) return;
      const items = groups[key].slice(0, limit).filter(item => !nodes.has(item.a));
      items.forEach((item, i) => {
        const [angle, span] = sectors[key], turn = (angle + (i / Math.max(items.length - 1, 1) - .5) * span) * Math.PI / 180, reach = 190 + (i % 2) * 50;
        const x = cx + Math.cos(turn) * reach * 1.3, y = cy + Math.sin(turn) * reach * .8;
        nodes.set(item.a, {...item, key, ax:x, ay:y, x, y});
        edges.push({from:center, to:item.a, key, n:item.n});
      });
    });
    const direct = [...nodes.values()].filter(node => node.key !== 'center');
    if (state.layers.has('indirect')) direct.filter(node => node.key === 'out').forEach(parent => {
      groups.indirect.filter(item => item.parent === parent.a && !nodes.has(item.a) && !related.has(item.a)).slice(0, 3).forEach((item, i) => {
        nodes.set(item.a, {...item, key:'indirect', faded:true, from:parent, ax:parent.x + 120, ay:parent.y, x:parent.x + 110, y:parent.y + (i - 1) * 30});
        edges.push({from:parent.a, to:item.a, key:'indirect', faded:true, n:item.n});
      });
    });
    let context = 0;
    if (state.layers.has('context')) direct.forEach(node => {
      const around = [...linksOf(node.a)].filter(([b]) => !nodes.has(b) && !related.has(b)).sort((p, q) => q[1] - p[1] || artists[q[0]].s - artists[p[0]].s).slice(0, 2);
      around.forEach(([b, n], i) => {
        if (context >= 30) return;
        const dx = node.x - cx, dy = node.y - cy, d = Math.hypot(dx, dy) || 1;
        nodes.set(b, {a:b, n, key:'context', faded:true, from:node, ax:node.x + dx / d * 110, ay:node.y + dy / d * 110, x:node.x + dx / d * 90 + (i ? 20 : -20), y:node.y + dy / d * 90 + (i ? -20 : 20)});
        context += 1;
      });
    });
    // Links between the other artists on screen, not involving the centre
    const pairs = new Set(edges.map(edge => [edge.from, edge.to].sort((p, q) => p - q).join()));
    nodes.forEach(node => {
      if (node.key === 'center') return;
      linksOf(node.a).forEach((n, b) => {
        const pair = [node.a, b].sort((p, q) => p - q).join();
        if (b !== center && nodes.has(b) && !pairs.has(pair)) { pairs.add(pair); edges.push({from:node.a, to:b, key:'context', faded:true, n}); }
      });
    });
    const list = [...nodes.values()], at = new Map(list.map((node, i) => [node.a, i]));
    const springs = edges.map(edge => edge.from === center ? [at.get(edge.from), at.get(edge.to), 220, .05] : [at.get(edge.from), at.get(edge.to), 70, edge.key === 'context' && !nodes.get(edge.to).from ? .004 : .03]);
    for (let step = 0; step < 300; step++) {
      const heat = 1 - step / 300, fx = list.map(() => 0), fy = list.map(() => 0);
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const dx = list[j].x - list[i].x, dy = list[j].y - list[i].y, d2 = Math.max(dx * dx + dy * dy, 25), f = (d2 < 900 ? 900 : 450) / d2;
        fx[i] -= dx * f; fy[i] -= dy * f; fx[j] += dx * f; fy[j] += dy * f;
      }
      springs.forEach(([i, j, rest, k]) => {
        const dx = list[j].x - list[i].x, dy = list[j].y - list[i].y, d = Math.hypot(dx, dy) || 1, f = (d - rest) * k / d;
        fx[i] += dx * f; fy[i] += dy * f; fx[j] -= dx * f; fy[j] -= dy * f;
      });
      const cap = 2 + 14 * heat;
      list.forEach((node, i) => {
        if (node.key === 'center') return;
        fx[i] += (node.ax - node.x) * .01; fy[i] += (node.ay - node.y) * .01;
        node.x += Math.max(-cap, Math.min(cap, fx[i])); node.y += Math.max(-cap, Math.min(cap, fy[i]));
        // Direct links stay in a band around the centre so their labels have room,
        // and the wider network stays close to the artist it hangs off
        const [ox, oy, near, far] = node.faded ? [node.from.x, node.from.y, 45, 100] : [cx, cy, 200, 260];
        const dx = node.x - ox, dy = node.y - oy, d = Math.hypot(dx, dy) || 1, keep = Math.min(far, Math.max(near, d)) / d;
        node.x = ox + dx * keep; node.y = oy + dy * keep;
      });
    }
    // Fit the settled layout into the frame, leaving room for labels at the sides
    const xs = list.map(node => node.x), ys = list.map(node => node.y), x0 = Math.min(...xs), y0 = Math.min(...ys);
    const sy = Math.min((H - 70) / Math.max(Math.max(...ys) - y0, 1), 1.4), sx = Math.min((W - 220) / Math.max(Math.max(...xs) - x0, 1), sy * 1.5);
    const ox = (W - (Math.max(...xs) - x0) * sx) / 2, oy = (H - (Math.max(...ys) - y0) * sy) / 2;
    list.forEach(node => { node.x = ox + (node.x - x0) * sx; node.y = oy + (node.y - y0) * sy; });
    return {nodes, edges, context, W, H};
  }
  function syncArtistSearch() {
    if (document.activeElement !== $('#artistSearch')) $('#artistSearch').value = state.center === null ? '' : artists[state.center].n;
    $('#clearArtist').hidden = state.center === null;
  }
  function renderCareers() {
    const center = state.center;
    $('#axisTitle').textContent = '';
    $('#chartHint').textContent = '';
    syncArtistSearch();
    if (center === null) {
      const picks = [findArtist('Sailor Shift'), ...findArtists('', {folkOnly:true})].filter((index, i, list) => index >= 0 && list.indexOf(index) === i).slice(0, 5);
      $('#viewDescription').textContent = 'Search for an artist to see their network.';
      $('#viz').innerHTML = `<div class="viz-empty"><span class="empty-mark">+</span><h2>Pick an artist</h2><p>Search above to see who influenced them, who they worked with and who they went on to influence.</p><div class="suggestions">${picks.map(index => `<button class="genre-chip" ${act(() => setCenter(index))}>${esc(artists[index].n)}</button>`).join('')}</div></div>`;
      $('#legend').innerHTML = '';
      inspector('IDLE', '<div class="empty-inspector"><span class="empty-mark">+</span><h2>No artist selected</h2><p>Their profile will appear here.</p></div>');
      return;
    }
    const groups = egoGroups(center), limit = 12, {nodes, edges, context, W, H} = egoNetwork(center, groups, limit);
    const name = artists[center].n, hub = nodes.get(center), radius = index => 4 + artists[index].s / 100 * 8;
    const point = node => `${node.x.toFixed(1)} ${node.y.toFixed(1)}`;
    const nodeTip = (item, key) => `<strong>${esc(artists[item.a].n)}</strong><br>${relations[key].label}${key === 'collab' ? ` · ${item.n} shared credits` : key === 'context' ? '' : ` · ${typeSummary(item.types) || `${item.n} references`}`}${item.first ? `<br>First reference ${item.first}` : ''}${item.from ? `<br>Via ${esc(artists[item.from.a].n)}` : ''}<br>Notoriety ${artists[item.a].s}${isFolk[item.a] ? ' · Oceanus Folk' : ''}`;
    const edgeSvg = edges.sort((p, q) => !!q.faded - !!p.faded).map(edge => {
      const p = nodes.get(edge.from), q = nodes.get(edge.to);
      const mx = (p.x + q.x) / 2 - (q.y - p.y) * .12, my = (p.y + q.y) / 2 + (q.x - p.x) * .12;
      return `<path class="net-edge ${edge.faded ? 'faded' : ''} ${edge.key === 'indirect' ? 'indirect' : ''}" d="M${point(p)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${point(q)}" stroke="${relations[edge.key].color}" stroke-width="${(1 + Math.min(edge.n, 6) * .4).toFixed(1)}"/>`;
    }).join('');
    const nodeSvg = [...nodes.values()].filter(node => node.key !== 'center').sort((p, q) => !!q.faded - !!p.faded).map(node => {
      const r = radius(node.a) * (node.faded ? .8 : 1), right = node.x >= hub.x;
      const label = text(node.x + (right ? 1 : -1) * (r + 5), node.y + 3.5, short(artists[node.a].n), `text-anchor="${right ? 'start' : 'end'}" class="net-label"`);
      const ring = node.key === 'indirect' ? ` style="stroke:${relations.indirect.color}"` : '';
      return `<g class="net-node ${node.faded ? 'faded' : ''}" ${tip(nodeTip(node, node.key))} ${act(() => inspectRelation(node, node.key))} data-center="${node.a}"><circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${node.key === 'indirect' ? '#fff' : relations[node.key].color}" class="${isFolk[node.a] ? 'folk' : ''}"${ring}/>${label}</g>`;
    }).join('');
    const hubSvg = `<g class="net-node" ${tip(`<strong>${esc(name)}</strong><br>Notoriety ${artists[center].s}`)} ${act(() => inspector('ARTIST', profileHtml(center)))}><circle cx="${hub.x}" cy="${hub.y}" r="20" fill="#13212a" class="${isFolk[center] ? 'folk-hub' : ''}"/>${text(hub.x, hub.y + 38, name, 'text-anchor="middle" class="net-center-label"')}</g>`;
    $('#viewDescription').textContent = `Click an artist for the evidence behind their link to ${name}. Double-click to put them at the centre.`;
    $('#viz').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Influence network for ${esc(name)}">${edgeSvg}${nodeSvg}${hubSvg}</svg>`;
    const counts = {by:groups.by.length, collab:groups.collab.length, out:groups.out.length, indirect:groups.indirect.length, context};
    $('#legend').innerHTML = `<h3 class="legend-title">Connections</h3>${Object.entries(relations).map(([key, relation]) => `<button class="legend-button ${state.layers.has(key) ? '' : 'off'}" data-layer="${key}" aria-pressed="${state.layers.has(key)}"><i class="legend-dot ${key === 'indirect' ? 'hollow' : ''} ${key === 'indirect' || key === 'context' ? 'faded' : ''}" style="--c:${relation.color}"></i>${relation.label}<b class="legend-count">${key === 'context' && !state.layers.has(key) ? '' : counts[key]}</b></button>`).join('')}<span class="legend-button static"><i class="legend-dot folk-key"></i>Oceanus Folk artist</span><p class="legend-note">Faded artists aren't linked to ${esc(short(name, 24))} directly. Size shows notoriety. Up to ${limit} per group.</p>`;
    $$('[data-layer]').forEach(button => button.addEventListener('click', () => { const key = button.dataset.layer; state.layers.has(key) ? state.layers.delete(key) : state.layers.add(key); render(); }));
    inspector('ARTIST', profileHtml(center));
  }
  function profileHtml(index) {
    const artist = artists[index], groups = egoGroups(index);
    const genres = new Map(); artist.w.forEach(work => work[1] >= 0 && genres.set(work[1], (genres.get(work[1]) || 0) + 1));
    const folkShare = list => `${list.filter(item => isFolk[item.a]).length} of ${list.length} are Oceanus Folk`;
    const section = (title, list, note) => `<div class="evidence-list"><h3>${title} · ${list.length}</h3>${list.slice(0, 5).map(item => `<div><i>●</i><span>${artistLink(item.a)}<br><b>${item.n}</b> ${item.n === 1 ? note.replace(/s$/, '') : note}</span></div>`).join('') || '<p class="list-note">None recorded.</p>'}${list.length ? `<p class="list-note">${folkShare(list)}.</p>` : ''}</div>`;
    return `<div class="detail-stat"><span>NOTORIETY</span><strong>${artist.s} / 100</strong><small>${artist.k[0]} works · ${artist.k[1]} notable · influenced ${artist.k[2]} artists${artist.f ? ` · first notable ${artist.f}` : ''}</small></div><div class="evidence-list"><h3>GENRES</h3><p class="list-note">${[...genres].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([genre, count]) => `${esc(data.genres[genre])} (${count})`).join(', ') || 'Unknown'}</p></div>${section('INFLUENCED THEM', groups.by, 'references')}${section('COLLABORATORS', groups.collab, 'shared credits')}${section('THEY INFLUENCED', groups.out, 'references')}${section('INDIRECTLY INFLUENCED', groups.indirect, 'references')}`;
  }
  function inspectRelation(node, key) {
    const center = artists[state.center].n, other = artists[node.a].n, via = node.from ? artists[node.from.a].n : null, partner = node.from ? node.from.a : state.center;
    const sentence = {by:`${other} influenced ${center}.`, collab:`${other} shares ${node.n} credits with ${center}.`, out:`${center} influenced ${other}.`, indirect:`${center} reached ${other} through ${via || 'an artist they influenced'}.`, context:`${other} is linked to ${via}, not directly to ${center}.`}[key];
    inspector('LINK', `<span class="selection-kicker">${relations[key].label.toUpperCase()}</span><h2 class="selection-title">${esc(other)}</h2><p class="selection-meta">${esc(sentence)}</p>${linkEvidenceHtml(node.a, partner) || '<p class="list-note">No song-level evidence for the selected relationship types.</p>'}<div class="detail-stat"><span>NOTORIETY</span><strong>${artists[node.a].s} / 100</strong><small>${artistMeta(node.a)}</small></div><button class="button primary" data-artist="${node.a}">Centre network on ${esc(short(other, 24))}</button><button class="text-button" data-profile>← Back to ${esc(short(center, 24))}</button>`);
  }

  // Candidates: compare cumulative careers
  const dataEnd = state.years.candidates.max, future = [1, 2, 3, 4, 5].map(k => dataEnd + k);
  const firstRelease = index => debuts[index];
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
    if (!series.length) { $('#viz').innerHTML = '<div class="viz-empty"><span class="empty-mark">+</span><h2>Pick up to three artists</h2><p>Use the boxes above to compare careers. Set the artist pool to Rising to search only artists who debuted in 2030 or later.</p></div>'; $('#legend').innerHTML = ''; return; }
    const W = 1000, H = 500, left = 40, right = 16, top = 34, bottom = 30;
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
    const hits = all.map((year, i) => { const projected = i >= years.length; return `<rect class="year-hit" x="${x(i) - gap / 2}" y="${top}" width="${gap || W - left - right}" height="${H - top - bottom}" ${tip(`<strong>${year}${projected ? ' · projected' : ''}</strong><br>${series.map(item => `<span style="color:${item.color}">●</span> ${esc(artists[item.index].n)}: ${fmt(projected ? item.projected[i - years.length] : item.values[i])}`).join('<br>')}`)} data-cross="${x(i)}"/>`; }).join('');
    $('#viz').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(metric.label)} by artist, with projections">${zone}<g>${grid}</g><line class="crosshair" id="crosshair" x1="0" x2="0" y1="${top}" y2="${H - bottom}" visibility="hidden"/>${lines}${labels}${hits}</svg>`;
    $('#legend').innerHTML = '<h3 class="legend-title">Artists</h3>' + series.map(item => `<button class="legend-button" data-artist="${item.index}" title="${projecting ? `${dataEnd} → projected ${future.at(-1)}` : `At ${range.end}`}"><i class="legend-swatch" style="background:${item.color}"></i>${esc(artists[item.index].n)}<b class="legend-count">${fmt(item.values.at(-1))}${item.projected.length ? ` → ${fmt(item.projected.at(-1))}` : ''}</b></button>`).join('') + (series.some(item => item.notable.length) ? '<span class="legend-button static"><i class="legend-dot" style="--c:#71828b"></i>Notable release</span>' : '') + (projecting ? '<span class="legend-button static"><i class="legend-dash"></i>Projected at lifetime average</span>' : '');
    $('#chartHint').textContent = 'Click a name in the key to open their network.';
  }
  // Views
  const views = {
    influence:{title:'Influence across genres', inspector:'Details'},
    careers:{title:'Artist network', inspector:'Artist profile'},
    candidates:{title:'Rising-star comparison'}
  };
  function setView(view) {
    state.view = view;
    $('.explorer').dataset.view = view;
    $$('.view-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
    $('#viewTitle').textContent = views[view].title; $('#inspectorTitle').textContent = views[view].inspector || '';
    $$('[data-views]').forEach(group => { group.hidden = !group.dataset.views.split(' ').includes(view); });
    syncYears(); render();
    if (view === 'candidates') renderSlots();
  }
  function render() {
    tips = []; acts = []; hideTooltip();
    if (state.view === 'influence') { renderInfluence(); influenceSummary(); }
    else if (state.view === 'careers') renderCareers();
    else renderCandidates();
  }
  function setSegment(attr, value) { $$(`[data-${attr}]`).forEach(item => item.classList.toggle('active', item.dataset[attr] === String(value))); }
  function reset() {
    if (state.view === 'influence') { state.direction = 'outbound'; state.types = new Set([0, 1, 2, 3, 4]); setSegment('direction', 'outbound'); renderTypeFilters(); }
    if (state.view === 'candidates') { state.metric = 'releases'; state.cumulative = true; state.pool = 'all'; state.poolSort = 'notoriety'; $('#compareMetric').value = 'releases'; $('#poolSort').value = 'notoriety'; setSegment('cumulative', true); setSegment('pool', 'all'); }
    if (state.view === 'careers') { state.types = new Set([0, 1, 2, 3, 4]); state.layers = new Set(Object.keys(relations)); state.folkOnly = false; $('#folkOnly').checked = false; renderTypeFilters(); }
    const range = state.years[state.view]; if (range) { range.start = range.default || range.min; range.end = range.max; syncYears(); }
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
  $$('[data-pool]').forEach(segment => segment.addEventListener('click', () => { state.pool = segment.dataset.pool; setSegment('pool', state.pool); }));
  $('#poolSort').addEventListener('change', event => { state.poolSort = event.target.value; });
  $('#folkOnly').addEventListener('change', event => { state.folkOnly = event.target.checked; });
  combobox($('#artistSearchBox'), () => state.center, query => findArtists(query, {folkOnly:state.folkOnly}), setCenter);
  $('#clearArtist').addEventListener('click', () => setCenter(null));
  $('#artistSearch').placeholder = `Search ${artists.length.toLocaleString()} artists`;
  $('#exportButton').addEventListener('click', () => {
    const range = state.years[state.view];
    const detail = {influence:`Direction: ${state.direction}\nRelationship types: ${[...state.types].map(type => typeLabels[type]).join(', ')}`, careers:`Centre: ${state.center === null ? 'none' : artists[state.center].n}`, candidates:`Comparing: ${compared().map(({index}) => artists[index].n).join(', ')}`}[state.view];
    const blob = new Blob([`Oceanus Folk — ${state.view}\n${detail}${range ? `\nYears: ${range.start}—${range.end}` : ''}\n${$('#viewDescription').textContent}\nSource: VAST Challenge 2025 MC1 knowledge graph.`], {type:'text/plain'});
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'oceanus-folk-exploration.txt'; link.click(); URL.revokeObjectURL(link.href);
  });
  const startView = new URLSearchParams(location.search).get('view');
  renderTypeFilters(); setView(views[startView] ? startView : 'influence');
})();
