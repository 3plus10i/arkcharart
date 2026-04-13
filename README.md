# 明日方舟立绘合成工具

静态前端工具，将角色立绘与阵营图标合成为博客题图。

## 使用

```bash
npm install
npm run dev      # 开发
npm run build    # 构建
```

## 添加立绘

1. 将立绘放入 `assets/chararts/`
2. 命名格式：`立绘_角色名_变体.png`
3. 运行 `npm run generate-data`

## 项目结构

```
assets/
  chararts/      # 角色立绘
  logos/         # 阵营图标
  charsinfo.csv  # 角色信息
src/
  lib/composeImage.js  # Canvas合成
  App.jsx              # 主界面
scripts/
  generate-data.js     # 数据生成
```

## 技术栈

React 18 + Vite + Ant Design + Canvas 2D
