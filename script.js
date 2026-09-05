(function(){
  const COLORS = ['#FFFFFF','#7C5CFC','#34D8C5','#FFD166','#FF6B6B','#4CC9F0','#B5F44A'];

  const state = {
    img: null,
    cols: 8,
    rows: 5,
    offX: 0,
    offY: 0,
    selected: new Set(),
    labels: {},
    activeColor: COLORS[0],
    scale: 1,
  };

  const canvas = document.getElementById('mainCanvas');
  const ctx = canvas.getContext('2d');
  const emptyState = document.getElementById('emptyState');
  const canvasHolder = document.getElementById('canvasHolder');
  const fileInput = document.getElementById('fileInput');
  const overlayBar = document.getElementById('overlayBar');

  // ---------- Color swatches ----------
  const colorRow = document.getElementById('colorRow');
  COLORS.forEach((c, i) => {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (i === 0 ? ' selected' : '');
    sw.style.background = c;
    sw.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      state.activeColor = c;
    });
    colorRow.appendChild(sw);
  });

  // ---------- Image loading ----------
  function loadImageFile(file){
    if(!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        state.img = img;
        state.selected.clear();
        state.labels = {};
        emptyState.classList.add('hidden');
        canvas.classList.remove('hidden');
        overlayBar.classList.remove('hidden');
        document.getElementById('exportBtn').disabled = false;
        render();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  emptyState.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => loadImageFile(e.target.files[0]));

  document.getElementById('resetBtn').addEventListener('click', () => {
    state.img = null;
    state.selected.clear();
    state.labels = {};
    document.getElementById('exportBtn').disabled = true;
    canvas.classList.add('hidden');
    overlayBar.classList.add('hidden');
    emptyState.classList.remove('hidden');
    updateCropStrip();
    updateCounts();
  });

  // ---------- Grid controls ----------
  const colsInput = document.getElementById('colsInput');
  const rowsInput = document.getElementById('rowsInput');
  const offXSlider = document.getElementById('offXSlider');
  const offYSlider = document.getElementById('offYSlider');

  colsInput.addEventListener('input', () => { state.cols = clamp(parseInt(colsInput.value)||1,1,60); state.selected.clear(); state.labels={}; render(); });
  rowsInput.addEventListener('input', () => { state.rows = clamp(parseInt(rowsInput.value)||1,1,60); state.selected.clear(); state.labels={}; render(); });
  offXSlider.addEventListener('input', () => { state.offX = parseInt(offXSlider.value); document.getElementById('offXVal').textContent = state.offX+'px'; render(); });
  offYSlider.addEventListener('input', () => { state.offY = parseInt(offYSlider.value); document.getElementById('offYVal').textContent = state.offY+'px'; render(); });

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  // ---------- Rendering ----------
  function render(){
    if(!state.img) return;
    const img = state.img;
    const holderRect = canvasHolder.getBoundingClientRect();
    const maxW = holderRect.width - 20;
    const maxH = holderRect.height - 20;
    const scale = Math.min(1, maxW / img.width, maxH / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    canvas.width = w;
    canvas.height = h;
    state.scale = scale;

    ctx.clearRect(0,0,w,h);
    ctx.drawImage(img, 0, 0, w, h);

    const cellW = (w - state.offX) / state.cols;
    const cellH = (h - state.offY) / state.rows;

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for(let c=0;c<=state.cols;c++){
      const x = state.offX + c*cellW;
      ctx.beginPath(); ctx.moveTo(x, state.offY); ctx.lineTo(x, h); ctx.stroke();
    }
    for(let r=0;r<=state.rows;r++){
      const y = state.offY + r*cellH;
      ctx.beginPath(); ctx.moveTo(state.offX, y); ctx.lineTo(w, y); ctx.stroke();
    }

    state.selected.forEach(key => {
      const [r,c] = key.split(',').map(Number);
      const x = state.offX + c*cellW;
      const y = state.offY + r*cellH;
      ctx.fillStyle = 'rgba(124,92,252,0.22)';
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = '#7C5CFC';
      ctx.lineWidth = 2;
      ctx.strokeRect(x+1, y+1, cellW-2, cellH-2);

      const label = state.labels[key];
      if(label && label.text){
        drawLabel(ctx, label, x + cellW/2, y + cellH - 8, cellW);
      }
    });

    updateCounts();
    updateCropStrip();
  }

  function drawLabel(context, label, cx, baseY, maxWidth){
    const size = label.size * state.scale;
    context.font = `700 ${size}px 'Inter', sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    if(label.outline){
      context.lineWidth = Math.max(2, size*0.22);
      context.strokeStyle = '#000000';
      context.strokeText(label.text, cx, baseY, maxWidth-6);
    }
    context.fillStyle = label.color;
    context.fillText(label.text, cx, baseY, maxWidth-6);
  }

  function updateCounts(){
    document.getElementById('selCount').textContent = state.selected.size;
    document.getElementById('totalCount').textContent = state.img ? state.cols*state.rows : 0;
  }

  // ---------- Tap to select ----------
  canvas.addEventListener('click', e => {
    if(!state.img) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const cellW = (canvas.width - state.offX) / state.cols;
    const cellH = (canvas.height - state.offY) / state.rows;
    if(x < state.offX || y < state.offY) return;
    const c = Math.floor((x - state.offX) / cellW);
    const r = Math.floor((y - state.offY) / cellH);
    if(c < 0 || c >= state.cols || r < 0 || r >= state.rows) return;
    const key = `${r},${c}`;
    if(state.selected.has(key)) state.selected.delete(key);
    else state.selected.add(key);
    render();
  });

  document.getElementById('selectAllBtn').addEventListener('click', () => {
    if(!state.img) return;
    state.selected.clear();
    for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++) state.selected.add(`${r},${c}`);
    render();
  });
  document.getElementById('clearSelBtn').addEventListener('click', () => {
    state.selected.clear();
    render();
  });

  // ---------- Label apply ----------
  document.getElementById('applyLabelBtn').addEventListener('click', () => {
    if(state.selected.size === 0){
      flashHint('먼저 격자에서 칸을 선택해주세요');
      return;
    }
    const text = document.getElementById('labelText').value.trim();
    const size = parseInt(document.getElementById('fontSizeSlider').value);
    const outline = document.getElementById('outlineToggle').checked;
    state.selected.forEach(key => {
      state.labels[key] = { text, color: state.activeColor, size, outline };
    });
    render();
    closeSheet();
  });

  document.getElementById('fontSizeSlider').addEventListener('input', function(){
    document.getElementById('fontSizeVal').textContent = this.value + 'px';
  });

  function flashHint(msg){
    const hint = document.getElementById('cropHint');
    const old = hint.textContent;
    hint.textContent = msg;
    hint.style.color = '#FF6B6B';
    setTimeout(() => { hint.textContent = old; hint.style.color = ''; }, 1800);
  }

  // ---------- Crop strip ----------
  function updateCropStrip(){
    const strip = document.getElementById('cropStrip');
    strip.innerHTML = '';
    if(!state.img || state.selected.size === 0){
      strip.innerHTML = '<div class="crop-empty">아직 선택한 칸이 없어요</div>';
      return;
    }
    const img = state.img;
    const cellWFull = img.width / state.cols;
    const cellHFull = img.height / state.rows;
    const offXFull = state.offX / state.scale;
    const offYFull = state.offY / state.scale;

    Array.from(state.selected).sort().forEach(key => {
      const [r,c] = key.split(',').map(Number);
      const sx = offXFull + c*cellWFull;
      const sy = offYFull + r*cellHFull;

      const item = document.createElement('div');
      item.className = 'crop-item';
      const cv = document.createElement('canvas');
      cv.width = 136; cv.height = 136;
      const cctx = cv.getContext('2d');
      cctx.fillStyle = '#0B0C10';
      cctx.fillRect(0,0,136,136);
      cctx.drawImage(img, sx, sy, cellWFull, cellHFull, 0, 0, 136, 136);

      const label = state.labels[key];
      if(label && label.text){
        drawLabel(cctx, {...label, size: label.size*1.3}, 68, 122, 136);
      }

      const dl = document.createElement('div');
      dl.className = 'dl';
      dl.textContent = '↓';
      item.appendChild(cv);
      item.appendChild(dl);
      item.addEventListener('click', () => {
        const a = document.createElement('a');
        a.download = `item_${r+1}-${c+1}.png`;
        a.href = cv.toDataURL('image/png');
        a.click();
      });
      strip.appendChild(item);
    });
  }

  // ---------- Export full image ----------
  document.getElementById('exportBtn').addEventListener('click', () => {
    if(!state.img) return;
    const img = state.img;
    const out = document.createElement('canvas');
    out.width = img.width; out.height = img.height;
    const octx = out.getContext('2d');
    octx.drawImage(img, 0, 0);

    const cellW = (img.width - state.offX/state.scale) / state.cols;
    const cellH = (img.height - state.offY/state.scale) / state.rows;
    const offX = state.offX/state.scale;
    const offY = state.offY/state.scale;

    state.selected.forEach(key => {
      const [r,c] = key.split(',').map(Number);
      const label = state.labels[key];
      if(label && label.text){
        const x = offX + c*cellW;
        const y = offY + r*cellH;
        drawLabel(octx, {...label, size: label.size/state.scale}, x+cellW/2, y+cellH-10, cellW);
      }
    });

    const a = document.createElement('a');
    a.download = 'grid-label-export.png';
    a.href = out.toDataURL('image/png');
    a.click();
  });

  window.addEventListener('resize', () => { if(state.img) render(); });

  // ---------- Tab bar + bottom sheet ----------
  const sheet = document.getElementById('sheet');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.sheet-panel');
  let sheetOpen = false;
  let activeTab = 'grid';

  function openSheet(tab){
    activeTab = tab;
    panels.forEach(p => p.classList.toggle('hidden', p.dataset.panel !== tab));
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    sheet.classList.add('open');
    sheetBackdrop.classList.add('show');
    sheetOpen = true;
  }
