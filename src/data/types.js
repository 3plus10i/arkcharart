// 类型定义
// 生成时间: 2026-04-13T09:28:41.994Z

/**
 * 角色信息
 */
export interface CharInfo {
  faction: string
  origin: string
}

/**
 * 映射表类型
 */
export type CharInfoMap = Record<string, CharInfo>
export type FactionLogoMap = Record<string, string>
