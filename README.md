# ArkCharArt - 立绘合成工具

将角色立绘与阵营Logo合成艺术图片的静态前端工具。

主要是明日方舟角色，通过[PRTS](https://prts.wiki/)获取角色数据，在此感谢。

也有一些非明日方舟干员角色可选。或者自己上传素材。

尝试一下：https://arkcharart.3plus10i.top/

## 功能

- 多出处角色数据（方舟干员 / 方舟特殊 / 终末地），支持职业、分支、星级、性别筛选，支持名称搜索，多立绘选择
- 支持自定义上传角色素材
- 立绘大小 / 横纵位置 / Logo大小可调
- Logo自定义选择，自由组合角色与logo
- 多种输出分辨率（4K / 2K / 1080p / 720p），支持 16:9 和 4:3 画面比例
- 导出 PNG 下载

## 使用

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 构建生产版本
```

## 添加立绘

1. 将立绘放入 `public/chararts/`
2. 在 `scripts/arts_data.csv` 中添加对应记录（`文件名` 字段须与实际文件名一致）
3. 运行 `npm run build-data`

## 项目结构

```
scripts/
  arts_data.csv       # 角色数据源（手工维护的CSV）
  build_data.js       # 统一构建脚本
public/
  chararts/           # 角色立绘 PNG
  logos/              # Logo图标 PNG/SVG
  bg-16-9.svg         # 合成底图（16:9）
  bg-4-3.svg          # 合成底图（4:3）
  arts_data.json      # 运行时角色数据（构建时自动生成）
src/
  App.jsx             # 主界面
  App.css             # 样式
  config.js           # 合成参数常量
  main.jsx            # 入口
  data/               # （已移至 public/logo_data.json）
  lib/
    composeImage.js   # Canvas 合成核心
```

## 技术栈

React 18 · Vite 5 · Ant Design 5 · Canvas 2D
