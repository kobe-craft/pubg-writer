"use strict";

/*
 * =====================================================
 * Iris — PUBG Writer
 * Vesper1.0
 * =====================================================
 */


/* =====================================================
   HELPERS
===================================================== */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) =>
  document.querySelectorAll(selector);


function clamp(value, min, max) {
  return Math.min(
    max,
    Math.max(min, value)
  );
}


/* =====================================================
   STATE
===================================================== */

const state = {

  image: null,

  cols: 3,
  rows: 3,

  offX: 0,
  offY: 0,

  cells: [],

  selected: new Set(),

  labels: new Map(),

  labelColor: "#171716",

  labelSize: 24,

  outline: true,

  templates: [],

  workName: "새 대필 작업"

};


/* =====================================================
   DOM
===================================================== */

const landing =
  $("#landing");

const app =
  $("#app");

const startBtn =
  $("#startBtn");

const brandHome =
  $("#brandHome");

const sideBrand =
  $("#sideBrand");

const fileInput =
  $("#fileInput");

const emptyState =
  $("#emptyState");

const emptyUploadBtn =
  $("#emptyUploadBtn");

const uploadTopBtn =
  $("#uploadTopBtn");

const canvasHolder =
  $("#canvasHolder");

const canvas =
  $("#mainCanvas");

const overlayBar =
  $("#overlayBar");

const selectAllBtn =
  $("#selectAllBtn");

const clearSelBtn =
  $("#clearSelBtn");

const selCount =
  $("#selCount");

const totalCount =
  $("#totalCount");

const cropHint =
  $("#cropHint");

const cropStrip =
  $("#cropStrip");

const colsInput =
  $("#colsInput");

const rowsInput =
  $("#rowsInput");

const offXSlider =
  $("#offXSlider");

const offYSlider =
  $("#offYSlider");

const offXValue =
  $("#offXValue");

const offYValue =
  $("#offYValue");

const labelText =
  $("#labelText");

const fontSizeSlider =
  $("#fontSizeSlider");

const fontSizeValue =
  $("#fontSizeValue");

const outlineToggle =
  $("#outlineToggle");

const applyLabelBtn =
  $("#applyLabelBtn");

const templateName =
  $("#templateName");

const saveTemplateBtn =
  $("#saveTemplateBtn");

const templateList =
  $("#templateList");

const resetBtn =
  $("#resetBtn");

const exportBtn =
  $("#exportBtn");

const newProjectBtn =
  $("#newProjectBtn");

const mobileNewProject =
  $("#mobileNewProject");

const mobileExport =
  $("#mobileExport");

const mobileMenuBtn =
  $("#mobileMenuBtn");

const sidebar =
  $("#sidebar");

const saveStatus =
  $("#saveStatus");

const sidebarProjectName =
  $("#sidebarProjectName");


/* =====================================================
   LANDING
===================================================== */

function startWriter() {

  landing.classList.add("hidden");

  app.classList.remove("hidden");

  window.scrollTo(0, 0);

}


startBtn.addEventListener(
  "click",
  startWriter
);


brandHome.addEventListener(
  "click",
  () => {

    app.classList.add("hidden");

    landing.classList.remove("hidden");

  }
);


sideBrand.addEventListener(
  "click",
  () => {

    app.classList.add("hidden");

    landing.classList.remove("hidden");

  }
);


/* =====================================================
   FILE PICKER
===================================================== */

function openFilePicker() {

  fileInput.click();

}


emptyUploadBtn.addEventListener(
  "click",
  openFilePicker
);


uploadTopBtn.addEventListener(
  "click",
  openFilePicker
);


fileInput.addEventListener(
  "change",
  () => {

    const file =
      fileInput.files &&
      fileInput.files[0];

    if (!file) {
      return;
    }

    loadImage(file);

  }
);


/* =====================================================
   LOAD IMAGE
===================================================== */

