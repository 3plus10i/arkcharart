import * as cheerio from 'cheerio'
import { appendFileSync, createReadStream, openSync, readSync, statSync, closeSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// ===== Config =====
const API = 'https://prts.wiki/api.php'
const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV_PATH = resolve(__dirname, 'ark_chars.csv')
const CSV_HEADERS = ['角色名', '外文名', '性别', '立绘编号', '文件名', '文件链接', '势力logo', '出处', '星级', '内部编号', '职业', '分支', '势力', '出身地', '上线时间', '时装品牌', '时装名']
const BLACKLIST = new Set([
  '预备干员-近战', '预备干员-狙击', '预备干员-后勤', '预备干员-术师', '预备干员-重装',
  'Sharp', 'Stormeye', 'Pith', 'Touch', '郁金香',
  '预备干员-先锋(卫戍协议)', '预备干员-近卫(卫戍协议)', '预备干员-重装(卫戍协议)',
  '预备干员-狙击(卫戍协议)', '预备干员-术师(卫戍协议)', '预备干员-医疗(卫戍协议)',
  '预备干员-辅助(卫戍协议)', '预备干员-特种(卫戍协议)',
  '郁金香(卫戍协议)', 'Sharp(卫戍协议)', 'Mechanist(卫戍协议)',
  'Stormeye(卫戍协议)', 'Pith(卫戍协议)', 'Touch(卫戍协议)',
  'Raidian(卫戍协议)', 'Misery(卫戍协议)',
  '盟约·辅助干员', '领主·Sharp',
])
const SKIN_CHAR_BLACKLIST = new Set(['海猫', '全知海猫', 'F91'])

// ===== Utilities =====
function timestamp() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function log(tag, msg) {
  console.log(`[${timestamp()}][${tag}] ${msg}`)
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

let _lastFetch = 0
async function rateLimitedFetch(url, options = {}) {
  const gap = Date.now() - _lastFetch
  if (gap < 1000) await sleep(1003 - gap)
  _lastFetch = Date.now()
  const resp = await fetch(url, { ...options, headers: { Accept: 'application/json', ...options.headers } })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

function parseCsvLine(line) {
  const fields = []; let cur = ''; let inQuote = false
  for (const ch of line) {
    if (inQuote) {
      if (ch === '"') { inQuote = false } else { cur += ch }
    } else {
      if (ch === '"') { inQuote = true } else if (ch === ',') { fields.push(cur); cur = '' } else { cur += ch }
    }
  }
  fields.push(cur)
  return fields
}

function escapeCsv(val) {
  if (val == null) return ''
  const s = String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s
}

function rowToCsvLine(row) {
  return CSV_HEADERS.map(h => escapeCsv(row[h] ?? '')).join(',')
}

function buildApiUrl(params) {
  const url = new URL(API)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.href
}

// ===== 1. Read old CSV data =====
async function extractOldData(filepath) {
  log('extractOldData', '读取 ark_chars.csv ...')
  const oldChars = new Set()
  const oldSkins = new Set()
  const oldCharSkinIds = new Map() // 角色名 → Set<立绘编号>

  const rl = createInterface({ input: createReadStream(filepath, 'utf-8'), crlfDelay: Infinity })
  let isHeader = true
  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue }
    if (!line.trim()) continue
    const cols = parseCsvLine(line)
    if (cols.length < 5) continue
    const name = cols[0]
    const skinId = cols[3]
    oldChars.add(name)
    oldSkins.add(cols[4])
    if (!oldCharSkinIds.has(name)) oldCharSkinIds.set(name, new Set())
    oldCharSkinIds.get(name).add(skinId)
  }
  log('extractOldData', `已有 ${oldChars.size} 个干员, ${oldSkins.size} 个立绘/时装`)
  return { oldChars, oldSkins, oldCharSkinIds }
}

// ===== 2. PRTS tool functions =====
async function getPrtsFile(filename) {
  const url = buildApiUrl({
    action: 'query', format: 'json', formatversion: '2',
    titles: `File:${filename}`, prop: 'imageinfo', iiprop: 'url', redirects: '1',
  })
  log('getPrtsFile', `查链: ${filename}`)
  const data = await rateLimitedFetch(url)
  const page = data?.query?.pages?.[0]
  if (!page || page.missing) throw new Error(`文件不存在: ${filename}`)
  const fileUrl = page?.imageinfo?.[0]?.url
  if (!fileUrl) throw new Error(`无URL: ${filename}`)
  return fileUrl
}

async function getSkinsPageImages(page) {
  const url = buildApiUrl({
    action: 'parse', format: 'json', formatversion: '2',
    page, prop: 'images',
  })
  log('getSkinsPageImages', `拉取 ${page} ...`)
  const data = await rateLimitedFetch(url)
  const images = data?.parse?.images || []
  const skinImages = images.filter(f => /^立绘_.+_skin\d+\.png$/.test(f))
  log('getSkinsPageImages', `共 ${images.length} 个文件, 时装立绘 ${skinImages.length} 个`)
  return skinImages
}

// ===== 3. Fetch char basic (name + online_date) =====
async function fetchCharsBasic() {
  const url = buildApiUrl({
    action: 'parse', format: 'json', formatversion: '2',
    page: '干员一览/干员id', prop: 'text',
  })
  log('fetchCharsBasic', '拉取 干员一览/干员id ...')
  const data = await rateLimitedFetch(url)
  const html = data?.parse?.text
  if (!html) throw new Error('干员id 响应无 parse.text')

  const $ = cheerio.load(html)
  const lines = $('pre').text().split('\n').filter(l => l.trim())
  const charMap = {}
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    if (cols.length >= 5) {
      const name = cols[1].trim()
      if (name) charMap[name] = { name_zh: name, online_date: cols[4].trim().slice(0, 10) || null }
    }
  }
  log('fetchCharsBasic', `PRTS 当前 ${Object.keys(charMap).length} 个干员`)
  return charMap
}

