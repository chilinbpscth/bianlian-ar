import { createHomeScreen } from "./home.js"
import { createUploadScreen } from "./upload.js"
import { createPaintScreen } from "./paint.js"
import { createArScreen } from "./ar.js"

const app = document.querySelector("#app")
let current = null
/** @type {'home' | 'upload' | 'paint'} */
let returnTo = "home"

function showHome() {
  current?.destroy?.()
  returnTo = "home"
  current = createHomeScreen(app, {
    onPhysical: showUpload,
    onDigital: showPaint,
  })
}

function showUpload() {
  current?.destroy?.()
  returnTo = "upload"
  current = createUploadScreen(app, {
    onStartAr(maskCanvases) {
      showAr(maskCanvases)
    },
    onBack: showHome,
  })
}

function showPaint() {
  current?.destroy?.()
  returnTo = "paint"
  current = createPaintScreen(app, {
    onStartAr(maskCanvases) {
      showAr(maskCanvases)
    },
    onBack: showHome,
  })
}

function showAr(maskCanvases) {
  current?.destroy?.()
  current = createArScreen(app, {
    maskCanvases,
    onBack() {
      if (returnTo === "upload") showUpload()
      else if (returnTo === "paint") showPaint()
      else showHome()
    },
  })
}

showHome()