function loadImage(file) {

  if (!file.type.startsWith("image/")) {

    alert(
      "이미지 파일만 사용할 수 있습니다."
    );

    return;
  }


  const reader =
    new FileReader();


  reader.onload =
    (event) => {

      const img =
        new Image();


      img.onload =
        () => {

          state.image =
            img;

          state.selected.clear();

          state.labels.clear();


          emptyState.classList.add(
            "hidden"
          );

          overlayBar.classList.remove(
            "hidden"
          );


          buildGrid();

          setStatus(
            "이미지 불러옴"
          );

        };


      img.onerror =
        () => {

          alert(
            "이미지를 불러오지 못했습니다."
          );

        };


      img.src =
        event.target.result;

    };


  reader.onerror =
    () => {

      alert(
        "파일을 읽지 못했습니다."
      );

    };


  reader.readAsDataURL(file);

}


/* =====================================================
   DRAG & DROP
===================================================== */

canvasHolder.addEventListener(
  "dragover",
  (event) => {

    event.preventDefault();

    canvasHolder.classList.add(
      "dragging"
    );

  }
);


canvasHolder.addEventListener(
  "dragleave",
  () => {

    canvasHolder.classList.remove(
      "dragging"
    );

  }
);


canvasHolder.addEventListener(
  "drop",
  (event) => {

    event.preventDefault();

    canvasHolder.classList.remove(
      "dragging"
    );


    const file =
      event.dataTransfer.files &&
      event.dataTransfer.files[0];


    if (file) {
      loadImage(file);
    }

  }
);


/* =====================================================
   BUILD GRID
===================================================== */

function buildGrid() {

  state.cells = [];


  if (!state.image) {
    return;
  }


  const width =
    state.image.naturalWidth ||
    state.image.width;


  const height =
    state.image.naturalHeight ||
    state.image.height;


  const cellWidth =
    width / state.cols;


  const cellHeight =
    height / state.rows;


  let index = 0;


  for (
    let row = 0;
    row < state.rows;
    row++
  ) {

    for (
      let col = 0;
      col < state.cols;
      col++
    ) {

      state.cells.push({

        index,

        row,

        col,

        x:
          col * cellWidth,

        y:
          row * cellHeight,

        width:
          cellWidth,

        height:
          cellHeight

      });


      index++;

    }

  }


  state.selected =
    new Set(
      [...state.selected]
        .filter(
          (index) =>
            index >= 0 &&
            index < state.cells.length
        )
    );


  resizeCanvas();

  updateUI();

}


/* =====================================================
   RESIZE CANVAS
===================================================== */

function resizeCanvas() {

  if (!state.image) {
    return;
  }


  const maxWidth =
    Math.max(
      280,
      canvasHolder.clientWidth - 30
    );


  const maxHeight =
    620;


  const imageWidth =
    state.image.naturalWidth ||
    state.image.width;


  const imageHeight =
    state.image.naturalHeight ||
    state.image.height;


  const ratio =
    Math.min(
      maxWidth / imageWidth,
      maxHeight / imageHeight,
      1
    );


  canvas.width =
    imageWidth;


  canvas.height =
    imageHeight;


  canvas.style.width =
    `${Math.round(
      imageWidth * ratio
    )}px`;


  canvas.style.height =
    `${Math.round(
      imageHeight * ratio
    )}px`;


  drawCanvas();

}


window.addEventListener(
  "resize",
  resizeCanvas
);


/* =====================================================
   DRAW CANVAS
===================================================== */