// ===== 4. Fetch char detail from 干员一览 =====
async function fetchCharsDetail() {
  const url = buildApiUrl({
    action: 'parse', format: 'json', formatversion: '2',
    page: '干员一览', prop: 'text', redirects: '1',
  })
  log('fetchCharsDetail', `从 干员一览 拉取所有干员详细信息 ...`)
  const data = await rateLimitedFetch(url)
  const html = data?.parse?.text
  if (!html) throw new Error('干员一览 响应无 parse.text')

  const $ = cheerio.load(html)
  const $container = $('#filter-data')
  const records = {}
  $container.children('div').each((_, el) => {
    const $el = $(el)
    const nameZh = ($el.attr('data-zh') || '').trim()
    if (!nameZh) return
    records[nameZh] = {
      角色名: nameZh,
      外文名: ($el.attr('data-en') || '').trim(),
      性别: ($el.attr('data-sex') || '').trim(),
      星级: ($el.attr('data-rarity') || '').trim(),
      内部编号: ($el.attr('data-id') || '').trim(),
      职业: ($el.attr('data-profession') || '').trim(),
      分支: ($el.attr('data-subprofession') || '').trim(),
      势力: ($el.attr('data-logo') || '').trim(),
      势力logo: ($el.attr('data-logo') || '').trim(),
      出身地: ($el.attr('data-birth_place') || '').trim(),
    }
  })
  log('fetchCharsDetail', `详情共 ${Object.keys(records).length} 条`)
  return records
}

