import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const svg = await readFile(new URL('../public/site-icon.svg', import.meta.url))
await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true })

const iconTargets = [
  ['../public/favicon.png', 64, 64],
  ['../public/favicon.ico', 32, 32],
  ['../public/apple-touch-icon.png', 180, 180],
  ['../public/icons/icon-192.png', 192, 192],
  ['../public/icons/icon-512.png', 512, 512],
]

for (const [path, width, height] of iconTargets) {
  await sharp(svg).resize(width, height).png().toFile(fileURLToPath(new URL(path, import.meta.url)))
}

const ogSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630">
      <stop stop-color="#121824"/>
      <stop offset="1" stop-color="#1D2330"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1040" cy="110" r="210" fill="#8A2BE2" opacity=".32"/>
  <circle cx="180" cy="520" r="220" fill="#FFCC00" opacity=".18"/>
  <image href="data:image/svg+xml;base64,${svg.toString('base64')}" x="86" y="105" width="260" height="260"/>
  <text x="390" y="250" fill="#FFFFFF" font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" font-size="86" font-weight="900">荒野報馬仔</text>
  <text x="395" y="330" fill="#FFCC00" font-family="Arial, sans-serif" font-size="34" font-weight="700">Brawl Stars Meta, Draft &amp; Counter Tool</text>
  <text x="395" y="398" fill="#CBD5E1" font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" font-size="30" font-weight="700">真實天梯勝率 · 地圖選角 · 台灣繁中資料</text>
</svg>
`)

await sharp(ogSvg).png().toFile(fileURLToPath(new URL('../public/og-image.png', import.meta.url)))
