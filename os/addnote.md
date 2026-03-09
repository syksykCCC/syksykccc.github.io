# 如何添加新的课程笔记（中英双语）

本指南说明如何把新笔记（例如 `Lec2`）添加到站点并在详情页支持中英文一键切换。

## 1. 创建双语 Markdown 文件
在 `os` 目录下为每一讲创建两个文件：

- `Lec2.zh.md`（中文）
- `Lec2.en.md`（English）

命名规则：
- 前缀是同一个笔记编号（如 `Lec2`）
- 后缀必须是 `.zh.md` 或 `.en.md`

## 2. 在首页挂载笔记编号
打开 `os/index.html`，找到 `NOTES` 数组，追加一个条目：

```js
{
  id: "Lec2",
  titleZh: "Lec2 - 进程与线程",
  titleEn: "Lec2 - Processes and Threads",
  summaryZh: "进程模型、线程模型与上下文切换。",
  updated: "2026-03-16"
}
```

首页会默认链接到中文：`/os/note.html?note=Lec2&lang=zh`

## 3. 详情页语言切换
`note.html` 会根据 URL 参数自动加载：

- 中文：`/os/note.html?note=Lec2&lang=zh`
- English：`/os/note.html?note=Lec2&lang=en`

页面右上角提供“中文 / English”一键切换按钮。

## 4. 一级标题独立渲染
在每个 markdown 文件里，第一行 `# 一级标题` 会被系统提取为页面大标题独立渲染，不再出现在正文里。

## 5. LaTeX 公式写法
笔记支持 LaTeX 公式（MathJax 渲染）：

- 行内公式：`$U = 1 - p^n$`
- 块公式：`$$T_{turnaround} = T_{completion} - T_{arrival}$$`

## 6. 备注折叠框写法
你可以在 markdown 中用下面语法添加“备注”（默认折叠，点击展开）：

```md
:::remark 这里是备注标题
这里是备注内容，可以写多行。
也可以写 **加粗**、`代码`、列表等常见 markdown。
:::
```

## 7. 不同备注类型（含颜色）
支持 4 类折叠框，建议这样使用：

```md
:::remark 📝 备注
...
:::

:::tip 💡 提示
...
:::

:::warn ⚠️ 注意
...
:::

:::error ⛔ 错误
...
:::
```

说明：
- `remark` 也支持 `note` 或 `备注`
- `tip` 也支持 `hint` 或 `提示`
- `warn` 也支持 `warning` 或 `注意`
- `error` 也支持 `danger` 或 `错误`

## 8. 兼容 file 模式
如果你需要打开单独文档（例如本手册），仍可使用：

- `/os/note.html?file=addnote.md`

## 9. 本地预览注意事项
请不要直接双击 HTML 以 `file://` 方式打开，否则浏览器会拦截 Markdown 读取并出现 `fail to fetch`。

推荐在仓库根目录启动本地 HTTP 服务后访问：

```bash
python -m http.server 8000
```

然后打开：`http://localhost:8000/os/index.html`
