#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const assetsDir = path.join(projectRoot, 'assets')
const srcDataDir = path.join(projectRoot, 'src', 'data')

// 确保data目录存在
if (!fs.existsSync(srcDataDir)) {
  fs.mkdirSync(srcDataDir, { recursive: true })
}

console.log('开始生成数据文件...')

// 1. 读取角色信息CSV
const charsInfoPath = path.join(assetsDir, 'charsinfo.csv')
console.log(`读取角色信息: ${charsInfoPath}`)
const charsInfoCsv = fs.readFileSync(charsInfoPath, 'utf-8')
const charsInfoLines = charsInfoCsv.split('\n').filter(line => line.trim())

// 解析CSV
const headers = charsInfoLines[0].split(',')
const charInfoMap = {}
const charNameToInfo = {}
const professionCharMap = {} // 职业 -> 角色列表

for (let i = 1; i < charsInfoLines.length; i++) {
  const line = charsInfoLines[i]
  const values = line.split(',')
  if (values.length < headers.length) continue
  
  const charName = values[2] // 代号列
  const chineseName = values[0] // 中文名列
  const profession = values[3] // 职业列
  const faction = values[5] // 势力列
  const origin = values[6] // 出身地列
  
  if (charName && faction) {
    charInfoMap[chineseName] = {
      profession: profession ? profession.trim() : '未知',
      faction: faction.trim(),
      origin: origin ? origin.trim() : ''
    }
    // 同时建立代号到中文名的映射
    charNameToInfo[charName] = chineseName
    
    // 按职业分组
    const prof = profession ? profession.trim() : '未知'
    if (!professionCharMap[prof]) {
      professionCharMap[prof] = []
    }
    if (!professionCharMap[prof].includes(chineseName)) {
      professionCharMap[prof].push(chineseName)
    }
  }
}

// 对每个职业的角色列表排序
Object.keys(professionCharMap).forEach(prof => {
  professionCharMap[prof].sort()
})

console.log(`已加载 ${Object.keys(charInfoMap).length} 个角色信息`)
console.log(`职业分类: ${Object.keys(professionCharMap).join(', ')}`)

// 2. 读取势力Logo对照表
const factionLogoPath = path.join(assetsDir, '势力logo对照表.csv')
console.log(`读取势力对照表: ${factionLogoPath}`)
const factionLogoCsv = fs.readFileSync(factionLogoPath, 'utf-8')
const factionLogoLines = factionLogoCsv.split('\n').filter(line => line.trim())

const factionLogoMap = {}
for (let i = 1; i < factionLogoLines.length; i++) {
  const line = factionLogoLines[i]
  const [faction, logoFile] = line.split(',')
  if (faction && logoFile) {
    let logoFileName = logoFile.trim()
    // 确保有.png扩展名
    if (!logoFileName.toLowerCase().endsWith('.png')) {
      logoFileName += '.png'
    }
    factionLogoMap[faction.trim()] = logoFileName
  }
}

console.log(`已加载 ${Object.keys(factionLogoMap).length} 个势力映射`)

// 3. 扫描chararts目录，获取立绘文件列表并解析角色和皮肤
const charArtsDir = path.join(assetsDir, 'chararts')
let charArts = []
const charSkinsMap = {} // 角色名 -> 皮肤列表

if (fs.existsSync(charArtsDir)) {
  charArts = fs.readdirSync(charArtsDir)
    .filter(file => file.toLowerCase().endsWith('.png'))
    .sort()
  
  // 解析立绘文件名: 立绘_角色名_皮肤编号.png
  for (const file of charArts) {
    const match = file.match(/立绘_(.+?)_(.+)\.png$/i)
    if (match) {
      const charName = match[1]
      const skinCode = match[2]
      // 转换皮肤编号为可读名称
      let skinName = skinCode
      if (skinCode === '1') skinName = '精一'
      else if (skinCode === '2') skinName = '精二'
      else if (skinCode.startsWith('skin')) skinName = skinCode.replace('skin', '皮肤')
      
      if (!charSkinsMap[charName]) {
        charSkinsMap[charName] = []
      }
      charSkinsMap[charName].push({
        file: file,
        code: skinCode,
        name: skinName
      })
    }
  }
  
  // 对每个角色的皮肤排序（精一、精二在前，皮肤在后）
  Object.keys(charSkinsMap).forEach(char => {
    charSkinsMap[char].sort((a, b) => {
      const order = { '精一': 1, '精二': 2 }
      const orderA = order[a.name] || 3
      const orderB = order[b.name] || 3
      return orderA - orderB
    })
  })
} else {
  console.warn(`警告: chararts目录不存在: ${charArtsDir}`)
  fs.mkdirSync(charArtsDir, { recursive: true })
}

console.log(`找到 ${charArts.length} 个立绘文件`)
console.log(`解析出 ${Object.keys(charSkinsMap).length} 个角色的皮肤信息`)

// 4. 生成mappings.js
const mappingsContent = `// 自动生成的角色信息映射表
// 生成时间: ${new Date().toISOString()}

export const charInfoMap = ${JSON.stringify(charInfoMap, null, 2)}

export const factionLogoMap = ${JSON.stringify(factionLogoMap, null, 2)}

export const charNameToInfo = ${JSON.stringify(charNameToInfo, null, 2)}

export const professionCharMap = ${JSON.stringify(professionCharMap, null, 2)}

export const charSkinsMap = ${JSON.stringify(charSkinsMap, null, 2)}
`

fs.writeFileSync(path.join(srcDataDir, 'mappings.js'), mappingsContent)
console.log(`已生成: src/data/mappings.js`)

// 5. 生成charArts.js
const charArtsContent = `// 自动生成的立绘文件列表
// 生成时间: ${new Date().toISOString()}

export const charArts = ${JSON.stringify(charArts, null, 2)}
`

fs.writeFileSync(path.join(srcDataDir, 'charArts.js'), charArtsContent)
console.log(`已生成: src/data/charArts.js`)

console.log('数据生成完成！')
console.log('运行 \`npm run build\` 构建项目，或 \`npm run dev\` 启动开发服务器。')
