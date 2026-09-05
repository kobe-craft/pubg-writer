/* =====================================================
   PUBG WRITER
   Grid / Crop / Label / Template
===================================================== */


/* =====================================================
   HELPERS
===================================================== */

const $ = id => document.getElementById(id);


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

    templates: []

};


/* =====================================================
   LANDING → APP
===================================================== */

function startWriter() {

    const landing =
        $("landingPage");

    const app =
        $("appPage");

    if (!landing || !app) {
        return;
    }


    landing.classList.add("leaving");


    setTimeout(() => {

        landing.classList.add("hidden");

        app.classList.remove("hidden");


        requestAnimationFrame(() => {

            app.classList.add("visible");

        });


        window.scrollTo(
            0,
            0
        );

    }, 420);
}


/* =====================================================
   APP → LANDING
===================================================== */

function showLanding() {

    const landing =
        $("landingPage");

    const app =
        $("appPage");

    if (!landing || !app) {
        return;
    }


    app.classList.remove(
        "visible"
    );


    setTimeout(() => {

        app.classList.add(
            "hidden"
        );


        landing.classList.remove(
            "hidden",
            "leaving"
        );


        window.scrollTo(
            0,
            0
        );

    }, 350);
}


/* =====================================================
   FILE
===================================================== */

function openFile() {

    $("fileInput").click();

}


$("filePickBtn").onclick =
    openFile;


$("emptyUpload").onclick =
    openFile;


/* =====================================================
   IMAGE LOAD
===================================================== */

$("fileInput").onchange = event => {

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }


    const image =
        new Image();


    image.onload = () => {

        state.image =
            image;


        $("emptyState")
            .classList
            .add("hidden");


        $("mainCanvas")
            .style
            .display =
            "block";


        render();

    };


    image.src =
        URL.createObjectURL(file);

};


/* =====================================================
   RENDER
===================================================== */

function render() {

    const canvas =
        $("mainCanvas");

    const ctx =
        canvas.getContext("2d");


    if (!state.image) {
        return;
    }


    const image =
        state.image;


    const W =
        image.naturalWidth;

    const H =
        image.naturalHeight;


    canvas.width =
        W;

    canvas.height =
        H;


    ctx.clearRect(
        0,
        0,
        W,
        H
    );


    ctx.drawImage(
        image,
        0,
        0,
        W,
        H
    );


    state.cells = [];


    const cellWidth =
        W / state.cols;

    const cellHeight =
        H / state.rows;


    /*
     * GRID
     */

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

            const index =
                row * state.cols + col;


            const x =
                col * cellWidth
                +
                state.offX *
                (cellWidth / 100);


            const y =
                row * cellHeight
                +
                state.offY *
                (cellHeight / 100);


            const cell = {

                i: index,

                r: row,

                col: col,

                x: x,

                y: y,

                w: cellWidth,

                h: cellHeight

            };


            state.cells.push(
                cell
            );


            /*
             * SELECTED BACKGROUND
             */

            if (
                state.selected.has(index)
            ) {

                ctx.fillStyle =
                    "rgba(217,119,69,.14)";

                ctx.fillRect(
                    x,
                    y,
                    cellWidth,
                    cellHeight
                );
            }


            /*
             * GRID BORDER
             */

            ctx.save();


            ctx.strokeStyle =
                state.selected.has(index)
                    ? "#d97745"
                    : "rgba(37,35,31,.35)";


            ctx.lineWidth =
                state.selected.has(index)
                    ? Math.max(
                        3,
                        W / 500
                    )
                    : Math.max(
                        1,
                        W / 1200
                    );


            ctx.strokeRect(
                x,
                y,
                cellWidth,
                cellHeight
            );


            ctx.restore();


            /*
             * LABEL
             */

            const label =
                state.labels.get(index);


            if (label) {

                ctx.save();


                ctx.font =
                    `700 ${label.size}px Inter, sans-serif`;


                ctx.textAlign =
                    "center";


                ctx.textBaseline =
                    "middle";


                if (label.outline) {

                    ctx.strokeStyle =
                        label.color === "#ffffff"
                            ? "#171716"
                            : "#ffffff";


                    ctx.lineWidth =
                        Math.max(
                            3,
                            label.size * .14
                        );


                    ctx.strokeText(

                        label.text,

                        x +
                            cellWidth / 2,

                        y +
                            cellHeight / 2

                    );
                }


                ctx.fillStyle =
                    label.color;


                ctx.fillText(

                    label.text,

                    x +
                        cellWidth / 2,

                    y +
                        cellHeight / 2

                );


                ctx.restore();
            }
        }
    }


    /*
     * COUNTER
     */

    $("totalCount")
        .textContent =
        state.cells.length;


    $("selCount")
        .textContent =
        state.selected.size;


    /*
     * RESULT
     */

    renderCrops();

}


