/**
 * 合成图片核心函数
 * 按照以下图层顺序绘制：
 * 1. 底图
 * 2. 背景大立绘（带alpha通道蒙版 + 白色渐变遮罩，只对立绘可见像素生效）
 * 3. 阵营图标（带阴影）
 * 4. 中心人物立绘
 */

import {
  DEFAULT_BG_CHAR_X,
  DEFAULT_BG_CHAR_Y,
  DEFAULT_BG_CHAR_HEIGHT_SCALE,
  DEFAULT_LOGO_X,
  DEFAULT_LOGO_Y,
  DEFAULT_LOGO_HEIGHT_SCALE,
  LOGO_SHADOW_INTENSITY,
  LOGO_SHADOW_BLUR,
  LOGO_SHADOW_COLOR,
  DEFAULT_OVERLAY_ALPHA_LEFT,
  DEFAULT_OVERLAY_ALPHA_RIGHT,
  DEFAULT_CENTER_CHAR_X,
  DEFAULT_CENTER_CHAR_Y,
  DEFAULT_CENTER_CHAR_HEIGHT_SCALE
} from '../config.js'

// ==================== 核心函数 ====================

/**
 * 加载图片辅助函数
 * 支持传入路径字符串或已有的 Image 对象
 */
function loadImage(src, fallbackSrc) {
  if (src instanceof HTMLImageElement) {
    return Promise.resolve(src)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    // 远程URL需要设置crossOrigin，本地路径不需要
    if (src.startsWith('http')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => {
      if (fallbackSrc) {
        const fallbackImg = new Image()
        if (fallbackSrc.startsWith('http')) {
          fallbackImg.crossOrigin = 'anonymous'
        }
        fallbackImg.onload = () => resolve(fallbackImg)
        fallbackImg.onerror = () => reject(new Error(`加载图片失败: ${src}，回落也失败: ${fallbackSrc}`))
        fallbackImg.src = fallbackSrc
      } else {
        reject(new Error(`加载图片失败: ${src}`))
      }
    }
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
 * @param {number} options.charYOffset - 立绘Y轴偏置 (0.3-0.7)
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
  const charYOffset = options.charYOffset ?? 0.5
  const logoScale = options.logoScale ?? 1
  
  // 计算位置偏移量 (用户50%为基准，计算偏移)
  const posOffset = charPos - 0.5
  const yOffset = charYOffset - 0.5
  
  // 清空Canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  try {
    // 1. 加载图片（logo可选）
    const imagesToLoad = [
      loadImage(baseImagePath),
      loadImage(charImagePath, options.charImageFallback)
    ]
    if (logoImagePath) {
      imagesToLoad.push(loadImage(logoImagePath))
    }
    const [baseImg, charImg, logoImg] = await Promise.all(imagesToLoad)

    // 2. 绘制底图
    ctx.drawImage(baseImg, 0, 0, canvasWidth, canvasHeight)

    // 3. 绘制背景大立绘（图层2）— 只对立绘可见像素应用白色渐变遮罩
    const bgCharHeight = canvasHeight * DEFAULT_BG_CHAR_HEIGHT_SCALE * charScale
    const bgCharSize = calculateScaledSize(charImg, bgCharHeight)
    const bgCharX = canvasWidth * (DEFAULT_BG_CHAR_X + posOffset) - bgCharSize.width / 2
    const bgCharY = canvasHeight * (DEFAULT_BG_CHAR_Y + yOffset) - bgCharSize.height / 2

    // 使用离屏Canvas：先绘制背景立绘，再对其可见像素混合白色
    const offscreen = document.createElement('canvas')
    offscreen.width = canvasWidth
    offscreen.height = canvasHeight
    const offCtx = offscreen.getContext('2d')

    // 3a. 在离屏Canvas上绘制背景大立绘
    offCtx.drawImage(charImg, bgCharX, bgCharY, bgCharSize.width, bgCharSize.height)

    // 3b. 对立绘可见像素混合白色渐变（30%原色 + 70%白色）
    // 利用 'source-atop' 合成模式，只在已有像素上绘制，透明区域不受影响
    offCtx.globalCompositeOperation = 'source-atop'
    const gradient = offCtx.createLinearGradient(0, 0, canvasWidth, 0)
    gradient.addColorStop(0, `rgba(255, 255, 255, ${DEFAULT_OVERLAY_ALPHA_LEFT})`)
    gradient.addColorStop(1, `rgba(255, 255, 255, ${DEFAULT_OVERLAY_ALPHA_RIGHT})`)
    offCtx.fillStyle = gradient
    offCtx.fillRect(0, 0, canvasWidth, canvasHeight)
    offCtx.globalCompositeOperation = 'source-over'

    // 3c. 将处理后的背景立绘绘制到主Canvas
    ctx.drawImage(offscreen, 0, 0)

    // 4. 绘制阵营图标（图层3）- 仅在提供logo时绘制
    if (logoImg) {
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
    }

    // 5. 绘制中心人物立绘（图层4）
    const centerCharHeight = canvasHeight * DEFAULT_CENTER_CHAR_HEIGHT_SCALE * charScale
    const centerCharSize = calculateScaledSize(charImg, centerCharHeight)
    const centerCharX = canvasWidth * (DEFAULT_CENTER_CHAR_X + posOffset) - centerCharSize.width / 2
    const centerCharY = canvasHeight * (DEFAULT_CENTER_CHAR_Y + yOffset) - centerCharSize.height / 2
    ctx.drawImage(charImg, centerCharX, centerCharY, centerCharSize.width, centerCharSize.height)

    return true
  } catch (error) {
    console.error('合成过程中出错:', error)
    throw new Error(`图片合成失败: ${error.message}`)
  }
}
