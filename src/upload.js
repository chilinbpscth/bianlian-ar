/**
 * Physical mask upload / photo capture → oval-clipped canvases → AR.
 * Eyes/mouth may stay opaque in the photo; AR punches holes at runtime.
 */
import { createDemoMaskDataUrls } from "./demoMasks.js"

const SIZE = 512
const OVAL = { cx: SIZE * 0.5, cy: SIZE * 0.5, rx: SIZE * 0.44, ry: SIZE * 0.48 }
const LABELS = ["一", "二", "三", "四"]
const STORAGE_KEY = "bianlian-physical-masks-v1"

function makeBlankMasks() {
  return [0, 1, 2, 3].map(() => {
    const c = document.createElement("canvas")
    c.width = SIZE
    c.height = SIZE
    const ctx = c.getContext("2d")
    ctx.clearRect(0, 0, SIZE, SIZE)
    return { canvas: c, ctx }
  })
}

function maskHasPaint(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] > 8) return true
  }
  return false
}

function nextEmptyIndex(masks) {
  for (let i = 0; i < 4; i++) {
    if (!maskHasPaint(masks[i].canvas)) return i
  }
  return 0
}

function drawImageIntoOval(ctx, img) {
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, 0, 0, Math.PI * 2)
  ctx.clip()
  // cover-fit into the square, then oval clip keeps the face area
  const scale = Math.max(SIZE / img.width, SIZE / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = (SIZE - dw) / 2
  const dy = (SIZE - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.restore()
}

function loadUrlOnto(mask, url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      drawImageIntoOval(mask.ctx, img)
      resolve()
    }
    img.onerror = reject
    img.src = url
  })
}