/* =====================================================
   CROPPED RESULT
===================================================== */

function renderCrops() {

    const strip =
        $("cropStrip");


    strip.innerHTML =
        "";


    if (!state.image) {

        $("cropHint")
            .textContent =
            "이미지를 불러오면 결과가 여기에 표시됩니다.";

        return;
    }


    $("cropHint")
        .textContent =
        state.selected.size
            ? "선택된 칸을 눌러 다시 선택할 수 있습니다."
            : "격자의 칸을 눌러 잘린 이미지를 선택하세요.";


    state.cells.forEach(
        cell => {

            const box =
                document.createElement(
                    "button"
                );


            box.className =
                "crop-item"
                +
                (
                    state.selected.has(
                        cell.i
                    )
                        ? " selected"
                        : ""
                );


            box.title =
                `${cell.i + 1}번`;


            /*
             * CROPPED CANVAS
             */

            const cropCanvas =
                document.createElement(
                    "canvas"
                );


            cropCanvas.width =
                Math.max(
                    1,
                    Math.round(
                        cell.w
                    )
                );


            cropCanvas.height =
                Math.max(
                    1,
                    Math.round(
                        cell.h
                    )
                );


            const cropContext =
                cropCanvas.getContext(
                    "2d"
                );


            cropContext.drawImage(

                state.image,

                cell.x,
                cell.y,

                cell.w,
                cell.h,

                0,
                0,

                cropCanvas.width,
                cropCanvas.height

            );


            const image =
                document.createElement(
                    "img"
                );


            image.src =
                cropCanvas.toDataURL(
                    "image/jpeg",
                    .92
                );


            box.appendChild(
                image
            );


            /*
             * NUMBER
             */

            const number =
                document.createElement(
                    "span"
                );


            number.textContent =
                `${cell.i + 1}번`;


            box.appendChild(
                number
            );


            /*
             * SELECT
             */

            box.onclick =
                () => {

                    toggle(
                        cell.i
                    );

                };


            strip.appendChild(
                box
            );

        }
    );

}


/* =====================================================
   SELECT TOGGLE
===================================================== */

function toggle(index) {

    if (
        state.selected.has(
            index
        )
    ) {

        state.selected.delete(
            index
        );

    } else {

        state.selected.add(
            index
        );

    }


    render();

}


/* =====================================================
   CANVAS INITIAL
===================================================== */

$("mainCanvas")
    .style
    .display =
    "none";


/* =====================================================
   CANVAS CLICK
===================================================== */

$("mainCanvas")
    .addEventListener(
        "click",
        event => {

            if (!state.image) {
                return;
            }


            const canvas =
                $("mainCanvas");


            const rect =
                canvas.getBoundingClientRect();


            const x =
                (
                    event.clientX -
                    rect.left
                )
                *
                canvas.width /
                rect.width;


            const y =
                (
                    event.clientY -
                    rect.top
                )
                *
                canvas.height /
                rect.height;


            const cell =
                state.cells.find(
                    current =>

                        x >= current.x &&

                        x <=
                            current.x +
                            current.w &&

                        y >= current.y &&

                        y <=
                            current.y +
                            current.h
                );


            if (cell) {

                toggle(
                    cell.i
                );

            }

        }
    );


/* =====================================================
   SELECT ALL
===================================================== */

$("selectAllBtn").onclick =
    () => {

        state.selected =
            new Set(
                state.cells.map(
                    cell => cell.i
                )
            );


        render();

    };


/* =====================================================
   CLEAR SELECTION
===================================================== */

$("clearSelBtn").onclick =
    () => {

        state.selected.clear();

        render();

    };


/* =====================================================
   GRID UPDATE
===================================================== */

function gridUpdate() {

    state.cols =
        Math.max(
            1,
            Math.min(
                20,
                +$("colsInput").value || 3
            )
        );


    state.rows =
        Math.max(
            1,
            Math.min(
                20,
                +$("rowsInput").value || 3
            )
        );


    state.selected.clear();


    render();

}


$("colsInput").oninput =
    gridUpdate;


$("rowsInput").oninput =
    gridUpdate;


/* =====================================================
   OFFSET
===================================================== */