// ===== 5. Generate default skin rows for a char =====
function generateDefaultSkinRows(charInfo) {
  const { 角色名, 外文名, 性别, 星级, 内部编号, 职业, 分支, 势力, 势力logo, 出身地, 上线时间 } = charInfo
  const rows = []
  const rarity = parseInt(星级 || '0', 10)

  const base = { 角色名, 外文名, 性别, 势力logo, 出处: '方舟干员', 星级, 内部编号, 职业, 分支, 势力, 出身地, 上线时间: 上线时间 || '', 时装品牌: '', 时装名: '' }

  // 阿米娅升变形态（如 阿米娅(医疗)）无精0立绘，仅精2
  const isAmiyaAlt = 角色名.startsWith('阿米娅(')

  // 精0
  if (!isAmiyaAlt) {
    rows.push({ ...base, 立绘编号: '1', 文件名: `立绘_${角色名}_1.png`, 文件链接: '' })
  }

  // 精2 (rarity >= 4)
  if (rarity >= 4) {
    rows.push({ ...base, 立绘编号: '2', 文件名: `立绘_${角色名}_2.png`, 文件链接: '' })
  }

  // 阿米娅 1+（仅本体，不含升变）
  if (角色名 === '阿米娅') {
    rows.push({ ...base, 立绘编号: '1+', 文件名: `立绘_${角色名}_1+.png`, 文件链接: '' })
  }

  return rows
}

// ===== 6. Append to CSV (no extra blank line at start) =====
function appendToCsv(filepath, rows) {
  if (!rows.length) { log('appendToCsv', '无新增数据'); return }
  const lines = rows.map(rowToCsvLine)

  // Check if file ends with newline, to avoid creating a blank line
  const fd = openSync(filepath, 'r')
  const { size } = statSync(filepath)
  const lastByte = Buffer.alloc(1)
  if (size > 0) readSync(fd, lastByte, 0, 1, size - 1)
  closeSync(fd)
  const needNewline = size > 0 && lastByte[0] !== 10

  appendFileSync(filepath, (needNewline ? '\n' : '') + lines.join('\n') + '\n', 'utf-8')
  log('appendToCsv', `已追加 ${rows.length} 行 → ${filepath}`)
}

