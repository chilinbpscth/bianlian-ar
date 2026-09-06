/**
 * Stylised 京劇／粵劇臉譜 demo masks (original drawings, not scans).
 * Oval + eye/mouth UVs match paint/upload OVAL and print/face-mask-frame.svg
 * so AR landmark warp lines up with physical paper templates.
 */

/** Normalized oval — same as paint.js / upload.js (rx 0.44, ry 0.48). */
export const MASK_OVAL = { cx: 0.5, cy: 0.5, rx: 0.44, ry: 0.48 }

/**
 * Feature centres in mask UV (0–1), from print template offsets
 * (eyes ±28/-8, mouth 0/38 on rx=80 ry=87.3 oval).
 */
export const MASK_FEATURES = {
  // Image-left / image-right (mask art space, not person-left)
  leftEye: {
    x: 0.5 - (28 / 80) * MASK_OVAL.rx,
    y: 0.5 - (8 / 87.3) * MASK_OVAL.ry,
  },
  rightEye: {
    x: 0.5 + (28 / 80) * MASK_OVAL.rx,
    y: 0.5 - (8 / 87.3) * MASK_OVAL.ry,
  },
  mouth: {
    x: 0.5,
    y: 0.5 + (38 / 87.3) * MASK_OVAL.ry,
  },
  // Hole radii (normalized), from print cutouts
  eyeRx: (13.5 / 80) * MASK_OVAL.rx,
  eyeRy: (9 / 87.3) * MASK_OVAL.ry,
  mouthRx: (22 / 80) * MASK_OVAL.rx,
  mouthRy: (10 / 87.3) * MASK_OVAL.ry,
}

function ovalClip(ctx, size, cx, cy, rx, ry) {
  ctx.beginPath()
  ctx.ellipse(size * cx, size * cy, size * rx, size * ry, 0, 0, Math.PI * 2)
  ctx.clip()
}

