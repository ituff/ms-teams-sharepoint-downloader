# Fork Notes — what this project is, and what this fork changes

[English](#english) · [中文](#中文) · [日本語](#日本語)

| | |
| --- | --- |
| **This fork** | <https://github.com/ituff/ms-teams-sharepoint-downloader> |
| **Upstream** | <https://github.com/brendangooden/ms-teams-sharepoint-downloader> |
| **Fix branch** | `fix/unicode-filenames` |
| **The change** | Non-Latin titles (Chinese / Japanese / Korean / …) no longer turn into `_____` filenames |

---

## English

### What this project is

A Chrome extension (Manifest V3) that downloads **videos, audio and transcripts** from Microsoft Teams meeting recordings, SharePoint, and Microsoft Stream (on SharePoint) — even when your organisation has disabled the built-in download button.

- Works on `teams.microsoft.com`, `teams.cloud.microsoft`, and `*.sharepoint.com` (including the Stream player at `/_layouts/15/stream.aspx`).
- It reuses the same API calls the native player already makes. No extra tools, no external server — all processing happens locally in the browser.
- Video + audio → **MP4**, audio only → **M4A**. Transcripts → raw **JSON**, standard **WebVTT**, or **Grouped VTT** (consecutive lines from the same speaker merged into one block), with optional timestamps and speaker names.
- MIT licensed. Upstream is maintained by Brendan Gooden.

### What this fork changes

One bug, in `src/content.js`.

| | |
| --- | --- |
| **Symptom** | Downloading a recording whose title is non-Latin produced a filename of nothing but underscores. A meeting called `产品评审会` was saved as `_____`. |
| **Also affected** | Japanese, Korean, Cyrillic, Greek, Thai, Vietnamese, and accented Latin titles (`Réunion générale` → `R_union_g_n_rale`). |
| **Root cause** | `sanitizeFilename()` used the ASCII-only character class `[^a-z0-9\s_-]`, which replaced *every* non-ASCII character with `_`. |
| **Why it hit every path** | The modal preview and the saved filename both call this one helper, so the name you saw and the name written to disk were equally wrong. |

The fix:

```js
// before
return String(name == null ? '' : name).replace(/[^a-z0-9\s_-]/gi, '_').trim();

// after
return String(name == null ? '' : name)
  .normalize('NFC')
  .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '_')
  .trim();
```

- `\p{L}` letters, `\p{N}` numbers, `\p{M}` combining marks — every script survives intact.
- Still neutralised, exactly as before: path separators (`/ \ :`), the Windows-illegal set (`* ? " < > |`), control and format characters (including bidi overrides), and leading/trailing dots and spaces.
- `normalize('NFC')` composes decomposed accents/dakuten into a single code point.
- ASCII behaviour is unchanged, so existing users see no difference at all.
- Idempotent — safe to apply on blur and again at download time, which the code does.

Files touched: `src/content.js` (the fix), `scripts/verify-sanitize.mjs` (new regression harness), `FORK-NOTES.md` (this file), `README.md` (pointer added at the top).

### Install the fixed build

1. `git clone https://github.com/ituff/ms-teams-sharepoint-downloader.git`
2. Open `chrome://extensions/` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `src/` folder.

The fork keeps the upstream version number (`1.7.1`). To build a release zip, bump `version` in `src/manifest.json` first, then run `pwsh scripts/package-extension.ps1`.

### Verify the fix

```bash
node scripts/verify-sanitize.mjs
# 29/29 cases passed; 0 failure(s)
```

---

## 中文

### 这个项目是做什么的

这是一个 Chrome 扩展（Manifest V3），用于从 **Microsoft Teams 会议录制、SharePoint 以及 Microsoft Stream（SharePoint 版）** 下载**视频、音频和转录文本**——即使所在组织已经禁用了页面自带的下载按钮。

- 支持 `teams.microsoft.com`、`teams.cloud.microsoft` 以及 `*.sharepoint.com`（包括 `/_layouts/15/stream.aspx` 的 Stream 播放器）。
- 复用的是原生播放器本身已经在调用的同一批接口，不需要额外工具，也不经过任何外部服务器——全部在浏览器本地完成。
- 视频＋音频导出 **MP4**，仅音频导出 **M4A**；转录文本支持原始 **JSON**、标准 **WebVTT**，以及「**分组 VTT**」（同一发言人的连续字幕合并为一段），时间戳与发言人姓名可选。
- MIT 许可。上游由 Brendan Gooden 维护。

### 我们改了什么

只修了一个 bug，位于 `src/content.js`。

| | |
| --- | --- |
| **现象** | 下载非拉丁文字标题的录制时，文件名会变成一串下划线。名为 `产品评审会` 的会议被保存成了 `_____`。 |
| **同样受影响** | 日文、韩文、西里尔文、希腊文、泰文、越南文，以及带重音的拉丁文标题（`Réunion générale` → `R_union_g_n_rale`）。 |
| **根因** | `sanitizeFilename()` 使用了只允许 ASCII 的字符类 `[^a-z0-9\s_-]`，会把**每一个**非 ASCII 字符都替换成 `_`。 |
| **为何波及所有入口** | 弹窗预览和落盘文件名调用的是同一个 helper，所以「看到的名字」和「写入磁盘的名字」同样错误。 |

修复内容：

```js
// 修改前
return String(name == null ? '' : name).replace(/[^a-z0-9\s_-]/gi, '_').trim();

// 修改后
return String(name == null ? '' : name)
  .normalize('NFC')
  .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '_')
  .trim();
```

- `\p{L}` 字母、`\p{N}` 数字、`\p{M}` 组合附加符号——所有文字系统都能完整保留。
- 与原逻辑完全一致，仍然会被屏蔽：路径分隔符（`/ \ :`）、Windows 非法字符集（`* ? " < > |`）、控制与格式字符（含 bidi 覆盖符），以及首尾的点号和空格。
- `normalize('NFC')` 把分解形式的浊音/重音合成单个码点。
- ASCII 行为保持不变，老用户完全无感。
- 幂等——失焦时和下载时各调用一次都安全（代码正是这样做的）。

改动文件：`src/content.js`（修复本体）、`scripts/verify-sanitize.mjs`（新增回归测试脚本）、`FORK-NOTES.md`（本文件）、`README.md`（顶部加了一行指引）。

### 安装修复版

1. `git clone https://github.com/ituff/ms-teams-sharepoint-downloader.git`
2. 打开 `chrome://extensions/`，开启右上角的**开发者模式**。
3. 点击**加载已解压的扩展程序**，选择 `src/` 目录。

本 fork 保留了上游的版本号（`1.7.1`）。如需打包发布 zip，请先提升 `src/manifest.json` 里的 `version`，再执行 `pwsh scripts/package-extension.ps1`。

### 验证修复

```bash
node scripts/verify-sanitize.mjs
# 29/29 cases passed; 0 failure(s)
```

---

## 日本語

### このプロジェクトについて

Microsoft Teams の会議録画、SharePoint、および Microsoft Stream（SharePoint 版）から、**動画・音声・文字起こし**をダウンロードするための Chrome 拡張機能（Manifest V3）です。組織が標準のダウンロードボタンを無効にしていても利用できます。

- `teams.microsoft.com`、`teams.cloud.microsoft`、`*.sharepoint.com`（`/_layouts/15/stream.aspx` の Stream プレーヤーを含む）で動作します。
- ネイティブプレーヤーがすでに呼び出している API をそのまま利用します。追加ツールは不要で、外部サーバーへの送信もありません。処理はすべてブラウザ内で完結します。
- 動画＋音声は **MP4**、音声のみは **M4A**。文字起こしは生の **JSON**、標準 **WebVTT**、**グループ化 VTT**（同一話者の連続する行を 1 ブロックにまとめる）に対応し、タイムスタンプと話者名は任意で付与できます。
- MIT ライセンス。上流は Brendan Gooden 氏がメンテナンスしています。

### この fork での変更内容

`src/content.js` の 1 件のバグのみです。

| | |
| --- | --- |
| **症状** | 非ラテン文字のタイトルを持つ録画をダウンロードすると、ファイル名がアンダースコアだけになります。`产品评审会` という会議は `_____` として保存されていました。 |
| **影響範囲** | 日本語・韓国語・中国語のほか、キリル文字、ギリシャ文字、タイ文字、ベトナム語、アクセント付きラテン文字（`Réunion générale` → `R_union_g_n_rale`）。 |
| **根本原因** | `sanitizeFilename()` が ASCII 限定の文字クラス `[^a-z0-9\s_-]` を使っており、**すべての**非 ASCII 文字を `_` に置換していました。 |
| **全経路に影響した理由** | モーダルのプレビューと保存ファイル名が同じ 1 つのヘルパーを呼び出すため、表示される名前もディスクに書き込まれる名前も同じように壊れていました。 |

修正内容：

```js
// 変更前
return String(name == null ? '' : name).replace(/[^a-z0-9\s_-]/gi, '_').trim();

// 変更後
return String(name == null ? '' : name)
  .normalize('NFC')
  .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '_')
  .trim();
```

- `\p{L}` は文字、`\p{N}` は数字、`\p{M}` は結合マーク — あらゆる文字体系をそのまま保持します。
- 従来どおり無効化されるもの：パス区切り文字（`/ \ :`）、Windows で禁止されている文字（`* ? " < > |`）、制御文字・書式文字（双方向制御文字を含む）、先頭と末尾のドットおよび空白。
- `normalize('NFC')` により、分解されたアクセントや濁点を 1 コードポイントに合成します。
- ASCII の挙動は変わらないため、既存ユーザーへの影響はまったくありません。
- 冪等（べきとう）— フォーカスを外した時とダウンロード時の 2 回適用しても安全です（コードは実際にそうしています）。

変更したファイル：`src/content.js`（修正本体）、`scripts/verify-sanitize.mjs`（回帰テストを新規追加）、`FORK-NOTES.md`（本ファイル）、`README.md`（先頭に案内を 1 行追加）。

### 修正版のインストール

1. `git clone https://github.com/ituff/ms-teams-sharepoint-downloader.git`
2. `chrome://extensions/` を開き、**デベロッパー モード**をオンにします。
3. **パッケージ化されていない拡張機能を読み込む**をクリックし、`src/` フォルダを選択します。

この fork は上流のバージョン番号（`1.7.1`）をそのまま維持しています。リリース用 zip を作る場合は、先に `src/manifest.json` の `version` を上げてから `pwsh scripts/package-extension.ps1` を実行してください。

### 修正の検証

```bash
node scripts/verify-sanitize.mjs
# 29/29 cases passed; 0 failure(s)
```

---

## Changed files / 改动文件 / 変更ファイル

| File | Change / 改动 / 変更 |
| --- | --- |
| `src/content.js` | `sanitizeFilename()` now preserves Unicode letters, numbers and combining marks |
| `scripts/verify-sanitize.mjs` | New — extracts the real function from `content.js` and runs 29 cases |
| `README.md` | Short pointer to this file added at the top |
| `FORK-NOTES.md` | This file |
