import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision"
import modelUrls from "./models.json"

const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
const LEFT_EYE = [33,160,158,133,153,144]
const RIGHT_EYE = [362,385,387,263,373,380]
const MOUTH = [61,40,37,0,267,270,291,321,314,17,84,91]
const STAGE_LABELS = ["面譜一","面譜二","面譜三","面譜四","真面目"]
const MASK_COOLDOWN_MS = 900
const MODEL_LOAD_TIMEOUT_MS = 30000

function isDebugMode() {
  try {
    const q = new URLSearchParams(location.search)
    if (q.get("debug") === "1") return true
    if ((location.hash || "").includes("debug=1")) return true
  } catch (_) {}
  return false
}

export function createArScreen(root, { maskCanvases, onBack }) {
  let stopped=false, stage=0, faceLandmarker=null, handLandmarker=null, raf=0, stream=null, lastVideoTime=-1, cooldownUntil=0
  let loadTimer=0, modelsReady=false
  const debugMode = isDebugMode()
  const tracks = new Map()
  root.innerHTML = `<div class="app-shell"><header class="top"><div><h1>變臉 · AR</h1><p id="stageTitle">面譜一</p></div><button type="button" class="ghost" id="backBtn">返回畫面</button></header><div class="panel"><div class="progress" id="progress"></div><div class="ar-stage" id="stageBox"><video id="video" playsinline muted autoplay></video><canvas id="overlay"></canvas><div class="ar-overlay"><p class="tip" id="tip">載入模型中…首次可能要十數秒</p><div class="ar-actions"><button type="button" id="photoBtn" class="secondary">影相</button><button type="button" id="manualBtn" class="manual-btn">手動變臉</button></div></div></div><p class="status show" id="status">準備開啟相機…</p></div></div>`

  const video = root.querySelector("#video")
  const canvas = root.querySelector("#overlay")
  const ctx = canvas.getContext("2d")
  const tip = root.querySelector("#tip")
  const status = root.querySelector("#status")
  const stageTitle = root.querySelector("#stageTitle")
  const progress = root.querySelector("#progress")
  const stageBox = root.querySelector("#stageBox")
  function renderProgress() {
    progress.innerHTML = STAGE_LABELS.map((label, i) => {
      const on = i === stage ? "on" : i < stage ? "done" : ""
      return `<span class="dot ${on}" title="${label}"></span>`
    }).join("")
    stageTitle.textContent = STAGE_LABELS[stage]
  }
  renderProgress()
  function showStatus(msg, isError = false) {
    status.textContent = msg
    status.className = "status show" + (isError ? " error" : "")
  }
  function clearLoadTimer() {
    if (loadTimer) { clearTimeout(loadTimer); loadTimer = 0 }
  }
  function offerRetry(msg) {
    showStatus(msg, true)
    const existing = status.querySelector("button.retry-btn")
    if (existing) return
    const retry = document.createElement("button")
    retry.type = "button"
    retry.className = "secondary retry-btn"
    retry.textContent = "再試一次"
    retry.onclick = () => { cleanup(); createArScreen(root, { maskCanvases, onBack }) }
    status.appendChild(document.createTextNode(" "))
    status.appendChild(retry)
  }
  function flashTransition() {
    const flash = document.createElement("div")
    flash.className = "ar-flash"
    stageBox.appendChild(flash)
    setTimeout(() => flash.remove(), 280)
  }
  function advanceMask(reason = "手動") {
    const now = performance.now()
    if (now < cooldownUntil) return
    cooldownUntil = now + MASK_COOLDOWN_MS
    stage = (stage + 1) % STAGE_LABELS.length
    renderProgress()
    flashTransition()
    tip.textContent = reason === "揮手"
      ? "③ 變臉成功！繼續掃過面部，或撳「手動變臉」"
      : "已轉去" + STAGE_LABELS[stage] + " · 用手喺面前任何方向一掃亦可"
  }
  function capturePhoto() {
    const w = video.videoWidth, h = video.videoHeight
    if (!w || !h) {
      showStatus("相機畫面未就緒，請稍候再影相。", true)
      return
    }
    const out = document.createElement("canvas")
    out.width = w
    out.height = h
    const octx = out.getContext("2d")
    // Mirrored composite to match on-screen AR view
    octx.save()
    octx.translate(w, 0)
    octx.scale(-1, 1)
    octx.drawImage(video, 0, 0, w, h)
    octx.drawImage(canvas, 0, 0, w, h)
    octx.restore()
    const pad = (n) => String(n).padStart(2, "0")
    const d = new Date()
    const name = `bianlian-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      showStatus("已下載相片：" + name)
    }, "image/png")
  }
  root.querySelector("#backBtn").onclick = () => { cleanup(); onBack() }
  root.querySelector("#manualBtn").onclick = () => advanceMask("手動")
  root.querySelector("#photoBtn").onclick = () => capturePhoto()

  async function init() {
    const camFn = atob("Z2V0VXNlck1lZGlh")
    try {
      showStatus("正在開啟相機…")
      stream = await navigator.mediaDevices[camFn]({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      video.srcObject = stream
      await video.play()
    } catch (err) {
      tip.textContent = "相機未能開啟"
      offerRetry("開唔到相機。請喺瀏覽器設定允許使用相機，然後再試。")
      return
    }
    try {
      modelsReady = false
      showStatus("正在載入臉部／手部模型…首次可能要十數秒，請保持網絡暢通。")
      tip.textContent = "載入模型中…首次可能要十數秒"
      clearLoadTimer()
      loadTimer = setTimeout(() => {
        if (stopped || modelsReady) return
        tip.textContent = "模型載入較慢…"
        offerRetry("模型仍在載入（已逾約 30 秒）。可再試一次，或檢查校網是否已放行白名單網域。")
      }, MODEL_LOAD_TIMEOUT_MS)

      const vision = await FilesetResolver.forVisionTasks(modelUrls.wasm)
      const faceOpt = (delegate) => FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrls.face, delegate },
        runningMode: "VIDEO",
        numFaces: 2,
      })
      const handOpt = (delegate) => HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrls.hand, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      try {
        faceLandmarker = await faceOpt("GPU")
        handLandmarker = await handOpt("GPU")
      } catch (e) {
        faceLandmarker = await faceOpt("CPU")
        handLandmarker = await handOpt("CPU")
      }
      if (stopped) return
      modelsReady = true
      clearLoadTimer()
      // Remove any timeout retry button if models eventually loaded
      const retryBtn = status.querySelector("button.retry-btn")
      if (retryBtn) retryBtn.remove()
      tip.textContent = "用手喺面前任何方向一掃，即刻變臉！雙人同玩都得"
      showStatus("模型已載入。把臉放入畫面，用手掃過面部變臉。")
      loop()
    } catch (err) {
      console.error(err)
      clearLoadTimer()
      tip.textContent = "模型載入失敗"
      offerRetry("AI 模型載入失敗，請檢查網絡／校網白名單後再試。")
    }
  }

  function loop() {
    if (stopped) return
    raf = requestAnimationFrame(loop)
    if (video.readyState < 2) return
    const w = video.videoWidth, h = video.videoHeight
    if (!w || !h) return
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    if (video.currentTime === lastVideoTime) return
    lastVideoTime = video.currentTime
    const ts = performance.now()
    ctx.clearRect(0, 0, w, h)
    const faces = faceLandmarker.detectForVideo(video, ts).faceLandmarks || []
    if (faces.length >= 2) stageTitle.textContent = "雙人變臉 · " + STAGE_LABELS[stage]
    else stageTitle.textContent = STAGE_LABELS[stage]
    const hands = handLandmarker.detectForVideo(video, ts).landmarks || []
    if (debugMode && faces.length) drawDebugEllipses(faces, w, h)
    const gestureHint = maybePassThroughWave(hands, faces, w, h)
    if (!faces.length) tip.textContent = "未偵測到臉 — 請正面望住鏡頭"
    else if (gestureHint) tip.textContent = gestureHint
    else if (stage < 4) tip.textContent = "用手由面外掃入再掃出（任何方向）即變臉 · 或撳「手動變臉」"
    else tip.textContent = "真面目 — 再掃一次或撳掣回到面譜一"
    if (stage < 4) for (const lm of faces) drawMaskOnFace(lm, w, h, maskCanvases[stage])
  }
  function drawDebugEllipses(faces, w, h) {
    ctx.save()
    for (const face of faces) {
      const { cx, cy, rx, ry } = faceMetrics(face, w, h)
      // Outer boundary (m≈1.05)
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(29, 78, 216, 0.55)"
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = "rgba(29, 78, 216, 0.12)"
      ctx.fill()
      // Inner boundary (m≈0.85)
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(234, 179, 8, 0.65)"
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.restore()
  }
  function ringPath(landmarks, idx, w, h) {
    ctx.beginPath()
    idx.forEach((i, n) => {
      const x = landmarks[i].x * w, y = landmarks[i].y * h
      if (n === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    })
    ctx.closePath()
  }
  function drawMaskOnFace(landmarks, w, h, maskCanvas) {
    const pts = FACE_OVAL.map((i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }))
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
    const padX = (maxX - minX) * 0.1, padY = (maxY - minY) * 0.12
    minX -= padX; maxX += padX; minY -= padY; maxY += padY
    ctx.save()
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.clip()
    ctx.globalAlpha = 0.96
    ctx.drawImage(maskCanvas, minX, minY, maxX - minX, maxY - minY)
    ctx.globalCompositeOperation = "destination-out"
    ctx.fillStyle = "#000"
    ringPath(landmarks, LEFT_EYE, w, h); ctx.fill()
    ringPath(landmarks, RIGHT_EYE, w, h); ctx.fill()
    ringPath(landmarks, MOUTH, w, h); ctx.fill()
    ctx.restore()
  }
  function palmPoint(hand) {
    const ids = [0, 5, 9, 13, 17]
    let x = 0, y = 0, n = 0
    for (const i of ids) {
      if (!hand[i]) continue
      x += hand[i].x; y += hand[i].y; n++
    }
    if (!n) { const p = hand[8] || hand[0]; return { x: p.x, y: p.y } }
    return { x: x / n, y: y / n }
  }
  function faceMetrics(face, w, h) {
    const cx = face[1].x * w, cy = face[1].y * h
    const faceW = Math.max(60, Math.abs(face[234].x - face[454].x) * w)
    const faceH = Math.max(70, Math.abs(face[10].y - face[152].y) * h)
    const rx = faceW * 0.55, ry = faceH * 0.65
    return { cx, cy, rx, ry }
  }
  function nearestFace(hx, hy, faces, w, h) {
    let best = faces[0], bestD = Infinity
    for (const face of faces) {
      const { cx, cy } = faceMetrics(face, w, h)
      const d = (hx - cx) * (hx - cx) + (hy - cy) * (hy - cy)
      if (d < bestD) { bestD = d; best = face }
    }
    return best
  }
  function radialState(hx, hy, face, w, h) {
    const { cx, cy, rx, ry } = faceMetrics(face, w, h)
    const dx = hx - cx, dy = hy - cy
    const m = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry))
    // Match original hysteresis: outside m>1.0, through m<0.85
    let zone = "mid"
    if (m > 1.05) zone = "out"
    else if (m < 0.85) zone = "in"
    return { m, zone, dx, dy, cx, cy }
  }
  function maybePassThroughWave(hands, faces, w, h) {
    const now = performance.now()
    if (!faces.length) { tracks.clear(); return "" }
    const seen = new Set()
    let hint = ""
    hands.forEach((hand, hi) => {
      const p = palmPoint(hand)
      const hx = p.x * w, hy = p.y * h
      const face = nearestFace(hx, hy, faces, w, h)
      const rs = radialState(hx, hy, face, w, h)
      seen.add(hi)
      let t = tracks.get(hi)
      if (!t) {
        t = { phase: "idle", entryDx: 0, entryDy: 0, seenAt: now, enteredAt: 0, smoothX: hx, smoothY: hy }
        tracks.set(hi, t)
      }
      // 3-frame-ish smoothing
      t.smoothX = t.smoothX * 0.65 + hx * 0.35
      t.smoothY = t.smoothY * 0.65 + hy * 0.35
      const rs2 = radialState(t.smoothX, t.smoothY, face, w, h)
      t.seenAt = now

      if (t.phase === "idle" && rs2.zone === "out") {
        t.phase = "outside"
        t.entryDx = rs2.dx
        t.entryDy = rs2.dy
        hint = "① 手喺面外 — 掃過面部"
      } else if (t.phase === "outside") {
        hint = "① 手喺面外 — 掃過面部"
        if (rs2.zone === "out") { t.entryDx = rs2.dx; t.entryDy = rs2.dy }
        if (rs2.zone === "in") {
          t.phase = "inside"
          t.enteredAt = now
          hint = "② 已穿過 — 繼續向另一邊掃出"
        }
      } else if (t.phase === "inside") {
        hint = "② 已穿過 — 繼續向另一邊掃出"
        if (rs2.zone === "out") {
          // original: exit roughly opposite entry (dot < -0.15)
          const dot = t.entryDx * rs2.dx + t.entryDy * rs2.dy
          const mag = Math.hypot(t.entryDx, t.entryDy) * Math.hypot(rs2.dx, rs2.dy) || 1
          const cos = dot / mag
          if (cos < -0.15 && now - t.enteredAt > 30) {
            advanceMask("揮手")
            hint = "③ 變臉成功！"
            t.phase = "idle"
          } else {
            // same-side exit resets like original
            t.phase = "idle"
            hint = "要掃去對面先得 — 再由面外試一次"
          }
        }
      }
    })
    for (const [id, t] of [...tracks.entries()]) {
      if (seen.has(id)) continue
      // disappear after inside triggers immediately (original)
      if (t.phase === "inside" && now - t.enteredAt > 30) {
        advanceMask("揮手")
        hint = "③ 變臉成功！"
        tracks.delete(id)
      } else if (now - t.seenAt > 300) {
        tracks.delete(id)
      }
    }
    return hint
  }
  function cleanup() {
    stopped = true
    clearLoadTimer()
    cancelAnimationFrame(raf)
    if (stream) stream.getTracks().forEach((t) => t.stop())
    if (faceLandmarker && faceLandmarker.close) faceLandmarker.close()
    if (handLandmarker && handLandmarker.close) handLandmarker.close()
    root.innerHTML = ""
  }
  init()
  return { destroy: cleanup }
}
