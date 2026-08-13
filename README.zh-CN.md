# MarkPaste

**Markdown 进，富文本出** —— 用 Markdown 写，点一下 **Copy**，直接粘进 Word、Outlook、Gmail 或 Notion，格式不走样。

[English](README.md) · [简体中文](README.zh-CN.md) · [markpaste.com](https://markpaste.com)

[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Live](https://img.shields.io/badge/markpaste.com-live-D4A843)](https://markpaste.com)
[![Zero install](https://img.shields.io/badge/%E9%9B%B6%E5%AE%89%E8%A3%85-%E6%B5%8F%E8%A7%88%E5%99%A8%E9%87%8C%E7%9B%B4%E6%8E%A5%E7%94%A8-brightgreen)](https://markpaste.com)
[![No build step](https://img.shields.io/badge/%E6%97%A0%E6%9E%84%E5%BB%BA%E6%AD%A5%E9%AA%A4-vanilla%20JS-lightgrey)](#技术栈)

不用转换，不用善后，什么都不用装 —— 打开网页就能写。

## 最近更新

- **📸 Snap 长图** —— 一键把文档变成手机宽度的长截图，直接进剪贴板。粘到帖子里就能发，不用截图工具，不用裁剪。
- **🎨 三套输出风格** —— *Aurum*（金色衬线）、*Metro*（简洁无衬线）、*Folio*（学术）。预览、长图和 PDF 都跟随你的选择。
- **🌈 代码语法高亮** —— 围栏代码块自动着色；工具栏的 ` ``` ` 按钮可以直接选语言，不用手打。
- **🔄 文件实时同步** —— Claude Code、其他 agent 或别的编辑器改写当前打开的文件时，改动会自己出现。**未保存的内容绝不会被覆盖**。
- **📱 手机适配** —— 手机上是单栏布局，只保留核心链路：粘贴 → 阅读 → Copy / Snap。
- **🔗 从链接打开** —— 复制一个 Markdown 链接，点 **Paste**，背后的文档就载入了。`markpaste.com/?url=<md>` 可以渲染任何能被链接到的 Markdown 文件。

## 功能

**写作**

- 实时预览，基于 [markdown-it](https://github.com/markdown-it/markdown-it)
- 编辑 / 分栏 / 预览 三种视图（`Alt+1` / `Alt+2` / `Alt+3`）
- 格式化工具栏 + 完整快捷键体系 —— 按 `Ctrl+K` 查看全部
- 行编辑：上下移动、复制、删除整行，缩进/反缩进，OneNote 式列表续行
- 查找替换，支持大小写、全词、正则，还能复制/剪切所有匹配行
- 脚注、任务列表、表格，以及 `==高亮文本==`
- 自动换行开关（`Alt+Z`）、深色 / 浅色主题、三套输出风格

**输出与分享**

- **复制为富文本**（`Ctrl/⌘+Shift+C`）—— 同时写入 `text/html` 和 `text/plain`，粘进 Word、邮件和聊天工具都干净
- **Snap 长图** —— 手机宽度的长图（1125px @3×）直接进剪贴板，拿来就能发
- 导出 HTML、Word（`.doc`）和 PDF

**不丢内容**

- 每次输入都会自动存草稿到 `localStorage`，刷新页面内容自动回来
- **New** 和 **Paste** 在有未保存改动时会先确认

## 在线使用

👉 **[markpaste.com](https://markpaste.com)** —— 什么都不用装。全部在你的浏览器里运行，**不会上传任何文件**。**Save** 是下载一个 `.md`，没有服务器碰你的磁盘。

想直接打开和保存本地磁盘上的 `.md` 文件，请看下面的本地运行。

## 本地运行

需要 [Node.js](https://nodejs.org/)。

```bash
npm install
npm start
```

然后打开 <http://localhost:3000>。

MarkPaste 是 **backend-optional** 的：前端启动时探测 `/api/health`。本地服务器在跑，就启用 **Local mode** —— 直接读写磁盘文件、支持 `?file=` 参数，以及当别的程序改动当前文件时的实时同步。作为纯静态站部署时（比如 markpaste.com）探测失败，就运行在 **Web mode**：Save 变成下载 `.md`，Refresh 隐藏，`?file=` 忽略。**同一套代码，不需要服务器。**

本地服务器会读写 `.md` 文件，并且**只绑定 `127.0.0.1`**，网络上访问不到。**它只适合本机使用** —— 不要暴露到公网。如果确实要跑在可访问的主机上，设置 `MD_BASE_DIR` 把所有文件访问限制在一个目录内：

```bash
MD_BASE_DIR=/path/to/notes npm start
```

## 离线单文件版

构建一个自包含的 `markpaste-local.html`，所有依赖全部内联，**零网络请求**：

```bash
npm install
npm run build:local
```

用任何浏览器双击打开即可：编辑、实时预览、**59 种语言的代码高亮**、复制富文本、导出 HTML/Word，以及通过打印对话框输出 PDF。约 415 KB，在完全没有网络的机器上也能用 —— 适合受限或隔离网络的环境。

这个版本不含 Snap：光 html2canvas 就有 194 KB，而手机尺寸的分享图并不是离线编辑器该干的事。

## 技术栈

- **前端**：原生 HTML / CSS / JS —— 无框架、无打包器、无构建步骤
- **后端**（可选）：Node.js + Express，仅用于本地文件读写
- **依赖库**：markdown-it（+ footnote、task-lists、mark）和 highlight.js —— 线上走 CDN，离线版全部内联

## 可选：Windows 右键集成

`add-context-menu.reg` / `remove-context-menu.reg`、`open-md.ps1` 和 `start-hidden.vbs` 用于在 Windows 右键菜单里加一项「用 MarkPaste 打开 `.md`」。可选，且仅限 Windows。

## 许可证

[MIT](LICENSE) © tokicode
