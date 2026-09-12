import { openOperaIntro, toggleMaskReference } from './reference.js'

const COLORS = [
  '#c41e3a', '#111111', '#ffffff', '#eab308', '#1d4ed8',
  '#16a34a', '#7c3aed', '#fb923c', '#7c2d12', '#fb7185',
]
const BRUSH_SIZES = [6, 14, 30]
const STORAGE_KEY = 'bianlian-masks-v5-blank'
const SIZE = 512
// Traced from step 1 of guan-yu-steps.png: crop x=256..768, y=0..500.
// Keep source-image proportions instead of estimating another face template.
const OVAL = { cx: 255, cy: 249.5 * 512 / 500, rx: 184, ry: 230.5 * 512 / 500 }
const PAINT_FEATURES = { leftEye: { x: 175 / 512, y: 225 / 500 }, rightEye: { x: 335 / 512, y: 225 / 500 }, mouth: { x: 255 / 512, y: 383 / 500 } }
/** White drawing surface; reference artwork never enters these canvases. */
const FACE_BASE = '#ffffff'

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
    c.maskFeatures = PAINT_FEATURES
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, 0, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = FACE_BASE
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.restore()
    return { canvas: c, ctx }
  })

  root.innerHTML = `
    <div class="app-shell paint-screen">
      <header class="top paint-header">
        <div class="paint-title">
          <button type="button" class="ghost" id="backHome" aria-label="返回主頁">← 返回</button>
          <div class="studio-brand"><span class="studio-seal">變</span><div>變臉工房<small>COLOUR · CHARACTER · PLAY</small></div></div>
        </div>
        <div class="paint-header-actions"><button type="button" class="ghost" id="aboutBtn">什麼是川劇？</button><button type="button" class="secondary" id="demoBtn" aria-expanded="false" aria-controls="referenceBoard">三步畫法</button></div>
      </header>
      <div class="studio-progress" aria-label="創作流程"><span class="on"><b>1</b> 畫面譜</span><span><b>2</b> 戴上面譜</span><span><b>3</b> 變臉演出</span></div>
      <div class="mask-tabs" id="maskTabs" aria-label="選擇面譜"></div>
      <div class="paint-stage">
        <div class="canvas-wrap">
          <p class="paint-guide">沿眼口底線畫，窿位留空；其餘自由創作</p>
          <canvas id="maskCanvas" width="${SIZE}" height="${SIZE}" aria-label="面譜畫板"></canvas>
        </div>
      </div>
      <div class="tools paint-tools" aria-label="畫畫工具">
        <div class="swatches" id="swatches" aria-label="顏色"></div>
        <div class="paint-controls">
          <div class="tool-row" id="sizes" aria-label="筆粗"></div>
          <div class="tool-row paint-actions">
            <button type="button" id="brushBtn">畫筆</button>
            <button type="button" class="ghost" id="fillBtn">填色</button>
            <button type="button" class="ghost" id="eraserBtn">橡皮</button>
            <button type="button" class="ghost" id="undoBtn">復原</button>
            <button type="button" class="ghost" id="clearBtn">清空</button>
          </div>
        </div>
      </div>
      <button type="button" id="startBtn">下一步：戴上面譜 →</button>
    </div>
  `

  const view = root.querySelector('#maskCanvas')
  const viewCtx = view.getContext('2d')
  const tabs = root.querySelector('#maskTabs')
  const swatches = root.querySelector('#swatches')
  const sizes = root.querySelector('#sizes')

  COLORS.forEach((c, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'swatch'
    b.style.background = c
    b.setAttribute('aria-label', ['紅色', '黑色', '白色', '黃色', '藍色', '綠色', '紫色', '橙色', '啡色', '粉紅色'][i])
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
    b.setAttribute('aria-label', `${label}筆`)
    b.title = `${label}筆`
    b.innerHTML = `<span class="brush-dot" style="width:${[5, 9, 15][i]}px;height:${[5, 9, 15][i]}px"></span>`
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
    b.innerHTML = `<canvas width="64" height="84" aria-hidden="true"></canvas><span>面譜${['一', '二', '三', '四'][i]}</span>`
    b.dataset.i = String(i)
    b.addEventListener('click', () => {
      state.active = i
      syncTabs()
      redrawView()
      const reference = root.querySelector('.reference-board')
      if (reference) {
        reference.querySelector('.reference-subtitle').textContent = i === 0 ? '第一幅：跟步驟學，再設計自己的角色' : '下一幅：先認識角色與劇情'
        reference.querySelector(`[data-step="${i === 0 ? 0 : 1}"]`).click()
        reference.scrollTop = 0
      }
    })
    tabs.appendChild(b)
  }

  function syncTabs() {
    tabs.querySelectorAll('button').forEach((b) => {
      const i = Number(b.dataset.i)
      b.classList.toggle('active', i === state.active)
      b.setAttribute('aria-pressed', String(i === state.active))
      const thumbnail = b.querySelector('canvas').getContext('2d')
      thumbnail.clearRect(0, 0, 64, 84)
      thumbnail.drawImage(masks[i].canvas, 0, 0, 64, 84)
    })
  }

  function syncTools() {
    root.querySelector('#brushBtn').className = state.tool === 'brush' ? '' : 'ghost'
    root.querySelector('#fillBtn').className = state.tool === 'fill' ? '' : 'ghost'
    root.querySelector('#eraserBtn').className = state.tool === 'eraser' ? '' : 'ghost'
    for (const tool of ['brush', 'fill', 'eraser']) {
      root.querySelector(`#${tool}Btn`).setAttribute('aria-pressed', String(state.tool === tool))
    }
    swatches.querySelectorAll('.swatch').forEach((el, idx) => {
      const selected = state.tool !== 'eraser' && COLORS[idx] === state.color
      el.classList.toggle('active', selected)
      el.setAttribute('aria-pressed', String(selected))
    })
    sizes.querySelectorAll('button').forEach((b) => {
      b.className = Number(b.dataset.size) === state.brushSize ? '' : 'ghost'
      b.setAttribute('aria-pressed', String(Number(b.dataset.size) === state.brushSize))
    })
  }

  function fillFaceBase(ctx) {
    ctx.save()
    clipOval(ctx)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = FACE_BASE
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.restore()
  }

  function drawGuideOnView() {
    // White paper with only an outer face boundary.
    viewCtx.fillStyle = '#ffffff'
    viewCtx.fillRect(0, 0, SIZE, SIZE)
    // White base underneath the student artwork.
    viewCtx.fillStyle = FACE_BASE
    viewCtx.beginPath()
    viewCtx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, 0, 0, Math.PI * 2)
    viewCtx.fill()
    // Neutral frame, not part of the artwork.
    viewCtx.strokeStyle = '#d8c7a8'
    viewCtx.lineWidth = 2
    viewCtx.beginPath()
    viewCtx.ellipse(OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, 0, 0, Math.PI * 2)
    viewCtx.stroke()
  }

  function featureOpenings(ctx) {
    const x = value => value - 256
    const y = value => value * SIZE / 500
    ctx.moveTo(x(365), y(204))
    ctx.bezierCurveTo(x(410), y(191), x(465), y(199), x(496), y(239))
    ctx.bezierCurveTo(x(450), y(261), x(397), y(248), x(365), y(204))
    ctx.closePath()
    ctx.moveTo(x(657), y(204))
    ctx.bezierCurveTo(x(612), y(191), x(557), y(199), x(526), y(239))
    ctx.bezierCurveTo(x(572), y(261), x(625), y(248), x(657), y(204))
    ctx.closePath()
    ctx.moveTo(x(561), y(383))
    ctx.ellipse(x(511), y(383), 50, 19 * SIZE / 500, 0, 0, Math.PI * 2)
  }

  function clearOpenings(ctx) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    featureOpenings(ctx)
    ctx.fill()
    ctx.restore()
  }

  function drawFeatureGuide() {
    viewCtx.save()
    viewCtx.strokeStyle = '#342c28'
    viewCtx.lineWidth = 3
    viewCtx.setLineDash([])
    viewCtx.beginPath()
    featureOpenings(viewCtx)
    viewCtx.stroke()
    viewCtx.strokeStyle = '#aaa59d'
    viewCtx.lineWidth = 1.5
    viewCtx.setLineDash([4, 5])
    viewCtx.beginPath()
    viewCtx.moveTo(SIZE * 0.47, SIZE * 0.59)
    viewCtx.quadraticCurveTo(SIZE * 0.5, SIZE * 0.615, SIZE * 0.53, SIZE * 0.59)
    viewCtx.stroke()
    viewCtx.restore()
  }

  function redrawView() {
    clearOpenings(masks[state.active].ctx)
    drawGuideOnView()
    viewCtx.save()
    clipOval(viewCtx)
    viewCtx.drawImage(masks[state.active].canvas, 0, 0)
    viewCtx.restore()
    drawFeatureGuide()
    syncTabs()
    root.querySelector('#undoBtn').disabled = state.history[state.active].length === 0
  }

  function snapshot() {
    const data = masks[state.active].ctx.getImageData(0, 0, SIZE, SIZE)
    const h = state.history[state.active]
    h.push(data)
    if (h.length > 12) h.shift()
  }

  function clearMask(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE)
  }

  function resetToBlank(ctx) {
    clearMask(ctx)
    fillFaceBase(ctx)
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
    masks[state.active].ctx.putImageData(prev, 0, 0)
    redrawView()
    persist()
  }
  root.querySelector('#clearBtn').onclick = () => {
    if (!confirm('確定清空呢幅面譜？此操作可撳「復原」撤回。')) return
    snapshot()
    resetToBlank(masks[state.active].ctx)
    redrawView()
    persist()
  }
  root.querySelector('#demoBtn').onclick = () => toggleMaskReference(root)
  root.querySelector('#aboutBtn').onclick = () => openOperaIntro(root)
  root.querySelector('#startBtn').onclick = () => {
    masks.forEach(mask => clearOpenings(mask.ctx))
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

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(masks.map((m) => m.canvas.toDataURL('image/png'))))
    } catch (_) {}
  }

  async function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        persist()
        return
      }
      const data = JSON.parse(raw)
      if (!Array.isArray(data) || data.length !== 4) {
        persist()
        return
      }
      for (let i = 0; i < 4; i++) await loadOnto(masks[i], data[i])
    } catch (_) {
      masks.forEach(mask => resetToBlank(mask.ctx))
    }
  }

  if (onBack) {
    root.querySelector('#backHome').onclick = () => onBack()
  } else {
    const bh = root.querySelector('#backHome')
    if (bh) bh.hidden = true
  }

  toggleMaskReference(root)

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
