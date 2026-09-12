const COOLDOWN_MS = 300
const LOST_FACE_MS = 1500

export function faceMetrics(face, w, h) {
  const top = face[10], chin = face[152], left = face[234], right = face[454]
  return {
    cx: (top.x + chin.x) * w / 2,
    cy: (top.y + chin.y) * h / 2,
    rx: Math.max(60, Math.hypot((left.x - right.x) * w, (left.y - right.y) * h)) * 0.55,
    ry: Math.max(70, Math.hypot((top.x - chin.x) * w, (top.y - chin.y) * h)) * 0.65,
  }
}

export function advanceTrack(track, now) {
  if (now < track.cooldownUntil) return false
  track.stage = (track.stage + 1) % 5
  track.cooldownUntil = now + COOLDOWN_MS
  track.entry = null
  track.inside = false
  return true
}

// A missing hand alone is not a completed gesture. Allow brief occlusion,
// but require an observed exit on the opposite side to avoid false changes.
export function updateSwipe(track, hand, now) {
  if (now < track.cooldownUntil || now - track.seenHandAt > 250) {
    track.entry = null
    track.inside = false
  }
  if (!hand || now < track.cooldownUntil) return false
  track.seenHandAt = now
  const { cx, cy, rx, ry } = track.metrics
  const x = (hand.x - cx) / rx, y = (hand.y - cy) / ry
  const radius = Math.hypot(x, y)
  if (radius > 1.05) {
    const direction = { x: x / radius, y: y / radius }
    if (track.inside && track.entry && track.entry.x * direction.x + track.entry.y * direction.y < -0.15) {
      return advanceTrack(track, now)
    }
    track.entry = direction
    track.inside = false
  } else if (radius < 0.85 && track.entry) {
    track.inside = true
  }
  return false
}

export function createTracking() {
  let nextId = 1
  let tracks = []
  return {
    update(faces, hands, w, h, now) {
      tracks = tracks.filter(t => now - t.lastSeen <= LOST_FACE_MS)
      const detections = faces.slice(0, 2).map(face => ({ face, metrics: faceMetrics(face, w, h) }))
      const pairs = []
      for (const track of tracks) for (const detection of detections) {
        const distance = Math.hypot(track.metrics.cx - detection.metrics.cx, track.metrics.cy - detection.metrics.cy)
        if (distance < detection.metrics.rx * 2.7) pairs.push({ track, detection, distance })
      }
      const usedTracks = new Set(), usedDetections = new Set()
      for (const { track, detection } of pairs.sort((a, b) => a.distance - b.distance)) {
        if (usedTracks.has(track) || usedDetections.has(detection)) continue
        Object.assign(track, detection, { lastSeen: now })
        usedTracks.add(track)
        usedDetections.add(detection)
      }
      for (const detection of detections) {
        if (usedDetections.has(detection)) continue
        // Replace a missing player when both slots were previously occupied.
        if (tracks.length >= 2) {
          const missing = tracks.findIndex(t => !usedTracks.has(t))
          if (missing < 0) continue
          tracks.splice(missing, 1)
        }
        const track = { id: nextId++, stage: 0, cooldownUntil: 0, entry: null, inside: false, seenHandAt: -Infinity, lastSeen: now, ...detection }
        tracks.push(track)
        usedTracks.add(track)
      }
      const visible = tracks.filter(t => usedTracks.has(t))
      const assigned = new Map()
      for (const hand of hands) {
        const points = [0, 5, 9, 13, 17].map(i => hand[i])
        const palm = { x: points.reduce((s, p) => s + p.x, 0) * w / 5, y: points.reduce((s, p) => s + p.y, 0) * h / 5 }
        let nearest = null, best = Infinity
        for (const track of visible) {
          const { cx, cy, rx, ry } = track.metrics
          const distance = Math.hypot((palm.x - cx) / rx, (palm.y - cy) / ry)
          if (distance < best) { nearest = track; best = distance }
        }
        // Both hands near one person stay with that person, never their neighbour.
        if (nearest && best < 4 && (!assigned.has(nearest) || best < assigned.get(nearest).distance)) {
          assigned.set(nearest, { palm, distance: best })
        }
      }
      const changed = []
      for (const track of tracks) {
        if (updateSwipe(track, assigned.get(track)?.palm, now)) changed.push(track)
      }
      return { visible, changed }
    },
  }
}
