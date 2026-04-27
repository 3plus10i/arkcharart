# DEV.md — ArkCharArt 技术文档

## 1. 架构概览

纯静态 SPA，无后端。构建时由 Python 脚本从 CSV + 目录扫描生成数据文件，运行时前端拉取 JSON 完成交互和 Canvas 合成。

```
构建时:  scripts/arts_data.csv + public/chararts/ + public/logos/  →  scripts/build_data.js  →  public/arts_data.json + public/logo_data.json
运行时:  arts_data.json  →  App.jsx(筛选/选择)  →  composeImage.js(Canvas合成)  →  PNG下载
```

## 2. 构建时数据管线

### 2.1 `scripts/build_data.js`（唯一构建脚本）

`npm run dev` 和 `npm run build` 前自动执行，完成以下工作：

1. 读取 `scripts/arts_data.csv`
2. 扫描 `public/chararts/`，给每条立绘标记 `内置: true/false`
3. 扫描 `public/logos/`，生成 `public/logo_data.json`
4. 生成 `public/arts_data.json`

| 输出文件 | 数据来源 | 内容 |
|----------|----------|------|
| `public/arts_data.json` | `scripts/arts_data.csv` + `public/chararts/` 扫描 | 角色主数据，含内置立绘标记 |
| `public/logo_data.json` | `public/logos/` 目录扫描 | `[{ logo: string, ext: 'png'|'svg' }]` logo名+扩展名数组 |

### 2.2 `public/arts_data.json` 结构

```json
{
  "元信息": {
    "转换时间": "...",
    "角色数": [{ "出处": "方舟干员", "角色数": 412, "立绘数": 1272 }, ...]
  },
  "角色": [
    {
      "角色名": "蓝毒",
      "外文名": "Blue Poison",
      "性别": "女性",
      "立绘": [
        { "编号": "1", "文件名": "立绘_蓝毒_1.png", "文件链接": "https://media.prts.wiki/...", "内置": false },
        { "编号": "2", "文件名": "立绘_蓝毒_2.png", "文件链接": "https://media.prts.wiki/...", "内置": true }
      ],
      "logo": "伊比利亚",
      "出处": "方舟干员",
      "信息": { "星级": 5, "职业": "狙击", "分支": "速射手", "出身地": "伊比利亚" }
    }
  ]
}
```

`内置` 字段：构建时通过检查 `文件名` 是否存在于 `public/chararts/` 目录来确定。目前该字段仅作数据标记，运行时未消费（所有立绘加载方式相同，均异步请求）。

## 3. 运行时模块

### 3.1 `src/App.jsx` — 主界面

#### 状态分层：pending / confirmed

角色和立绘选择采用双层状态，防止频繁触发合成：

```
pendingChar / pendingSkinCode   ← 选择器实时绑定（用户操作不触发合成）
        ↓ 点击"确定"
confirmedChar / confirmedSkinCode ← 确认后触发合成
```

参数滑块（大小/位置/Logo/质量/裁剪羽化）变化时直接重组合成，无需确认。

#### 数据流

```
arts_data.json (fetch)
      ↓
allCharRecords = builtIn角色 + uploadedImages映射
      ↓ selectedComefrom
comefromCharList (出处过滤)
      ↓ selectedProfession/Branch/Star/Gender
filteredCharList (多条件过滤)
      ↓
filteredCharNames (去重排序，绑定到角色下拉框)
      ↓ pendingChar
pendingCharRecord → pendingCharartList (立绘列表，绑定到立绘下拉框)
      ↓ confirm
confirmedCharRecord → confirmedCharart (实际用于合成的记录)
      ↓
generateImage() → composeImage()
```

#### 图片资源定位

| 场景 | 主路径 | 回落 |
|------|--------|------|
| 内置角色 | `chararts/{文件名}` (本地) | `文件链接` (远程URL) |
| 用户上传 | dataURL (内存) | 无 |
| Logo | `logos/{logo名}.{ext}` (本地) | 无 |
| 底图 | `bg-16-9.svg` / `bg-4-3.svg` (本地) | 无 |

内置角色优先本地，`loadImage` 主路径失败后尝试 fallback URL。

#### 合成触发时机

1. `confirmedChar` / `confirmedSkinCode` 变化 → `useEffect` 200ms debounce
2. `charScale` / `charPos` / `charYOffset` / `logoScale` / `selectedLogo` / `outputQuality` / `aspectRatio` / `clipFeather` 变化 → `useEffect` 200ms debounce

#### 默认初始化

`artsData` 加载完成后自动设置：出处=方舟干员，职业=狙击，分支=速射手，星级=5，性别=女性，角色=蓝毒，立绘=2(精二)，直接 confirm 触发首次合成。

### 3.2 `src/lib/composeImage.js` — Canvas 合成

#### 四图层绘制顺序

```
1. 底图 (bg-16-9.svg / bg-4-3.svg)   — 铺满 Canvas
2. 背景大立绘                         — 居右偏，高度=canvas×1.2×charScale
   └ 白色渐变遮罩 (source-atop)       — 左半透明→右不透明，只影响立绘可见像素
   └ 裁剪羽化蒙版 (destination-in)    — 可选，平行四边形+羽化
3. Logo                              — 居左上，高度=canvas×0.75×logoScale，带阴影
4. 中心人物立绘                       — 居中，高度=canvas×1.0×charScale
   └ 裁剪羽化预处理 (applyClipFeather) — 可选，平行四边形+羽化
```

