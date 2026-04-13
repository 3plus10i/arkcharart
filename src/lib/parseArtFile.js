/**
 * 立绘文件名解析模块
 * 
 * 文件名格式：
 * A类：立绘_角色名_编号.png （如 立绘_蓝毒_2.png, 立绘_玛恩纳_skin1.png）
 * B类：角色名_职业_势力_编号.png
 * F类：解析失败，取文件名为角色名
 */

import { charsInfo } from '../data/charsInfo'
import { factions } from '../data/faction'

/**
 * 解析立绘文件名，返回立绘信息
 * @param {string} filename - 文件名（含扩展名）
 * @param {boolean} aOnly - 仅尝试A类解析（用户上传时使用）
 * @returns {{ name: string, profession: string, faction: string, code: string }}
 */
export function parseArtFilename(filename, aOnly = false) {
  const nameWithoutExt = filename.replace(/\.png$/i, '').replace(/\.jpg$/i, '').replace(/\.jpeg$/i, '')

  // A类：立绘_角色名_编号
  const matchA = nameWithoutExt.match(/^立绘_(.+?)_(.+)$/)
  if (matchA) {
    const charName = matchA[1]
    const code = matchA[2]
    const info = charsInfo[charName]
    if (info) {
      return {
        name: charName,
        profession: info.profession,
        faction: validateFaction(info.faction),
        code
      }
    }
    // 查表失败
    return {
      name: charName,
      profession: '其他',
      faction: '',
      code
    }
  }

  // aOnly模式下不尝试B类
  if (aOnly) {
    return fallbackParse(nameWithoutExt)
  }

  // B类：角色名_职业_势力_编号
  const matchB = nameWithoutExt.match(/^(.+?)_(.+?)_(.+?)_(.+)$/)
  if (matchB) {
    const charName = matchB[1]
    const profession = matchB[2]
    const faction = validateFaction(matchB[3])
    const code = matchB[4]
    return { name: charName, profession, faction, code }
  }

  // F类：解析失败
  return fallbackParse(nameWithoutExt)
}

/** 验证势力是否在faction列表中，不在则返回空字符串 */
function validateFaction(faction) {
  if (!faction) return ''
  return factions.includes(faction) ? faction : ''
}

/** 降级解析：取整个文件名为角色名 */
function fallbackParse(nameWithoutExt) {
  return {
    name: nameWithoutExt,
    profession: '其他',
    faction: '',
    code: '1'
  }
}
