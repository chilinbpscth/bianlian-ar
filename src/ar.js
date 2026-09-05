import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision"
import modelUrls from "./models.json"

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]

export function createArScreen(root, { maskCanvases, onBack }) {
  let stopped = false
  let maskIndex = 0
  let faceLandmarker = null
  let handLandmarker = null
  let raf = 0
  let stream = null
  let lastVideoTime = -1
  let lastWaveX = null
  let lastWaveAt = 0
  let cooldownUntil = 0

  root.innerHTML = `
    <div class="app-shell">
      <header class="top">
        <div>
          <h1>變臉 · AR</h1>
          <p>而家係面譜 <span id="maskLabel">1</span>／4</p>
        </div>
        <button type="button" class="ghost" id="backBtn">返回畫面</button>
      </header>
      <div class="panel">
        <div class="ar-stage" id="stage">
          <video id="video" playsinline muted autoplay></video>
          <canvas id="overlay"></canvas>
          <div class="ar-overlay">
            <p class="tip" id="tip">載入模型中…首次可能要十數秒</p>
            <button type="button" class="secondary" id="nextBtn">下一個面譜</button>
          </div>
        </div>
        <p class="status" id="status"></p>
      </div>
    </div>
  `

  const video = root.querySelector("#video")
  const canvas = root.querySelector("#overlay")
  const ctx = canvas.getContext("2d")
  const tip = root.querySelector("#tip")
  const status = root.querySelector("#status")
  const maskLabel = root.querySelector("#maskLabel")

  root.querySelector("#backBtn").onclick = () => { cleanup(); onBack() }
  root.querySelector("#nextBtn").onclick = () => advanceMask("手動")

  function showStatus(msg, isError = false) {
    status.textContent = msg
    status.className = "status show" + (isError ? " error" : "")
  }

  function advanceMask(reason) {
    const now = performance.now()
    if (now < cooldownUntil) return
    cooldownUntil = now + 900
    maskIndex = (maskIndex + 1) % maskCanvases.length
    maskLabel.textContent = String(maskIndex + 1)
    tip.textContent = reason === "揮手"
      ? "偵測到揮手，已轉面譜！繼續喺面前揮動可變下一個"
      : "已轉去下一個面譜 · 用手喺面前揮動亦可變臉"
  }

  async function init() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      video.srcObject = stream
      await video.play()
    } catch (err) {
      showStatus("請喺瀏覽器設定允許使用相機（HTTPS 或 localhost）。" + ((err && err.message) || ""), true)
      tip.textContent = "相機未能開啟"
      return
    }

    try {
      const vision = await FilesetResolver.forVisionTasks(modelUrls.wasm)
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrls.face, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 2,
      })
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrls.hand, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
      })
      tip.textContent = "用手喺面前揮動變臉 · 可雙人同玩"
      loop()
    } catch (err) {
      console.error(err)
      showStatus("AI 模型載入失敗，請檢查網絡後再試。" + ((err && err.message) || ""), true)
      tip.textContent = "模型載入失敗"
    }
  }

  function loop() {
    if (stopped) return
    raf = requestAnimationFrame(loop)
    if (video.readyState < 2) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    if (video.currentTime === lastVideoTime) return
    lastVideoTime = video.currentTime
    const ts = performance.now()
    ctx.clearRect(0, 0, w, h)
    const faceResult = faceLandmarker.detectForVideo(video, ts)
    const faces = faceResult.faceLandmarks || []
    for (const lm of faces) drawMaskOnFace(lm, w, h, maskCanvases[maskIndex])
    const handResult = handLandmarker.detectForVideo(video, ts)
    maybeWave(handResult.landmarks || [], faces, w, h)
  }

  function drawMaskOnFace(landmarks, w, h, maskCanvas) {
    const pts = FACE_OVAL.map((i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }))
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of pts) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y)
    }
    const padX = (maxX - minX) * 0.08
    const padY = (maxY - minY) * 0.1
    minX -= padX; maxX += padX; minY -= padY; maxY += padY
    ctx.save()
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.clip()
    ctx.globalAlpha = 0.92
    ctx.drawImage(maskCanvas, minX, minY, maxX - minX, maxY - minY)
    ctx.restore()
  }

  function maybeWave(hands, faces, w, h) {
    if (!hands.length || !faces.length) { lastWaveX = null; return }
    const face = faces[0]
    const cx = face[1].x * w
    const cy = face[1].y * h
    const faceW = Math.abs(face[234].x - face[454].x) * w
    for (const hand of hands) {
      const wrist = hand[0]
      const hx = wrist.x * w
      const hy = wrist.y * h
      const near = Math.hypot(hx - cx, hy - cy) < faceW * 1.8 && hy < cy + faceW * 1.2
      if (!near) continue
      const now = performance.now()
      if (lastWaveX != null && now - lastWaveAt < 400) {
        if (Math.abs(hx - lastWaveX) > faceW * 0.35) {
          advanceMask("揮手")
          lastWaveX = null
          return
        }
      }
      lastWaveX = hx
      lastWaveAt = now
    }
  }

  function cleanup() {
    stopped = true
    cancelAnimationFrame(raf)
    if (stream) stream.getTracks().forEach((t) => t.stop())
    if (faceLandmarker && faceLandmarker.close) faceLandmarker.close()
    if (handLandmarker && handLandmarker.close) handLandmarker.close()
    root.innerHTML = ""
  }

  init()
  return { destroy: cleanup }
}
