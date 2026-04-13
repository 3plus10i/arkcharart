/**
 * 立绘列表管理模块
 * 维护预置立绘列表，提供按职业/角色分组的数据结构
 */

import { charArts } from '../data/charArts'
import { charsInfo } from '../data/charsInfo'
import { parseArtFilename } from './parseArtFile'

/**
 * 单条立绘记录
 * @typedef {{ file: string, name: string, profession: string, faction: string, code: string }} ArtEntry
 */

/** 初始化预置立绘列表 */
export function initPresetArts() {
  const arts = []
  for (const file of charArts) {
    const info = parseArtFilename(file)
    arts.push({ file, ...info })
  }
  return arts
}

/**
 * 从立绘列表构建按职业->角色的分组结构
 * @param {ArtEntry[]} arts
 * @returns {{ professions: string[], charMap: Object<string, ArtEntry[]>, skinMap: Object<string, ArtEntry[]> }}
 */
export function buildArtIndex(arts) {
  const charMap = {}   // 角色名 -> 该角色的立绘列表
  const profSet = new Set()

  for (const art of arts) {
    profSet.add(art.profession)
    if (!charMap[art.name]) charMap[art.name] = []
    charMap[art.name].push(art)
  }

  // 对每个角色的立绘排序
  const skinOrder = { '1': 1, '2': 2 }
  for (const char of Object.keys(charMap)) {
    charMap[char].sort((a, b) => {
      const oa = skinOrder[a.code] || 3
      const ob = skinOrder[b.code] || 3
      return oa - ob
    })
  }

  const professions = [...profSet].sort()
  return { professions, charMap }
}

/**
 * 获取角色信息（职业和本家势力）
 * @param {string} charName
 * @returns {{ profession: string, faction: string } | null}
 */
export function getCharInfo(charName) {
  const info = charsInfo[charName]
  if (!info) return null
  return info
}

/**
 * 从立绘记录获取本家势力标签
 * @param {ArtEntry} art
 * @returns {string} 如 "本家罗德岛" 或空字符串
 */
export function getHomeFactionLabel(art) {
  if (art.faction) return `本家${art.faction}`
  return ''
}

/** 编号转可读名 */
export function codeToName(code) {
  if (code === '1') return '精一'
  if (code === '2') return '精二'
  if (code.startsWith('skin')) return '皮肤' + code.replace('skin', '')
  return code
}
