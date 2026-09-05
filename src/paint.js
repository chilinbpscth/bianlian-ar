import { createDemoMaskDataUrls } from './demoMasks.js'

const COLORS = [
  '#c41e3a', '#1d4ed8', '#eab308', '#f5f0e6',
  '#111111', '#16a34a', '#7c3aed', '#fb923c',
  '#ffffff', '#64748b',
]

const STORAGE_KEY = 'bianlian-masks-v2'
const SIZE = 512

export function createPaintScreen(root, { onStartAr }) {
  const state = {
    active: 0,
    color: COLORS[0],
    eraser: false,
    drawing: false,
    last: null,
    history: [[], [], [], []],
  }

  const masks = [0, 1, 2, 3].map(() => {
    const c = document.createElement('canvas')
    c.width = SIZE
    c.height = SIZE
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, SIZE, SIZE)
    return { canvas: c, ctx }
  })

  root.innerHTML = `
    <div class="app-shell">
      <header class="top">
        <div>
          <h1>變臉 · 畫面譜</h1>
          <p>先畫好四個面譜，再開始變臉體驗</p>
        </div>
      </header>
      <div class="panel">
        <div class="mask-tabs" id="maskTabs"></div>
        <div class="paint-layout">
          <div class="canvas-wrap">
            <canvas id="maskCanvas" width="${SIZE}" height="${SIZE}"></canvas>
          </div>
          <div class="tools">
            <h2>顏色</h2>
            <div class="swatches" id="swatches"></div>
            <h2>工具</h2>
            <div class="tool-row">
              <button type="button" class="secondary" id="brushBtn">畫筆</button>
              <button type="button" class="ghost" id="eraserBtn">橡皮</button>
              <button type="button" class="ghost" id="undoBtn">復原</button>
              <button type="button" class="ghost" id="clearBtn">清空</button>
            </div>
            <p class="hint">第一步可以撳「示範面譜」睇效果；或者自己喺黃色橢圓入面塗色。塗完撳綠色「開始變臉」。</p>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="secondary" id="demoBtn">示範面譜</button>
          <button type="button" class="ok" id="startBtn">開始變臉</button>
        </div>
      </div>
    </div>
  `

  const view = root.querySelector('#maskCanvas')
  const viewCtx = view.getContext('2d')
  const tabs = root.querySelector('#maskTabs')
  const swatches = root.querySelector('#swatches')

  COLORS.forEach((c) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'swatch' + (c === state.color ? ' active' : '')
    b.style.background = c
    b.title = c
    b.addEventListener('click', () => {
      state.color = c
      state.eraser = false
      syncTools()
    })
    swatches.appendChild(b)
  })

  for (let i = 0; i < 4; i++) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = `面譜 ${i + 1}`
    b.dataset.i = String(i)
    if (i === 0) b.classList.add('active')
    b.addEventListener('click', () => {
      state.active = i
      syncTabs()
      redrawView()
    })
    tabs.appendChild(b)
  }

  function syncTabs() {
    tabs.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.i) === state.active)
    })
  }

  function syncTools() {
    root.querySelector('#brushBtn').className = state.eraser ? 'secondary' : 'ok'
    root.querySelector('#eraserBtn').className = state.eraser ? 'ok' : 'ghost'
    swatches.querySelectorAll('.swatch').forEach((el, idx) => {
      el.classList.toggle('active', !state.eraser && COLORS[idx] === state.color)
    })
  }

  function redrawView() {
    drawGuideOnView()
    viewCtx.drawImage(masks[state.active].canvas, 0, 0)
  }

  function snapshot() {
    const data = masks[state.active].canvas.toDataURL('image/png')
    const h = state.history[state.active]
    h.push(data)
    if (h.length > 30) h.shift()
  }

  function clearMask(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE)
  }

  function drawGuideOnView() {
    viewCtx.fillStyle = '#1a1028'
    viewCtx.fillRect(0, 0, SIZE, SIZE)
    viewCtx.fillStyle = '#3a2848'
    viewCtx.beginPath()
    viewCtx.ellipse(SIZE * 0.5, SIZE * 0.52, SIZE * 0.38, SIZE * 0.46, 0, 0, Math.PI * 2)
    viewCtx.fill()
    viewCtx.strokeStyle = '#f0c14a'
    viewCtx.lineWidth = 4
    viewCtx.setLineDash([10, 8])
    viewCtx.beginPath()
    viewCtx.ellipse(SIZE * 0.5, SIZE * 0.52, SIZE * 0.38, SIZE * 0.46, 0, 0, Math.PI * 2)
    viewCtx.stroke()
    viewCtx.setLineDash([])
    viewCtx.fillStyle = '#f5e6ff'
    viewCtx.font = '26px sans-serif'
    viewCtx.textAlign = 'center'
    viewCtx.fillText('喺黃色橢圓入面畫', SIZE * 0.5, SIZE * 0.96)
  }

  function pointerPos(e) {
    const rect = view.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return {
      x: ((src.clientX - rect.left) / rect.width) * SIZE,
      y: ((src.clientY - rect.top) / rect.height) * SIZE,
    }
  }

  const OVAL = { cx: SIZE * 0.5, cy: SIZE * 0.52, rx: SIZE * 0.38, ry: SIZE * 0.46 }

  function clipOval(ctx) {
    ctx.beginPath()
    ctx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, 0, 0, Math.PI * 2)
    ctx.clip()
  }

  function paintTo(p) {
    const { ctx } = masks[state.active]
    const width = state.eraser ? 34 : 22
    ctx.save()
    clipOval(ctx)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = width
    ctx.globalCompositeOperation = state.eraser ? 'destination-out' : 'source-over'
    ctx.strokeStyle = state.color
    ctx.fillStyle = state.color
    if (state.last) {
      ctx.beginPath()
      ctx.moveTo(state.last.x, state.last.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()
    state.last = p
    redrawView()
  }

  function onDown(e) {
    e.preventDefault()
    if (e.pointerId != null && view.setPointerCapture) {
      try { view.setPointerCapture(e.pointerId) } catch (_) {}
    }
    snapshot()
    state.drawing = true
    state.last = null
    paintTo(pointerPos(e))
  }
  function onMove(e) {
    if (!state.drawing) return
    e.preventDefault()
    paintTo(pointerPos(e))
  }
  function onUp(e) {
    if (!state.drawing) return
    state.drawing = false
    state.last = null
    persist()
  }

  view.style.touchAction = 'none'
  view.addEventListener('pointerdown', onDown)
  view.addEventListener('pointermove', onMove)
  view.addEventListener('pointerup', onUp)
  view.addEventListener('pointercancel', onUp)
  window.addEventListener('pointerup', onUp)

  root.querySelector('#brushBtn').onclick = () => { state.eraser = false; syncTools() }
  root.querySelector('#eraserBtn').onclick = () => { state.eraser = true; syncTools() }
  root.querySelector('#undoBtn').onclick = () => {
    const h = state.history[state.active]
    const prev = h.pop()
    if (!prev) return
    const img = new Image()
    img.onload = () => {
      masks[state.active].ctx.clearRect(0, 0, SIZE, SIZE)
      masks[state.active].ctx.drawImage(img, 0, 0)
      redrawView()
      persist()
    }
    img.src = prev
  }
  root.querySelector('#clearBtn').onclick = () => {
    snapshot()
    clearMask(masks[state.active].ctx)
    redrawView()
    persist()
  }
  root.querySelector('#demoBtn').onclick = async () => {
    const urls = createDemoMaskDataUrls(SIZE)
    for (let i = 0; i < 4; i++) {
      await loadOnto(masks[i], urls[i])
      state.history[i] = []
    }
    redrawView()
    persist()
  }
  root.querySelector('#startBtn').onclick = () => {
    persist()
    onStartAr(masks.map((m) => m.canvas))
  }

  function loadOnto(mask, url) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        mask.ctx.clearRect(0, 0, SIZE, SIZE)
        mask.ctx.drawImage(img, 0, 0)
        resolve()
      }
      img.src = url
    })
  }

  function persist() {
    try {
      const data = masks.map((m) => m.canvas.toDataURL('image/png'))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (_) { /* ignore quota */ }
  }

  async function loadDemos() {
    const urls = createDemoMaskDataUrls(SIZE)
    for (let i = 0; i < 4; i++) {
      await loadOnto(masks[i], urls[i])
      state.history[i] = []
    }
  }

  async function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        await loadDemos()
        persist()
        return
      }
      const data = JSON.parse(raw)
      if (!Array.isArray(data) || data.length !== 4) {
        await loadDemos()
        persist()
        return
      }
      for (let i = 0; i < 4; i++) await loadOnto(masks[i], data[i])
    } catch (_) {
      await loadDemos()
    }
  }

  restore().then(redrawView)
  syncTools()

  return {
    destroy() {
      window.removeEventListener('pointerup', onUp)
      root.innerHTML = ''
    },
  }
}