function drawCanvas() {

  if (!state.image) {
    return;
  }


  const ctx =
    canvas.getContext("2d");


  const width =
    canvas.width;


  const height =
    canvas.height;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  ctx.drawImage(
    state.image,
    0,
    0,
    width,
    height
  );


  /*
   * Selected cells
   */

  state.cells.forEach(
    (cell) => {

      if (
        !state.selected.has(
          cell.index
        )
      ) {
        return;
      }


      ctx.fillStyle =
        "rgba(217,121,80,.20)";


      ctx.fillRect(
        cell.x,
        cell.y,
        cell.width,
        cell.height
      );


      ctx.strokeStyle =
        "#d97950";


      ctx.lineWidth =
        Math.max(
          3,
          width / 500
        );


      ctx.strokeRect(
        cell.x,
        cell.y,
        cell.width,
        cell.height
      );

    }
  );


  /*
   * Grid
   */

  ctx.strokeStyle =
    "rgba(255,255,255,.9)";


  ctx.lineWidth =
    Math.max(
      1,
      width / 900
    );


  state.cells.forEach(
    (cell) => {

      ctx.strokeRect(
        cell.x,
        cell.y,
        cell.width,
        cell.height
      );

    }
  );


  /*
   * Cell numbers
   */

  const numberSize =
    Math.max(
      12,
      Math.min(
        width,
        height
      ) / 35
    );


  ctx.font =
    `600 ${numberSize}px DM Sans`;


  ctx.textAlign =
    "center";


  ctx.textBaseline =
    "middle";


  state.cells.forEach(
    (cell) => {

      const cx =
        cell.x +
        cell.width / 2;


      const cy =
        cell.y +
        cell.height / 2;


      ctx.fillStyle =
        "rgba(20,19,18,.75)";


      ctx.beginPath();


      ctx.arc(
        cx,
        cy,
        numberSize * 0.8,
        0,
        Math.PI * 2
      );


      ctx.fill();


      ctx.fillStyle =
        "#fff";


      ctx.fillText(
        String(cell.index + 1),
        cx,
        cy
      );

    }
  );

}


/* =====================================================
   CANVAS CLICK
===================================================== */

canvas.addEventListener(
  "click",
  (event) => {

    if (!state.image) {
      return;
    }


    const rect =
      canvas.getBoundingClientRect();


    const scaleX =
      canvas.width /
      rect.width;


    const scaleY =
      canvas.height /
      rect.height;


    const x =
      (event.clientX -
        rect.left) *
      scaleX;


    const y =
      (event.clientY -
        rect.top) *
      scaleY;


    const cell =
      state.cells.find(
        (item) => {

          return (
            x >= item.x &&
            x <=
              item.x +
              item.width &&

            y >= item.y &&
            y <=
              item.y +
              item.height
          );

        }
      );


    if (!cell) {
      return;
    }


    if (
      state.selected.has(
        cell.index
      )
    ) {

      state.selected.delete(
        cell.index
      );

    } else {

      state.selected.add(
        cell.index
      );

    }


    updateUI();

    drawCanvas();

    setStatus(
      "변경사항 저장됨"
    );

  }
);


/* =====================================================
   SELECT ALL
===================================================== */

selectAllBtn.addEventListener(
  "click",
  () => {

    state.selected.clear();


    state.cells.forEach(
      (cell) => {

        state.selected.add(
          cell.index
        );

      }
    );


    updateUI();

    drawCanvas();

  }
);


/* =====================================================
   CLEAR SELECTION
===================================================== */

clearSelBtn.addEventListener(
  "click",
  () => {

    state.selected.clear();

    updateUI();

    drawCanvas();

  }
);


/* =====================================================
   UI
===================================================== */

function updateUI() {

  const selectedCount =
    state.selected.size;


  const total =
    state.cells.length;


  selCount.textContent =
    selectedCount;


  totalCount.textContent =
    `${total}개`;


  if (
    selectedCount === 0
  ) {

    cropHint.textContent =
      "격자에서 칸을 선택하면 결과가 표시됩니다.";

  } else {

    cropHint.textContent =
      `${selectedCount}개의 영역이 선택되었습니다.`;

  }


  renderCrops();

}


/* =====================================================
   QUICK GRID
===================================================== */

$$("[data-grid]").forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        const values =
          button.dataset.grid
            .split("x");


        state.cols =
          Number(values[0]);


        state.rows =
          Number(values[1]);


        colsInput.value =
          state.cols;


        rowsInput.value =
          state.rows;


        state.selected.clear();


        buildGrid();


        setStatus(
          "격자 변경됨"
        );

      }
    );

  }
);


