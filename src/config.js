// ==================== 资源文件名配置 ====================

/** 背景图文件名 */
export const BG_FILENAME = 'bg.svg'

// ==================== 合成效果配置 ====================

/** 背景大立绘默认水平位置 (0-1) */
export const DEFAULT_BG_CHAR_X = 0.7
/** 背景大立绘默认垂直位置 (0-1) */
export const DEFAULT_BG_CHAR_Y = 0.5
/** 背景大立绘默认高度比例 */
export const DEFAULT_BG_CHAR_HEIGHT_SCALE = 1.2
/** 白色遮罩不透明度 */
export const BG_OVERLAY_ALPHA = 0.7

/** logo默认水平位置 (0-1) */
export const DEFAULT_LOGO_X = 0.15
/** logo默认垂直位置 (0-1) */
export const DEFAULT_LOGO_Y = 0.2
/** logo默认高度比例 */
export const DEFAULT_LOGO_HEIGHT_SCALE = 0.75

/** Logo阴影强度 (0=无阴影, 1=默认阴影) */
export const LOGO_SHADOW_INTENSITY = 0.5
/** Logo阴影模糊半径 */
export const LOGO_SHADOW_BLUR = 20
/** Logo阴影颜色 */
export const LOGO_SHADOW_COLOR = 'rgba(0, 0, 0, 0.5)'

/** Logo高斯模糊强度（相对画布高度的比例，0=无模糊） */
// 常用参考：
/**
 * 0.001: 720p-0.7px, 1080p-1.1px, 2K-2.2px, 4K-4.3px
 * 0.002: 720p-1.4px, 1080p-2.2px, 2K-4.3px, 4K-8.6px
 * 0.004: 720p-2.8px, 1080p-4.0px, 2K-8.6px, 4K-17.2px
 */
export const LOGO_BLUR = 0.002

/** Logo白色蒙版不透明度 (0=无蒙版) */
export const LOGO_OVERLAY_ALPHA = 0.4

/** 中心立绘默认水平位置 (0-1) */
export const DEFAULT_CENTER_CHAR_X = 0.5
/** 中心立绘默认垂直位置 (0-1) */
export const DEFAULT_CENTER_CHAR_Y = 0.5
/** 中心立绘默认高度比例 */
export const DEFAULT_CENTER_CHAR_HEIGHT_SCALE = 1.0

/** 裁剪羽化 */
/** 裁剪参数 */
export const CLIP_K = 0.25
/** 羽化半径 */
export const BLUR_RADIUS = 0.05