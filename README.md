# 明日方舟立绘合成工具

静态前端工具，将角色立绘与阵营图标合成为博客题图。

## 使用

```bash
npm install
npm run dev      # 开发
npm run build    # 构建
```

## 添加立绘

1. 将立绘放入 `public/chararts/`
2. 按以下命名规则命名
3. 运行 `npm run generate-data`

### 内置立绘命名规则

支持两种文件名格式：

| 类型 | 格式 | 示例 | 说明 |
|------|------|------|------|
| A类 | `立绘_角色名_编号.png` | `立绘_蓝毒_2.png`、`立绘_玛恩纳_skin1.png` | 编号可以是数字或skin+数字。这也是PRTS的标准立绘文件命名 |
| B类 | `角色名_职业_势力_编号.png` | `蓝毒_狙击_罗德岛_2.png` | 职业和势力直接从文件名提取，势力须为 `logos/` 下已有的logo文件名 |

无法匹配以上格式时，会降级为F类（取文件名为角色名，职业"其他"，无势力，编号1）。

> **注意**：A类要求角色名在 `public/charsinfo.csv` 中有记录，否则职业和势力无法获取。

## 项目结构

```
public/
  chararts/          # 角色立绘
  logos/             # 势力图标
  charsinfo.csv      # 角色信息（势力字段=logo文件名）
src/
  data/              # 构建前脚本自动生成，勿手动编辑
    charsInfo.js     # 角色信息对象
    charArts.js      # 预置立绘文件列表
    faction.js       # 势力名列表
  lib/
    composeImage.js  # Canvas合成
    parseArtFile.js  # 文件名解析
    artListManager.js# 立绘列表管理
  App.jsx            # 主界面
scripts/
  generate-data.js   # 构建前数据生成
```

## 技术栈

React 18 + Vite + Ant Design + Canvas 2D
