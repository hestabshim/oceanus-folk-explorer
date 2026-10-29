(() => {
  const $ = selector => document.querySelector(selector);
  let fileHandle = null;
  let annotations = [];
  const title = $('#title');
  const source = $('#source');
  const note = $('#note');
  const markdown = $('#markdown');
  const selectionState = $('#selectionState');
  const saveState = $('#saveState');

  const quote = () => source.value.slice(source.selectionStart, source.selectionEnd).trim();
  const buildMarkdown = () => {
    const lines = [`# ${title.value.trim() || 'Untitled notes'}`, '', `Source text: ${source.value.trim() ? 'included below' : 'not added'}`, ''];
    if (source.value.trim()) lines.push('## Source', '', source.value.trim(), '');
    lines.push('## Annotations', '');
    if (!annotations.length) lines.push('_No annotations yet._');
    annotations.forEach((item, index) => lines.push(`### ${index + 1}. ${item.quote || 'General note'}`, '', item.quote ? `> ${item.quote.replace(/\n/g, '\n> ')}` : '', '', item.note, ''));
    return lines.join('\n');
  };
  const renderList = () => {
    $('#annotationList').innerHTML = annotations.length ? annotations.map(item => `<article class="annotation"><blockquote>${item.quote || 'General note'}</blockquote><p>${item.note}</p></article>`).join('') : '<p class="empty">No annotations yet.</p>';
    markdown.value = buildMarkdown();
    saveState.textContent = 'Unsaved';
  };
  source.addEventListener('select', () => { selectionState.textContent = quote() ? 'Selection ready' : 'No selection'; });
  $('#useSelection').addEventListener('click', () => { selectionState.textContent = quote() ? 'Selection ready' : 'No selection'; source.focus(); });
  $('#addAnnotation').addEventListener('click', () => {
    const selected = quote();
    const text = note.value.trim();
    if (!selected && !text) { note.focus(); return; }
    annotations.push({quote:selected, note:text || 'No note added.'});
    note.value = '';
    renderList();
  });
  title.addEventListener('input', () => { markdown.value = buildMarkdown(); saveState.textContent = 'Unsaved'; });
  $('#openFile').addEventListener('click', async () => {
    try {
      if (!window.showOpenFilePicker) { alert('File opening is not supported in this browser. Paste the Markdown into the editor instead.'); return; }
      [fileHandle] = await window.showOpenFilePicker({types:[{description:'Markdown',accept:{'text/markdown':['.md']}}],multiple:false});
      const file = await fileHandle.getFile();
      markdown.value = await file.text();
      title.value = file.name.replace(/\.md$/i,'');
      saveState.textContent = 'Opened';
    } catch (error) { if (error.name !== 'AbortError') alert('Could not open that file.'); }
  });
  $('#saveFile').addEventListener('click', async () => {
    const contents = markdown.value || buildMarkdown();
    try {
      if (window.showSaveFilePicker) {
        fileHandle ||= await window.showSaveFilePicker({suggestedName:`${title.value.trim() || 'notes'}.md`,types:[{description:'Markdown',accept:{'text/markdown':['.md']}}]});
        const writable = await fileHandle.createWritable();
        await writable.write(contents);
        await writable.close();
        saveState.textContent = 'Saved';
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([contents],{type:'text/markdown'}));
        link.download = `${title.value.trim() || 'notes'}.md`;
        link.click();
        URL.revokeObjectURL(link.href);
        saveState.textContent = 'Downloaded';
      }
    } catch (error) { if (error.name !== 'AbortError') alert('Could not save the Markdown file.'); }
  });
  renderList();
})();