// ===== Main =====
async function main() {
  const startTime = Date.now()
  log('main', '======== ark_chars.csv 更新开始 ========')

  // 1. 读取旧数据
  const { oldChars, oldSkins, oldCharSkinIds } = await extractOldData(CSV_PATH)

  // 2. 拉取当前所有干员信息
  const charBasicMap = await fetchCharsBasic()
  const detailMap = await fetchCharsDetail()

  // 3. 检测新增干员（过滤黑名单）
  const newCharNames = Object.keys(charBasicMap).filter(n => !oldChars.has(n) && !BLACKLIST.has(n))
  const skippedByBlacklist = Object.keys(charBasicMap).filter(n => !oldChars.has(n) && BLACKLIST.has(n))
  const newRows = []

  if (newCharNames.length > 0) {
    log('main', `新增干员 ${newCharNames.length} 个: ${newCharNames.join(', ')}`)
    if (skippedByBlacklist.length) log('main', `黑名单屏蔽 ${skippedByBlacklist.length} 个: ${skippedByBlacklist.join(', ')}`)
    for (const name of newCharNames) {
      const detail = detailMap[name]
      if (!detail) { log('main', `跳过 ${name}（无详情）`); continue }
      detail.上线时间 = charBasicMap[name]?.online_date || ''

      for (const row of generateDefaultSkinRows(detail)) {
        try { row.文件链接 = await getPrtsFile(row.文件名) } catch (e) { log('main', `查链失败 ${row.文件名}: ${e.message}`) }
        newRows.push(row)
      }
    }
  } else {
    log('main', '无新增干员')
    if (skippedByBlacklist.length) log('main', `黑名单屏蔽 ${skippedByBlacklist.length} 个`)
  }

  // 4. 检测新增时装（过滤皮肤黑名单）
  const skinFiles = await getSkinsPageImages('PRTS:文件一览/干员皮肤')
  let newSkinFiles = skinFiles.filter(f => !oldSkins.has(f))

  // 提前过滤皮肤黑名单（海猫等非真实干员皮肤）
  const beforeFilter = newSkinFiles.length
  newSkinFiles = newSkinFiles.filter(f => {
    const m = f.match(/^立绘_(.+)_(skin\d+)\.png$/)
    return m && !SKIN_CHAR_BLACKLIST.has(m[1])
  })
  if (beforeFilter - newSkinFiles.length > 0) {
    log('main', `皮肤黑名单过滤 ${beforeFilter - newSkinFiles.length} 个`)
  }

  if (newSkinFiles.length > 0) {
    log('main', `新增时装 ${newSkinFiles.length} 个`)
    for (const fname of newSkinFiles) {
      const m = fname.match(/^立绘_(.+)_(skin\d+)\.png$/)
      if (!m) continue
      const [_, charName, skinId] = m
      const detail = detailMap[charName]
      if (!detail) { log('main', `跳过 ${charName}（信息不存在）`); continue }

      let fileUrl = ''
      try { fileUrl = await getPrtsFile(fname) } catch (e) { log('main', `查链失败 ${fname}: ${e.message}`) }

      newRows.push({
        角色名: charName, 外文名: detail.外文名 || '', 性别: detail.性别 || '',
        立绘编号: skinId, 文件名: fname, 文件链接: fileUrl,
        势力logo: detail.势力logo || '', 出处: '方舟干员',
        星级: detail.星级 || '', 内部编号: detail.内部编号 || '',
        职业: detail.职业 || '', 分支: detail.分支 || '',
        势力: detail.势力 || '', 出身地: detail.出身地 || '',
        上线时间: charBasicMap[charName]?.online_date || '',
        时装品牌: '', 时装名: '',
      })
    }
  } else {
    log('main', '无新增时装')
  }

  // 5. 检查已有干员是否缺失默认立绘（精0/精2），补全
  const repairedRecords = [] // { name, skinId, filename }
  for (const name of oldChars) {
    const detail = detailMap[name]
    if (!detail) continue
    const rarity = parseInt(detail.星级 || '0', 10)
    const existing = oldCharSkinIds.get(name) || new Set()
    const expectedIds = ['1']
    if (rarity >= 4) expectedIds.push('2')
    if (name === '阿米娅') expectedIds.push('1+')

    for (const needId of expectedIds) {
      if (existing.has(needId)) continue
      // 缺失，重新生成这行
      detail.上线时间 = charBasicMap[name]?.online_date || ''
      const row = generateDefaultSkinRows(detail).find(r => r.立绘编号 === needId)
      if (!row) continue
      try { row.文件链接 = await getPrtsFile(row.文件名) } catch (e) { log('main', `查链失败 ${row.文件名}: ${e.message}`) }
      newRows.push(row)
      repairedRecords.push({ name, skinId: needId, filename: row.文件名 })
    }
  }
  if (repairedRecords.length > 0) {
    const detailStr = repairedRecords.map(r => `${r.name}[${r.skinId}]`).join(', ')
    log('main', `补全固有立绘 ${repairedRecords.length} 行: ${detailStr}`)
  }

  // 6. 写入
  appendToCsv(CSV_PATH, newRows)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  if (newRows.length > 0) {
    const previewCount = Math.min(newRows.length, 16)
    log('main', `======== 增补数据摘要（前${previewCount}行）========`)
    for (let i = 0; i < previewCount; i++) {
      const r = newRows[i]
      log('main', `  ${r.角色名},${r.立绘编号},${r.文件名},${r.时装品牌 || '-'},${r.时装名 || '-'}`)
    }
  }
  log('main', `======== 更新完成 | 新增干员 ${newCharNames.length} 个, 新增时装 ${newSkinFiles.length} 个, 补全固有立绘 ${repairedRecords.length} 行, 总追加 ${newRows.length} 行, 用时 ${elapsed}s ========`)
}

main().catch(err => { console.error(`[${timestamp()}][FATAL] ${err.message}`); process.exit(1) })
