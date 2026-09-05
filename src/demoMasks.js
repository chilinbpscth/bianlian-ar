/** Draw stylised opera-style demo masks onto offscreen canvases. */
export function createDemoMaskDataUrls(size = 512) {
  const styles = [
    { name: '紅', fill: '#c41e3a', accent: '#1a1a1a', eye: '#111', pattern: 'red' },
    { name: '白', fill: '#f5f0e6', accent: '#1e3a8a', eye: '#111', pattern: 'white' },
    { name: '藍', fill: '#1d4ed8', accent: '#f5f0e6', eye: '#0b1020', pattern: 'blue' },
    { name: '黃', fill: '#eab308', accent: '#7f1d1d', eye: '#111', pattern: 'yellow' },
  ]

  return styles.map((s) => {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, size, size)

    // Face oval
    ctx.fillStyle = s.fill
    ctx.beginPath()
    ctx.ellipse(size * 0.5, size * 0.52, size * 0.38, size * 0.46, 0, 0, Math.PI * 2)
    ctx.fill()

    // Brow / forehead pattern
    ctx.strokeStyle = s.accent
    ctx.lineWidth = size * 0.035
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(size * 0.22, size * 0.38)
    ctx.quadraticCurveTo(size * 0.5, size * 0.22, size * 0.78, size * 0.38)
    ctx.stroke()

    // Eyes
    ctx.fillStyle = s.eye
    for (const x of [0.35, 0.65]) {
      ctx.beginPath()
      ctx.ellipse(size * x, size * 0.48, size * 0.07, size * 0.045, x < 0.5 ? -0.2 : 0.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Nose bridge
    ctx.strokeStyle = s.accent
    ctx.lineWidth = size * 0.02
    ctx.beginPath()
    ctx.moveTo(size * 0.5, size * 0.5)
    ctx.lineTo(size * 0.5, size * 0.62)
    ctx.stroke()

    // Mouth
    ctx.beginPath()
    ctx.ellipse(size * 0.5, size * 0.74, size * 0.12, size * 0.05, 0, 0, Math.PI * 2)
    ctx.fillStyle = s.pattern === 'white' ? '#9f1239' : s.accent
    ctx.fill()

    // Cheek accents
    ctx.strokeStyle = s.accent
    ctx.lineWidth = size * 0.018
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(size * (0.5 + side * 0.28), size * 0.58)
      ctx.quadraticCurveTo(size * (0.5 + side * 0.34), size * 0.68, size * (0.5 + side * 0.22), size * 0.78)
      ctx.stroke()
    }

    return c.toDataURL('image/png')
  })
}
