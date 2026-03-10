# 如何添加新的优化课程笔记（中英双语）

## 1. 创建双语 Markdown 文件
在 `optimization` 目录下为每一讲创建两个文件：

- `LecN.zh.md`
- `LecN.en.md`

例如：`Lec3.zh.md` 与 `Lec3.en.md`。

## 2. 在首页挂载
编辑 `optimization/index.html` 中 `NOTES` 数组，新增：

```js
{
  id: "Lec3",
  titleZh: "Lec3 - 次梯度与近端方法",
  titleEn: "Lec3 - Subgradient and Proximal Methods",
  summaryZh: "不可导情形下的优化策略。",
  updated: "2026-03-24"
}
```

## 3. 访问方式
- 中文：`/optimization/note.html?note=Lec3&lang=zh`
- English：`/optimization/note.html?note=Lec3&lang=en`

## 4. 一级标题独立渲染
每个 markdown 的第一行 `# 标题` 会被提取为页面大标题，不再重复出现在正文。

## 5. LaTeX 公式
- 行内：`$\nabla f(x)$`
- 块级：`$$x_{k+1}=x_k-\alpha_k\nabla f(x_k)$$`

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

打开：`http://localhost:8000/optimization/index.html`
