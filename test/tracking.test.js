import test from "node:test"
import assert from "node:assert/strict"
import { advanceTrack, createTracking, updateSwipe } from "../src/tracking.js"

function player() {
  return { stage: 0, cooldownUntil: 0, seenHandAt: -Infinity, entry: null, inside: false, metrics: { cx: 0, cy: 0, rx: 100, ry: 100 } }
}
for (const [name, dx, dy] of [["horizontal", 1, 0], ["vertical", 0, 1], ["diagonal", 0.7, 0.7]]) {
  test(`one ${name} pass advances once`, () => {
    const t = player()
    assert.equal(updateSwipe(t, { x: -150 * dx, y: -150 * dy }, 0), false)
    assert.equal(updateSwipe(t, { x: 0, y: 0 }, 100), false)
    assert.equal(updateSwipe(t, { x: 150 * dx, y: 150 * dy }, 200), true)
    assert.equal(t.stage, 1)
    assert.equal(updateSwipe(t, { x: -150 * dx, y: -150 * dy }, 220), false)
  })
}
test("same-side return and hand disappearance do not trigger", () => {
  const t = player()
  updateSwipe(t, { x: -150, y: 0 }, 0)
  updateSwipe(t, { x: 0, y: 0 }, 100)
  assert.equal(updateSwipe(t, null, 130), false)
  assert.equal(updateSwipe(t, { x: -150, y: 0 }, 180), false)
  assert.equal(t.stage, 0)
})
test("brief tracking loss can resume; stale tracking cannot", () => {
  for (const [exitAt, expected] of [[240, true], [500, false]]) {
    const t = player()
    updateSwipe(t, { x: -150, y: 0 }, 0)
    updateSwipe(t, { x: 0, y: 0 }, 100)
    updateSwipe(t, null, 150)
    assert.equal(updateSwipe(t, { x: 150, y: 0 }, exitAt), expected)
  }
})
test("slow continuous sweep does not time out", () => {
  const t = player()
  updateSwipe(t, { x: -150, y: 0 }, 0)
  for (let now = 100; now <= 2500; now += 100) updateSwipe(t, { x: 0, y: 0 }, now)
  assert.equal(updateSwipe(t, { x: 150, y: 0 }, 2600), true)
})
test("five stages cycle independently with a per-player cooldown", () => {
  const a = player(), b = player()
  for (let i = 0; i < 5; i++) assert.equal(advanceTrack(a, i * 300), true)
  assert.equal(a.stage, 0)
  assert.equal(b.stage, 0)
  assert.equal(advanceTrack(b, 1200), true)
  assert.equal(advanceTrack(a, 1201), false)
})
function face(x) {
  const lm = Array.from({ length: 468 }, () => ({ x, y: 0.5 }))
  lm[10] = { x, y: 0.3 }; lm[152] = { x, y: 0.7 }
  lm[234] = { x: x - 0.1, y: 0.5 }; lm[454] = { x: x + 0.1, y: 0.5 }
  return lm
}
const hand = x => Array.from({ length: 21 }, () => ({ x, y: 0.5 }))
test("face result reordering preserves each player's progress", () => {
  const tracking = createTracking(), a = face(0.25), b = face(0.75)
  const first = tracking.update([a, b], [], 1000, 1000, 0).visible
  advanceTrack(first[0], 0)
  const next = tracking.update([b, a], [], 1000, 1000, 100).visible
  assert.equal(next.find(t => t.face === a).stage, 1)
  assert.equal(next.find(t => t.face === b).stage, 0)
})
test("one player's sweep does not change the other player", () => {
  const tracking = createTracking(), faces = [face(0.25), face(0.75)]
  tracking.update(faces, [hand(0.08)], 1000, 1000, 0)
  tracking.update(faces, [hand(0.25)], 1000, 1000, 100)
  const result = tracking.update(faces, [hand(0.42)], 1000, 1000, 200)
  assert.deepEqual(result.visible.map(t => t.stage), [1, 0])
  assert.equal(result.changed.length, 1)
})
test("reordering two hand detections does not swap gestures", () => {
  const tracking = createTracking(), faces = [face(0.25), face(0.75)]
  tracking.update(faces, [hand(0.08), hand(0.92)], 1000, 1000, 0)
  tracking.update(faces, [hand(0.75), hand(0.25)], 1000, 1000, 100)
  const result = tracking.update(faces, [hand(0.42), hand(0.58)], 1000, 1000, 200)
  assert.deepEqual(result.visible.map(t => t.stage), [1, 1])
})
test("a player absent for over 1.5 seconds starts afresh", () => {
  const tracking = createTracking(), faces = [face(0.25)]
  const old = tracking.update(faces, [], 1000, 1000, 0).visible[0]
  advanceTrack(old, 0)
  tracking.update([], [], 1000, 1000, 1600)
  const current = tracking.update(faces, [], 1000, 1000, 1700).visible[0]
  assert.notEqual(current.id, old.id)
  assert.equal(current.stage, 0)
})
