/**
 * 合成图片核心函数
 * 按照以下图层顺序绘制：
 * 1. 底图
 * 2. 背景大立绘（带alpha通道蒙版 + 白色遮罩，只对立绘可见像素生效）
 * 3. 阵营图标（带阴影 + 模糊 + 白色蒙版）
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
  LOGO_BLUR,
  BG_OVERLAY_ALPHA,
  LOGO_OVERLAY_ALPHA,
  DEFAULT_CENTER_CHAR_X,
  DEFAULT_CENTER_CHAR_Y,
  DEFAULT_CENTER_CHAR_HEIGHT_SCALE,
  CLIP_K,
  BLUR_RADIUS
} from '../config.js'

// ==================== 核心函数 ====================

/**
 * 创建裁剪羽化蒙版（全画布尺寸）
 * 在立绘所在区域绘制平行四边形+羽化的蒙版，其余区域透明
 */
function createClipFeatherMask(imgW, imgH, imgX, imgY, canvasW, canvasH) {
  const blurPx = Math.round(BLUR_RADIUS * Math.min(imgW, imgH))
  const pad = blurPx * 2

  // 在带padding的canvas上画蒙版
  const mask = document.createElement('canvas')
  mask.width = canvasW + pad * 2
  mask.height = canvasH + pad * 2
  const maskCtx = mask.getContext('2d')

  maskCtx.filter = `blur(${blurPx}px)`
  maskCtx.beginPath()
  maskCtx.moveTo(imgX + CLIP_K * imgW + pad + blurPx, imgY + pad + blurPx)
  maskCtx.lineTo(imgX + imgW + pad - blurPx, imgY + pad + blurPx)
  maskCtx.lineTo(imgX + (1 - CLIP_K) * imgW + pad - blurPx, imgY + imgH + pad - blurPx)
  maskCtx.lineTo(imgX + pad + blurPx, imgY + imgH + pad - blurPx)
  maskCtx.closePath()
  maskCtx.fillStyle = 'white'
  maskCtx.fill()
  maskCtx.filter = 'none'

  // 裁掉padding
  const result = document.createElement('canvas')
  result.width = canvasW
  result.height = canvasH
  const resultCtx = result.getContext('2d')
  resultCtx.drawImage(mask, pad, pad, canvasW, canvasH, 0, 0, canvasW, canvasH)

  return result
}

/**
 * 对图片素材做平行四边形裁剪+羽化预处理
 * 裁剪形状为：(k,0)→(1,0)→(1-k,1)→(0,1) 的平行四边形
 * 边缘按 BLUR_RADIUS 做羽化渐变
 */