/* =====================================================
   GRID INPUT
===================================================== */

function applyGridInputs() {

  let cols =
    parseInt(
      colsInput.value,
      10
    );


  let rows =
    parseInt(
      rowsInput.value,
      10
    );


  if (!Number.isFinite(cols)) {
    cols = 3;
  }


  if (!Number.isFinite(rows)) {
    rows = 3;
  }


  cols =
    clamp(
      cols,
      1,
      10
    );


  rows =
    clamp(
      rows,
      1,
      10
    );


  state.cols =
    cols;


  state.rows =
    rows;


  colsInput.value =
    cols;


  rowsInput.value =
    rows;


  state.selected.clear();


  buildGrid();


  setStatus(
    "격자 변경됨"
  );

}


colsInput.addEventListener(
  "change",
  applyGridInputs
);


rowsInput.addEventListener(
  "change",
  applyGridInputs
);


/* =====================================================
   OFFSET
===================================================== */

offXSlider.addEventListener(
  "input",
  () => {

    state.offX =
      Number(
        offXSlider.value
      );


    offXValue.textContent =
      state.offX;


    updateOffsets();

  }
);


offYSlider.addEventListener(
  "input",
  () => {

    state.offY =
      Number(
        offYSlider.value
      );


    offYValue.textContent =
      state.offY;


    updateOffsets();

  }
);


function updateOffsets() {

  if (!state.image) {
    return;
  }


  const width =
    state.image.naturalWidth ||
    state.image.width;


  const height =
    state.image.naturalHeight ||
    state.image.height;


  const cellWidth =
    width / state.cols;


  const cellHeight =
    height / state.rows;


  state.cells.forEach(
    (cell) => {

      cell.x =
        cell.col *
          cellWidth +
        state.offX;


      cell.y =
        cell.row *
          cellHeight +
        state.offY;

    }
  );


  drawCanvas();

  renderCrops();

}


/* =====================================================
   CROPS
===================================================== */

function renderCrops() {

  cropStrip.innerHTML = "";


  if (
    !state.image ||
    state.selected.size === 0
  ) {
    return;
  }


  const selected =
    [...state.selected]
      .sort(
        (a, b) => a - b
      );


  selected.forEach(
    (index) => {

      const cell =
        state.cells[index];


      if (!cell) {
        return;
      }


      const item =
        document.createElement(
          "div"
        );


      item.className =
        "crop-item";


      const image =
        document.createElement(
          "img"
        );


      image.src =
        createCropDataURL(
          cell
        );


      image.alt =
        `선택된 칸 ${index + 1}`;


      const number =
        document.createElement(
          "span"
        );


      number.className =
        "crop-number";


      number.textContent =
        index + 1;


      item.appendChild(
        image
      );


      item.appendChild(
        number
      );


      cropStrip.appendChild(
        item
      );

    }
  );

}


/* =====================================================
   CROP DATA
===================================================== */

function createCropDataURL(
  cell
) {

  const output =
    document.createElement(
      "canvas"
    );


  const width =
    Math.max(
      1,
      Math.round(
        cell.width
      )
    );


  const height =
    Math.max(
      1,
      Math.round(
        cell.height
      )
    );


  output.width =
    width;


  output.height =
    height;


  const ctx =
    output.getContext("2d");


  ctx.drawImage(

    state.image,

    cell.x,
    cell.y,

    cell.width,
    cell.height,

    0,
    0,

    width,
    height

  );


  return output.toDataURL(
    "image/png"
  );

}


/* =====================================================
   LABEL COLORS
===================================================== */

$$(".color").forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        $$(".color").forEach(
          (item) => {

            item.classList.remove(
              "active"
            );

          }
        );


        button.classList.add(
          "active"
        );


        state.labelColor =
          button.dataset.color;

      }
    );

  }
);


