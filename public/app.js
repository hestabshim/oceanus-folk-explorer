(() => {
  const data = window.DASHBOARD_DATA;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const state = { view:'influence', direction:'outbound', start:2007, end:2040, genres:new Set(data.trend.series.map(series => series.name)) };
  const tooltip = $('#tooltip');
  const colors = {sailor:'#df7065',cassian:'#e4a04e',claire:'#4c9fc7'};
  const careerNames = {sailor:'Sailor Shift',cassian:'Cassian Storm',claire:'Claire Holmes'};
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
    const page = `${location.pathname} · ${state.view}`;
    const lines = [`# Page feedback`, '', `Page: ${page}`, '', '## Pins', ''];
    if (!feedbackPins.length) lines.push('_No pins._');
    feedbackPins.forEach((pin, index) => lines.push(`### ${index + 1}. ${pin.title || 'Untitled pin'}`, '', `- Position: ${pin.x.toFixed(1)}% from left, ${pin.y.toFixed(1)}% from top`, `- Feedback: ${pin.note || 'None'}`, ''));
    return lines.join('\\n');
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
  function xScale(index, count, width, padding) { return padding + (count < 2 ? 0 : index * (width - padding * 2) / (count - 1)); }
  function yScale(value, max, height, padding) { return height - padding - (value / max) * (height - padding * 2); }
  function text(x, y, value, attrs='') { return `<text x="${x}" y="${y}" ${attrs}>${esc(value)}</text>`; }

  function renderGenreFilters() {
    const series = state.direction === 'outbound' ? data.trend.series : data.trend.inboundSeries;
    const available = new Set(series.map(item => item.name));
    state.genres = new Set([...state.genres].filter(name => available.has(name)));
    if (!state.genres.size) state.genres = new Set(available);
    $('#genreFilters').innerHTML = series.map(item => `<button class="genre-chip ${state.genres.has(item.name) ? 'active' : ''}" data-genre="${esc(item.name)}"><i style="background:${item.color}"></i>${esc(item.name)}</button>`).join('');
    $$('.genre-chip').forEach(chip => chip.addEventListener('click', () => {
      const name = chip.dataset.genre;
      if (state.genres.has(name) && state.genres.size > 1) state.genres.delete(name); else state.genres.add(name);
      renderGenreFilters();
      render();
    }));
  }

  function renderInfluence() {
    const series = (state.direction === 'outbound' ? data.trend.series : data.trend.inboundSeries).filter(item => state.genres.has(item.name));
    const allYears = data.trend.years;
    const years = allYears.filter(year => year >= state.start && year <= state.end);
    const W=1000,H=500,p=22, totals=years.map((_,i) => series.reduce((sum,item) => sum + item.values[allYears.indexOf(years[i])],0));
    const max=Math.max(...totals,1)*1.12;
    const x=i=>xScale(i,years.length,W,p), y=value=>yScale(value,max,H,p);
    let previous=years.map(()=>0), layers='';
    series.forEach(item=>{
      const indexes=years.map(year=>allYears.indexOf(year));
      const top=item.values.filter((_,i)=>indexes.includes(i)).map((value,i)=>previous[i]+value);
      const upper=top.map((value,i)=>`${x(i)},${y(value)}`).join(' ');
      const lower=[...previous].reverse().map((value,i)=>`${x(years.length-1-i)},${y(value)}`).join(' ');
      layers += `<polygon class="area-layer" points="${upper} ${lower}" fill="${item.color}" fill-opacity=".86" data-series="${esc(item.name)}"/>`;
      previous=top;
    });
    const grid=[0,.25,.5,.75,1].map(r=>`<line class="chart-grid" x1="${p}" x2="${W-p}" y1="${y(max*r)}" y2="${y(max*r)}"/>`).join('');
    const labels=years.map((year,i)=>(i===0||i===years.length-1||year%4===0)?text(x(i),H-5,year,'text-anchor="middle" class="chart-label"'):'').join('');
    const debut=state.start<=2017&&state.end>=2017?`<line class="event-line" x1="${x(allYears.indexOf(2017)-allYears.findIndex(year=>year>=state.start))}" x2="${x(allYears.indexOf(2017)-allYears.findIndex(year=>year>=state.start))}" y1="${p}" y2="${H-p}"/><text class="event-label" x="${x(allYears.indexOf(2017)-allYears.findIndex(year=>year>=state.start))+7}" y="${p+10}">SAILOR · 2017</text>`:'';
    const hits=years.map((year,i)=>`<rect class="year-hit" x="${Math.max(p,x(i)-22)}" y="${p}" width="44" height="${H-p*2}" data-year="${year}" data-total="${totals[i].toFixed(1)}"/>`).join('');
    $('#axisTitle').textContent='REFERENCES & INSPIRATIONS';
    $('#viz').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Oceanus Folk influence by year"><g>${grid}</g>${layers}${debut}${labels}${hits}</svg>`;
    $$('.year-hit').forEach(hit=>{
      hit.addEventListener('mouseenter',event=>showTooltip(`<strong>${hit.dataset.year}</strong><br>${hit.dataset.total} weighted references`,event));
      hit.addEventListener('mouseleave',hideTooltip);
      hit.addEventListener('click',()=>inspectInfluence(Number(hit.dataset.year),series,allYears));
    });
    $('#legend').innerHTML=series.map(item=>`<button class="legend-button" data-legend="${esc(item.name)}"><i class="legend-swatch" style="background:${item.color}"></i>${esc(item.name)}</button>`).join('');
    $$('.legend-button').forEach(button=>button.addEventListener('click',()=>{const genre=button.dataset.legend;state.genres.has(genre)?state.genres.delete(genre):state.genres.add(genre);if(!state.genres.size)state.genres.add(genre);renderGenreFilters();render()}));
  }

  function renderLines(mode) {
    const isCandidate=mode==='candidates';
    const years=isCandidate?[2030,2031,2032,2033,2034,2035,2036,2037,2038,2039,2040]:data.careers.years;
    const sets=isCandidate?data.candidates.map(candidate=>({key:candidate.id,name:candidate.name,values:candidate.values,color:candidate.color,detail:candidate.detail,meta:candidate.meta})):Object.keys(careerNames).map(key=>({key,name:careerNames[key],values:data.careers[key],color:colors[key],detail:`${data.careers[key].filter(value=>value>0).at(-1)||0} cumulative songs by 2040`,meta:'career trajectory'}));
    const visibleYears=years.filter(year=>year>=state.start&&year<=state.end);
    const indexes=visibleYears.map(year=>years.indexOf(year));
    const W=1000,H=500,p=22,max=Math.max(...sets.flatMap(set=>indexes.map(index=>set.values[index])),1)*1.12;
    const x=i=>xScale(i,visibleYears.length,W,p),y=value=>yScale(value,max,H,p);
    const grid=[0,.25,.5,.75,1].map(r=>`<line class="chart-grid" x1="${p}" x2="${W-p}" y1="${y(max*r)}" y2="${y(max*r)}"/>${text(p-8,y(max*r)+3,(max*r).toFixed(0),'text-anchor="end" class="chart-label"')}`).join('');
    const labels=visibleYears.map((year,i)=>(i===0||i===visibleYears.length-1||year%4===0)?text(x(i),H-5,year,'text-anchor="middle" class="chart-label"'):'').join('');
    const lines=sets.map(set=>{const points=indexes.map((index,i)=>`${x(i)},${y(set.values[index])}`).join(' ');const dots=indexes.map((index,i)=>`<circle class="point" cx="${x(i)}" cy="${y(set.values[index])}" r="${set.values[index]>0?4:0}" fill="${set.color}" data-key="${set.key}" data-year="${visibleYears[i]}"/>`).join('');return `<polyline class="line-series" points="${points}" stroke="${set.color}" data-key="${set.key}"/>${dots}`}).join('');
    $('#axisTitle').textContent='CUMULATIVE SONGS';
    $('#viz').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Career trajectory comparison"><g>${grid}</g>${lines}${labels}</svg>`;
    $$('.point').forEach(point=>{point.addEventListener('mouseenter',event=>showTooltip(`<strong>${esc(sets.find(set=>set.key===point.dataset.key).name)}</strong><br>${point.dataset.year} · ${point.getAttribute('cy')?'click for detail':''}`,event));point.addEventListener('mouseleave',hideTooltip);point.addEventListener('click',()=>inspectLine(sets.find(set=>set.key===point.dataset.key)))});
    $('#legend').innerHTML=sets.map(set=>`<button class="legend-button" data-line="${set.key}"><i class="legend-swatch" style="background:${set.color}"></i>${esc(set.name)}</button>`).join('');
    $$('.legend-button').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.line;const line=$(`.line-series[data-key="${key}"]`);const points=$$(`.point[data-key="${key}"]`);const off=line.style.opacity==='0.18';line.style.opacity=off?'1':'0.18';points.forEach(point=>point.style.opacity=off?'1':'0.18');button.classList.toggle('off',!off)}));
  }

  function inspectInfluence(year,series,allYears){
    const index=allYears.indexOf(year);const values=series.map(item=>({name:item.name,value:item.values[index]})).filter(item=>item.value>0).sort((a,b)=>b.value-a.value);const total=values.reduce((sum,item)=>sum+item.value,0);
    $('#selectionSummary').textContent=`${year} selected`;$('#inspectorState').textContent='YEAR';$('#inspectorContent').innerHTML=`<span class="selection-kicker">INFLUENCE WINDOW</span><h2 class="selection-title">${year}</h2><p class="selection-meta">${state.direction==='outbound'?'Oceanus Folk → other genres':'Other genres → Oceanus Folk'}</p><div class="detail-stat"><span>WEIGHTED REFERENCES</span><strong>${total.toFixed(1)}</strong></div><div class="evidence-list"><h3>GENRES</h3>${values.slice(0,6).map(item=>`<div><i style="color:${series.find(seriesItem=>seriesItem.name===item.name).color}>●</i><span>${esc(item.name)}<br><b>${item.value.toFixed(1)}</b></span></div>`).join('')}</div>`;
  }
  function inspectLine(set){$('#selectionSummary').textContent=set.name;$('#inspectorState').textContent='ARTIST';$('#inspectorContent').innerHTML=`<span class="selection-kicker">SELECTED ARTIST</span><h2 class="selection-title">${esc(set.name)}</h2><p class="selection-meta">${esc(set.meta)}</p><div class="detail-stat"><span>GRAPH SIGNAL</span><strong>${esc(set.detail)}</strong></div><div class="evidence-list"><h3>READING</h3><div><i>●</i><span>Compare slope, output, and first release.</span></div></div>`}
  function inspectCandidate(candidate){$('#selectionSummary').textContent=candidate.name;$('#inspectorState').textContent='CANDIDATE';$('#inspectorContent').innerHTML=`<span class="selection-kicker">FUTURE SIGNAL</span><h2 class="selection-title">${esc(candidate.name)}</h2><p class="selection-meta">${esc(candidate.meta)}</p><div class="detail-stat"><span>SIGNAL SCORE</span><strong>${candidate.score} / 5</strong></div><div class="evidence-list"><h3>DETAIL</h3><div><i>●</i><span>${esc(candidate.detail)}</span></div></div>`}

  function setView(view){state.view=view;$$('.view-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.view===view));const config={influence:['INFLUENCE / OCEANUS FOLK','Influence by year','Filter by year, direction, or genre.'],careers:['CAREERS / COMPARISON','Career output','Compare cumulative songs by artist.'],candidates:['CANDIDATES / 2041—45','Candidate trajectories','Compare output from 2030 to 2040.']}[view];$('#viewKicker').textContent=config[0];$('#viewTitle').textContent=config[1];$('#viewDescription').textContent=config[2];$$('[data-influence-only]').forEach(group=>group.hidden=view!=='influence');render();if(devMode)feedbackLoad();}
  function render(){if(state.view==='influence')renderInfluence();else renderLines(state.view)}
  function updateYears(){let start=Number($('#yearStart').value),end=Number($('#yearEnd').value);if(start>end){[start,end]=[end,start];$('#yearStart').value=start;$('#yearEnd').value=end}state.start=start;state.end=end;$('#yearOutput').value=`${start} — ${end}`;render()}
  function reset(){state.direction='outbound';state.start=2007;state.end=2040;state.genres=new Set(data.trend.series.map(item=>item.name));$('#yearStart').value=2007;$('#yearEnd').value=2040;$$('.segment').forEach(item=>item.classList.toggle('active',item.dataset.direction==='outbound'));renderGenreFilters();updateYears();$('#selectionSummary').textContent='No selection';$('#inspectorState').textContent='IDLE';$('#inspectorContent').innerHTML='<div class="empty-inspector"><span class="empty-mark">+</span><h2>Select a mark</h2><p>Select a year, line, or candidate to view details.</p></div>'}

  $$('.view-tab').forEach(tab=>tab.addEventListener('click',()=>setView(tab.dataset.view)));
  $$('.segment').forEach(segment=>segment.addEventListener('click',()=>{state.direction=segment.dataset.direction;$$('.segment').forEach(item=>item.classList.toggle('active',item===segment));renderGenreFilters();render()}));
  $('#yearStart').addEventListener('input',updateYears);$('#yearEnd').addEventListener('input',updateYears);$('#clearFilters').addEventListener('click',reset);$('#resetView').addEventListener('click',reset);
  const modal=$('#notesModal');const closeModal=()=>modal.hidden=true;$('#notesButton').addEventListener('click',()=>modal.hidden=false);$('#closeNotes').addEventListener('click',closeModal);$('#closeNotesBottom').addEventListener('click',closeModal);modal.addEventListener('click',event=>{if(event.target===modal)closeModal()});
  $('#exportButton').addEventListener('click',()=>{const blob=new Blob([`Oceanus Folk — ${state.view}\nFilters: ${state.start}—${state.end}, ${state.direction}\nSource: VAST Challenge 2025 MC1 synthetic knowledge graph.`],{type:'text/plain'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='oceanus-folk-exploration.txt';link.click();URL.revokeObjectURL(url)});
  feedbackInit();renderGenreFilters();setView('influence');
})();
