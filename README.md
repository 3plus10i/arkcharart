# ArkCharArt - 明日方舟立绘合成工具

将角色立绘与Logo合成的静态前端工具。

## 功能

- 多出处角色数据（方舟干员 / 方舟特殊 / 终末地），支持职业、分支、星级、性别筛选，支持名称搜索，多立绘选择
- Canvas 2D 五图层合成：底图 → 背景大立绘 → Logo → 白色渐变遮罩 → 中心人物立绘
- 立绘大小 / 横纵位置 / Logo大小 / 输出质量可调
- Logo可覆盖选择
- 本地立绘优先，回落远程 URL；支持上传自定义立绘图片
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
  build_data.py       # 统一构建脚本
public/
  chararts/           # 角色立绘 PNG
  logos/              # Logo图标 PNG/SVG
  bg.svg              # 合成底图
  arts_data.json      # 运行时角色数据（构建时自动生成）
src/
  App.jsx             # 主界面
  config.js           # 合成参数常量
  data/               # 由脚本自动生成，勿手动编辑
    logo.js           # logo名+扩展名映射
  lib/
    composeImage.js   # Canvas 合成核心
    parseArtFile.js   # 立绘文件名解析
    artListManager.js # 立绘编号映射
```

## 技术栈

React 18 · Vite 5 · Ant Design 5 · Canvas 2D