/* =====================================================
   LABEL SIZE
===================================================== */

fontSizeSlider.addEventListener(
  "input",
  () => {

    state.labelSize =
      Number(
        fontSizeSlider.value
      );


    fontSizeValue.textContent =
      `${state.labelSize}px`;

  }
);


/* =====================================================
   OUTLINE
===================================================== */

outlineToggle.addEventListener(
  "change",
  () => {

    state.outline =
      outlineToggle.checked;

  }
);


/* =====================================================
   APPLY LABEL
===================================================== */

applyLabelBtn.addEventListener(
  "click",
  () => {

    const text =
      labelText.value.trim();


    if (!text) {

      alert(
        "라벨 텍스트를 입력해주세요."
      );

      return;
    }


    if (
      state.selected.size === 0
    ) {

      alert(
        "먼저 라벨을 적용할 칸을 선택해주세요."
      );

      return;
    }


    state.selected.forEach(
      (index) => {

        state.labels.set(
          index,
          {

            text,

            color:
              state.labelColor,

            size:
              state.labelSize,

            outline:
              state.outline

          }
        );

      }
    );


    setStatus(
      "라벨 적용됨"
    );

  }
);


/* =====================================================
   TABS
===================================================== */

$$(".tab").forEach(
  (tab) => {

    tab.addEventListener(
      "click",
      () => {

        const target =
          tab.dataset.tab;


        $$(".tab").forEach(
          (item) => {

            item.classList.remove(
              "active"
            );

          }
        );


        $$(".tab-content").forEach(
          (item) => {

            item.classList.remove(
              "active"
            );

          }
        );


        tab.classList.add(
          "active"
        );


        const content =
          $(`#tab-${target}`);


        if (content) {

          content.classList.add(
            "active"
          );

        }

      }
    );

  }
);


/* =====================================================
   TEMPLATES
===================================================== */

const TEMPLATE_KEY =
  "iris-pubg-writer-templates";


function loadTemplates() {

  try {

    const saved =
      localStorage.getItem(
        TEMPLATE_KEY
      );


    if (!saved) {
      return;
    }


    const parsed =
      JSON.parse(saved);


    if (
      Array.isArray(parsed)
    ) {

      state.templates =
        parsed;

    }

  } catch (error) {

    console.warn(
      "템플릿 불러오기 실패:",
      error
    );


    state.templates = [];

  }


  renderTemplates();

}


function saveTemplates() {

  try {

    localStorage.setItem(
      TEMPLATE_KEY,
      JSON.stringify(
        state.templates
      )
    );

  } catch (error) {

    console.warn(
      "템플릿 저장 실패:",
      error
    );

  }

}


saveTemplateBtn.addEventListener(
  "click",
  () => {

    const name =
      templateName.value.trim();


    if (!name) {

      alert(
        "템플릿 이름을 입력해주세요."
      );

      return;
    }


    const template = {

      id:
        Date.now(),

      name,

      cols:
        state.cols,

      rows:
        state.rows,

      offX:
        state.offX,

      offY:
        state.offY,

      labelColor:
        state.labelColor,

      labelSize:
        state.labelSize,

      outline:
        state.outline

    };


    state.templates.unshift(
      template
    );


    saveTemplates();

    renderTemplates();


    templateName.value =
      "";


    setStatus(
      "템플릿 저장됨"
    );

  }
);


/* =====================================================
   RENDER TEMPLATES
===================================================== */

