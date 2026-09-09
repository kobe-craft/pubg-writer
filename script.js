(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  /* ================================
     SUPABASE
  ================================= */

  const SUPABASE_URL =
    "https://ivwgsfqyhvitrtnyllem.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_SAEWFTBARoRatHTHHtYmSQ_pjRb0nYH";

  const supabaseClient =
    window.supabase?.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

  /* ================================
     STATE
  ================================= */

  const state = {
    projectId: makeId(),
    projectName: "새 대필 작업",

    image: null,
    imageData: null,

    crop: null,
    cropNorm: null,

    pieces: [],
    templates: [],
    selectedTemplate: null,

    objects: [],
    selectedObject: null,

    textColor: "#171716",
    fontSize: 24,
    fontFamily: "DM Sans, sans-serif",
    outline: true,

    grid: {
      cols: 3,
      rows: 3,
      offX: 0,
      offY: 0
    },

    draggingCrop: false,
    draggingObject: false,
    cropStart: null,
    objectOffset: null,

    restoring: false
  };

  let saveTimer = null;
  let currentUser = null;
  let templateInput = null;

  let boardCanvas = null;
  let boardCtx = null;

  const fileInput = $("#fileInput");
  const canvas = $("#mainCanvas");
  const ctx = canvas?.getContext("2d");

  const cropStrip = $("#cropStrip");
  const emptyState = $("#emptyState");
  const overlayBar = $("#overlayBar");

  /* ================================
     ID
  ================================= */

  function makeId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 3) | 8;
        return v.toString(16);
      }
    );
  }

  /* ================================
     STATUS
  ================================= */

  function setStatus(text) {
    const el = $("#saveStatus");
    if (el) el.textContent = text;
  }

  /* ================================
     LOCAL STORAGE
  ================================= */

  function localKey(id = state.projectId) {
    return "iris-project-" + id;
  }

  function getProjectSnapshot() {
    return {
      projectId: state.projectId,
      projectName: state.projectName,

      imageData: state.imageData,
      cropNorm: state.cropNorm,

      pieces: state.pieces,
      templates: state.templates,

      selectedTemplateId:
        state.selectedTemplate?.id || null,

      objects: state.objects,

      textColor: state.textColor,
      fontSize: state.fontSize,
      fontFamily: state.fontFamily,
      outline: state.outline,

      grid: { ...state.grid },

      updatedAt: new Date().toISOString()
    };
  }

  function saveLocalProject() {
    try {
      localStorage.setItem(
        localKey(),
        JSON.stringify(getProjectSnapshot())
      );

      updateProjectListLocal();
    } catch (error) {
      console.warn("Local save failed:", error);
    }
  }

  function loadLocalProject(id) {
    try {
      const raw = localStorage.getItem(localKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getLocalProjectIndex() {
    const list = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (!key?.startsWith("iris-project-")) continue;

      try {
        const data = JSON.parse(
          localStorage.getItem(key)
        );

        if (data?.projectId) {
          list.push(data);
        }
      } catch {}
    }

    return list.sort(
      (a, b) =>
        new Date(b.updatedAt || 0) -
        new Date(a.updatedAt || 0)
    );
  }

  /* ================================
     AUTH
  ================================= */

  async function getSession() {
    if (!supabaseClient) return null;

    try {
      const { data, error } =
        await supabaseClient.auth.getSession();

      if (error) {
        console.warn(error);
        return null;
      }

      currentUser =
        data?.session?.user || null;

      return data?.session || null;
    } catch {
      return null;
    }
  }

  async function ensureUser() {
    if (!supabaseClient) return null;

    const session = await getSession();

    if (session?.user) {
      return session.user;
    }

    /*
      로그인 UI가 아직 없는 구조이므로
      익명 사용자 세션을 시도한다.
    */
    try {
      const { data, error } =
        await supabaseClient.auth.signInAnonymously();

      if (error) {
        console.warn(
          "Anonymous auth unavailable:",
          error.message
        );
        return null;
      }

      currentUser =
        data?.user ||
        data?.session?.user ||
        null;

      return currentUser;
    } catch (error) {
      console.warn(
        "Anonymous auth failed:",
        error
      );

      return null;
    }
  }

  /* ================================
     IMAGE
  ================================= */

  function loadImage(fileOrData) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = reject;

      if (typeof fileOrData === "string") {
        img.src = fileOrData;
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        img.src = reader.result;
      };

      reader.onerror = reject;
      reader.readAsDataURL(fileOrData);
    });
  }

  async function setMainImage(img, dataUrl, fileName = "") {
    state.image = img;
    state.imageData = dataUrl || img.src;

    if (
      (!state.projectName ||
        state.projectName === "새 대필 작업") &&
      fileName
    ) {
      state.projectName =
        fileName.replace(/\.[^/.]+$/, "") ||
        "새 대필 작업";
    }

    if (emptyState) {
      emptyState.classList.add("hidden");
    }

    if (overlayBar) {
      overlayBar.classList.remove("hidden");
    }

    updateProjectNameUI();

    fitCanvas();

    state.crop = null;
    state.cropNorm = null;

    drawCanvas();
    scheduleSave();
  }

  /* ================================
     CANVAS
  ================================= */

  function fitCanvas() {
    if (!canvas || !state.image) return;

    const holder = $("#canvasHolder");

    const maxW =
      holder?.clientWidth || 900;

    const maxH =
      Math.min(
        window.innerHeight * 0.65,
        650
      );

    const ratio =
      Math.min(
        maxW / state.image.naturalWidth,
        maxH / state.image.naturalHeight
      );

    canvas.width =
      Math.max(
        1,
        Math.round(
          state.image.naturalWidth * ratio
        )
      );

    canvas.height =
      Math.max(
        1,
        Math.round(
          state.image.naturalHeight * ratio
        )
      );

    canvas.style.width =
      `${canvas.width}px`;

    canvas.style.height =
      `${canvas.height}px`;

    drawCanvas();
  }

  function getDisplayScale() {
    if (!state.image || !canvas) return 1;

    return (
      canvas.width /
      state.image.naturalWidth
    );
  }

  function getCropPixels() {
    if (!state.image) return null;

    if (state.cropNorm) {
      return {
        x:
          state.cropNorm.x *
          state.image.naturalWidth,

        y:
          state.cropNorm.y *
          state.image.naturalHeight,

        w:
          state.cropNorm.w *
          state.image.naturalWidth,

        h:
          state.cropNorm.h *
          state.image.naturalHeight
      };
    }

    return state.crop;
  }

  function saveCropNormalized(crop) {
    if (!state.image) return;

    state.cropNorm = {
      x:
        crop.x /
        state.image.naturalWidth,

      y:
        crop.y /
        state.image.naturalHeight,

      w:
        crop.w /
        state.image.naturalWidth,

      h:
        crop.h /
        state.image.naturalHeight
    };

    state.crop = crop;
  }

  function clampCrop(crop) {
    if (!canvas) return crop;

    const min = 10;

    crop.w = Math.max(
      min,
      Math.min(crop.w, canvas.width)
    );

    crop.h = Math.max(
      min,
      Math.min(crop.h, canvas.height)
    );

    crop.x = Math.max(
      0,
      Math.min(
        crop.x,
        canvas.width - crop.w
      )
    );

    crop.y = Math.max(
      0,
      Math.min(
        crop.y,
        canvas.height - crop.h
      )
    );

    return crop;
  }

  function drawCanvas() {
    if (!ctx || !state.image) return;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

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

      ctx.fillStyle =
        "rgba(0,0,0,.08)";

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.fillStyle = "#171716";
      ctx.font = "600 15px DM Sans";
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

    ctx.fillStyle =
      "rgba(0,0,0,.48)";

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

    const scale = getDisplayScale();

    ctx.drawImage(
      state.image,

      crop.x / scale,
      crop.y / scale,
      crop.w / scale,
      crop.h / scale,

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

    ctx.fillStyle =
      "rgba(255,255,255,.9)";

    ctx.font =
      "600 12px DM Sans";

    ctx.fillText(
      `${Math.round(crop.w / scale)} × ${Math.round(crop.h / scale)}`,
      crop.x + 8,
      crop.y + 18
    );

    ctx.restore();
  }

  function pointerPosition(e) {
    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        (e.clientX - rect.left) *
        (canvas.width / rect.width),

      y:
        (e.clientY - rect.top) *
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

  /* ================================
     CROP
  ================================= */

  function beginCrop(e) {
    if (!state.image) return;

    const p = pointerPosition(e);
    const current = getCropPixels();

    if (
      current &&
      pointInsideCrop(p, current)
    ) {
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

    canvas.setPointerCapture?.(
      e.pointerId
    );
  }

  function moveCrop(e) {
    if (
      !state.draggingCrop ||
      !state.image
    ) {
      return;
    }

    const p = pointerPosition(e);
    const start = state.cropStart;

    if (start.mode === "create") {
      const x =
        Math.min(start.x, p.x);

      const y =
        Math.min(start.y, p.y);

      const w =
        Math.abs(p.x - start.x);

      const h =
        Math.abs(p.y - start.y);

      state.crop =
        clampCrop({
          x,
          y,
          w,
          h
        });
    } else {
      const crop = getCropPixels();

      state.crop =
        clampCrop({
          x:
            p.x - start.x,

          y:
            p.y - start.y,

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
      saveCropNormalized(
        state.crop
      );
    }

    drawCanvas();

    setStatus("선택됨");
    scheduleSave();
  }

  /* ================================
     PIECES
  ================================= */

  function cropCurrentPiece() {
    if (
      !state.image ||
      !state.crop
    ) {
      return;
    }

    const crop = getCropPixels();

    if (!crop) return;

    const scale =
      state.image.naturalWidth /
      canvas.width;

    const sx = crop.x * scale;
    const sy = crop.y * scale;
    const sw = crop.w * scale;
    const sh = crop.h * scale;

    const out =
      document.createElement("canvas");

    out.width =
      Math.max(1, Math.round(sw));

    out.height =
      Math.max(1, Math.round(sh));

    const outCtx =
      out.getContext("2d");

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

    state.pieces.push({
      id: makeId(),
      src:
        out.toDataURL("image/png"),
      width: out.width,
      height: out.height
    });

    renderPieces();

    setStatus("조각 저장됨");
    scheduleSave();
  }

  function renderPieces() {
    if (!cropStrip) return;

    cropStrip.innerHTML = "";

    state.pieces.forEach(
      (piece, index) => {
        const item =
          document.createElement("button");

        item.type = "button";
        item.className = "crop-item";

        item.innerHTML = `
          <img
            src="${piece.src}"
            alt="조각 ${index + 1}"
          >
          <span>${index + 1}</span>
        `;

        item.addEventListener(
          "click",
          () => addPieceToBoard(piece)
        );

        cropStrip.appendChild(item);
      }
    );

    const total = $("#totalCount");

    if (total) {
      total.textContent =
        `${state.pieces.length}개`;
    }

    const hint = $("#cropHint");

    if (hint) {
      hint.textContent =
        state.pieces.length
          ? "조각을 클릭하면 대필판에 추가됩니다."
          : "영역을 선택한 뒤 조각 저장을 눌러주세요.";
    }

    updateSelectionCount();
  }

  /* ================================
     IMAGE UPLOAD
  ================================= */

  function openImagePicker() {
    fileInput?.click();
  }

  function setupFileInput() {
    fileInput?.addEventListener(
      "change",
      async () => {
        const file =
          fileInput.files?.[0];

        if (!file) return;

        try {
          const img =
            await loadImage(file);

          const reader =
            new FileReader();

          reader.onload = () => {
            setMainImage(
              img,
              reader.result,
              file.name
            );
          };

          reader.readAsDataURL(file);

          setStatus(
            "이미지 불러옴"
          );
        } catch {
          alert(
            "이미지를 불러오지 못했습니다."
          );
        }

        fileInput.value = "";
      }
    );
  }

  function setupUploadButtons() {
    $("#startBtn")?.addEventListener(
      "click",
      async () => {
        $("#landing")
          ?.classList.add("hidden");

        $("#app")
          ?.classList.remove("hidden");

        renderProjectList();

        await loadProjects();
      }
    );

    $("#uploadTopBtn")
      ?.addEventListener(
        "click",
        openImagePicker
      );

    $("#emptyUploadBtn")
      ?.addEventListener(
        "click",
        openImagePicker
      );
  }

  /* ================================
     TEMPLATE UPLOAD
  ================================= */

  function setupTemplateUpload() {
    templateInput =
      $("#templateFileInput");

    $("#templateUploadBtn")
      ?.addEventListener(
        "click",
        () => templateInput?.click()
      );

    templateInput?.addEventListener(
      "change",
      async () => {
        const file =
          templateInput.files?.[0];

        if (!file) return;

        try {
          const img =
            await loadImage(file);

          const template = {
            id: makeId(),

            name:
              file.name.replace(
                /\.[^/.]+$/,
                ""
              ) || "새 대필판",

            src: img.src,

            width:
              img.naturalWidth,

            height:
              img.naturalHeight
          };

          state.templates.push(
            template
          );

          state.selectedTemplate =
            template;

          const nameInput =
            $("#templateName");

          if (nameInput) {
            nameInput.value =
              template.name;
          }

          renderTemplates();
          renderBoard();

          setStatus(
            "대필판 추가됨"
          );

          scheduleSave();
        } catch {
          alert(
            "대필판을 불러오지 못했습니다."
          );
        }

        templateInput.value = "";
      }
    );
  }

  function renderTemplates() {
    const list =
      $("#templateList");

    if (!list) return;

    list.innerHTML = "";

    if (!state.templates.length) {
      const empty =
        document.createElement("div");

      empty.style.cssText = `
        padding:20px 10px;
        text-align:center;
        color:#918c83;
        font-size:10px;
        border:1px dashed rgba(40,37,33,.12);
        border-radius:9px;
      `;

      empty.textContent =
        "아직 저장된 대필판이 없습니다.";

      list.appendChild(empty);
      return;
    }

    state.templates.forEach(
      (template) => {
        const item =
          document.createElement("button");

        item.type = "button";
        item.className =
          "template-item";

        if (
          state.selectedTemplate?.id ===
          template.id
        ) {
          item.classList.add("active");
        }

        item.innerHTML = `
          <img
            src="${template.src}"
            alt=""
          >
          <span>
            ${escapeHtml(template.name)}
          </span>
        `;

        item.addEventListener(
          "click",
          () => {
            state.selectedTemplate =
              template;

            const name =
              $("#templateName");

            if (name) {
              name.value =
                template.name;
            }

            renderTemplates();
            renderBoard();
            scheduleSave();
          }
        );

        list.appendChild(item);
      }
    );
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(
        /[&<>"']/g,
        (char) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
          })[char]
      );
  }

  /* ================================
     BOARD
  ================================= */

  function ensureBoard() {
    if (boardCanvas) return;

    const section =
      $(".result-section");

    if (!section) return;

    boardCanvas =
      document.createElement("canvas");

    boardCanvas.style.cssText = `
      display:block;
      width:100%;
      max-width:900px;
      margin-top:20px;
      border-radius:12px;
      border:1px solid rgba(40,37,33,.11);
      background:#fff;
      cursor:default;
    `;

    boardCanvas.width = 900;
    boardCanvas.height = 600;

    section.appendChild(
      boardCanvas
    );

    boardCtx =
      boardCanvas.getContext("2d");

    boardCanvas.addEventListener(
      "pointerdown",
      beginObjectDrag
    );

    boardCanvas.addEventListener(
      "pointermove",
      moveObjectDrag
    );

    boardCanvas.addEventListener(
      "pointerup",
      endObjectDrag
    );

    boardCanvas.addEventListener(
      "pointercancel",
      endObjectDrag
    );
  }

  function addPieceToBoard(piece) {
    ensureBoard();

    const template =
      state.selectedTemplate;

    const baseWidth =
      template?.width || 1000;

    const baseHeight =
      template?.height || 700;

    const scale =
      Math.min(
        1,
        260 /
          Math.max(
            piece.width,
            piece.height
          )
      );

    const object = {
      id: makeId(),
      type: "image",
      src: piece.src,

      x:
        baseWidth / 2 -
        (piece.width * scale) / 2,

      y:
        baseHeight / 2 -
        (piece.height * scale) / 2,

      width:
        piece.width * scale,

      height:
        piece.height * scale
    };

    state.objects.push(object);
    state.selectedObject =
      object.id;

    renderBoard();

    setStatus(
      "대필판에 추가됨"
    );

    scheduleSave();
  }

  function addTextObject(text) {
    ensureBoard();

    const template =
      state.selectedTemplate;

    const width =
      template?.width || 1000;

    const height =
      template?.height || 700;

    const object = {
      id: makeId(),
      type: "text",
      text,

      x: width / 2,
      y: height / 2,

      color: state.textColor,
      fontSize: state.fontSize,
      fontFamily: state.fontFamily,
      outline: state.outline
    };

    state.objects.push(object);

    state.selectedObject =
      object.id;

    renderBoard();
    scheduleSave();
  }

  function renderBoard() {
    ensureBoard();

    if (!boardCanvas || !boardCtx) {
      return;
    }

    const template =
      state.selectedTemplate;

    const width =
      template?.width || 1000;

    const height =
      template?.height || 700;

    const ratio =
      Math.min(
        1,
        900 / width
      );

    boardCanvas.width =
      Math.round(width * ratio);

    boardCanvas.height =
      Math.round(height * ratio);

    boardCtx.clearRect(
      0,
      0,
      boardCanvas.width,
      boardCanvas.height
    );

    if (template) {
      const img = new Image();

      img.onload = () => {
        boardCtx.drawImage(
          img,
          0,
          0,
          boardCanvas.width,
          boardCanvas.height
        );

        drawBoardObjects(ratio);
      };

      img.src = template.src;
    } else {
      boardCtx.fillStyle = "#ffffff";

      boardCtx.fillRect(
        0,
        0,
        boardCanvas.width,
        boardCanvas.height
      );

      drawBoardObjects(ratio);
    }
  }

  function drawBoardObjects(ratio) {
    state.objects.forEach(
      (object) => {
        if (object.type === "image") {
          const img = new Image();

          img.onload = () => {
            boardCtx.drawImage(
              img,

              object.x * ratio,
              object.y * ratio,

              object.width * ratio,
              object.height * ratio
            );

            drawSelection(
              object,
              ratio
            );
          };

          img.src = object.src;
        } else {
          drawTextObject(
            object,
            ratio
          );
        }
      }
    );
  }

  function drawTextObject(
    object,
    ratio
  ) {
    boardCtx.save();

    const size =
      object.fontSize * ratio;

    const family =
      object.fontFamily ||
      "DM Sans, sans-serif";

    boardCtx.font =
      `600 ${size}px ${family}`;

    boardCtx.textAlign = "center";
    boardCtx.textBaseline = "middle";

    if (object.outline) {
      boardCtx.strokeStyle =
        object.color === "#ffffff"
          ? "rgba(0,0,0,.8)"
          : "rgba(255,255,255,.9)";

      boardCtx.lineWidth =
        Math.max(
          2,
          size * 0.12
        );

      boardCtx.strokeText(
        object.text,
        object.x * ratio,
        object.y * ratio
      );
    }

    boardCtx.fillStyle =
      object.color;

    boardCtx.fillText(
      object.text,
      object.x * ratio,
      object.y * ratio
    );

    boardCtx.restore();

    drawSelection(
      object,
      ratio
    );
  }

  function drawSelection(
    object,
    ratio
  ) {
    if (
      state.selectedObject !==
      object.id
    ) {
      return;
    }

    boardCtx.save();

    boardCtx.strokeStyle =
      "#d97950";

    boardCtx.lineWidth = 1.5;

    if (object.type === "image") {
      boardCtx.strokeRect(
        object.x * ratio,
        object.y * ratio,
        object.width * ratio,
        object.height * ratio
      );
    } else {
      boardCtx.strokeRect(
        (object.x - 60) * ratio,
        (object.y - object.fontSize) * ratio,
        120 * ratio,
        object.fontSize * 2 * ratio
      );
    }

    boardCtx.restore();
  }

  function boardPointerPosition(e) {
    const rect =
      boardCanvas.getBoundingClientRect();

    const scale =
      boardCanvas.width /
      rect.width;

    return {
      x:
        (e.clientX - rect.left) *
        scale,

      y:
        (e.clientY - rect.top) *
        scale
    };
  }

  function findObjectAt(p) {
    const template =
      state.selectedTemplate;

    const width =
      template?.width || 1000;

    const ratio =
      boardCanvas.width / width;

    const x = p.x / ratio;
    const y = p.y / ratio;

    for (
      let i = state.objects.length - 1;
      i >= 0;
      i--
    ) {
      const object =
        state.objects[i];

      if (object.type === "image") {
        if (
          x >= object.x &&
          x <= object.x + object.width &&
          y >= object.y &&
          y <= object.y + object.height
        ) {
          return object;
        }
      } else {
        if (
          Math.abs(x - object.x) < 80 &&
          Math.abs(y - object.y) < 50
        ) {
          return object;
        }
      }
    }

    return null;
  }

  function beginObjectDrag(e) {
    const p =
      boardPointerPosition(e);

    const object =
      findObjectAt(p);

    if (!object) {
      state.selectedObject = null;
      renderBoard();
      return;
    }

    state.selectedObject =
      object.id;

    const template =
      state.selectedTemplate;

    const width =
      template?.width || 1000;

    const ratio =
      boardCanvas.width / width;

    state.draggingObject = true;

    state.objectOffset = {
      x:
        p.x / ratio -
        object.x,

      y:
        p.y / ratio -
        object.y
    };

    boardCanvas.setPointerCapture?.(
      e.pointerId
    );

    renderBoard();
  }

  function moveObjectDrag(e) {
    if (!state.draggingObject) return;

    const object =
      state.objects.find(
        (item) =>
          item.id ===
          state.selectedObject
      );

    if (!object) return;

    const p =
      boardPointerPosition(e);

    const template =
      state.selectedTemplate;

    const width =
      template?.width || 1000;

    const ratio =
      boardCanvas.width / width;

    object.x =
      p.x / ratio -
      state.objectOffset.x;

    object.y =
      p.y / ratio -
      state.objectOffset.y;

    renderBoard();
  }

  function endObjectDrag() {
    if (!state.draggingObject) return;

    state.draggingObject = false;
    scheduleSave();
  }

  /* ================================
     LABEL
  ================================= */

  function setupLabel() {
    $("#colorRow")
      ?.addEventListener(
        "click",
        (e) => {
          const btn =
            e.target.closest(".color");

          if (!btn) return;

          state.textColor =
            btn.dataset.color;

          $$(".color").forEach(
            (el) =>
              el.classList.remove(
                "active"
              )
          );

          btn.classList.add("active");

          scheduleSave();
        }
      );

    $("#fontFamilySelect")
      ?.addEventListener(
        "change",
        (e) => {
          state.fontFamily =
            e.target.value;

          const selected =
            state.objects.find(
              (object) =>
                object.id ===
                state.selectedObject
            );

          if (
            selected?.type === "text"
          ) {
            selected.fontFamily =
              state.fontFamily;
          }

          renderBoard();
          scheduleSave();
        }
      );

    $("#fontSizeSlider")
      ?.addEventListener(
        "input",
        (e) => {
          state.fontSize =
            Number(e.target.value);

          const value =
            $("#fontSizeValue");

          if (value) {
            value.textContent =
              `${state.fontSize}px`;
          }

          const selected =
            state.objects.find(
              (object) =>
                object.id ===
                state.selectedObject
            );

          if (
            selected?.type === "text"
          ) {
            selected.fontSize =
              state.fontSize;
          }

          renderBoard();
          scheduleSave();
        }
      );

    $("#outlineToggle")
      ?.addEventListener(
        "change",
        (e) => {
          state.outline =
            e.target.checked;

          const selected =
            state.objects.find(
              (object) =>
                object.id ===
                state.selectedObject
            );

          if (
            selected?.type === "text"
          ) {
            selected.outline =
              state.outline;
          }

          renderBoard();
          scheduleSave();
        }
      );

    $("#applyLabelBtn")
      ?.addEventListener(
        "click",
        () => {
          const text =
            $("#labelText")
              ?.value
              ?.trim();

          if (!text) {
            alert(
              "라벨 텍스트를 입력해주세요."
            );
            return;
          }

          const selected =
            state.objects.find(
              (object) =>
                object.id ===
                state.selectedObject
            );

          if (
            selected &&
            selected.type === "text"
          ) {
            selected.text = text;
            selected.color =
              state.textColor;
            selected.fontSize =
              state.fontSize;
            selected.fontFamily =
              state.fontFamily;
            selected.outline =
              state.outline;

            renderBoard();
          } else {
            addTextObject(text);
          }

          setStatus(
            "라벨 적용됨"
          );

          scheduleSave();
        }
      );
  }

  /* ================================
     GRID
  ================================= */

  function setupGrid() {
    const cols = $("#colsInput");
    const rows = $("#rowsInput");
    const offX = $("#offXSlider");
    const offY = $("#offYSlider");

    cols?.addEventListener(
      "input",
      () => {
        state.grid.cols =
          Number(cols.value);

        scheduleSave();
      }
    );

    rows?.addEventListener(
      "input",
      () => {
        state.grid.rows =
          Number(rows.value);

        scheduleSave();
      }
    );

    offX?.addEventListener(
      "input",
      () => {
        state.grid.offX =
          Number(offX.value);

        const value =
          $("#offXValue");

        if (value) {
          value.textContent =
            offX.value;
        }

        scheduleSave();
      }
    );

    offY?.addEventListener(
      "input",
      () => {
        state.grid.offY =
          Number(offY.value);

        const value =
          $("#offYValue");

        if (value) {
          value.textContent =
            offY.value;
        }

        scheduleSave();
      }
    );

    $$(".quick-grid button")
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const [
                colsValue,
                rowsValue
              ] =
                button.dataset.grid
                  .split("x")
                  .map(Number);

              if (cols) {
                cols.value =
                  colsValue;
              }

              if (rows) {
                rows.value =
                  rowsValue;
              }

              state.grid.cols =
                colsValue;

              state.grid.rows =
                rowsValue;

              createGridPieces(
                colsValue,
                rowsValue
              );

              scheduleSave();
            }
          );
        }
      );
  }

  function createGridPieces(
    cols,
    rows
  ) {
    if (!state.image) return;

    const imageW =
      state.image.naturalWidth;

    const imageH =
      state.image.naturalHeight;

    const offX =
      state.grid.offX;

    const offY =
      state.grid.offY;

    state.pieces = [];

    const cellW =
      imageW / cols;

    const cellH =
      imageH / rows;

    for (
      let row = 0;
      row < rows;
      row++
    ) {
      for (
        let col = 0;
        col < cols;
        col++
      ) {
        const out =
          document.createElement(
            "canvas"
          );

        out.width =
          Math.round(cellW);

        out.height =
          Math.round(cellH);

        const outCtx =
          out.getContext("2d");

        const sx =
          col * cellW + offX;

        const sy =
          row * cellH + offY;

        outCtx.drawImage(
          state.image,
          sx,
          sy,
          cellW,
          cellH,
          0,
          0,
          out.width,
          out.height
        );

        state.pieces.push({
          id: makeId(),
          src:
            out.toDataURL(
              "image/png"
            ),
          width: out.width,
          height: out.height
        });
      }
    }

    renderPieces();

    setStatus(
      `${cols} × ${rows} 생성됨`
    );

    scheduleSave();
  }

  /* ================================
     SELECTION
  ================================= */

  function updateSelectionCount() {
    const count =
      $("#selCount");

    if (count) {
      count.textContent =
        state.pieces.length;
    }
  }

  /* ================================
     PROJECT NAME
  ================================= */

  function updateProjectNameUI() {
    const name =
      state.projectName ||
      "새 대필 작업";

    const sidebar =
      $("#sidebarProjectName");

    const breadcrumb =
      $("#breadcrumbProject");

    if (sidebar) {
      sidebar.textContent = name;
    }

    if (breadcrumb) {
      breadcrumb.textContent = name;
    }
  }

  /* ================================
     PROJECT PAYLOAD
  ================================= */

  function getProjectPayload() {
    return {
      pieces: state.pieces,
      templates: state.templates,

      selectedTemplateId:
        state.selectedTemplate?.id ||
        null,

      objects: state.objects,

      cropNorm: state.cropNorm,

      textColor: state.textColor,
      fontSize: state.fontSize,
      fontFamily: state.fontFamily,
      outline: state.outline,

      grid: { ...state.grid }
    };
  }

  /* ================================
     SAVE
  ================================= */

  function scheduleSave() {
    if (state.restoring) return;

    saveLocalProject();

    clearTimeout(saveTimer);

    setStatus("저장 중...");

    saveTimer =
      setTimeout(
        saveCurrentProject,
        700
      );
  }

  async function saveCurrentProject() {
    if (state.restoring) return;

    saveLocalProject();

    if (!supabaseClient || !currentUser) {
      setStatus("로컬 저장됨");
      return;
    }

    try {
      const now =
        new Date().toISOString();

      const row = {
        id: state.projectId,

        user_id:
          currentUser.id,

        name:
          state.projectName ||
          "새 대필 작업",

        thumbnail:
          state.pieces[0]?.src ||
          state.imageData ||
          null,

        data:
          getProjectPayload(),

        state: {
          cropNorm:
            state.cropNorm,

          textColor:
            state.textColor,

          fontSize:
            state.fontSize,

          fontFamily:
            state.fontFamily,

          outline:
            state.outline,

          grid:
            state.grid
        },

        image_data:
          state.imageData,

        updated_at:
          now
      };

      const { error } =
        await supabaseClient
          .from("projects")
          .upsert(
            row,
            {
              onConflict: "id"
            }
          );

      if (error) {
        throw error;
      }

      setStatus("저장됨");

      await loadProjects();
    } catch (error) {
      console.error(
        "Supabase project save:",
        error
      );

      setStatus(
        "로컬 저장됨 · DB 연결 확인 필요"
      );
    }
  }

  /* ================================
     PROJECT LIST
  ================================= */

  async function loadProjects() {
    if (!supabaseClient || !currentUser) {
      renderProjectList();
      return;
    }

    try {
      const { data, error } =
        await supabaseClient
          .from("projects")
          .select(
            "id,name,thumbnail,updated_at"
          )
          .eq(
            "user_id",
            currentUser.id
          )
          .order(
            "updated_at",
            {
              ascending: false
            }
          )
          .limit(50);

      if (error) {
        throw error;
      }

      renderProjectList(
        data || []
      );
    } catch (error) {
      console.warn(
        "Project list:",
        error
      );

      renderProjectList();
    }
  }

  function renderProjectList(
    remoteProjects = null
  ) {
    const list =
      $("#projectList");

    if (!list) return;

    list.innerHTML = "";

    let projects =
      remoteProjects;

    if (!projects) {
      projects =
        getLocalProjectIndex().map(
          (project) => ({
            id:
              project.projectId,

            name:
              project.projectName,

            thumbnail:
              project.imageData,

            updated_at:
              project.updatedAt
          })
        );
    }

    if (!projects.length) {
      projects = [
        {
          id:
            state.projectId,

          name:
            state.projectName,

          thumbnail:
            state.imageData,

          updated_at:
            new Date().toISOString()
        }
      ];
    }

    projects.forEach(
      (project) => {
        const button =
          document.createElement(
            "button"
          );

        button.type = "button";
        button.className =
          "project-item";

        if (
          project.id ===
          state.projectId
        ) {
          button.classList.add(
            "active"
          );
        }

        button.innerHTML = `
          <span class="project-dot"></span>

          <span class="project-info">
            <strong>
              ${escapeHtml(
                project.name ||
                "새 대필 작업"
              )}
            </strong>

            <small>
              ${formatProjectDate(
                project.updated_at
              )}
            </small>
          </span>
        `;

        button.addEventListener(
          "click",
          () => {
            openProject(
              project.id
            );
          }
        );

        list.appendChild(button);
      }
    );
  }

  function updateProjectListLocal() {
    if (
      $("#app")?.classList.contains(
        "hidden"
      )
    ) {
      return;
    }

    renderProjectList();
  }

  function formatProjectDate(date) {
    if (!date) return "현재 작업";

    const d =
      new Date(date);

    if (
      Number.isNaN(
        d.getTime()
      )
    ) {
      return "현재 작업";
    }

    const diff =
      Date.now() -
      d.getTime();

    if (diff < 60000) {
      return "방금 전";
    }

    if (diff < 3600000) {
      return `${Math.floor(
        diff / 60000
      )}분 전`;
    }

    if (diff < 86400000) {
      return `${Math.floor(
        diff / 3600000
      )}시간 전`;
    }

    return d.toLocaleDateString(
      "ko-KR",
      {
        month: "numeric",
        day: "numeric"
      }
    );
  }

  /* ================================
     OPEN PROJECT
  ================================= */

  async function openProject(projectId) {
    if (
      projectId ===
      state.projectId
    ) {
      renderProjectList();
      return;
    }

    setStatus("불러오는 중...");

    let row = null;

    if (
      supabaseClient &&
      currentUser
    ) {
      try {
        const { data, error } =
          await supabaseClient
            .from("projects")
            .select("*")
            .eq(
              "id",
              projectId
            )
            .eq(
              "user_id",
              currentUser.id
            )
            .single();

        if (!error) {
          row = data;
        }
      } catch (error) {
        console.warn(error);
      }
    }

    if (!row) {
      row =
        loadLocalProject(
          projectId
        );
    }

    if (!row) {
      setStatus(
        "프로젝트를 찾을 수 없습니다."
      );
      return;
    }

    await restoreProject(row);
  }

  async function restoreProject(row) {
    state.restoring = true;

    try {
      state.projectId =
        row.id ||
        row.projectId ||
        makeId();

      state.projectName =
        row.name ||
        row.projectName ||
        "새 대필 작업";

      const data =
        typeof row.data ===
        "string"
          ? JSON.parse(row.data)
          : row.data || {};

      state.pieces =
        Array.isArray(
          data.pieces
        )
          ? data.pieces
          : [];

      state.templates =
        Array.isArray(
          data.templates
        )
          ? data.templates
          : [];

      state.objects =
        Array.isArray(
          data.objects
        )
          ? data.objects
          : [];

      state.cropNorm =
        data.cropNorm ||
        row.state?.cropNorm ||
        null;

      state.textColor =
        data.textColor ||
        row.state?.textColor ||
        "#171716";

      state.fontSize =
        Number(
          data.fontSize ||
          row.state?.fontSize ||
          24
        );

      state.fontFamily =
        data.fontFamily ||
        row.state?.fontFamily ||
        "DM Sans, sans-serif";

      state.outline =
        data.outline ??
        row.state?.outline ??
        true;

      state.grid =
        data.grid ||
        row.state?.grid ||
        {
          cols: 3,
          rows: 3,
          offX: 0,
          offY: 0
        };

      state.selectedTemplate =
        state.templates.find(
          (template) =>
            template.id ===
            data.selectedTemplateId
        ) ||
        state.templates[0] ||
        null;

      state.selectedObject = null;

      syncControls();

      if (
        row.image_data ||
        row.imageData
      ) {
        const imageData =
          row.image_data ||
          row.imageData;

        state.imageData =
          imageData;

        state.image =
          await loadImage(
            imageData
          );

        if (emptyState) {
          emptyState.classList.add(
            "hidden"
          );
        }

        if (overlayBar) {
          overlayBar.classList.remove(
            "hidden"
          );
        }

        fitCanvas();

        if (state.cropNorm) {
          state.crop =
            getCropPixels();
        }
      } else {
        state.image = null;
        state.imageData = null;

        if (emptyState) {
          emptyState.classList.remove(
            "hidden"
          );
        }

        if (overlayBar) {
          overlayBar.classList.add(
            "hidden"
          );
        }
      }

      renderPieces();
      renderTemplates();
      renderBoard();

      updateProjectNameUI();

      $("#app")
        ?.classList.remove("hidden");

      $("#landing")
        ?.classList.add("hidden");

      renderProjectList();

      setStatus("불러옴");
    } catch (error) {
      console.error(
        "Restore project:",
        error
      );

      alert(
        "프로젝트를 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      state.restoring = false;
    }
  }

  function syncControls() {
    const cols = $("#colsInput");
    const rows = $("#rowsInput");
    const offX = $("#offXSlider");
    const offY = $("#offYSlider");

    if (cols) {
      cols.value =
        state.grid.cols;
    }

    if (rows) {
      rows.value =
        state.grid.rows;
    }

    if (offX) {
      offX.value =
        state.grid.offX;
    }

    if (offY) {
      offY.value =
        state.grid.offY;
    }

    const offXValue =
      $("#offXValue");

    const offYValue =
      $("#offYValue");

    if (offXValue) {
      offXValue.textContent =
        state.grid.offX;
    }

    if (offYValue) {
      offYValue.textContent =
        state.grid.offY;
    }

    const fontSize =
      $("#fontSizeSlider");

    const fontSizeValue =
      $("#fontSizeValue");

    if (fontSize) {
      fontSize.value =
        state.fontSize;
    }

    if (fontSizeValue) {
      fontSizeValue.textContent =
        `${state.fontSize}px`;
    }

    const fontFamily =
      $("#fontFamilySelect");

    if (fontFamily) {
      fontFamily.value =
        state.fontFamily;
    }

    const outline =
      $("#outlineToggle");

    if (outline) {
      outline.checked =
        state.outline;
    }

    $$(".color").forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset.color ===
            state.textColor
        );
      }
    );
  }

  /* ================================
     NEW PROJECT
  ================================= */

  function createNewProject() {
    state.restoring = true;

    state.projectId = makeId();
    state.projectName =
      "새 대필 작업";

    state.image = null;
    state.imageData = null;

    state.crop = null;
    state.cropNorm = null;

    state.pieces = [];
    state.objects = [];

    state.selectedObject = null;

    state.selectedTemplate =
      state.templates[0] ||
      null;

    state.restoring = false;

    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    if (emptyState) {
      emptyState.classList.remove(
        "hidden"
      );
    }

    if (overlayBar) {
      overlayBar.classList.add(
        "hidden"
      );
    }

    renderPieces();
    renderTemplates();
    renderBoard();

    updateProjectNameUI();

    renderProjectList();

    saveLocalProject();

    setStatus(
      "새 프로젝트"
    );
  }

  /* ================================
     TEMPLATE DATABASE
  ================================= */

  async function saveTemplateToDB() {
    const template =
      state.selectedTemplate;

    if (!template) {
      alert(
        "먼저 대필판을 업로드해주세요."
      );
      return;
    }

    const input =
      $("#templateName");

    const name =
      input?.value?.trim() ||
      template.name ||
      "새 대필판";

    template.name = name;

    if (
      supabaseClient &&
      currentUser
    ) {
      try {
        const { error } =
          await supabaseClient
            .from("templates")
            .upsert(
              {
                id: template.id,

                user_id:
                  currentUser.id,

                name,

                rows:
                  Number(
                    $("#rowsInput")?.value ||
                    3
                  ),

                cols:
                  Number(
                    $("#colsInput")?.value ||
                    3
                  ),

                settings: {
                  src:
                    template.src,

                  width:
                    template.width,

                  height:
                    template.height,

                  offsetX:
                    state.grid.offX,

                  offsetY:
                    state.grid.offY
                },

                updated_at:
                  new Date().toISOString()
              },
              {
                onConflict: "id"
              }
            );

        if (error) {
          throw error;
        }

        setStatus(
          "대필판 저장됨"
        );
      } catch (error) {
        console.error(
          "Template save:",
          error
        );

        setStatus(
          "대필판 로컬 저장됨"
        );
      }
    } else {
      setStatus(
        "대필판 로컬 저장됨"
      );
    }

    renderTemplates();
    scheduleSave();
  }

  async function loadTemplatesFromDB() {
    if (
      !supabaseClient ||
      !currentUser
    ) {
      return;
    }

    try {
      const { data, error } =
        await supabaseClient
          .from("templates")
          .select("*")
          .eq(
            "user_id",
            currentUser.id
          )
          .order(
            "updated_at",
            {
              ascending: false
            }
          );

      if (error) {
        throw error;
      }

      if (!data?.length) return;

      const remote =
        data
          .map((row) => {
            const settings =
              row.settings || {};

            return {
              id: row.id,

              name:
                row.name ||
                "대필판",

              src:
                settings.src ||
                "",

              width:
                settings.width ||
                1000,

              height:
                settings.height ||
                700
            };
          })
          .filter(
            (item) =>
              item.src
          );

      const existing =
        new Map(
          state.templates.map(
            (item) => [
              item.id,
              item
            ]
          )
        );

      remote.forEach(
        (template) => {
          existing.set(
            template.id,
            template
          );
        }
      );

      state.templates =
        [...existing.values()];

      if (
        !state.selectedTemplate &&
        state.templates.length
      ) {
        state.selectedTemplate =
          state.templates[0];
      }

      renderTemplates();
      renderBoard();
    } catch (error) {
      console.warn(
        "Templates:",
        error
      );
    }
  }

  /* ================================
     TABS
  ================================= */

  function setupTabs() {
    $$(".tab").forEach(
      (tab) => {
        tab.addEventListener(
          "click",
          () => {
            const name =
              tab.dataset.tab;

            $$(".tab").forEach(
              (el) =>
                el.classList.toggle(
                  "active",
                  el === tab
                )
            );

            $$(".tab-content").forEach(
              (content) =>
                content.classList.toggle(
                  "active",
                  content.id ===
                    `tab-${name}`
                )
            );
          }
        );
      }
    );
  }

  /* ================================
     NAVIGATION
  ================================= */

  function setupNavigation() {
    $("#newProjectBtn")
      ?.addEventListener(
        "click",
        createNewProject
      );

    resetButton();

    $("#brandHome")
      ?.addEventListener(
        "click",
        goHome
      );

    $("#sideBrand")
      ?.addEventListener(
        "click",
        goHome
      );

    $("#settingsBtn")
      ?.addEventListener(
        "click",
        () => {
          $(".settings")
            ?.scrollIntoView({
              behavior: "smooth"
            });
        }
      );

    $("#helpBtn")
      ?.addEventListener(
        "click",
        () => {
          alert(
`Iris 사용 방법

1. 이미지를 업로드합니다.
2. 이미지 위를 드래그합니다.
3. 조각 저장을 누릅니다.
4. 잘라낸 이미지를 클릭합니다.
5. 대필판을 템플릿에서 업로드합니다.
6. 라벨 탭에서 글꼴과 색상을 선택합니다.
7. 내보내기로 결과를 저장합니다.

작업 내용은 자동으로 저장됩니다.
사이드바의 프로젝트를 클릭하면 다시 불러올 수 있습니다.`
          );
        }
      );

    $("#mobileMenuBtn")
      ?.addEventListener(
        "click",
        () => {
          $("#sidebar")
            ?.classList.toggle(
              "open"
            );
        }
      );
  }

  function resetButton() {
    $("#resetBtn")
      ?.addEventListener(
        "click",
        () => {
          if (
            confirm(
              "현재 프로젝트를 초기화할까요?"
            )
          ) {
            resetCurrentProject();
          }
        }
      );
  }

  function goHome() {
    $("#app")
      ?.classList.add("hidden");

    $("#landing")
      ?.classList.remove("hidden");
  }

  function resetCurrentProject() {
    state.image = null;
    state.imageData = null;

    state.crop = null;
    state.cropNorm = null;

    state.pieces = [];
    state.objects = [];

    state.selectedObject = null;

    state.projectName =
      "새 대필 작업";

    state.projectId = makeId();

    updateProjectNameUI();

    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }

    if (emptyState) {
      emptyState.classList.remove(
        "hidden"
      );
    }

    if (overlayBar) {
      overlayBar.classList.add(
        "hidden"
      );
    }

    renderPieces();
    renderBoard();
    renderProjectList();

    saveLocalProject();

    setStatus(
      "새 프로젝트"
    );
  }

  /* ================================
     EXPORT
  ================================= */

  function exportBoard() {
    if (!boardCanvas) {
      alert(
        "먼저 대필판을 선택해주세요."
      );
      return;
    }

    const link =
      document.createElement("a");

    link.download =
      `${state.projectName || "iris"}-result.png`;

    link.href =
      boardCanvas.toDataURL(
        "image/png"
      );

    link.click();

    setStatus(
      "내보내기 완료"
    );
  }

  function setupExport() {
    $("#exportBtn")
      ?.addEventListener(
        "click",
        exportBoard
      );

    $("#mobileExport")
      ?.addEventListener(
        "click",
        exportBoard
      );
  }

  /* ================================
     CROP BUTTONS
  ================================= */

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

    $("#selectAllBtn")
      ?.addEventListener(
        "click",
        cropCurrentPiece
      );

    $("#clearSelBtn")
      ?.addEventListener(
        "click",
        () => {
          state.crop = null;
          state.cropNorm = null;

          drawCanvas();

          setStatus(
            "선택 해제"
          );

          scheduleSave();
        }
      );
  }

  /* ================================
     DRAG DROP
  ================================= */

  function setupDragDrop() {
    const holder =
      $("#canvasHolder");

    if (!holder) return;

    holder.addEventListener(
      "dragover",
      (e) => {
        e.preventDefault();
      }
    );

    holder.addEventListener(
      "drop",
      async (e) => {
        e.preventDefault();

        const file =
          e.dataTransfer.files?.[0];

        if (
          !file ||
          !file.type.startsWith(
            "image/"
          )
        ) {
          return;
        }

        try {
          const img =
            await loadImage(file);

          const reader =
            new FileReader();

          reader.onload = () => {
            setMainImage(
              img,
              reader.result,
              file.name
            );
          };

          reader.readAsDataURL(file);
        } catch {
          alert(
            "이미지를 불러오지 못했습니다."
          );
        }
      }
    );
  }

  /* ================================
     DATABASE INIT
  ================================= */

  async function initDatabase() {
    if (!supabaseClient) {
      renderProjectList();
      return;
    }

    /*
      기존 로그인 세션 확인
    */
    await getSession();

    /*
      로그인 UI가 없는 현재 구조에서는
      익명 사용자 세션을 사용
    */
    if (!currentUser) {
      await ensureUser();
    }

    if (currentUser) {
      await loadTemplatesFromDB();
      await loadProjects();

      setStatus("DB 연결됨");
    } else {
      renderProjectList();

      setStatus(
        "로컬 저장 모드"
      );
    }

    supabaseClient.auth
      .onAuthStateChange(
        (_event, session) => {
          setTimeout(
            async () => {
              currentUser =
                session?.user ||
                null;

              if (currentUser) {
                await loadTemplatesFromDB();
                await loadProjects();
              }
            },
            0
          );
        }
      );
  }

  /* ================================
     LAST PROJECT
  ================================= */

  async function loadLastProject() {
    let latest = null;

    if (
      supabaseClient &&
      currentUser
    ) {
      try {
        const { data } =
          await supabaseClient
            .from("projects")
            .select("*")
            .eq(
              "user_id",
              currentUser.id
            )
            .order(
              "updated_at",
              {
                ascending: false
              }
            )
            .limit(1);

        latest =
          data?.[0] ||
          null;
      } catch {}
    }

    if (!latest) {
      const local =
        getLocalProjectIndex();

      latest =
        local?.[0] ||
        null;
    }

    if (latest) {
      await restoreProject(
        latest
      );
    }
  }

  /* ================================
     RESIZE
  ================================= */

  window.addEventListener(
    "resize",
    () => {
      if (state.image) {
        fitCanvas();
      }
    }
  );

  /* ================================
     BEFORE UNLOAD
  ================================= */

  window.addEventListener(
    "beforeunload",
    () => {
      saveLocalProject();
    }
  );

  /* ================================
     INIT
  ================================= */

  async function init() {
    setupFileInput();
    setupUploadButtons();
    setupCropButtons();
    setupTabs();
    setupLabel();
    setupGrid();
    setupTemplateUpload();
    setupTemplateSave();
    setupNavigation();
    setupExport();
    setupDragDrop();

    renderPieces();
    renderTemplates();

    await initDatabase();
    await loadLastProject();
  }

  function setupTemplateSave() {
    $("#saveTemplateBtn")
      ?.addEventListener(
        "click",
        saveTemplateToDB
      );
  }

  init();

})();
