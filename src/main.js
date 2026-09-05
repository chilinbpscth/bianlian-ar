import { createPaintScreen } from "./paint.js"
import { createArScreen } from "./ar.js"

const app = document.querySelector("#app")
let current = null

function showPaint() {
  current?.destroy?.()
  current = createPaintScreen(app, {
    onStartAr(maskCanvases) {
      showAr(maskCanvases)
    },
  })
}

function showAr(maskCanvases) {
  current?.destroy?.()
  current = createArScreen(app, {
    maskCanvases,
    onBack: showPaint,
  })
}

showPaint()
