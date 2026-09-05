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
        <ol class="steps" id="steps">
          <li>面對鏡頭，等系統偵測到你嘅臉</li>
          <li>見到面譜貼喺臉上就成功</li>
          <li>撳「下一個面譜」，或者用手喺面前左右揮動轉面</li>
        </ol>
        <div class="ar-stage" id="stage">
          <video id="video" playsinline muted autoplay></video>
          <canvas id="overlay"></canvas>
          <div class="ar-overlay">
            <p class="tip" id="tip">載入模型中…首次可能要十數秒，請稍等</p>
            <div class="ar-actions">
              <button type="button" class="secondary" id="prevBtn">上一個</button>
              <button type="button" class="ok" id="nextBtn">下一個面譜</button>
            </div>
          </div>
        </div>
        <p class="status show" id="status">準備開啟相機…</p>
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
  root.querySelector("#prevBtn").onclick = () => advanceMask("手動", -1)

  function showStatus(msg, isError = false) {
    status.textContent = msg
    status.className = "status show" + (isError ? " error" : "")
  }

  function advanceMask(reason, dir = 1) {
    const now = performance.now()
    if (reason === "揮手" && now < cooldownUntil) return
    if (reason === "揮手") cooldownUntil = now + 900
    const n = maskCanvases.length
    maskIndex = (maskIndex + dir + n) % n
    maskLabel.textContent = String(maskIndex + 1)
    tip.textContent = reason === "揮手"
      ? "偵測到揮手，已轉面譜！可再揮，或撳掣轉面"
      : "已轉面譜 " + (maskIndex + 1) + " · 面對鏡頭就會貼上"
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
      showStatus("正在載入臉部／手部模型…首次要等一陣")
      const vision = await FilesetResolver.forVisionTasks(modelUrls.wasm)
      async function makeFace(delegate) {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelUrls.face, delegate },
          runningMode: "VIDEO",
          numFaces: 2,
        })
      }
      async function makeHand(delegate) {
        return HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelUrls.hand, delegate },
          runningMode: "VIDEO",
          numHands: 2,
        })
      }
      try {
        faceLandmarker = await makeFace("GPU")
        handLandmarker = await makeHand("GPU")
      } catch (gpuErr) {
        console.warn(gpuErr)
        faceLandmarker = await makeFace("CPU")
        handLandmarker = await makeHand("CPU")
      }
      tip.textContent = "請面對鏡頭 · 見到面譜後可撳「下一個面譜」"
      showStatus("模型已載入。請把臉放入畫面中央。")
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
    if (!faces.length) {
      tip.textContent = "未偵測到臉 — 請走近鏡頭、光線充足、正面望住鏡頭"
      showStatus("下一步：把臉放入畫面中央，等面譜自動貼上")
    } else {
      tip.textContent = "已貼面譜 " + (maskIndex + 1) + " — 撳「下一個面譜」或左右揮手轉面"
      showStatus("成功偵測到臉。用下面掣轉面譜，或用手喺面前揮動。")
    }
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
    ctx.save()
    ctx.clip()
    ctx.globalAlpha = 0.95
    ctx.drawImage(maskCanvas, minX, minY, maxX - minX, maxY - minY)
    ctx.restore()
    ctx.strokeStyle = "rgba(240,193,74,0.85)"
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.restore()
  }

  let swipeAcc = 0
  let swipeLastX = null
  let swipeLastAt = 0

  function maybeWave(hands, faces, w, h) {
    if (!hands.length || !faces.length) {
      lastWaveX = null
      swipeAcc = 0
      swipeLastX = null
      return
    }
    const face = faces[0]
    const cx = face[1].x * w
    const cy = face[1].y * h
    const faceW = Math.max(80, Math.abs(face[234].x - face[454].x) * w)
    const now = performance.now()
    for (const hand of hands) {
      // index fingertip is more stable for a wave than wrist alone
      const tip = hand[8] || hand[0]
      const hx = tip.x * w
      const hy = tip.y * h
      // allow hand in front / beside face (looser than before)
      const near = Math.hypot(hx - cx, hy - cy) < faceW * 2.6
      if (!near) continue
      if (swipeLastX != null && now - swipeLastAt < 450) {
        swipeAcc += hx - swipeLastX
      } else {
        swipeAcc = 0
      }
      swipeLastX = hx
      swipeLastAt = now
      // ~0.28 face-width net horizontal travel triggers switch
      if (Math.abs(swipeAcc) > faceW * 0.28) {
        advanceMask("揮手", swipeAcc > 0 ? 1 : -1)
        swipeAcc = 0
        swipeLastX = null
        lastWaveX = null
        return
      }
      lastWaveX = hx
      lastWaveAt = now
    }
  }

  function bindScreenSwipe() {
    const stage = root.querySelector("#stage")
    if (!stage) return
    let x0 = null
    stage.style.touchAction = "pan-y"
    const down = (e) => {
      const t = e.touches ? e.touches[0] : e
      x0 = t.clientX
    }
    const up = (e) => {
      if (x0 == null) return
      const t = (e.changedTouches && e.changedTouches[0]) || e
      const dx = t.clientX - x0
      x0 = null
      if (Math.abs(dx) < 56) return
      advanceMask("手動", dx < 0 ? 1 : -1)
    }
    stage.addEventListener("pointerdown", down)
    stage.addEventListener("pointerup", up)
  }
  bindScreenSwipe()

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