export function createUploadScreen(root, { onStartAr, onBack }) {
  const masks = makeBlankMasks()
  const state = {
    active: 0,
    stream: null,
    camOn: false,
  }

  root.innerHTML = `
    <div class="app-shell">
      <header class="top">
        <div>
          <h1>主線 · 實體面譜</h1>
          <p>影相或上傳油色紙樣，放入面譜 1–4，再開始變臉</p>
        </div>
        <button type="button" class="ghost" id="backHome">返回主頁</button>
      </header>
      <div class="panel">
        <div class="mask-tabs" id="maskTabs"></div>
        <div class="upload-layout">
          <div class="canvas-wrap upload-preview-wrap">
            <canvas id="preview" width="${SIZE}" height="${SIZE}"></canvas>
            <video id="camVideo" class="cam-video" playsinline muted autoplay hidden></video>
          </div>
          <div class="tools">
            <h2>放入相片</h2>
            <div class="tool-row">
              <button type="button" id="pickBtn">上傳相片</button>
              <button type="button" class="secondary" id="camToggle">開啟相機</button>
              <button type="button" class="ok" id="captureBtn" hidden>影相放入</button>
            </div>
            <input type="file" id="fileInput" accept="image/*" capture="environment" hidden />
            <p class="hint">相機會盡量 cover 放入橙色橢圓；眼口喺相入面唔使留窿——AR 會自己開窿。未滿格會自動填下一空位。</p>
            <h2>快速</h2>
            <div class="tool-row">
              <button type="button" class="ghost" id="demoBtn">載入示範</button>
              <button type="button" class="ghost" id="clearBtn">清空呢格</button>
            </div>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="secondary" id="fillNextHint" disabled>下一個空位：面譜一</button>
          <button type="button" id="startBtn">開始變臉</button>
        </div>
        <p class="status show" id="status">揀一格面譜，然後上傳或影相。</p>
      </div>
    </div>
  `

  const preview = root.querySelector("#preview")
  const previewCtx = preview.getContext("2d")
  const tabs = root.querySelector("#maskTabs")
  const fileInput = root.querySelector("#fileInput")
  const camVideo = root.querySelector("#camVideo")
  const status = root.querySelector("#status")
  const captureBtn = root.querySelector("#captureBtn")
  const camToggle = root.querySelector("#camToggle")
  const fillNextHint = root.querySelector("#fillNextHint")

  for (let i = 0; i < 4; i++) {
    const b = document.createElement("button")
    b.type = "button"
    b.textContent = `面譜${LABELS[i]}`
    b.dataset.i = String(i)
    b.addEventListener("click", () => {
      state.active = i
      syncTabs()
      redrawPreview()
      updateNextHint()
    })
    tabs.appendChild(b)
  }

  function showStatus(msg, isError = false) {
    status.textContent = msg
    status.className = "status show" + (isError ? " error" : "")
  }

  function syncTabs() {
    tabs.querySelectorAll("button").forEach((b) => {
      const i = Number(b.dataset.i)
      b.classList.toggle("active", i === state.active)
      b.classList.toggle("filled", maskHasPaint(masks[i].canvas))
    })
  }

  function updateNextHint() {
    const n = nextEmptyIndex(masks)
    fillNextHint.textContent = `下一個空位：面譜${LABELS[n]}`
  }

  function drawGuide() {
    previewCtx.fillStyle = "#1a1028"
    previewCtx.fillRect(0, 0, SIZE, SIZE)
    previewCtx.fillStyle = "#4a3020"
    previewCtx.beginPath()
    previewCtx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, 0, 0, Math.PI * 2)
    previewCtx.fill()
    previewCtx.strokeStyle = "#f97316"
    previewCtx.lineWidth = 5
    previewCtx.beginPath()
    previewCtx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, 0, 0, Math.PI * 2)
    previewCtx.stroke()
    previewCtx.strokeStyle = "rgba(255,255,255,0.35)"
    previewCtx.lineWidth = 2
    previewCtx.setLineDash([8, 8])
    previewCtx.beginPath()
    previewCtx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx * 0.82, OVAL.ry * 0.82, 0, 0, Math.PI * 2)
    previewCtx.stroke()
    previewCtx.setLineDash([])
  }

  function redrawPreview() {
    if (state.camOn) return
    drawGuide()
    previewCtx.drawImage(masks[state.active].canvas, 0, 0)
  }

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(masks.map((m) => m.canvas.toDataURL("image/png"))),
      )
    } catch (_) {}
  }

  async function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      if (!Array.isArray(data) || data.length !== 4) return
      for (let i = 0; i < 4; i++) {
        if (!data[i]) continue
        await new Promise((resolve) => {
          const img = new Image()
          img.onload = () => {
            masks[i].ctx.clearRect(0, 0, SIZE, SIZE)
            masks[i].ctx.drawImage(img, 0, 0)
            resolve()
          }
          img.onerror = resolve
          img.src = data[i]
        })
      }
    } catch (_) {}
  }

  async function placeImageSmart(url) {
    const target = maskHasPaint(masks[state.active].canvas)
      ? nextEmptyIndex(masks)
      : state.active
    state.active = target
    await loadUrlOnto(masks[target], url)
    syncTabs()
    redrawPreview()
    updateNextHint()
    persist()
    showStatus(`已放入面譜${LABELS[target]}。可繼續影／上傳，或開始變臉。`)
  }

  root.querySelector("#pickBtn").onclick = () => fileInput.click()
  fileInput.onchange = async () => {
    const file = fileInput.files && fileInput.files[0]
    fileInput.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      showStatus("請揀圖片檔。", true)
      return
    }
    const url = URL.createObjectURL(file)
    try {
      await placeImageSmart(url)
    } catch (_) {
      showStatus("讀取圖片失敗。", true)
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
  }

  async function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop())
      state.stream = null
    }
    state.camOn = false
    camVideo.hidden = true
    camVideo.srcObject = null
    captureBtn.hidden = true
    camToggle.textContent = "開啟相機"
    redrawPreview()
  }

  async function startCamera() {
    const camFn = atob("Z2V0VXNlck1lZGlh")
    try {
      showStatus("正在開啟相機…")
      state.stream = await navigator.mediaDevices[camFn]({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      camVideo.srcObject = state.stream
      await camVideo.play()
      state.camOn = true
      camVideo.hidden = false
      captureBtn.hidden = false
      camToggle.textContent = "關閉相機"
      showStatus("對準紙樣，撳「影相放入」。")
    } catch (err) {
      console.error(err)
      await stopCamera()
      showStatus("開唔到相機。可用「上傳相片」，或喺瀏覽器允許相機。", true)
    }
  }

  camToggle.onclick = async () => {
    if (state.camOn) await stopCamera()
    else await startCamera()
  }

  captureBtn.onclick = async () => {
    if (!state.camOn || !camVideo.videoWidth) {
      showStatus("相機未就緒。", true)
      return
    }
    const snap = document.createElement("canvas")
    snap.width = camVideo.videoWidth
    snap.height = camVideo.videoHeight
    snap.getContext("2d").drawImage(camVideo, 0, 0)
    const url = snap.toDataURL("image/jpeg", 0.92)
    try {
      await placeImageSmart(url)
    } catch (_) {
      showStatus("影相放入失敗。", true)
    }
  }

  root.querySelector("#demoBtn").onclick = async () => {
    const urls = createDemoMaskDataUrls(SIZE)
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          masks[i].ctx.clearRect(0, 0, SIZE, SIZE)
          masks[i].ctx.drawImage(img, 0, 0)
          resolve()
        }
        img.src = urls[i]
      })
    }
    state.active = 0
    syncTabs()
    redrawPreview()
    updateNextHint()
    persist()
    showStatus("已載入四幅示範面譜。")
  }

  root.querySelector("#clearBtn").onclick = () => {
    masks[state.active].ctx.clearRect(0, 0, SIZE, SIZE)
    syncTabs()
    redrawPreview()
    updateNextHint()
    persist()
    showStatus(`已清空面譜${LABELS[state.active]}。`)
  }

  root.querySelector("#startBtn").onclick = () => {
    const any = masks.some((m) => maskHasPaint(m.canvas))
    if (!any) {
      showStatus("請至少放入一幅面譜（或撳「載入示範」）。", true)
      return
    }
    persist()
    stopCamera().then(() => onStartAr(masks.map((m) => m.canvas)))
  }

  root.querySelector("#backHome").onclick = () => {
    stopCamera().then(() => onBack())
  }

  restore().then(() => {
    syncTabs()
    updateNextHint()
    redrawPreview()
  })

  return {
    destroy() {
      stopCamera()
      root.innerHTML = ""
    },
  }
}