function cutFeatures(ctx, size, f) {
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  for (const eye of [f.leftEye, f.rightEye]) {
    ctx.beginPath()
    ctx.ellipse(size * eye.x, size * eye.y, size * f.eyeRx, size * f.eyeRy, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.ellipse(
    size * f.mouth.x,
    size * f.mouth.y,
    size * f.mouthRx,
    size * f.mouthRy,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

/** 紅臉（忠勇，關羽感）：紅底、黑臥蠶眉、額沖天紋 */
function drawRedLoyal(ctx, size, cx, cy, rx, ry, f) {
  const S = size
  ctx.fillStyle = '#c41e3a'
  ctx.beginPath()
  ctx.ellipse(S * cx, S * cy, S * rx, S * ry, 0, 0, Math.PI * 2)
  ctx.fill()

  // Forehead 沖天紋 — three black vertical strokes
  ctx.strokeStyle = '#1a0a08'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const browBase = f.leftEye.y - 0.04
  for (const [ox, len, w] of [[-0.07, 0.16, 0.018], [0, 0.2, 0.022], [0.07, 0.16, 0.018]]) {
    ctx.lineWidth = S * w
    ctx.beginPath()
    ctx.moveTo(S * (cx + ox), S * (cy - ry * 0.78))
    ctx.quadraticCurveTo(
      S * (cx + ox * 0.4),
      S * (cy - ry * 0.45),
      S * (cx + ox * 0.15),
      S * browBase,
    )
    ctx.stroke()
  }

  // 臥蠶眉 — thick arched black brows above each eye
  ctx.lineWidth = S * 0.038
  ctx.strokeStyle = '#0d0504'
  for (const side of [-1, 1]) {
    const ex = side < 0 ? f.leftEye.x : f.rightEye.x
    const ey = f.leftEye.y
    ctx.beginPath()
    ctx.moveTo(S * (ex - side * f.eyeRx * 1.55), S * (ey - 0.055))
    ctx.quadraticCurveTo(
      S * ex,
      S * (ey - 0.1),
      S * (ex + side * f.eyeRx * 1.35),
      S * (ey - 0.03),
    )
    ctx.stroke()
  }

  // Eye socket outline (black, around cutouts)
  ctx.lineWidth = S * 0.02
  for (const eye of [f.leftEye, f.rightEye]) {
    ctx.beginPath()
    ctx.ellipse(S * eye.x, S * eye.y, S * f.eyeRx * 1.35, S * f.eyeRy * 1.45, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Soft cheek curve + nose bridge
  ctx.lineWidth = S * 0.014
  ctx.beginPath()
  ctx.moveTo(S * cx, S * (f.leftEye.y + 0.03))
  ctx.lineTo(S * cx, S * (f.mouth.y - 0.08))
  ctx.stroke()
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(S * (cx + side * rx * 0.55), S * (f.leftEye.y + 0.05))
    ctx.quadraticCurveTo(
      S * (cx + side * rx * 0.72),
      S * ((f.leftEye.y + f.mouth.y) / 2),
      S * (cx + side * rx * 0.4),
      S * (f.mouth.y + 0.02),
    )
    ctx.stroke()
  }

  // Lip tint ring
  ctx.strokeStyle = '#7f1d1d'
  ctx.lineWidth = S * 0.018
  ctx.beginPath()
  ctx.ellipse(S * f.mouth.x, S * f.mouth.y, S * f.mouthRx * 1.4, S * f.mouthRy * 1.5, 0, 0, Math.PI * 2)
  ctx.stroke()
}

/** 白臉（奸詐感）：白／灰白底、三角眼紋、斜線 */
function drawWhiteCunning(ctx, size, cx, cy, rx, ry, f) {
  const S = size
  ctx.fillStyle = '#f2eee6'
  ctx.beginPath()
  ctx.ellipse(S * cx, S * cy, S * rx, S * ry, 0, 0, Math.PI * 2)
  ctx.fill()

  // Soft gray wash on cheeks / temples
  ctx.fillStyle = 'rgba(120, 120, 130, 0.18)'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(S * (cx + side * rx * 0.42), S * (cy + 0.02), S * rx * 0.28, S * ry * 0.38, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = '#1e293b'
  ctx.fillStyle = '#1e293b'
  ctx.lineCap = 'round'

  // Fine 魚尾／斜線 near temples
  ctx.lineWidth = S * 0.01
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const y0 = f.leftEye.y - 0.02 + i * 0.028
      ctx.beginPath()
      ctx.moveTo(S * (cx + side * rx * 0.55), S * y0)
      ctx.lineTo(S * (cx + side * rx * 0.78), S * (y0 + side * 0.01 + 0.02))
      ctx.stroke()
    }
  }

  // Triangular eye sockets (奸白臉)
  ctx.lineWidth = S * 0.022
  for (const side of [-1, 1]) {
    const eye = side < 0 ? f.leftEye : f.rightEye
    ctx.beginPath()
    ctx.moveTo(S * (eye.x - side * f.eyeRx * 1.6), S * (eye.y - f.eyeRy * 0.2))
    ctx.lineTo(S * (eye.x + side * f.eyeRx * 0.2), S * (eye.y - f.eyeRy * 1.7))
    ctx.lineTo(S * (eye.x + side * f.eyeRx * 1.5), S * (eye.y + f.eyeRy * 0.4))
    ctx.closePath()
    ctx.stroke()
  }

  // Thin suspicious brows angling down toward center
  ctx.lineWidth = S * 0.016
  for (const side of [-1, 1]) {
    const eye = side < 0 ? f.leftEye : f.rightEye
    ctx.beginPath()
    ctx.moveTo(S * (eye.x - side * f.eyeRx * 1.4), S * (eye.y - 0.08))
    ctx.lineTo(S * (cx + side * 0.04), S * (eye.y - 0.02))
    ctx.stroke()
  }

  // Forehead question-mark hint (多疑)
  ctx.lineWidth = S * 0.014
  ctx.beginPath()
  ctx.arc(S * cx, S * (cy - ry * 0.55), S * 0.035, Math.PI * 0.9, Math.PI * 2.1)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(S * cx, S * (cy - ry * 0.42), S * 0.008, 0, Math.PI * 2)
  ctx.fill()

  // Thin nose + lip lines in slate
  ctx.lineWidth = S * 0.012
  ctx.beginPath()
  ctx.moveTo(S * cx, S * (f.leftEye.y + 0.04))
  ctx.lineTo(S * cx, S * (f.mouth.y - 0.07))
  ctx.stroke()
  ctx.strokeStyle = '#9f1239'
  ctx.lineWidth = S * 0.014
  ctx.beginPath()
  ctx.ellipse(S * f.mouth.x, S * f.mouth.y, S * f.mouthRx * 1.25, S * f.mouthRy * 1.3, 0, 0, Math.PI * 2)
  ctx.stroke()
}

/** 黑臉（猛／張飛感）：黑底、白紋、寬眉環眼 */
function drawBlackFierce(ctx, size, cx, cy, rx, ry, f) {
  const S = size
  ctx.fillStyle = '#111111'
  ctx.beginPath()
  ctx.ellipse(S * cx, S * cy, S * rx, S * ry, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#f5f0e6'
  ctx.fillStyle = '#f5f0e6'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Wide butterfly / 蝠形 brows (張飛感)
  ctx.lineWidth = S * 0.045
  for (const side of [-1, 1]) {
    const eye = side < 0 ? f.leftEye : f.rightEye
    ctx.beginPath()
    ctx.moveTo(S * (cx + side * 0.02), S * (eye.y - 0.02))
    ctx.quadraticCurveTo(
      S * (eye.x - side * 0.02),
      S * (eye.y - 0.14),
      S * (eye.x + side * f.eyeRx * 1.6),
      S * (eye.y - 0.05),
    )
    ctx.stroke()
  }

  // Ring eyes (環眼)
  ctx.lineWidth = S * 0.028
  for (const eye of [f.leftEye, f.rightEye]) {
    ctx.beginPath()
    ctx.ellipse(S * eye.x, S * eye.y, S * f.eyeRx * 1.55, S * f.eyeRy * 1.65, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  // White forehead blaze / cross
  ctx.lineWidth = S * 0.03
  ctx.beginPath()
  ctx.moveTo(S * cx, S * (cy - ry * 0.82))
  ctx.lineTo(S * cx, S * (f.leftEye.y - 0.06))
  ctx.stroke()
  ctx.lineWidth = S * 0.022
  ctx.beginPath()
  ctx.moveTo(S * (cx - rx * 0.22), S * (cy - ry * 0.55))
  ctx.lineTo(S * (cx + rx * 0.22), S * (cy - ry * 0.55))
  ctx.stroke()

  // Cheek white swirls
  ctx.lineWidth = S * 0.02
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(S * (cx + side * rx * 0.25), S * (f.leftEye.y + 0.08))
    ctx.quadraticCurveTo(
      S * (cx + side * rx * 0.7),
      S * ((f.leftEye.y + f.mouth.y) / 2),
      S * (cx + side * rx * 0.35),
      S * (f.mouth.y + 0.05),
    )
    ctx.quadraticCurveTo(
      S * (cx + side * rx * 0.18),
      S * (f.mouth.y - 0.02),
      S * (cx + side * rx * 0.28),
      S * (f.leftEye.y + 0.12),
    )
    ctx.stroke()
  }

  // Mouth white outline
  ctx.lineWidth = S * 0.02
  ctx.beginPath()
  ctx.ellipse(S * f.mouth.x, S * f.mouth.y, S * f.mouthRx * 1.45, S * f.mouthRy * 1.55, 0, 0, Math.PI * 2)
  ctx.stroke()
}

/** 藍花臉：鮮明藍底＋對稱渦紋（剛猛／花三塊瓦感） */
function drawBlueFlower(ctx, size, cx, cy, rx, ry, f) {
  const S = size
  ctx.fillStyle = '#1d4ed8'
  ctx.beginPath()
  ctx.ellipse(S * cx, S * cy, S * rx, S * ry, 0, 0, Math.PI * 2)
  ctx.fill()

  // Pale forehead / cheek panels (三塊瓦 hint)
  ctx.fillStyle = '#e8eefc'
  ctx.beginPath()
  ctx.moveTo(S * (cx - rx * 0.55), S * (cy - ry * 0.35))
  ctx.quadraticCurveTo(S * cx, S * (cy - ry * 0.92), S * (cx + rx * 0.55), S * (cy - ry * 0.35))
  ctx.quadraticCurveTo(S * cx, S * (cy - ry * 0.15), S * (cx - rx * 0.55), S * (cy - ry * 0.35))
  ctx.fill()

  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(
      S * (cx + side * rx * 0.48),
      S * ((f.leftEye.y + f.mouth.y) / 2 + 0.02),
      S * rx * 0.22,
      S * ry * 0.28,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  ctx.strokeStyle = '#0b1f4a'
  ctx.fillStyle = '#0b1f4a'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Symmetric forehead swirls
  ctx.lineWidth = S * 0.02
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(S * cx, S * (cy - ry * 0.7))
    ctx.bezierCurveTo(
      S * (cx + side * rx * 0.35),
      S * (cy - ry * 0.85),
      S * (cx + side * rx * 0.55),
      S * (cy - ry * 0.4),
      S * (cx + side * rx * 0.2),
      S * (f.leftEye.y - 0.08),
    )
    ctx.stroke()
    // Inner curl
    ctx.beginPath()
    ctx.arc(S * (cx + side * rx * 0.28), S * (cy - ry * 0.52), S * 0.04, side < 0 ? 0.2 : Math.PI - 0.2, side < 0 ? Math.PI + 0.4 : -0.4)
    ctx.stroke()
  }

  // Bold brows
  ctx.lineWidth = S * 0.036
  for (const side of [-1, 1]) {
    const eye = side < 0 ? f.leftEye : f.rightEye
    ctx.beginPath()
    ctx.moveTo(S * (eye.x - side * f.eyeRx * 1.5), S * (eye.y - 0.06))
    ctx.quadraticCurveTo(S * eye.x, S * (eye.y - 0.12), S * (eye.x + side * f.eyeRx * 1.3), S * (eye.y - 0.04))
    ctx.stroke()
  }

  // Eye frames
  ctx.lineWidth = S * 0.022
  for (const eye of [f.leftEye, f.rightEye]) {
    ctx.beginPath()
    ctx.ellipse(S * eye.x, S * eye.y, S * f.eyeRx * 1.4, S * f.eyeRy * 1.5, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Cheek vortex curls
  ctx.lineWidth = S * 0.018
  ctx.strokeStyle = '#1e3a8a'
  for (const side of [-1, 1]) {
    const mx = cx + side * rx * 0.5
    const my = (f.leftEye.y + f.mouth.y) / 2
    ctx.beginPath()
    ctx.arc(S * mx, S * my, S * 0.055, 0, Math.PI * 1.6)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(S * (mx - side * 0.02), S * (my + 0.02), S * 0.028, Math.PI * 0.3, Math.PI * 1.8)
    ctx.stroke()
  }

  // Nose bridge + mouth ring
  ctx.strokeStyle = '#0b1f4a'
  ctx.lineWidth = S * 0.016
  ctx.beginPath()
  ctx.moveTo(S * cx, S * (f.leftEye.y + 0.03))
  ctx.lineTo(S * cx, S * (f.mouth.y - 0.07))
  ctx.stroke()
  ctx.lineWidth = S * 0.02
  ctx.beginPath()
  ctx.ellipse(S * f.mouth.x, S * f.mouth.y, S * f.mouthRx * 1.4, S * f.mouthRy * 1.5, 0, 0, Math.PI * 2)
  ctx.stroke()
}

const DRAWERS = [drawRedLoyal, drawWhiteCunning, drawBlackFierce, drawBlueFlower]

export function createDemoMaskDataUrls(size = 512) {
  const { cx, cy, rx, ry } = MASK_OVAL
  const f = MASK_FEATURES

  return DRAWERS.map((draw) => {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ovalClip(ctx, size, cx, cy, rx, ry)
    draw(ctx, size, cx, cy, rx, ry, f)
    ctx.restore()
    // Transparent eye / mouth cutouts (aligned to print UVs; AR also punches landmarks)
    cutFeatures(ctx, size, f)
    return c.toDataURL('image/png')
  })
}
