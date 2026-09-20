#!/usr/bin/env node
/**
 * Render the guitar mark to PNG at the sizes a home-screen install needs.
 *
 * public/guitar.svg is the source of truth for the shape, but an installed
 * icon has to be PNG: manifest support for SVG is patchy across Android
 * launchers, and iOS apple-touch-icon does not take SVG at all. There is no
 * rasteriser on this machine and no image library in the project, so the
 * geometry is re-stated here and drawn directly — any change to the SVG has
 * to be mirrored below, which is why the numbers carry the same comments.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')

const TILE = [0x16, 0x1b, 0x22] //  --panel
const MARK = [0x1d, 0xb9, 0x54] //  --accent

// ---------------------------------------------------------------- geometry
// All in the SVG's own 32×32 user space.
const circles = [
  { cx: 12.2, cy: 21, r: 7.3 },   // lower bout
  { cx: 18, cy: 14, r: 5.4 },     // upper bout
]
const rects = [
  { x: 19.6, y: 3.4, w: 3, h: 15, a: 37, px: 21.15, py: 11.4 },   // neck
  { x: 18.8, y: 0.8, w: 4.6, h: 4, a: 37, px: 21.15, py: 11.4 },  // headstock
]
const hole = { cx: 12.8, cy: 20.4, r: 2 }

const inCircle = (x, y, c) => (x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.r * c.r

/** Inverse-rotate the point, then test the axis-aligned rectangle. */
function inRect(x, y, r) {
  const a = (-r.a * Math.PI) / 180
  const dx = x - r.px
  const dy = y - r.py
  const ux = dx * Math.cos(a) - dy * Math.sin(a) + r.px
  const uy = dx * Math.sin(a) + dy * Math.cos(a) + r.py
  return ux >= r.x && ux <= r.x + r.w && uy >= r.y && uy <= r.y + r.h
}

/** Rounded square, matching the SVG's rx. Skipped for maskable icons, where
 *  the launcher applies its own mask and a pre-rounded tile shows gaps. */
function inTile(x, y, rx) {
  if (rx <= 0) return true
  const cx = Math.min(Math.max(x, rx), 32 - rx)
  const cy = Math.min(Math.max(y, rx), 32 - rx)
  return (x - cx) ** 2 + (y - cy) ** 2 <= rx * rx
}

/**
 * @param scale  how much of the 32-unit box the art fills. Maskable icons get
 *               less: a launcher may crop to a circle inscribed in the middle
 *               80%, and a mark drawn edge to edge loses its headstock.
 */
function sample(x, y, rx, scale, bare) {
  const m = 16 * (1 - scale)
  const u = (x - m) / scale
  const v = (y - m) / scale
  if (!inTile(x, y, rx)) return null
  if (u >= 0 && u <= 32 && v >= 0 && v <= 32) {
    // `bare` draws the mark alone on transparency, for an adaptive icon's
    // foreground layer: Android composites it over its own background and
    // shifts the two apart for parallax, which an opaque tile would defeat.
    if (inCircle(u, v, hole)) return bare ? null : TILE
    if (circles.some((c) => inCircle(u, v, c))) return MARK
    if (rects.some((r) => inRect(u, v, r))) return MARK
  }
  return bare ? null : TILE
}

/** 4×4 supersampling — without it every curve and the diagonal neck alias badly. */
function render(size, { rx = 7, scale = 1, bare = false } = {}) {
  const px = Buffer.alloc(size * size * 4)
  const SS = 4
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((i + (sx + 0.5) / SS) / size) * 32
          const y = ((j + (sy + 0.5) / SS) / size) * 32
          const c = sample(x, y, rx, scale, bare)
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255 }
        }
      }
      const n = SS * SS
      const o = (j * size + i) * 4
      // Un-premultiply: averaging colour over covered samples only keeps the
      // edge hue true instead of darkening it toward transparent black.
      const cov = a / 255
      px[o] = cov ? Math.round(r / cov) : 0
      px[o + 1] = cov ? Math.round(g / cov) : 0
      px[o + 2] = cov ? Math.round(b / cov) : 0
      px[o + 3] = Math.round(a / n)
    }
  }
  return px
}

// ---------------------------------------------------------------- png
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([len, body, crc])
}

let TABLE = null
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      TABLE[n] = c
    }
  }
  let c = -1
  for (const byte of buf) c = TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return c ^ -1
}

function png(size, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8    // bit depth
  ihdr[9] = 6    // RGBA
  // Each scanline carries a filter byte; 0 means none, which compresses
  // perfectly well for flat colour and keeps this readable.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let j = 0; j < size; j++) {
    raw[j * (size * 4 + 1)] = 0
    px.copy(raw, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const targets = [
  ['icon-192.png', 192, { rx: 7 }],
  ['icon-512.png', 512, { rx: 7 }],
  // Maskable: full-bleed background, art pulled into the safe area.
  ['icon-maskable-512.png', 512, { rx: 0, scale: 0.72 }],
  // iOS composites onto its own rounded rect, so this one ships square.
  ['apple-touch-icon.png', 180, { rx: 0 }],
]

for (const [name, size, opts] of targets) {
  const file = path.join(OUT, name)
  writeFileSync(file, png(size, render(size, opts)))
  console.log(`${name.padEnd(26)} ${size}×${size}`)
}

// ---------------------------------------------------------------- android
// Launcher icons, written straight into the native project. Android wants a
// bitmap per density; the adaptive foreground is drawn at the maskable scale
// because the launcher crops it to whatever shape the device uses.
const android = [
  ['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192],
]
const RES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'android', 'app', 'src', 'main', 'res')
import { existsSync, mkdirSync } from 'node:fs'
if (existsSync(RES)) {
  for (const [density, size] of android) {
    const dir = path.join(RES, `mipmap-${density}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'ic_launcher.png'), png(size, render(size, { rx: 7 })))
    writeFileSync(path.join(dir, 'ic_launcher_round.png'), png(size, render(size, { rx: 16 })))
    writeFileSync(
      path.join(dir, 'ic_launcher_foreground.png'),
      png(size * 2, render(size * 2, { rx: 0, scale: 0.72, bare: true })),
    )
    console.log(`android mipmap-${density.padEnd(8)} ${size}×${size}`)
  }
}