function renderTemplates() {

  templateList.innerHTML =
    "";


  if (
    state.templates.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "template-empty";


    empty.textContent =
      "저장된 템플릿이 없습니다.";


    templateList.appendChild(
      empty
    );


    return;
  }


  state.templates.forEach(
    (template) => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "template-item";


      const info =
        document.createElement(
          "div"
        );


      const title =
        document.createElement(
          "strong"
        );


      title.textContent =
        template.name;


      const sub =
        document.createElement(
          "small"
        );


      sub.textContent =
        `${template.cols} × ${template.rows}`;


      info.appendChild(
        title
      );


      info.appendChild(
        sub
      );


      const use =
        document.createElement(
          "button"
        );


      use.type =
        "button";


      use.className =
        "template-use";


      use.textContent =
        "사용";


      use.addEventListener(
        "click",
        () => {

          applyTemplate(
            template
          );

        }
      );


      item.appendChild(
        info
      );


      item.appendChild(
        use
      );


      templateList.appendChild(
        item
      );

    }
  );

}


/* =====================================================
   APPLY TEMPLATE
===================================================== */

function applyTemplate(
  template
) {

  state.cols =
    template.cols;


  state.rows =
    template.rows;


  state.offX =
    template.offX || 0;


  state.offY =
    template.offY || 0;


  state.labelColor =
    template.labelColor ||
    "#171716";


  state.labelSize =
    template.labelSize ||
    24;


  state.outline =
    template.outline !== false;


  colsInput.value =
    state.cols;


  rowsInput.value =
    state.rows;


  offXSlider.value =
    state.offX;


  offYSlider.value =
    state.offY;


  offXValue.textContent =
    state.offX;


  offYValue.textContent =
    state.offY;


  fontSizeSlider.value =
    state.labelSize;


  fontSizeValue.textContent =
    `${state.labelSize}px`;


  outlineToggle.checked =
    state.outline;


  state.selected.clear();


  buildGrid();


  setStatus(
    "템플릿 적용됨"
  );

}


/* =====================================================
   EXPORT
===================================================== */

exportBtn.addEventListener(
  "click",
  exportSelected
);


mobileExport.addEventListener(
  "click",
  exportSelected
);


function exportSelected() {

  if (!state.image) {

    alert(
      "먼저 이미지를 업로드해주세요."
    );

    return;
  }


  if (
    state.selected.size === 0
  ) {

    alert(
      "내보낼 칸을 하나 이상 선택해주세요."
    );

    return;
  }


  const selected =
    [...state.selected]
      .sort(
        (a, b) => a - b
      );


  selected.forEach(
    (index, order) => {

      const cell =
        state.cells[index];


      if (!cell) {
        return;
      }


      const output =
        document.createElement(
          "canvas"
        );


      output.width =
        Math.max(
          1,
          Math.round(
            cell.width
          )
        );


      output.height =
        Math.max(
          1,
          Math.round(
            cell.height
          )
        );


      const ctx =
        output.getContext(
          "2d"
        );


      ctx.drawImage(

        state.image,

        cell.x,
        cell.y,

        cell.width,
        cell.height,

        0,
        0,

        output.width,
        output.height

      );


      const label =
        state.labels.get(
          index
        );


      if (label) {

        drawLabel(
          ctx,
          label,
          output.width,
          output.height
        );

      }


      const link =
        document.createElement(
          "a"
        );


      link.download =
        `iris-writer-${String(
          order + 1
        ).padStart(
          2,
          "0"
        )}.png`;


      link.href =
        output.toDataURL(
          "image/png"
        );


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();

    }
  );


  setStatus(
    "내보내기 완료"
  );

}


/* =====================================================
   DRAW LABEL
===================================================== */

function drawLabel(
  ctx,
  label,
  width,
  height
) {

  const size =
    Math.min(
      label.size,
      Math.max(
        12,
        width / 8
      )
    );


  ctx.font =
    `600 ${size}px DM Sans`;


  ctx.textAlign =
    "center";


  ctx.textBaseline =
    "middle";


  const x =
    width / 2;


  const y =
    height / 2;


  if (label.outline) {

    ctx.strokeStyle =
      label.color === "#ffffff"
        ? "#171716"
        : "#ffffff";


    ctx.lineWidth =
      Math.max(
        3,
        size / 7
      );


    ctx.strokeText(
      label.text,
      x,
      y
    );

  }


  ctx.fillStyle =
    label.color;


  ctx.fillText(
    label.text,
    x,
    y
  );

}


