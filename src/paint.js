import { createDemoMaskDataUrls } from './demoMasks.js'

const COLORS = [
  '#c41e3a', '#111111', '#f5f0e6', '#eab308', '#1d4ed8',
  '#16a34a', '#7c3aed', '#fb923c', '#7c2d12', '#fb7185',
]
const BRUSH_SIZES = [6, 14, 30]
const STORAGE_KEY = 'bianlian-masks-v3'
const SIZE = 512
// Larger outer oval (closer to original orange boundary)
const OVAL = { cx: SIZE * 0.5, cy: SIZE * 0.5, rx: SIZE * 0.44, ry: SIZE * 0.48 }

export function createPaintScreen(root, { onStartAr, onBack }) {
  const state = {
    active: 0,
    color: COLORS[0],
    tool: 'brush', // brush | fill | eraser
    brushSize: 14,
    drawing: false,
    last: null,
    history: [[], [], [], []],
  }

  const masks = [0, 1, 2, 3].map(() => {
    const c = document.createElement('canvas')
    c.width = SIZE
    c.height = SIZE
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.clearRect(0, 0, SIZE, SIZE)
    return { canvas: c, ctx }
  })

  root.innerHTML = `
    <div class="app-shell">
      <header class="top">
        <div>
          <h1>試玩／備案 · iPad 畫面譜</h1>
          <p>喺橙色範圍入面畫；可以填色、改筆粗，再開始變臉（課堂主線請用實體紙樣）</p>
        </div>
        <button type="button" class="ghost" id="backHome">返回主頁</button>
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
            <h2>筆粗</h2>
            <div class="tool-row" id="sizes"></div>
            <h2>工具</h2>
            <div class="tool-row">
              <button type="button" id="brushBtn">畫筆</button>
              <button type="button" class="ghost" id="fillBtn">填色</button>
              <button type="button" class="ghost" id="eraserBtn">橡皮</button>
              <button type="button" class="ghost" id="undoBtn">復原</button>
              <button type="button" class="ghost" id="clearBtn">清空</button>
            </div>
            <p class="hint">筆跡同填色都只會喺橙色橢圓入面。眼口唔使留窿——AR 會自己開窿。</p>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="secondary" id="demoBtn">示範面譜</button>
          <button type="button" id="startBtn">開始變臉</button>
        </div>
      </div>
    </div>
  `

  const view = root.querySelector('#maskCanvas')
  const viewCtx = view.getContext('2d')
  const tabs = root.querySelector('#maskTabs')
  const swatches = root.querySelector('#swatches')
  const sizes = root.querySelector('#sizes')

  COLORS.forEach((c) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'swatch'
    b.style.background = c
    b.addEventListener('click', () => {
      state.color = c
      if (state.tool === 'eraser') state.tool = 'brush'
      syncTools()
    })
    swatches.appendChild(b)
  })

  ;['細', '中', '大'].forEach((label, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'ghost'
    b.textContent = label
    b.dataset.size = String(BRUSH_SIZES[i])
    b.addEventListener('click', () => {
      state.brushSize = BRUSH_SIZES[i]
      syncTools()
    })
    sizes.appendChild(b)
  })

  for (let i = 0; i < 4; i++) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = `面譜${['一', '二', '三', '四'][i]}`
    b.dataset.i = String(i)
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
    root.querySelector('#brushBtn').className = state.tool === 'brush' ? '' : 'ghost'
    root.querySelector('#fillBtn').className = state.tool === 'fill' ? '' : 'ghost'
    root.querySelector('#eraserBtn').className = state.tool === 'eraser' ? '' : 'ghost'
    swatches.querySelectorAll('.swatch').forEach((el, idx) => {
      el.classList.toggle('active', state.tool !== 'eraser' && COLORS[idx] === state.color)
    })
    sizes.querySelectorAll('button').forEach((b) => {
      b.className = Number(b.dataset.size) === state.brushSize ? '' : 'ghost'
    })
  }

  function drawGuideOnView() {
    viewCtx.fillStyle = '#1a1028'
    viewCtx.fillRect(0, 0, SIZE, SIZE)
    // outer fill guide
    viewCtx.fillStyle = '#4a3020'
    viewCtx.beginPath()
    viewCtx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, 0, 0, Math.PI * 2)
    viewCtx.fill()
    viewCtx.strokeStyle = '#f97316'
    viewCtx.lineWidth = 5
    viewCtx.beginPath()
    viewCtx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, 0, 0, Math.PI * 2)
    viewCtx.stroke()
    // inner face hint (dashed)
    viewCtx.strokeStyle = 'rgba(255,255,255,0.35)'
    viewCtx.lineWidth = 2
    viewCtx.setLineDash([8, 8])
    viewCtx.beginPath()
    viewCtx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx * 0.82, OVAL.ry * 0.82, 0, 0, Math.PI * 2)
    viewCtx.stroke()
    viewCtx.setLineDash([])
  }

  function redrawView() {
    drawGuideOnView()
    viewCtx.drawImage(masks[state.active].canvas, 0, 0)
  }

  function snapshot() {
    const data = masks[state.active].canvas.toDataURL('image/png')
    const h = state.history[state.active]
    h.push(data)
    if (h.length > 12) h.shift()
  }

  function clearMask(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE)
  }

  function clipOval(ctx) {
    ctx.beginPath()
    ctx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, 0, 0, Math.PI * 2)
    ctx.clip()
  }

  function insideOval(x, y) {
    const nx = (x - OVAL.cx) / OVAL.rx
    const ny = (y - OVAL.cy) / OVAL.ry
    return nx * nx + ny * ny <= 1
  }

  function pointerPos(e) {
    const rect = view.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return {
      x: ((src.clientX - rect.left) / rect.width) * SIZE,
      y: ((src.clientY - rect.top) / rect.height) * SIZE,
    }
  }

  function hexToRgba(hex) {
    const h = hex.replace('#', '')
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
  }

  function floodFill(cx, cy) {
    if (!insideOval(cx, cy)) return
    const { ctx, canvas } = masks[state.active]
    const img = ctx.getImageData(0, 0, SIZE, SIZE)
    const data = img.data
    const x0 = Math.floor(cx)
    const y0 = Math.floor(cy)
    const i0 = (y0 * SIZE + x0) * 4
    const target = [data[i0], data[i0 + 1], data[i0 + 2], data[i0 + 3]]
    const fill = state.tool === 'eraser' ? [0, 0, 0, 0] : hexToRgba(state.color)
    if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === fill[3]) return

    const stack = [[x0, y0]]
    const seen = new Uint8Array(SIZE * SIZE)
    const match = (i) =>
      data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2] && data[i + 3] === target[3]

    while (stack.length) {
      const [x, y] = stack.pop()
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue
      if (!insideOval(x, y)) continue
      const key = y * SIZE + x
      if (seen[key]) continue
      const i = key * 4
      if (!match(i)) continue
      seen[key] = 1
      data[i] = fill[0]
      data[i + 1] = fill[1]
      data[i + 2] = fill[2]
      data[i + 3] = fill[3]
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }
    ctx.putImageData(img, 0, 0)
  }

  function paintTo(p) {
    const { ctx } = masks[state.active]
    const width = state.brushSize
    ctx.save()
    clipOval(ctx)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = width
    if (state.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = '#000'
      ctx.fillStyle = '#000'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = state.color
      ctx.fillStyle = state.color
    }
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
    ctx.restore()
    state.last = p
    redrawView()
  }

  function onDown(e) {
    e.preventDefault()
    if (e.pointerId != null && view.setPointerCapture) {
      try { view.setPointerCapture(e.pointerId) } catch (_) {}
    }
    const p = pointerPos(e)
    if (state.tool === 'fill') {
      snapshot()
      floodFill(p.x, p.y)
      redrawView()
      persist()
      return
    }
    snapshot()
    state.drawing = true
    state.last = null
    paintTo(p)
  }
  function onMove(e) {
    if (!state.drawing) return
    e.preventDefault()
    paintTo(pointerPos(e))
  }
  function onUp() {
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

  root.querySelector('#brushBtn').onclick = () => { state.tool = 'brush'; syncTools() }
  root.querySelector('#fillBtn').onclick = () => { state.tool = 'fill'; syncTools() }
  root.querySelector('#eraserBtn').onclick = () => { state.tool = 'eraser'; syncTools() }
  root.querySelector('#undoBtn').onclick = () => {
    const prev = state.history[state.active].pop()
    if (!prev) return
    const img = new Image()
    img.onload = () => {
      clearMask(masks[state.active].ctx)
      masks[state.active].ctx.drawImage(img, 0, 0)
      redrawView()
      persist()
    }
    img.src = prev
  }
  root.querySelector('#clearBtn').onclick = () => {
    if (!confirm('確定清空呢幅面譜？此操作可撳「復原」撤回。')) return
    snapshot()
    clearMask(masks[state.active].ctx)
    redrawView()
    persist()
  }
  root.querySelector('#demoBtn').onclick = async () => {
    await loadDemos()
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
        clearMask(mask.ctx)
        mask.ctx.drawImage(img, 0, 0)
        resolve()
      }
      img.src = url
    })
  }

  async function loadDemos() {
    const urls = createDemoMaskDataUrls(SIZE)
    for (let i = 0; i < 4; i++) {
      await loadOnto(masks[i], urls[i])
      state.history[i] = []
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(masks.map((m) => m.canvas.toDataURL('image/png'))))
    } catch (_) {}
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

  if (onBack) {
    root.querySelector('#backHome').onclick = () => onBack()
  } else {
    const bh = root.querySelector('#backHome')
    if (bh) bh.hidden = true
  }

  restore().then(() => {
    syncTabs()
    syncTools()
    redrawView()
  })

  return {
    destroy() {
      window.removeEventListener('pointerup', onUp)
      root.innerHTML = ''
    },
  }
}
