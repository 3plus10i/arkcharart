/**
 * 合成图片核心函数
 * 按照以下图层顺序绘制：
 * 1. 底图
 * 2. 背景大立绘
 * 3. 阵营图标
 * 4. 白色渐变遮罩
 * 5. 中心人物立绘
 */

// ==================== 画布配置 ====================

/** 画布宽度 */
export const CANVAS_WIDTH = 2720
/** 画布高度 */
export const CANVAS_HEIGHT = 1600

// ==================== 默认配置 ====================

/** 背景大立绘默认水平位置 (0-1) */
const DEFAULT_BG_CHAR_X = 0.7
/** 背景大立绘默认垂直位置 (0-1) */
const DEFAULT_BG_CHAR_Y = 0.5
/** 背景大立绘默认高度比例 */
const DEFAULT_BG_CHAR_HEIGHT_SCALE = 1.2

/** 阵营图标默认水平位置 (0-1) */
const DEFAULT_LOGO_X = 0.15
/** 阵营图标默认垂直位置 (0-1) */
const DEFAULT_LOGO_Y = 0.2
/** 阵营图标默认高度比例 */
const DEFAULT_LOGO_HEIGHT_SCALE = 0.75

/** Logo阴影强度 (0=无阴影, 1=默认阴影) */
const LOGO_SHADOW_INTENSITY = 0.5
/** Logo阴影模糊半径 */
const LOGO_SHADOW_BLUR = 20
/** Logo阴影颜色 */
const LOGO_SHADOW_COLOR = 'rgba(0, 0, 0, 0.5)'

/** 白色遮罩左侧默认不透明度 */
const DEFAULT_OVERLAY_ALPHA_LEFT = 0.3
/** 白色遮罩右侧默认不透明度 */
const DEFAULT_OVERLAY_ALPHA_RIGHT = 0.6

/** 中心立绘默认水平位置 (0-1) */
const DEFAULT_CENTER_CHAR_X = 0.5
/** 中心立绘默认垂直位置 (0-1) */
const DEFAULT_CENTER_CHAR_Y = 0.5
/** 中心立绘默认高度比例 */
const DEFAULT_CENTER_CHAR_HEIGHT_SCALE = 1.0

// ==================== 核心函数 ====================

/**
 * 加载图片辅助函数
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(new Error(`加载图片失败: ${src}`))
    img.src = src
  })
}

/**
 * 计算缩放后的尺寸，保持纵横比
 */
function calculateScaledSize(img, targetHeight, maxWidth = null) {
  const scale = targetHeight / img.height
  const width = img.width * scale
  const height = targetHeight
  
  if (maxWidth && width > maxWidth) {
    const widthScale = maxWidth / width
    return {
      width: width * widthScale,
      height: height * widthScale,
      scale: scale * widthScale
    }
  }
  
  return { width, height, scale }
}

/**
 * 主合成函数
 * @param {HTMLCanvasElement} canvas - Canvas元素
 * @param {string} baseImagePath - 底图路径
 * @param {string} charImagePath - 角色立绘路径
 * @param {string} logoImagePath - 阵营图标路径
 * @param {Object} options - 配置选项
 * @param {number} options.charScale - 立绘倍率 (0.5-2)
 * @param {number} options.charPos - 立绘水平位置 (0.3-0.7)
 * @param {number} options.logoScale - Logo倍率 (0.5-2)
 */
export async function composeImage(canvas, baseImagePath, charImagePath, logoImagePath, options = {}) {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas上下文获取失败')
  }

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  
  // 解析选项
  const charScale = options.charScale ?? 1
  const charPos = options.charPos ?? 0.5
  const logoScale = options.logoScale ?? 1
  
  // 计算位置偏移量 (用户50%为基准，计算偏移)
  const posOffset = charPos - 0.5
  
  // 清空Canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  try {
    // 1. 加载所有图片
    const [baseImg, charImg, logoImg] = await Promise.all([
      loadImage(baseImagePath),
      loadImage(charImagePath),
      loadImage(logoImagePath)
    ])

    // 2. 绘制底图
    ctx.drawImage(baseImg, 0, 0, canvasWidth, canvasHeight)

    // 3. 绘制背景大立绘（图层2）
    const bgCharHeight = canvasHeight * DEFAULT_BG_CHAR_HEIGHT_SCALE * charScale
    const bgCharSize = calculateScaledSize(charImg, bgCharHeight)
    const bgCharX = canvasWidth * (DEFAULT_BG_CHAR_X + posOffset) - bgCharSize.width / 2
    const bgCharY = canvasHeight * DEFAULT_BG_CHAR_Y - bgCharSize.height / 2
    ctx.drawImage(charImg, bgCharX, bgCharY, bgCharSize.width, bgCharSize.height)

    // 4. 绘制阵营图标（图层3）
    const logoHeight = canvasHeight * DEFAULT_LOGO_HEIGHT_SCALE * logoScale
    const logoSize = calculateScaledSize(logoImg, logoHeight)
    const logoX = canvasWidth * DEFAULT_LOGO_X - logoSize.width / 2
    const logoY = canvasHeight * DEFAULT_LOGO_Y - logoSize.height / 2
    
    // 设置阴影效果
    if (LOGO_SHADOW_INTENSITY > 0) {
      ctx.shadowBlur = LOGO_SHADOW_BLUR * LOGO_SHADOW_INTENSITY
      ctx.shadowColor = LOGO_SHADOW_COLOR
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    }
    
    // 绘制Logo
    ctx.drawImage(logoImg, logoX, logoY, logoSize.width, logoSize.height)
    
    // 重置阴影设置
    ctx.shadowBlur = 0

    // 5. 绘制白色渐变遮罩（图层4）
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0)
    gradient.addColorStop(0, `rgba(255, 255, 255, ${DEFAULT_OVERLAY_ALPHA_LEFT})`)
    gradient.addColorStop(1, `rgba(255, 255, 255, ${DEFAULT_OVERLAY_ALPHA_RIGHT})`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // 6. 绘制中心人物立绘（图层5）
    const centerCharHeight = canvasHeight * DEFAULT_CENTER_CHAR_HEIGHT_SCALE * charScale
    const centerCharSize = calculateScaledSize(charImg, centerCharHeight)
    const centerCharX = canvasWidth * (DEFAULT_CENTER_CHAR_X + posOffset) - centerCharSize.width / 2
    const centerCharY = canvasHeight * DEFAULT_CENTER_CHAR_Y - centerCharSize.height / 2
    ctx.drawImage(charImg, centerCharX, centerCharY, centerCharSize.width, centerCharSize.height)

    return true
  } catch (error) {
    console.error('合成过程中出错:', error)
    throw new Error(`图片合成失败: ${error.message}`)
  }
}