function applyClipFeather(img) {
  const w = img.width
  const h = img.height
  const blurPx = Math.round(BLUR_RADIUS * Math.min(w, h))
  const pad = blurPx * 2 // 为羽化边缘留出空间

  // 1. 在带padding的canvas上绘制原图
  const src = document.createElement('canvas')
  src.width = w + pad * 2
  src.height = h + pad * 2
  const srcCtx = src.getContext('2d')
  srcCtx.drawImage(img, pad, pad, w, h)

  // 2. 创建羽化蒙版：先画纯白平行四边形，再模糊
  const mask = document.createElement('canvas')
  mask.width = w + pad * 2
  mask.height = h + pad * 2
  const maskCtx = mask.getContext('2d')

  maskCtx.filter = `blur(${blurPx}px)`
  maskCtx.beginPath()
  maskCtx.moveTo(CLIP_K * w + pad + blurPx, pad + blurPx)
  maskCtx.lineTo(w + pad - blurPx, pad + blurPx)
  maskCtx.lineTo((1 - CLIP_K) * w + pad - blurPx, h + pad - blurPx)
  maskCtx.lineTo(pad + blurPx, h + pad - blurPx)
  maskCtx.closePath()
  maskCtx.fillStyle = 'white'
  maskCtx.fill()
  maskCtx.filter = 'none'

  // 3. 用蒙版作为alpha通道：destination-in 只保留蒙版不透明区域的原图像素
  srcCtx.globalCompositeOperation = 'destination-in'
  srcCtx.drawImage(mask, 0, 0)
  srcCtx.globalCompositeOperation = 'source-over'

  // 4. 裁掉padding，返回处理后的canvas
  const result = document.createElement('canvas')
  result.width = w
  result.height = h
  const resultCtx = result.getContext('2d')
  resultCtx.drawImage(src, pad, pad, w, h, 0, 0, w, h)

  return result
}

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
  const clipFeather = options.clipFeather ?? false
  
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

    // 预处理：裁剪羽化
    let processedCharImg = charImg
    if (clipFeather) {
      processedCharImg = applyClipFeather(charImg)
    }

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

    // 3a. 在离屏Canvas上绘制背景大立绘（用原图）
    offCtx.drawImage(charImg, bgCharX, bgCharY, bgCharSize.width, bgCharSize.height)

    // 3b. 对立绘可见像素混合白色
    offCtx.globalCompositeOperation = 'source-atop'
    offCtx.fillStyle = `rgba(255, 255, 255, ${BG_OVERLAY_ALPHA})`
    offCtx.fillRect(0, 0, canvasWidth, canvasHeight)
    offCtx.globalCompositeOperation = 'source-over'

    // 3c. 裁剪羽化：在白色遮罩之后应用，白色遮罩和立绘共同被羽化
    if (clipFeather) {
      const featherMask = createClipFeatherMask(bgCharSize.width, bgCharSize.height, bgCharX, bgCharY, canvasWidth, canvasHeight)
      offCtx.globalCompositeOperation = 'destination-in'
      offCtx.drawImage(featherMask, 0, 0)
      offCtx.globalCompositeOperation = 'source-over'
    }

    // 3d. 将处理后的背景立绘绘制到主Canvas
    ctx.drawImage(offscreen, 0, 0)

    // 4. 绘制阵营图标（图层3）- 仅在提供logo时绘制
    if (logoImg) {
      const logoHeight = canvasHeight * DEFAULT_LOGO_HEIGHT_SCALE * logoScale
      const logoSize = calculateScaledSize(logoImg, logoHeight)
      const logoX = canvasWidth * DEFAULT_LOGO_X - logoSize.width / 2
      const logoY = canvasHeight * DEFAULT_LOGO_Y - logoSize.height / 2
      
      // 使用离屏Canvas：先绘制Logo（带阴影/模糊），再对其可见像素混合白色蒙版
      const logoScreen = document.createElement('canvas')
      logoScreen.width = canvasWidth
      logoScreen.height = canvasHeight
      const logoCtx = logoScreen.getContext('2d')
      
      // 4a. 绘制Logo（带阴影和模糊效果）
      if (LOGO_SHADOW_INTENSITY > 0) {
        logoCtx.shadowBlur = LOGO_SHADOW_BLUR * LOGO_SHADOW_INTENSITY
        logoCtx.shadowColor = LOGO_SHADOW_COLOR
        logoCtx.shadowOffsetX = 0
        logoCtx.shadowOffsetY = 0
      }
      if (LOGO_BLUR > 0) {
        const blurPx = Math.round(LOGO_BLUR * canvasHeight)
        logoCtx.filter = `blur(${blurPx}px)`
      }
      logoCtx.drawImage(logoImg, logoX, logoY, logoSize.width, logoSize.height)
      logoCtx.shadowBlur = 0
      logoCtx.filter = 'none'
      
      // 4b. 对Logo可见像素混合白色蒙版
      if (LOGO_OVERLAY_ALPHA > 0) {
        logoCtx.globalCompositeOperation = 'source-atop'
        logoCtx.fillStyle = `rgba(255, 255, 255, ${LOGO_OVERLAY_ALPHA})`
        logoCtx.fillRect(0, 0, canvasWidth, canvasHeight)
        logoCtx.globalCompositeOperation = 'source-over'
      }
      
      // 4c. 绘制到主Canvas
      ctx.drawImage(logoScreen, 0, 0)
    }

    // 5. 绘制中心人物立绘（图层4）
    const centerCharHeight = canvasHeight * DEFAULT_CENTER_CHAR_HEIGHT_SCALE * charScale
    const centerCharSize = calculateScaledSize(charImg, centerCharHeight)
    const centerCharX = canvasWidth * (DEFAULT_CENTER_CHAR_X + posOffset) - centerCharSize.width / 2
    const centerCharY = canvasHeight * (DEFAULT_CENTER_CHAR_Y + yOffset) - centerCharSize.height / 2
    ctx.drawImage(processedCharImg, centerCharX, centerCharY, centerCharSize.width, centerCharSize.height)

    return true
  } catch (error) {
    console.error('合成过程中出错:', error)
    throw new Error(`图片合成失败: ${error.message}`)
  }
}