$("offXSlider").oninput =
    event => {

        state.offX =
            +event.target.value;


        $("offXValue")
            .value =
            state.offX;


        render();

    };


$("offYSlider").oninput =
    event => {

        state.offY =
            +event.target.value;


        $("offYValue")
            .value =
            state.offY;


        render();

    };


/* =====================================================
   QUICK GRID
===================================================== */

document
    .querySelectorAll(
        ".quick"
    )
    .forEach(
        button => {

            button.onclick =
                () => {

                    const [
                        columns,
                        rows
                    ] =
                        button
                            .dataset
                            .grid
                            .split("x")
                            .map(Number);


                    state.cols =
                        columns;


                    state.rows =
                        rows;


                    $("colsInput")
                        .value =
                        columns;


                    $("rowsInput")
                        .value =
                        rows;


                    document
                        .querySelectorAll(
                            ".quick"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    button
                        .classList
                        .add(
                            "active"
                        );


                    gridUpdate();

                };

        }
    );


/* =====================================================
   MODE
===================================================== */

function setMode(mode) {

    /*
     * DESKTOP
     */

    document
        .querySelectorAll(
            "#modeTabs button"
        )
        .forEach(
            button => {

                button.classList.toggle(

                    "active",

                    button.dataset.mode ===
                    mode

                );

            }
        );


    /*
     * MOBILE
     */

    document
        .querySelectorAll(
            ".mobile-tabs button"
        )
        .forEach(
            button => {

                button.classList.toggle(

                    "active",

                    button.dataset.mode ===
                    mode

                );

            }
        );


    /*
     * PANELS
     */

    [
        "grid",
        "label",
        "template"
    ]
        .forEach(
            panel => {

                $(
                    `${panel}Panel`
                )
                    .classList
                    .toggle(
                        "hidden",
                        panel !== mode
                    );

            }
        );

}


document
    .querySelectorAll(
        "[data-mode]"
    )
    .forEach(
        button => {

            button.onclick =
                () => {

                    setMode(
                        button.dataset.mode
                    );

                };

        }
    );


/* =====================================================
   LABEL
===================================================== */

$("labelText").oninput =
    event => {

        state.labelText =
            event.target.value;

    };


/* =====================================================
   LABEL COLOR
===================================================== */

document
    .querySelectorAll(
        ".color"
    )
    .forEach(
        button => {

            button.onclick =
                () => {

                    state.labelColor =
                        button.dataset.color;


                    document
                        .querySelectorAll(
                            ".color"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    button
                        .classList
                        .add(
                            "active"
                        );


                    render();

                };

        }
    );


/* =====================================================
   LABEL SIZE
===================================================== */

$("fontSizeSlider").oninput =
    event => {

        state.labelSize =
            +event.target.value;


        $("fontSizeValue")
            .textContent =
            state.labelSize;


        render();

    };


/* =====================================================
   OUTLINE
===================================================== */

$("outlineToggle").onchange =
    event => {

        state.outline =
            event.target.checked;


        render();

    };


/* =====================================================
   APPLY LABEL
===================================================== */

$("applyLabelBtn").onclick =
    () => {

        const text =
            $("labelText")
                .value
                .trim();


        if (!text) {

            alert(
                "라벨 내용을 입력하세요."
            );

            return;
        }


        state.selected.forEach(
            index => {

                state.labels.set(

                    index,

                    {
                        text: text,

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


        render();

    };


/* =====================================================
   TEMPLATE
===================================================== */

function saveTemplate() {

    const name =
        $("templateName")
            .value
            .trim()
        ||
        `템플릿 ${state.templates.length + 1}`;


    const template = {

        name,

        cols:
            state.cols,

        rows:
            state.rows,

        offX:
            state.offX,

        offY:
            state.offY

    };


    state.templates.push(
        template
    );


    localStorage.setItem(

        "pubgWriterTemplates",

        JSON.stringify(
            state.templates
        )

    );


    $("templateName")
        .value =
        "";


    renderTemplates();

}


/* =====================================================
   TEMPLATE LIST
===================================================== */

function renderTemplates() {

    const box =
        $("templateList");


    box.innerHTML =
        "";


    state.templates.forEach(
        (template, index) => {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "template-item";


            const name =
                document.createElement(
                    "span"
                );


            name.textContent =
                template.name;


            const apply =
                document.createElement(
                    "button"
                );


            apply.textContent =
                "적용";


            apply.onclick =
                () => {

                    state.cols =
                        template.cols;

                    state.rows =
                        template.rows;

                    state.offX =
                        template.offX;

                    state.offY =
                        template.offY;


                    $("colsInput")
                        .value =
                        template.cols;

                    $("rowsInput")
                        .value =
                        template.rows;

                    $("offXSlider")
                        .value =
                        template.offX;

                    $("offYSlider")
                        .value =
                        template.offY;


                    $("offXValue")
                        .value =
                        template.offX;

                    $("offYValue")
                        .value =
                        template.offY;


                    state.selected.clear();


                    render();

                };


            element.appendChild(
                name
            );


            element.appendChild(
                apply
            );


            box.appendChild(
                element
            );

        }
    );

}


try {

    state.templates =
        JSON.parse(
            localStorage.getItem(
                "pubgWriterTemplates"
            ) ||
            "[]"
        );

} catch {

    state.templates = [];

}


renderTemplates();


$("saveTemplateBtn").onclick =
    saveTemplate;


/* =====================================================
   RESET
===================================================== */

$("resetBtn").onclick =
    () => {

        state.image =
            null;


        state.selected.clear();


        state.cells = [];


        state.labels.clear();


        $("fileInput")
            .value =
            "";


        $("mainCanvas")
            .style
            .display =
            "none";


        $("emptyState")
            .classList
            .remove(
                "hidden"
            );


        render();

    };


/* =====================================================
   EXPORT
===================================================== */

$("exportBtn").onclick =
    () =>
        exportSelected(
            false
        );


$("downloadSelected").onclick =
    () =>
        exportSelected(
            false
        );


/* =====================================================
   EXPORT FUNCTION
===================================================== */

function exportSelected(
    all = false
) {

    if (!state.image) {

        alert(
            "먼저 이미지를 불러오세요."
        );

        return;
    }


    const ids =
        all

            ? state.cells.map(
                cell => cell.i
            )

            : Array.from(
                state.selected
            );


    if (!ids.length) {

        alert(
            "저장할 칸을 먼저 선택하세요."
        );

        return;
    }


    ids.forEach(
        (id, index) => {

            const cell =
                state.cells[id];


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
                        cell.w
                    )
                );


            output.height =
                Math.max(
                    1,
                    Math.round(
                        cell.h
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

                cell.w,
                cell.h,

                0,
                0,

                output.width,
                output.height

            );


            /*
             * LABEL
             */

            const label =
                state.labels.get(
                    id
                );


            if (label) {

                ctx.save();


                ctx.font =
                    `700 ${label.size}px Inter, sans-serif`;


                ctx.textAlign =
                    "center";


                ctx.textBaseline =
                    "middle";


                const centerX =
                    output.width / 2;

                const centerY =
                    output.height / 2;


                if (label.outline) {

                    ctx.strokeStyle =
                        label.color === "#ffffff"
                            ? "#171716"
                            : "#ffffff";


                    ctx.lineWidth =
                        Math.max(
                            3,
                            label.size * .14
                        );


                    ctx.strokeText(

                        label.text,

                        centerX,

                        centerY

                    );

                }


                ctx.fillStyle =
                    label.color;


                ctx.fillText(

                    label.text,

                    centerX,

                    centerY

                );


                ctx.restore();

            }


            /*
             * DOWNLOAD
             */

            const link =
                document.createElement(
                    "a"
                );


            link.href =
                output.toDataURL(
                    "image/png"
                );


            link.download =
                `pubg-writer-${String(
                    id + 1
                ).padStart(
                    2,
                    "0"
                )}.png`;


            link.click();

        }
    );

}


/* =====================================================
   DRAG & DROP
===================================================== */

$("mainCanvas")
    .addEventListener(
        "dragover",
        event => {

            event.preventDefault();

        }
    );


$("mainCanvas")
    .addEventListener(
        "drop",
        event => {

            event.preventDefault();


            const file =
                event
                    .dataTransfer
                    .files?.[0];


            if (!file) {
                return;
            }


            const image =
                new Image();


            image.onload =
                () => {

                    state.image =
                        image;


                    $("emptyState")
                        .classList
                        .add(
                            "hidden"
                        );


                    $("mainCanvas")
                        .style
                        .display =
                        "block";


                    render();

                };


            image.src =
                URL.createObjectURL(
                    file
                );

        }
    );


/* =====================================================
   KEYBOARD SHORTCUT
===================================================== */

document.addEventListener(
    "keydown",
    event => {

        /*
         * ESC
         */

        if (
            event.key === "Escape"
        ) {

            if (
                !$("appPage")
                    .classList
                    .contains(
                        "hidden"
                    )
            ) {

                showLanding();

            }

        }

    }
);