#### 坐标系

所有位置参数以 Canvas 宽高的比例表示（0-1），`charPos` 和 `charYOffset` 以 0.5 为基准计算偏移。

#### `loadImage(src, fallbackSrc)`

- `src` 为 `HTMLImageElement` → 直接返回
- `src` 以 `http` 开头 → 设置 `crossOrigin='anonymous'`（避免 canvas 污染）
- `src` 为本地路径 → 不设 crossOrigin
- 主路径加载失败 → 尝试 fallbackSrc（同理判断 http 设置 crossOrigin）

#### `calculateScaledSize(img, targetHeight, maxWidth)`

保持纵横比缩放。若宽度超过 maxWidth，二次缩放裁切。

#### 裁剪羽化

由 `clipFeather` 开关控制，涉及两个函数：

**`applyClipFeather(img)`** — 对单张图片素材做预处理：
1. 在带 padding 的 canvas 上绘制原图（padding 为羽化边缘留空间）
2. 创建白色平行四边形蒙版（形状由 `CLIP_K` 决定），路径向内收缩 `blurPx`，应用 `blur()` 滤镜
3. `destination-in` 合成，只保留蒙版区域的原图像素
4. 裁掉 padding 返回

**`createClipFeatherMask(imgW, imgH, imgX, imgY, canvasW, canvasH)`** — 创建全画布尺寸的羽化蒙版：
- 用于背景大立绘，在白色渐变遮罩之后应用，使遮罩和立绘共同被羽化
- 同样路径向内收缩 `blurPx`，避免裁剪区域外内容因羽化而显示

平行四边形裁剪路径：`(k,0) → (1,0) → (1-k,1) → (0,1)`，其中 `k = CLIP_K`。路径各顶点向内收缩 `blurPx` 以确保羽化渐变完全落在裁剪区域内。

### 3.3 `src/config.js` — 合成参数常量

| 常量 | 默认值 | 含义 |
|------|--------|------|
| `BG_FILENAME` | `bg.svg` | 底图文件名（历史遗留，运行时根据画面比例选择 bg-16-9.svg / bg-4-3.svg） |
| `DEFAULT_BG_CHAR_X/Y` | 0.7 / 0.5 | 背景大立绘中心位置 |
| `DEFAULT_BG_CHAR_HEIGHT_SCALE` | 1.2 | 背景大立绘高度比 |
| `DEFAULT_CENTER_CHAR_X/Y` | 0.5 / 0.5 | 中心人物立绘位置 |
| `DEFAULT_CENTER_CHAR_HEIGHT_SCALE` | 1.0 | 中心人物高度比 |
| `DEFAULT_LOGO_X/Y` | 0.15 / 0.2 | Logo 位置 |
| `DEFAULT_LOGO_HEIGHT_SCALE` | 0.75 | Logo 高度比 |
| `LOGO_SHADOW_*` | blur=20, color=rgba(0,0,0,0.5) | Logo 阴影 |
| `DEFAULT_OVERLAY_ALPHA_LEFT/RIGHT` | 0.5 / 0.7 | 白色遮罩两端不透明度 |
| `CLIP_K` | 0.25 | 裁剪平行四边形参数 |
| `BLUR_RADIUS` | 0.05 | 羽化半径（占图片短边的比例） |

## 4. 用户上传流程

```
1. 选择文件 → FileReader.readAsDataURL → dataURL
2. 用文件名（去扩展名）作为默认角色名，Logo默认"罗德岛"
3. 弹出 Modal：确认角色名/外文名/默认Logo
4. validateFields + 重名检查 → new Image() 加载 dataURL 获取尺寸
5. 构造 uploadedImage 对象追加到 uploadedImages[]
6. 自动设置：出处=用户上传, confirmedChar=角色名, confirmedSkinCode=1, 同时重置筛选器
7. uploadedImage 映射为 allCharRecords 中的记录：
   { 角色名, 外文名, 性别:'其他', 立绘:[{编号:'1', 文件名, 文件链接:'', 内置:false}], logo, 出处:'用户上传', 信息:{}, _dataUrl }
```

上传角色数据仅存于内存，刷新即丢失。

## 5. CORS 策略

Canvas `toDataURL` 要求所有绘制内容未被跨域污染：

- 本地资源（`chararts/`, `logos/`, `bg-*.svg`）：同源，不设 `crossOrigin`
- 远程 URL（PRTS 等立绘链接）：设置 `img.crossOrigin = 'anonymous'`，依赖服务器返回 CORS 头
- 用户上传：dataURL，无跨域问题
- 回落链：本地优先 → 远程 fallback，两层独立判断 crossOrigin

## 6. 输出质量

| 选项 | 16:9 尺寸 | 4:3 尺寸 |
|------|-----------|----------|
| 4K | 3840 × 2160 | 2880 × 2160 |
| 2K | 2560 × 1440 | 1920 × 1440 |
| 1080p | 1920 × 1080 | 1440 × 1080 |
| 720p | 1280 × 720 | 960 × 720 |

每次合成前重设 Canvas 尺寸，导出为 PNG dataURL。


## 7. 开发计划

- [ ] 将角色外文名渲染到图中
- [ ] 更好的裁剪和虚化配置