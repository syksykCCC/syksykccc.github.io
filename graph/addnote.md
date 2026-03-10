# 如何添加新的图形学与物理仿真笔记（中英双语）

## 0. 当前站点设计要点（便于迁移）
- 元素候选：布料网格、粒子轨迹、碰撞法线、刚体包围盒、能量曲线。
- 最终仅选择一个核心元素：`质量-弹簧网格（mass-spring mesh）`。
- 目标：背景有学科语义，但不喧宾夺主，正文阅读优先。

## 1. 创建双语 Markdown 文件
在 `graph` 目录下为每一讲创建两个文件：

- `LecN.zh.md`
- `LecN.en.md`

例如：`Lec3.zh.md` 与 `Lec3.en.md`。

## 2. 在首页挂载
编辑 `graph/index.html` 中 `NOTES` 数组，新增：

```js
{
  id: "Lec3",
  titleZh: "Lec3 - 刚体与碰撞约束",
  titleEn: "Lec3 - Rigid Body and Contact Constraints",
  summaryZh: "冲量法、接触解算与稳定性。",
  updated: "2026-03-24"
}
```

## 3. 访问方式
- 中文：`/graph/note.html?note=Lec3&lang=zh`
- English：`/graph/note.html?note=Lec3&lang=en`

## 4. 一级标题独立渲染
每个 markdown 的第一行 `# 标题` 会被提取为页面大标题，不再重复出现在正文。

## 5. LaTeX 公式
- 行内：`$\Delta t$`
- 块级：`$$x_{t+\Delta t}=x_t+\Delta t\,v_t$$`

## 6. 备注折叠框
支持如下语法（默认折叠）：

```md
:::remark 📝 备注
内容...
:::

:::tip 💡 提示
内容...
:::

:::warn ⚠️ 注意
内容...
:::

:::error ⛔ 错误
内容...
:::
```

## 7. 本地预览
不要直接双击 HTML（`file://` 会拦截 fetch）。

在仓库根目录运行：

```bash
python -m http.server 8000
```

打开：`http://localhost:8000/graph/index.html`