/* =====================================================
   RESET
===================================================== */

resetBtn.addEventListener(
  "click",
  resetProject
);


function resetProject() {

  const confirmed =
    confirm(
      "현재 작업을 초기화할까요?"
    );


  if (!confirmed) {
    return;
  }


  state.image =
    null;


  state.cols =
    3;


  state.rows =
    3;


  state.offX =
    0;


  state.offY =
    0;


  state.cells =
    [];


  state.selected.clear();

  state.labels.clear();


  colsInput.value =
    3;


  rowsInput.value =
    3;


  offXSlider.value =
    0;


  offYSlider.value =
    0;


  offXValue.textContent =
    "0";


  offYValue.textContent =
    "0";


  cropStrip.innerHTML =
    "";


  cropHint.textContent =
    "격자에서 칸을 선택하면 결과가 표시됩니다.";


  totalCount.textContent =
    "0개";


  selCount.textContent =
    "0";


  canvas.width =
    300;


  canvas.height =
    150;


  canvas.style.width =
    "";


  canvas.style.height =
    "";


  canvas
    .getContext("2d")
    .clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


  emptyState.classList.remove(
    "hidden"
  );


  overlayBar.classList.add(
    "hidden"
  );


  fileInput.value =
    "";


  setStatus(
    "초기화됨"
  );

}


newProjectBtn.addEventListener(
  "click",
  resetProject
);


mobileNewProject.addEventListener(
  "click",
  resetProject
);


/* =====================================================
   MOBILE SIDEBAR
===================================================== */

mobileMenuBtn.addEventListener(
  "click",
  () => {

    sidebar.classList.toggle(
      "open"
    );

  }
);


document.addEventListener(
  "click",
  (event) => {

    if (
      !sidebar.classList.contains(
        "open"
      )
    ) {
      return;
    }


    if (
      !sidebar.contains(
        event.target
      ) &&
      event.target !==
        mobileMenuBtn
    ) {

      sidebar.classList.remove(
        "open"
      );

    }

  }
);


/* =====================================================
   HELP
===================================================== */

$("#helpBtn").addEventListener(
  "click",
  () => {

    alert(
`Iris — PUBG Writer

1. 이미지를 업로드합니다.
2. 격자를 설정합니다.
3. 원하는 칸을 클릭합니다.
4. 라벨을 추가할 수 있습니다.
5. 내보내기를 누르면 PNG로 저장됩니다.

Vesper1.0`
    );

  }
);


/* =====================================================
   SETTINGS
===================================================== */

$("#settingsBtn").addEventListener(
  "click",
  () => {

    const settings =
      document.querySelector(
        ".settings"
      );


    if (settings) {

      settings.scrollIntoView({
        behavior: "smooth"
      });

    }

  }
);


/* =====================================================
   KEYBOARD
===================================================== */

document.addEventListener(
  "keydown",
  (event) => {

    if (
      (event.ctrlKey ||
        event.metaKey) &&
      event.key.toLowerCase() === "o"
    ) {

      event.preventDefault();

      openFilePicker();

    }


    if (
      event.key === "Escape"
    ) {

      sidebar.classList.remove(
        "open"
      );

    }

  }
);


/* =====================================================
   STATUS
===================================================== */

let statusTimer = null;


function setStatus(text) {

  saveStatus.textContent =
    text;


  clearTimeout(
    statusTimer
  );


  statusTimer =
    setTimeout(
      () => {

        saveStatus.textContent =
          "저장됨";

      },
      1800
    );

}


/* =====================================================
   INIT
===================================================== */

loadTemplates();


canvas.width =
  300;


canvas.height =
  150;


totalCount.textContent =
  "0개";


selCount.textContent =
  "0";


sidebarProjectName.textContent =
  state.workName;


console.log(
  "Iris PUBG Writer Vesper1.0 initialized."
);
