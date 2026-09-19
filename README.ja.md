# MarkPaste

**Markdown で書いて、Word にそのまま貼る。** 見出しも表もコードも、書式を保ったまま Word・Outlook・Gmail・Notion へ貼り付けられます。

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [markpaste.com](https://markpaste.com)

[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Live](https://img.shields.io/badge/markpaste.com-live-D4A843)](https://markpaste.com)
[![インストール不要](https://img.shields.io/badge/%E3%82%A4%E3%83%B3%E3%82%B9%E3%83%88%E3%83%BC%E3%83%AB%E4%B8%8D%E8%A6%81-%E3%83%96%E3%83%A9%E3%82%A6%E3%82%B6%E3%81%A0%E3%81%91-brightgreen)](https://markpaste.com)
[![ビルド不要](https://img.shields.io/badge/%E3%83%93%E3%83%AB%E3%83%89%E4%B8%8D%E8%A6%81-vanilla%20JS-lightgrey)](#技術スタック)

変換も、貼り直しも、インストールも要りません。ページを開けば、すぐ書けます。

## 最近の変更

- **📸 Snap** — ドキュメントをスマホ幅の縦長画像にして、そのままクリップボードへ。投稿に貼るだけです。
- **🎨 3 つの出力スタイル** — *Aurum*（金色のセリフ体）、*Metro*（すっきりしたサンセリフ）、*Folio*（論文風）。プレビューも縦長画像も PDF も、選んだスタイルに揃います。
- **🌈 シンタックスハイライト** — コードブロックに色が付きます。言語はツールバーの ` ``` ` ボタンから選べます。
- **🔄 ファイルの自動同期** — Claude Code や別のエディタが開いているファイルを書き換えると、その変更が自動で反映されます。**未保存の編集が上書きされることはありません。**
- **📱 スマホ表示** — スマホでは 1 ペインになり、貼る → 読む → Copy / Snap という最短の流れだけが残ります。
- **🔗 リンクから開く** — Markdown の URL をコピーして **Paste** を押すと、その中身が読み込まれます。

## 機能

**書く**

- 打った先からのライブプレビュー
- エディタ / 分割 / プレビューの 3 表示（`Alt+1` / `Alt+2` / `Alt+3`）
- 書式ツールバーとひと通りのキーボードショートカット — 一覧は `Ctrl+K` で開きます
- 行の移動・複製・削除、インデントとその解除、OneNote 風のリスト自動継続
- 検索と置換（大文字小文字・単語単位・正規表現に対応）
- 脚注、タスクリスト、表、そして `==ハイライト==`
- 折り返しの切り替え（`Alt+Z`）、ダーク / ライトテーマ

**取り出す**

- **リッチテキストとしてコピー**（`Ctrl/⌘+Shift+C`）— Word でもメールでもチャットでもきれいに貼れます
- **Snap** — スマホ幅の縦長画像をクリップボードへ。そのまま投稿できます
- HTML・Word（`.doc`）・PDF への書き出し

**失わない**

- 打つたびに下書きを自動保存。リロードしても続きから書けます
- **New** と **Paste** は、未保存の変更があるときだけ確認します

## オンラインで使う

👉 **[markpaste.com](https://markpaste.com)** — インストールは要りません。処理はすべてブラウザの中で完結し、**ファイルはどこにもアップロードされません**。

ディスク上の `.md` を直接開いて保存したい場合は、次のローカル実行をご覧ください。

## ローカルで動かす

[Node.js](https://nodejs.org/) が必要です。

```bash
npm install
npm start
```

あとは <http://localhost:3000> を開きます。

MarkPaste は **backend-optional** です。ローカルサーバーが動いていれば **Local mode** になり、ディスク上のファイルを直接開いて保存でき、他のプログラムによる変更も自動で反映されます。markpaste.com のように静的サイトとして置かれた場合は **Web mode** で動き、Save は `.md` のダウンロードになります。**コードは同じひとつです。**

ローカルサーバーは `127.0.0.1` だけにバインドするため、ネットワークからは見えません。手元で使うためのものなので、インターネットには公開しないでください。外から届くホストで動かす場合は、`MD_BASE_DIR` でアクセス範囲を 1 つのディレクトリに限定できます。

```bash
MD_BASE_DIR=/path/to/notes npm start
```

## オフライン版（単一ファイル）

依存をすべて埋め込んだ `markpaste-local.html` を作れます。**ネットワークアクセスはゼロ**です。

```bash
npm install
npm run build:local
```

ブラウザでダブルクリックするだけで、編集、ライブプレビュー、**59 言語のシンタックスハイライト**、リッチテキストのコピー、HTML / Word の書き出しが使えます。約 415 KB。インターネットに繋がっていない端末でも動くので、持ち込みや閉域網の環境に向いています（Snap は含まれません）。

## 技術スタック

- **フロントエンド**：素の HTML / CSS / JS — フレームワークなし、バンドラなし、ビルドステップなし
- **バックエンド**（任意）：Node.js + Express。ローカルのファイル読み書きにだけ使います
- **ライブラリ**：markdown-it と highlight.js

## おまけ：Windows の右クリックメニュー

`add-context-menu.reg` / `remove-context-menu.reg`、`open-md.ps1`、`start-hidden.vbs` を使うと、`.md` の右クリックメニューに「Open with MarkPaste」を追加できます。**取り込む前に `.reg` の中のパスを書き換えてください** — `.reg` はコマンドをただの文字列として持つため、リポジトリの場所を自力では見つけられません。Windows 専用です。

## ライセンス

[MIT](LICENSE) © tokicode
