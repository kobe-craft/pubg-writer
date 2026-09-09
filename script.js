// script.js
// Iris — PUBG Writer
// 자유 크롭 + 반복 크롭 + 대필판 업로드 + 자유 배치 + 텍스트 + PNG

(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const state = {
    image: null,
    crop: null,
    cropNorm: null,
    pieces: [],
    templates: [],
    selectedTemplate: null,
    objects: [],
    selectedObject: null,
    textColor: "#171716",
    fontSize: 24,
    outline: true,
    draggingCrop: false,
    draggingObject: false,
    cropStart: null,
    objectOffset: null
  };

  const fileInput = $("#fileInput");
  const canvas = $("#mainCanvas");
  const ctx = canvas?.getContext("2d");

  const cropStrip = $("#cropStrip");
  const emptyState = $("#emptyState");
  const overlayBar = $("#overlayBar");

  function makeId() {
    return crypto.randomUUID?.() ||
      Math.random().toString(36).slice(2) +
      Date.now().toString(36);
  }

  function setStatus(text) {
    const el = $("#saveStatus");
    if (el) el.textContent = text;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function fitCanvas() {
    if (!canvas || !state.image) return;

    const holder = $("#canvasHolder");
    const maxW = holder.clientWidth || 900;
    const maxH = Math.min(window.innerHeight * 0.65, 650);

    const ratio = Math.min(
      maxW / state.image.naturalWidth,
      maxH / state.image.naturalHeight
    );

    canvas.width = Math.round(state.image.naturalWidth * ratio);
    canvas.height = Math.round(state.image.naturalHeight * ratio);

    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;

    drawCanvas();
  }

  function getDisplayScale() {
    if (!state.image || !canvas) return 1;

    return canvas.width / state.image.naturalWidth;
  }

  function getCropPixels() {
    if (!state.image) return null;

    if (state.cropNorm) {
      return {
        x: state.cropNorm.x * state.image.naturalWidth,
        y: state.cropNorm.y * state.image.naturalHeight,
        w: state.cropNorm.w * state.image.naturalWidth,
        h: state.cropNorm.h * state.image.naturalHeight
      };
    }

    return state.crop;
  }

  function saveCropNormalized(crop) {
    if (!state.image) return;

    state.cropNorm = {
      x: crop.x / state.image.naturalWidth,
      y: crop.y / state.image.naturalHeight,
      w: crop.w / state.image.naturalWidth,
      h: crop.h / state.image.naturalHeight
    };

    state.crop = crop;
  }

  function clampCrop(crop) {
    if (!canvas) return crop;

    const min = 10;

    crop.w = Math.max(min, crop.w);
    crop.h = Math.max(min, crop.h);

    crop.x = Math.max(
      0,
      Math.min(crop.x, canvas.width - crop.w)
    );

    crop.y = Math.max(
      0,
      Math.min(crop.y, canvas.height - crop.h)
    );

    return crop;
  }

  function drawCanvas() {
    if (!ctx || !state.image) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
      state.image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const crop = getCropPixels();

    if (!crop) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#171716";
      ctx.font = "600 15px DM Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "드래그해서 자르기 영역 선택",
        canvas.width / 2,
        canvas.height / 2
      );

      ctx.restore();
      return;
    }

    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,.48)";
    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.clearRect(
      crop.x,
      crop.y,
      crop.w,
      crop.h
    );

    ctx.drawImage(
      state.image,
      crop.x / getDisplayScale(),
      crop.y / getDisplayScale(),
      crop.w / getDisplayScale(),
      crop.h / getDisplayScale(),
      crop.x,
      crop.y,
      crop.w,
      crop.h
    );

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      crop.x,
      crop.y,
      crop.w,
      crop.h
    );

    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "600 12px DM Sans, sans-serif";
    ctx.fillText(
      `${Math.round(crop.w / getDisplayScale())} × ${Math.round(crop.h / getDisplayScale())}`,
      crop.x + 8,
      crop.y + 18
    );

    ctx.restore();
  }

  function pointerPosition(e) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: (e.clientX - rect.left) *
        (canvas.width / rect.width),

      y: (e.clientY - rect.top) *
        (canvas.height / rect.height)
    };
  }

  function pointInsideCrop(p, crop) {
    return (
      p.x >= crop.x &&
      p.x <= crop.x + crop.w &&
      p.y >= crop.y &&
      p.y <= crop.y + crop.h
    );
  }

  function beginCrop(e) {
    if (!state.image) return;

    const p = pointerPosition(e);
    const current = getCropPixels();

    if (current && pointInsideCrop(p, current)) {
      state.draggingCrop = true;
      state.cropStart = {
        x: p.x - current.x,
        y: p.y - current.y,
        mode: "move"
      };
    } else {
      state.draggingCrop = true;

      state.cropStart = {
        x: p.x,
        y: p.y,
        mode: "create"
      };

      state.crop = {
        x: p.x,
        y: p.y,
        w: 1,
        h: 1
      };

      state.cropNorm = null;
    }

    canvas.setPointerCapture?.(e.pointerId);
  }

  function moveCrop(e) {
    if (!state.draggingCrop || !state.image) return;

    const p = pointerPosition(e);
    const start = state.cropStart;

    if (start.mode === "create") {
      const x = Math.min(start.x, p.x);
      const y = Math.min(start.y, p.y);
      const w = Math.abs(p.x - start.x);
      const h = Math.abs(p.y - start.y);

      state.crop = clampCrop({
        x,
        y,
        w,
        h
      });
    } else {
      const crop = getCropPixels();

      state.crop = clampCrop({
        x: p.x - start.x,
        y: p.y - start.y,
        w: crop.w,
        h: crop.h
      });
    }

    drawCanvas();
  }

  function endCrop() {
    if (!state.draggingCrop) return;

    state.draggingCrop = false;

    if (
      state.crop &&
      state.crop.w > 8 &&
      state.crop.h > 8
    ) {
      saveCropNormalized(state.crop);
    }

    drawCanvas();
    setStatus("저장됨");
  }

  function cropCurrentPiece() {
    if (!state.image || !state.crop) return;

    const crop = getCropPixels();
    if (!crop) return;

    const scale = state.image.naturalWidth / canvas.width;

    const sx = crop.x * scale;
    const sy = crop.y * scale;
    const sw = crop.w * scale;
    const sh = crop.h * scale;

    const out = document.createElement("canvas");

    out.width = Math.round(sw);
    out.height = Math.round(sh);

    const outCtx = out.getContext("2d");

    outCtx.drawImage(
      state.image,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      out.width,
      out.height
    );

    const piece = {
      id: makeId(),
      src: out.toDataURL("image/png"),
      width: out.width,
      height: out.height
    };

    state.pieces.push(piece);

    renderPieces();
    setStatus("조각 저장됨");
  }

  function renderPieces() {
    if (!cropStrip) return;

    cropStrip.innerHTML = "";

    state.pieces.forEach((piece, index) => {
      const item = document.createElement("button");

      item.type = "button";
      item.className = "crop-item";
      item.dataset.id = piece.id;

      item.innerHTML = `
        <img src="${piece.src}" alt="조각 ${index + 1}">
        <span>${index + 1}</span>
      `;

      item.addEventListener("click", () => {
        addPieceToBoard(piece);
      });

      cropStrip.appendChild(item);
    });

    const total = $("#totalCount");
    if (total) {
      total.textContent = `${state.pieces.length}개`;
    }

    const hint = $("#cropHint");

    if (hint) {
      hint.textContent =
        state.pieces.length
          ? "조각을 클릭하면 대필판에 추가됩니다."
          : "영역을 선택한 뒤 조각 저장을 눌러주세요.";
    }
  }

  function setupFileInput() {
    if (!fileInput) return;

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];

      if (!file) return;

      try {
        const img = await loadImage(file);

        state.image = img;

        if (emptyState) {
          emptyState.classList.add("hidden");
        }

        if (overlayBar) {
          overlayBar.classList.remove("hidden");
        }

        fitCanvas();

        if (state.cropNorm) {
          state.crop = getCropPixels();
        } else {
          state.crop = null;
        }

        drawCanvas();

        setStatus("이미지 불러옴");
      } catch {
        alert("이미지를 불러오지 못했습니다.");
      }

      fileInput.value = "";
    });
  }

  function openImagePicker() {
    fileInput?.click();
  }

  function setupUploadButtons() {
    $("#startBtn")?.addEventListener("click", () => {
      $("#landing")?.classList.add("hidden");
      $("#app")?.classList.remove("hidden");
    });

    $("#uploadTopBtn")?.addEventListener(
      "click",
      openImagePicker
    );

    $("#emptyUploadBtn")?.addEventListener(
      "click",
      openImagePicker
    );
  }

  function setupCropButtons() {
    canvas?.addEventListener(
      "pointerdown",
      beginCrop
    );

    canvas?.addEventListener(
      "pointermove",
      moveCrop
    );

    canvas?.addEventListener(
      "pointerup",
      endCrop
    );

    canvas?.addEventListener(
      "pointercancel",
      endCrop
    );

    const selectBtn = $("#selectAllBtn");

    if (selectBtn) {
      selectBtn.textContent = "조각 저장";

      selectBtn.addEventListener(
        "click",
        cropCurrentPiece
      );
    }

    $("#clearSelBtn")?.addEventListener(
      "click",
      () => {
        state.crop = null;
        state.cropNorm = null;
        drawCanvas();
        setStatus("선택 해제");
      }
    );
  }

  function createTemplateInput() {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/*";
    input.hidden = true;

    document.body.appendChild(input);

    input.addEventListener("change", async () => {
      const file = input.files?.[0];

      if (!file) return;

      try {
        const img = await loadImage(file);

        const template = {
          id: makeId(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          src: img.src,
          width: img.naturalWidth,
          height: img.naturalHeight
        };

        state.templates.push(template);
        state.selectedTemplate = template;

        renderTemplates();
        renderBoard();

        setStatus("대필판 추가됨");
      } catch {
        alert("대필판을 불러오지 못했습니다.");
      }

      input.value = "";
    });

    return input;
  }

  let templateInput = null;

  function setupTemplates() {
    templateInput = createTemplateInput();

    const list = $("#templateList");

    if (!list) return;

    const upload = document.createElement("button");

    upload.type = "button";
    upload.className = "template-upload";
    upload.textContent = "+ 대필판 업로드";

    upload.addEventListener(
      "click",
      () => templateInput.click()
    );

    list.parentNode.insertBefore(
      upload,
      list
    );
  }

  function renderTemplates() {
    const list = $("#templateList");

    if (!list) return;

    list.innerHTML = "";

    state.templates.forEach(template => {
      const item = document.createElement("button");

      item.type = "button";
      item.className = "template-item";

      if (
        state.selectedTemplate?.id ===
        template.id
      ) {
        item.classList.add("active");
      }

      item.innerHTML = `
        <img src="${template.src}" alt="">
        <span>${template.name}</span>
      `;

      item.addEventListener(
        "click",
        () => {
          state.selectedTemplate = template;
          renderTemplates();
          renderBoard();
        }
      );

      list.appendChild(item);
    });
  }

  let boardCanvas = null;
  let boardCtx = null;

  function ensureBoard() {
    const section = $(".result-section");

    if (!section) return;

    let holder = section.querySelector(
      ".iris-composer"
    );

    if (!holder) {
      holder = document.createElement("div");
      holder.className = "iris-composer";

      boardCanvas =
        document.createElement("canvas");

      boardCanvas.className =
        "iris-composer-canvas";

      holder.appendChild(boardCanvas);
      section.appendChild(holder);
    } else {
      boardCanvas =
        holder.querySelector("canvas");
    }

    boardCtx =
      boardCanvas?.getContext("2d");
  }

  function renderBoard() {
    ensureBoard();

    if (
      !boardCanvas ||
      !boardCtx ||
      !state.selectedTemplate
    ) {
      return;
    }

    const template = state.selectedTemplate;

    const maxW = 900;
    const ratio = Math.min(
      1,
      maxW / template.width
    );

    boardCanvas.width =
      Math.round(template.width * ratio);

    boardCanvas.height =
      Math.round(template.height * ratio);

    boardCtx.clearRect(
      0,
      0,
      boardCanvas.width,
      boardCanvas.height
    );

    const bg = new Image();

    bg.onload = () => {
      boardCtx.drawImage(
        bg,
        0,
        0,
        boardCanvas.width,
        boardCanvas.height
      );

      drawObjects();
    };

    bg.src = template.src;
  }

  function addPieceToBoard(piece) {
    ensureBoard();

    if (!boardCanvas || !state.selectedTemplate) {
      alert("먼저 대필판을 선택해주세요.");
      return;
    }

    const maxWidth =
      boardCanvas.width * 0.35;

    const ratio =
      Math.min(
        1,
        maxWidth / piece.width
      );

    const obj = {
      id: makeId(),
      type: "image",
      src: piece.src,
      x: 30 + state.objects.length * 10,
      y: 30 + state.objects.length * 10,
      width: piece.width * ratio,
      height: piece.height * ratio,
      rotation: 0
    };

    state.objects.push(obj);
    state.selectedObject = obj;

    renderBoard();
  }

  function addText() {
    const input = $("#labelText");

    const text =
      input?.value?.trim();

    if (!text) return;

    ensureBoard();

    if (!boardCanvas) return;

    const obj = {
      id: makeId(),
      type: "text",
      text,
      x: boardCanvas.width / 2,
      y: boardCanvas.height / 2,
      fontSize: state.fontSize,
      color: state.textColor,
      outline: state.outline
    };

    state.objects.push(obj);
    state.selectedObject = obj;

    renderBoard();

    input.value = "";

    setStatus("텍스트 추가됨");
  }

  function drawObjects() {
    if (!boardCtx) return;

    state.objects.forEach(obj => {
      if (obj.type === "image") {
        const img = new Image();

        img.onload = () => {
          boardCtx.drawImage(
            img,
            obj.x,
            obj.y,
            obj.width,
            obj.height
          );

          drawSelection(obj);
        };

        img.src = obj.src;
      }

      if (obj.type === "text") {
        boardCtx.save();

        boardCtx.font =
          `600 ${obj.fontSize}px DM Sans, sans-serif`;

        boardCtx.textAlign = "center";
        boardCtx.textBaseline = "middle";

        if (obj.outline) {
          boardCtx.lineWidth = 5;
          boardCtx.strokeStyle =
            "rgba(255,255,255,.9)";

          boardCtx.strokeText(
            obj.text,
            obj.x,
            obj.y
          );
        }

        boardCtx.fillStyle = obj.color;

        boardCtx.fillText(
          obj.text,
          obj.x,
          obj.y
        );

        boardCtx.restore();

        drawSelection(obj);
      }
    });
  }

  function drawSelection(obj) {
    if (
      !state.selectedObject ||
      state.selectedObject.id !== obj.id
    ) {
      return;
    }

    boardCtx.save();

    boardCtx.strokeStyle =
      "rgba(0,0,0,.65)";

    boardCtx.lineWidth = 1;
    boardCtx.setLineDash([5, 5]);

    if (obj.type === "image") {
      boardCtx.strokeRect(
        obj.x,
        obj.y,
        obj.width,
        obj.height
      );
    } else {
      boardCtx.strokeRect(
        obj.x - 80,
        obj.y - obj.fontSize,
        160,
        obj.fontSize * 2
      );
    }

    boardCtx.restore();
  }

  function objectHit(obj, p) {
    if (obj.type === "image") {
      return (
        p.x >= obj.x &&
        p.x <= obj.x + obj.width &&
        p.y >= obj.y &&
        p.y <= obj.y + obj.height
      );
    }

    return (
      p.x >= obj.x - 100 &&
      p.x <= obj.x + 100 &&
      p.y >= obj.y - obj.fontSize &&
      p.y <= obj.y + obj.fontSize
    );
  }

  function boardPoint(e) {
    const rect =
      boardCanvas.getBoundingClientRect();

    return {
      x:
        (e.clientX - rect.left) *
        (boardCanvas.width / rect.width),

      y:
        (e.clientY - rect.top) *
        (boardCanvas.height / rect.height)
    };
  }

  function boardDown(e) {
    if (!boardCanvas) return;

    const p = boardPoint(e);

    const hit =
      [...state.objects]
        .reverse()
        .find(obj =>
          objectHit(obj, p)
        );

    if (!hit) {
      state.selectedObject = null;
      renderBoard();
      return;
    }

    state.selectedObject = hit;
    state.draggingObject = true;

    state.objectOffset = {
      x: p.x - hit.x,
      y: p.y - hit.y
    };

    boardCanvas.setPointerCapture?.(
      e.pointerId
    );

    renderBoard();
  }

  function boardMove(e) {
    if (
      !state.draggingObject ||
      !state.selectedObject
    ) {
      return;
    }

    const p = boardPoint(e);
    const obj = state.selectedObject;

    obj.x =
      p.x - state.objectOffset.x;

    obj.y =
      p.y - state.objectOffset.y;

    renderBoard();
  }

  function boardUp() {
    state.draggingObject = false;
  }

  function setupBoardEvents() {
    ensureBoard();

    boardCanvas?.addEventListener(
      "pointerdown",
      boardDown
    );

    boardCanvas?.addEventListener(
      "pointermove",
      boardMove
    );

    boardCanvas?.addEventListener(
      "pointerup",
      boardUp
    );

    boardCanvas?.addEventListener(
      "pointercancel",
      boardUp
    );
  }

  function setupLabels() {
    const slider =
      $("#fontSizeSlider");

    slider?.addEventListener(
      "input",
      () => {
        state.fontSize =
          Number(slider.value);

        const value =
          $("#fontSizeValue");

        if (value) {
          value.textContent =
            `${state.fontSize}px`;
        }

        if (
          state.selectedObject?.type ===
          "text"
        ) {
          state.selectedObject.fontSize =
            state.fontSize;

          renderBoard();
        }
      }
    );

    $("#outlineToggle")?.addEventListener(
      "change",
      e => {
        state.outline =
          e.target.checked;

        if (
          state.selectedObject?.type ===
          "text"
        ) {
          state.selectedObject.outline =
            state.outline;

          renderBoard();
        }
      }
    );

    $$("#colorRow .color").forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            $$("#colorRow .color")
              .forEach(x =>
                x.classList.remove("active")
              );

            button.classList.add("active");

            state.textColor =
              button.dataset.color;

            if (
              state.selectedObject?.type ===
              "text"
            ) {
              state.selectedObject.color =
                state.textColor;

              renderBoard();
            }
          }
        );
      }
    );

    $("#applyLabelBtn")
      ?.addEventListener(
        "click",
        addText
      );
  }

  function exportPNG() {
    if (!boardCanvas) {
      alert("먼저 대필판을 선택해주세요.");
      return;
    }

    if (!state.selectedTemplate) {
      alert("먼저 대필판을 선택해주세요.");
      return;
    }

    renderBoard();

    setTimeout(() => {
      const link =
        document.createElement("a");

      link.download =
        `iris-pubg-writer-${Date.now()}.png`;

      link.href =
        boardCanvas.toDataURL("image/png");

      link.click();

      setStatus("PNG 내보내기 완료");
    }, 200);
  }

  function resetProject() {
    state.image = null;
    state.crop = null;
    state.cropNorm = null;
    state.pieces = [];
    state.objects = [];
    state.selectedObject = null;
    state.selectedTemplate = null;
    state.templates = [];

    if (emptyState) {
      emptyState.classList.remove("hidden");
    }

    if (overlayBar) {
      overlayBar.classList.add("hidden");
    }

    if (ctx && canvas) {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    renderPieces();
    renderTemplates();
    renderBoard();

    setStatus("초기화됨");
  }

  function setupTabs() {
    $$(".tab").forEach(tab => {
      tab.addEventListener(
        "click",
        () => {
          const target =
            tab.dataset.tab;

          $$(".tab").forEach(
            x =>
              x.classList.remove("active")
          );

          $$(".tab-content").forEach(
            x =>
              x.classList.remove("active")
          );

          tab.classList.add("active");

          $(`#tab-${target}`)
            ?.classList.add("active");
        }
      );
    });
  }

  function setupNavigation() {
    $("#brandHome")
      ?.addEventListener(
        "click",
        () => {
          $("#app")
            ?.classList.add("hidden");

          $("#landing")
            ?.classList.remove("hidden");
        }
      );

    $("#sideBrand")
      ?.addEventListener(
        "click",
        () => {
          $("#app")
            ?.classList.add("hidden");

          $("#landing")
            ?.classList.remove("hidden");
        }
      );

    $("#resetBtn")
      ?.addEventListener(
        "click",
        resetProject
      );

    $("#newProjectBtn")
      ?.addEventListener(
        "click",
        resetProject
      );

    $("#mobileNewProject")
      ?.addEventListener(
        "click",
        resetProject
      );

    $("#exportBtn")
      ?.addEventListener(
        "click",
        exportPNG
      );

    $("#mobileExport")
      ?.addEventListener(
        "click",
        exportPNG
      );
  }

  function setupQuickGrid() {
    $$(".quick-grid button")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            setStatus(
              "자유 자르기 모드에서는 격자를 사용하지 않습니다."
            );
          }
        );
      });
  }

  function setupDragDrop() {
    const holder =
      $("#canvasHolder");

    if (!holder) return;

    ["dragenter", "dragover"]
      .forEach(type => {
        holder.addEventListener(
          type,
          e => {
            e.preventDefault();
            holder.classList.add("dragging");
          }
        );
      });

    ["dragleave", "drop"]
      .forEach(type => {
        holder.addEventListener(
          type,
          e => {
            e.preventDefault();
            holder.classList.remove("dragging");
          }
        );
      });

    holder.addEventListener(
      "drop",
      async e => {
        const file =
          [...e.dataTransfer.files]
            .find(
              f =>
                f.type.startsWith("image/")
            );

        if (!file) return;

        const img =
          await loadImage(file);

        state.image = img;

        emptyState?.classList.add(
          "hidden"
        );

        overlayBar?.classList.remove(
          "hidden"
        );

        fitCanvas();

        if (state.cropNorm) {
          state.crop =
            getCropPixels();
        }

        drawCanvas();
      }
    );
  }

  window.addEventListener(
    "resize",
    () => {
      if (state.image) {
        fitCanvas();

        if (state.cropNorm) {
          state.crop =
            getCropPixels();

          drawCanvas();
        }
      }

      if (state.selectedTemplate) {
        renderBoard();
      }
    }
  );

  function init() {
    setupFileInput();
    setupUploadButtons();
    setupCropButtons();
    setupTemplates();
    setupBoardEvents();
    setupLabels();
    setupTabs();
    setupNavigation();
    setupQuickGrid();
    setupDragDrop();

    renderPieces();
    renderTemplates();

    setStatus("저장됨");
  }

  init();
})();
