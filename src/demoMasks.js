/**
 * Stylised opera-style demo masks.
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

export function createDemoMaskDataUrls(size = 512) {
  const styles = [
    { name: '紅', fill: '#c41e3a', accent: '#1a1a1a', pattern: 'red' },
    { name: '白', fill: '#f5f0e6', accent: '#1e3a8a', pattern: 'white' },
    { name: '藍', fill: '#1d4ed8', accent: '#f5f0e6', pattern: 'blue' },
    { name: '黃', fill: '#eab308', accent: '#7f1d1d', pattern: 'yellow' },
  ]

  const { cx, cy, rx, ry } = MASK_OVAL
  const f = MASK_FEATURES

  return styles.map((s) => {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, size, size)

    // Face oval — fills the shared template oval (no inset transparent margin)
    ctx.fillStyle = s.fill
    ctx.beginPath()
    ctx.ellipse(size * cx, size * cy, size * rx, size * ry, 0, 0, Math.PI * 2)
    ctx.fill()

    // Brow / forehead pattern (above eyes)
    ctx.strokeStyle = s.accent
    ctx.lineWidth = size * 0.035
    ctx.lineCap = 'round'
    ctx.beginPath()
    const browY = size * (f.leftEye.y - 0.08)
    ctx.moveTo(size * (cx - rx * 0.72), browY)
    ctx.quadraticCurveTo(size * cx, size * (cy - ry * 0.72), size * (cx + rx * 0.72), browY)
    ctx.stroke()

    // Nose bridge between eyes → toward mouth
    ctx.lineWidth = size * 0.02
    ctx.beginPath()
    ctx.moveTo(size * cx, size * (f.leftEye.y + 0.02))
    ctx.lineTo(size * cx, size * (f.mouth.y - 0.06))
    ctx.stroke()

    // Cheek accents
    ctx.lineWidth = size * 0.018
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(size * (cx + side * rx * 0.62), size * (f.leftEye.y + 0.06))
      ctx.quadraticCurveTo(
        size * (cx + side * rx * 0.78),
        size * ((f.leftEye.y + f.mouth.y) / 2),
        size * (cx + side * rx * 0.48),
        size * (f.mouth.y + 0.04),
      )
      ctx.stroke()
    }

    // Soft lip tint around mouth hole (does not fill the hole)
    ctx.beginPath()
    ctx.ellipse(
      size * f.mouth.x,
      size * f.mouth.y,
      size * (f.mouthRx * 1.35),
      size * (f.mouthRy * 1.45),
      0,
      0,
      Math.PI * 2,
    )
    ctx.strokeStyle = s.pattern === 'white' ? '#9f1239' : s.accent
    ctx.lineWidth = size * 0.022
    ctx.stroke()

    // Transparent eye / mouth cutouts (aligned to print UVs; AR also punches landmarks)
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

    return c.toDataURL('image/png')
  })
}
