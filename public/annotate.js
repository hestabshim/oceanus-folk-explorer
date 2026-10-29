(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const state = {imageName:'', imageUrl:'', pins:[], selected:null, fileHandle:null};
  const imageFile = $('#imageFile');
  const emptyImageFile = $('#emptyImageFile');
  const stage = $('#imageStage');
  const image = $('#designImage');
  const pins = $('#pins');
  const title = $('#title');
  const markdown = $('#markdown');
  const pinLabel = $('#pinLabel');
  const pinNote = $('#pinNote');

  function openImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageName = file.name;
    state.imageUrl = URL.createObjectURL(file);
    state.pins = [];
    state.selected = null;
    image.src = state.imageUrl;
    $('#dropZone').hidden = true;
    stage.hidden = false;
    render();
  }
  function chooseFile(event) { openImage(event.target.files[0]); event.target.value = ''; }
  imageFile.addEventListener('change', chooseFile);
  emptyImageFile.addEventListener('change', chooseFile);
  $('#dropZone').addEventListener('dragover', event => { event.preventDefault(); $('#dropZone').classList.add('dragging'); });
  $('#dropZone').addEventListener('dragleave', () => $('#dropZone').classList.remove('dragging'));
  $('#dropZone').addEventListener('drop', event => { event.preventDefault(); $('#dropZone').classList.remove('dragging'); openImage(event.dataTransfer.files[0]); });

  stage.addEventListener('click', event => {
    if (event.target.closest('.pin') || !image.naturalWidth) return;
    const rect = image.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    state.pins.push({id:Date.now(), x:(event.clientX-rect.left)/rect.width*100, y:(event.clientY-rect.top)/rect.height*100, label:'', note:''});
    state.selected = state.pins.at(-1).id;
    render();
    pinNote.focus();
  });
  function selectPin(id) { state.selected=id; render(); }
  function selectedPin() { return state.pins.find(pin => pin.id === state.selected); }
  function renderPins() {
    pins.innerHTML = state.pins.map((pin,index) => `<button class="pin ${pin.id===state.selected?'selected':''}" style="left:${pin.x}%;top:${pin.y}%" data-id="${pin.id}" aria-label="Pin ${index+1}"><span>${index+1}</span></button>`).join('');
    $$('.pin').forEach(pin => pin.addEventListener('click', event => { event.stopPropagation(); selectPin(Number(pin.dataset.id)); }));
  }
  function renderEditor() {
    const pin = selectedPin();
    $('#pinEditor').hidden = !pin;
    $('#selectedLabel').textContent = pin ? `Pin ${state.pins.indexOf(pin)+1}` : 'Select a pin';
    if (pin) { pinLabel.value=pin.label; pinNote.value=pin.note; }
  }
  function renderList() {
    const list=$('#pinList');
    $('#pinCount').textContent=`${state.pins.length} pin${state.pins.length===1?'':'s'}`;
    $('#emptyHint').textContent=state.pins.length?'':'None yet';
    list.innerHTML=state.pins.length?state.pins.map((pin,index)=>`<button class="pin-row ${pin.id===state.selected?'selected':''}" data-id="${pin.id}"><span class="pin-number">${index+1}</span><span><strong>${escapeHtml(pin.label||'Untitled note')}</strong><small>${escapeHtml(pin.note||'No feedback yet')}</small></span></button>`).join(''):'<p class="empty">Add a pin to start.</p>';
    $$('.pin-row').forEach(row=>row.addEventListener('click',()=>selectPin(Number(row.dataset.id))));
  }
  function buildMarkdown() {
    const output=[`# ${title.value.trim()||'Design feedback'}`,'',`Image: ${state.imageName||'not selected'}`,'','## Pins',''];
    if (!state.pins.length) output.push('_No pins yet._');
    state.pins.forEach((pin,index)=>output.push(`### ${index+1}. ${pin.label||'Untitled note'}`,'',`- Position: ${pin.x.toFixed(1)}% from left, ${pin.y.toFixed(1)}% from top`,`- Feedback: ${pin.note||'None'}`,'','> Add a screenshot crop or follow-up here.',''));
    return output.join('\n');
  }
  function render() { renderPins();renderEditor();renderList();markdown.value=buildMarkdown();$('#saveState').textContent='Unsaved'; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char])); }
  pinLabel.addEventListener('input',()=>{const pin=selectedPin();if(pin){pin.label=pinLabel.value;renderList();markdown.value=buildMarkdown();}});
  pinNote.addEventListener('input',()=>{const pin=selectedPin();if(pin){pin.note=pinNote.value;renderList();markdown.value=buildMarkdown();}});
  $('#donePin').addEventListener('click',()=>{state.selected=null;render();});
  $('#deletePin').addEventListener('click',()=>{state.pins=state.pins.filter(pin=>pin.id!==state.selected);state.selected=null;render();});
  title.addEventListener('input',()=>{markdown.value=buildMarkdown();});
  $('#saveFile').addEventListener('click',async()=>{
    const contents=markdown.value||buildMarkdown();
    try {
      if (window.showSaveFilePicker) {
        state.fileHandle ||= await window.showSaveFilePicker({suggestedName:`${title.value.trim()||'design-feedback'}.md`,types:[{description:'Markdown',accept:{'text/markdown':['.md']}}]});
        const writable=await state.fileHandle.createWritable();await writable.write(contents);await writable.close();$('#saveState').textContent='Saved';
      } else { const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([contents],{type:'text/markdown'}));link.download=`${title.value.trim()||'design-feedback'}.md`;link.click();URL.revokeObjectURL(link.href);$('#saveState').textContent='Downloaded'; }
    } catch(error) { if(error.name!=='AbortError') alert('Could not save the Markdown file.'); }
  });
  render();
})();
