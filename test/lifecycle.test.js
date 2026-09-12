import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { SourceTextModule, SyntheticModule, createContext } from "node:vm"
import * as tracking from "../src/tracking.js"
import { MASK_FEATURES } from "../src/demoMasks.js"

const deferred = () => {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
const model = () => ({ closes: 0, close() { this.closes++ }, detectForVideo() { return {} } })

async function fixture({ camera, vision, face, hand, landmarks } = {}) {
  const mediaTrack = { stops: 0, stop() { this.stops++ } }
  const stream = { getTracks: () => [mediaTrack] }
  const faceModel = model(), handModel = model()
  if (landmarks) faceModel.detectForVideo = () => ({ faceLandmarks: [landmarks] })
  const delegates = []
  const transforms = []
  const drawing = new Proxy({}, { get: (_, key) => (...args) => { if (key === "setTransform") transforms.push(args) } })
  const nodes = new Map()
  const root = { innerHTML: "", querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      textContent: "", innerHTML: "", className: "", readyState: landmarks ? 2 : 0,
      videoWidth: 1000, videoHeight: 1000, currentTime: 0,
      getContext: () => drawing, play: async () => {}, querySelector: () => null,
      appendChild() {},
    })
    return nodes.get(selector)
  } }
  const context = createContext({
    console, URLSearchParams, location: { search: "", hash: "" },
    navigator: { mediaDevices: { getUserMedia: () => camera?.promise || Promise.resolve(stream) } },
    performance: { now: () => 0 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout: () => 1, clearTimeout() {},
  })
  const visionExports = {
    FilesetResolver: { forVisionTasks: () => vision?.promise || Promise.resolve({}) },
    FaceLandmarker: { createFromOptions: () => face?.promise || Promise.resolve(faceModel) },
    HandLandmarker: { createFromOptions: (_, options) => {
      delegates.push(options.baseOptions.delegate)
      return hand ? hand(options.baseOptions.delegate) : Promise.resolve(handModel)
    } },
  }
  const source = new SourceTextModule(await readFile(new URL("../src/ar.js", import.meta.url), "utf8"), { context })
  await source.link(specifier => {
    const exports = specifier.includes("tasks-vision") ? visionExports
      : specifier.endsWith("models.json") ? { default: {} }
      : specifier.endsWith("tracking.js") ? tracking : { MASK_FEATURES }
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await source.evaluate()
  const screen = source.namespace.createArScreen(root, { maskCanvases: [{ width: 512, height: 512 }], onBack() {} })
  return { screen, root, stream, mediaTrack, faceModel, handModel, delegates, transforms }
}

test("leaving before camera resolves stops the late stream without replacing the new screen", async () => {
  const camera = deferred(), f = await fixture({ camera })
  f.screen.destroy()
  f.root.innerHTML = "next screen"
  camera.resolve(f.stream)
  await flush()
  assert.equal(f.mediaTrack.stops, 1)
  assert.equal(f.root.innerHTML, "next screen")
})

test("leaving during face model creation closes the late model", async () => {
  const face = deferred(), f = await fixture({ face })
  await flush()
  f.screen.destroy()
  face.resolve(f.faceModel)
  await flush()
  assert.equal(f.faceModel.closes, 1)
  assert.equal(f.delegates.length, 0)
  assert.equal(f.mediaTrack.stops, 1)
})

test("leaving during hand model creation closes both models exactly once", async () => {
  const pending = deferred(), f = await fixture({ hand: () => pending.promise })
  await flush()
  f.screen.destroy()
  pending.resolve(f.handModel)
  await flush()
  f.screen.destroy()
  assert.equal(f.faceModel.closes, 1)
  assert.equal(f.handModel.closes, 1)
  assert.equal(f.mediaTrack.stops, 1)
})

test("hand GPU failure falls back without replacing or leaking the face model", async () => {
  const cpuHand = model()
  const f = await fixture({ hand: delegate => delegate === "GPU" ? Promise.reject(new Error("GPU unavailable")) : Promise.resolve(cpuHand) })
  await flush()
  assert.deepEqual(f.delegates, ["GPU", "CPU"])
  assert.equal(f.faceModel.closes, 0)
  f.screen.destroy()
  assert.equal(f.faceModel.closes, 1)
  assert.equal(cpuHand.closes, 1)
})


test("mask artwork maps image-left to image-left without a horizontal flip", async () => {
  const landmarks = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }))
  for (const i of [33,160,158,133,153,144]) landmarks[i] = { x: 0.35, y: 0.4 }
  for (const i of [362,385,387,263,373,380]) landmarks[i] = { x: 0.65, y: 0.4 }
  for (const i of [61,40,37,0,267,270,291,321,314,17,84,91]) landmarks[i] = { x: 0.5, y: 0.7 }
  landmarks[10] = { x: 0.5, y: 0.2 }; landmarks[152] = { x: 0.5, y: 0.8 }
  landmarks[234] = { x: 0.25, y: 0.5 }; landmarks[454] = { x: 0.75, y: 0.5 }
  const f = await fixture({ landmarks })
  await flush()
  const [a, b, c, d, e, g] = f.transforms[0]
  const x = MASK_FEATURES.leftEye.x * 512, y = MASK_FEATURES.leftEye.y * 512
  assert.ok(a > 0, "mask must not be reflected")
  assert.ok(Math.abs(a * x + c * y + e - 350) < 1e-6)
  assert.ok(Math.abs(b * x + d * y + g - 400) < 1e-6)
  f.screen.destroy()
})
