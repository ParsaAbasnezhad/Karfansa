const fs = require('fs')
const path = require('path')

const root = __dirname
const mode = process.argv[2] || 'baseline'
const ports = { browser: 9223, api: 8000, vite: 5173 }
const sizes = mode === 'baseline' ? [390, 768] : [320, 360, 375, 390, 430, 768, 1440]
const cases = [
  { name: 'verification-organization', kind: 'organization', status: 'rejected', route: '/business?section=verification' },
  { name: 'profile-organization', kind: 'organization', status: 'verified', route: '/business?section=profile' },
  { name: 'profile-individual', kind: 'individual', status: 'draft', route: '/business?section=profile' },
]

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function createTab(url) {
  const response = await fetch(`http://127.0.0.1:${ports.browser}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  if (!response.ok) throw new Error(`CDP new tab ${response.status}`)
  return response.json()
}

async function connect(tab) {
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let serial = 0
  const pending = new Map()
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data)
    if (!msg.id) return
    const promise = pending.get(msg.id)
    if (!promise) return
    pending.delete(msg.id)
    if (msg.error) promise.reject(new Error(`${promise.method}: ${JSON.stringify(msg.error)}`))
    else promise.resolve(msg.result)
  })
  return {
    ws,
    send(method, params = {}) {
      const id = ++serial
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method })
        ws.send(JSON.stringify({ id, method, params }))
      })
    },
  }
}

async function capture(testCase, width) {
  const height = width <= 430 ? 844 : 900
  await fetch(`http://127.0.0.1:${ports.api}/__mode?kind=${testCase.kind}&status=${testCase.status}`)
  const url = `http://127.0.0.1:${ports.vite}${testCase.route}`
  const tab = await createTab(url)
  const { ws, send } = await connect(tab)
  try {
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width <= 430,
      screenWidth: width, screenHeight: height,
    })
    await send('Page.navigate', { url })
    for (let attempt = 0; attempt < 35; attempt++) {
      const ready = await send('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('.biz-card form') || document.querySelector('.bos-detail-grid .bos-empty'))`,
        returnByValue: true,
      })
      if (ready.result.value) break
      await wait(200)
    }
    await wait(300)
    const measurement = await send('Runtime.evaluate', {
      expression: `({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        title: document.title,
        heading: document.querySelector('.bos-section-title h2')?.textContent?.trim(),
        page: (() => { const r = document.querySelector('.business-os')?.getBoundingClientRect(); return r ? { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) } : null })(),
      })`,
      returnByValue: true,
    })
    const metrics = await send('Page.getLayoutMetrics')
    const contentHeight = Math.min(Math.ceil(metrics.cssContentSize.height), 4800)
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: contentHeight, scale: 1 },
    })
    const name = `${mode}-${testCase.name}-${width}.png`
    fs.writeFileSync(path.join(root, name), Buffer.from(screenshot.data, 'base64'))
    return { name, ...measurement.result.value, height: contentHeight }
  } finally {
    ws.close()
    await fetch(`http://127.0.0.1:${ports.browser}/json/close/${tab.id}`).catch(() => {})
  }
}

async function main() {
  const rows = []
  for (const testCase of cases) {
    for (const width of sizes) {
      const result = await capture(testCase, width)
      rows.push(result)
      process.stdout.write(`${result.name}: viewport ${result.viewport}, scroll ${result.document}, height ${result.height}\n`)
    }
  }
  fs.writeFileSync(path.join(root, `${mode}-measurements.json`), JSON.stringify(rows, null, 2))
}

main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1 })
