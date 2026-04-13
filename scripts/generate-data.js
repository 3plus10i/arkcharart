#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const assetsDir = path.join(projectRoot, 'public')
const srcDataDir = path.join(projectRoot, 'src', 'data')

// 确保data目录存在
if (!fs.existsSync(srcDataDir)) {
  fs.mkdirSync(srcDataDir, { recursive: true })
}

console.log('开始生成数据文件...')

// 1. 读取角色信息CSV，生成 charsInfo.js
const charsInfoPath = path.join(assetsDir, 'charsinfo.csv')
console.log(`读取角色信息: ${charsInfoPath}`)
const charsInfoCsv = fs.readFileSync(charsInfoPath, 'utf-8')
const charsInfoLines = charsInfoCsv.split('\n').filter(line => line.trim())

// 解析CSV（跳过表头）
const charsInfo = {} // 中文名 -> { profession, faction }
for (let i = 1; i < charsInfoLines.length; i++) {
  const values = charsInfoLines[i].split(',')
  if (values.length < 6) continue

  const chineseName = values[0].trim()
  const profession = values[3].trim()
  const faction = values[5].trim() // 势力=logo文件名（不含.png）

  if (chineseName) {
    charsInfo[chineseName] = {
      profession: profession || '其他',
      faction: faction || ''
    }
  }
}

console.log(`已加载 ${Object.keys(charsInfo).length} 个角色信息`)

// 写出 charsInfo.js
const charsInfoContent = `// 自动生成的角色信息表（势力字段即logo文件名，不含.png后缀）

export const charsInfo = ${JSON.stringify(charsInfo, null, 2)}
`
fs.writeFileSync(path.join(srcDataDir, 'charsInfo.js'), charsInfoContent)
console.log('已生成: src/data/charsInfo.js')

// 2. 扫描 chararts 目录，生成 charArts.js（立绘文件列表）
const charArtsDir = path.join(assetsDir, 'chararts')
let charArts = []

if (fs.existsSync(charArtsDir)) {
  charArts = fs.readdirSync(charArtsDir)
    .filter(file => file.toLowerCase().endsWith('.png'))
    .sort()
} else {
  console.warn(`警告: chararts目录不存在: ${charArtsDir}`)
  fs.mkdirSync(charArtsDir, { recursive: true })
}

const charArtsContent = `// 自动生成的立绘文件列表

export const charArts = ${JSON.stringify(charArts, null, 2)}
`
fs.writeFileSync(path.join(srcDataDir, 'charArts.js'), charArtsContent)
console.log(`已生成: src/data/charArts.js (${charArts.length} 个文件)`)

// 3. 扫描 logos 目录，生成 faction.js（势力logo文件列表）
const logosDir = path.join(assetsDir, 'logos')
let factionFiles = []

if (fs.existsSync(logosDir)) {
  factionFiles = fs.readdirSync(logosDir)
    .filter(file => file.toLowerCase().endsWith('.png'))
    .sort()
} else {
  console.warn(`警告: logos目录不存在: ${logosDir}`)
  fs.mkdirSync(logosDir, { recursive: true })
}

// 存储的是不含.png后缀的文件名（即势力名）
const factionList = factionFiles.map(f => f.replace(/\.png$/i, ''))

const factionContent = `// 自动生成的势力logo文件列表（势力名=logo文件名，不含.png后缀）

export const factions = ${JSON.stringify(factionList, null, 2)}
`
fs.writeFileSync(path.join(srcDataDir, 'faction.js'), factionContent)
console.log(`已生成: src/data/faction.js (${factionList.length} 个势力)`)

console.log('数据生成完成！')
