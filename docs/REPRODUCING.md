# 安装与复现

主入口为 [`production/mv/render-film.mjs`](../production/mv/render-film.mjs)，根目录 npm 脚本只是调用该入口。以下命令在仓库根目录执行；源码与场景数据的关系见 [架构说明](ARCHITECTURE.md)。

## 先区分代码包与完整制作输入

公开仓库分发代码、登记数据和素材清单中允许分发的图片。素材清单中有 78 张 `commitAllowed: true` 图片；它们不能单独组成整片所需的全部输入。音乐、字幕原件、字体、原 MV 取材层、其他角色图及混合角色烘焙结果分别有自己的来源和许可，部分文件只在完整制作目录中存在。

完整渲染需要让活动代码和 JSON 引用的输入实际存在：

| 输入 | 位置与要求 |
| --- | --- |
| 场景与规划数据 | `production/mv/tracks.json`、`production/mv/plan.json`。 |
| 场景登记与预处理数据 | `assets/runtime/` 各场景组中的 JSON；部分文件在模块导入时就会读取。 |
| 人物、表情、封面与道具 | `assets/visuals/`、`assets/props/` 与运行资源中的局部层；保持对应的原始尺寸、alpha 与登记关系。 |
| 原作派生图 | `assets/third-party-derived/` 中的清理背景、手部等；代码包不授予其再分发许可。 |
| SNS 烘焙输入 | `assets/runtime/social-web-export/` 的两个 timeline 清单、屏幕纹理、投影前面板与侧壁。 |
| 歌曲 | `assets/ASSET_INDEX.json` 的 `audio` 字段；默认指向 `assets/audio/KAWAIKU NARITAI (feat. Sana).mp3`。 |
| 字体 | 系统字体或明确指定的字体文件；字体更换会影响字形、排版和像素结果。 |
| 可选外挂字幕源 | `assets/subtitles/` 中对应的 SRT，仅在使用 `--srt` 时读取。 |

按 [素材许可清单](../assets/asset-licenses.json) 的 `path`、`sha256`、`authors`、`sourceUrls`、`changes`、`license` 与 `commitAllowed` 核对素材。原作者和换装参考见 [素材出处](ASSET_ATTRIBUTION.md)，权利范围见 [LICENSING.md](../LICENSING.md)。从作者允许的渠道取得素材或自行制作具有相应使用权的替代素材；替换后同步调整轨道与登记数据。代码可运行不等于音乐、原 MV 或全部角色已获得同一许可。

原 MV 视频不是渲染器的逐帧解码输入。只把一段原 MV 放入工程，不能补出缺少的清理底板、透明人物、表情补层或 SNS 烘焙纹理。

## 运行环境

根 `package.json` 锁定 `@napi-rs/canvas` 为 `0.1.100`，`package-lock.json` 固定 npm 依赖解析。使用：

```powershell
node --version
npm ci
ffmpeg -version
```

参考运行环境为 Windows、Node.js 24.19.0、`@napi-rs/canvas` 0.1.100，以及提供 `libx264`、`av1_amf`、AAC、rawvideo 和 MP4 支持的 FFmpeg 构建。Canvas 的原生二进制由对应平台 npm 包提供；不要把别的平台 `node_modules/` 当作跨平台安装包。

FFmpeg 默认从 PATH 查找。也可设置 `FFMPEG_PATH`，或给渲染命令添加 `--ffmpeg`；命令行参数优先于环境变量。参数应是可执行文件本身的路径，不包含额外 FFmpeg 参数。

字体变量如下。示例路径应替换成自己已取得使用权的字体：

```powershell
$env:MV_FONT_PATH = (Resolve-Path ".local/fonts/main-font.ttf").Path
$env:MV_TITLE_FONT_PATH = (Resolve-Path ".local/fonts/title-font.ttf").Path
$env:MV_SOURCE_FONT_PATH = (Resolve-Path ".local/fonts/display-font.ttf").Path
```

| 变量 | 字体族及默认行为 |
| --- | --- |
| `MV_FONT_PATH` | 注册为 `MV Gothic`；Windows 默认从系统字体目录加载 `msyh.ttc`。 |
| `MV_TITLE_FONT_PATH` | 注册为 `TitleRound`；Windows 默认尝试 `YuGothM.ttc`。 |
| `MV_SOURCE_FONT_PATH` | 注册为 `SourceDisplay`；默认尝试 `assets/fonts/汉仪跳跳体简5.0.ttf`。 |

非 Windows 系统应自行指定适合的字体。字体注册具有回退行为，缺少字体未必立即报错，却可能产生缺字或不同排版；需要比较字形、换行与输出帧，不能只检查命令退出码。

## 覆盖检查与参数规划

先运行：

```powershell
npm run coverage
```

默认 60 fps 的时钟为 15,135 帧、252.25 秒；覆盖报告写入 `qa/mv/film-coverage.json`。该命令不需要音轨、不进行视频编码，但仍需加载模块导入阶段读取的 JSON。它检查帧路由，不验证所有图片、字体或 SNS 纹理是否齐全。

`--dry-run` 计算输出区间和 FFmpeg 参数，不调用编码器、不生成视频。它仍会执行覆盖检查和相关导出门槛，并把参数写入 `qa/mv/film-render-plan.json`。例如：

```powershell
npm run render -- --output-range 44 56 --width 1280 --fps 60 --encoder av1_amf --quality speed --bitrate 8M --preview-release --dry-run --out qa/mv/plan-only.mp4
```

当前轨道保留 `ready: false` 等制作登记值。`--qa` 允许绘制这些场景并附内部检查水印；`--preview-release` 同样允许绘制现有场景，但关闭该水印。后者不补齐缺素材、不认证画质，也不修改登记值。这里的复现命令使用它来输出现有实现。

渲染器给 FFmpeg 传入 `-y`；应为 `--out` 选择明确的新文件名，避免覆盖已有输出。

## 先导出与整片对齐的局部

局部检查优先使用**输出时间**：

```powershell
npm run render -- --output-range 44 56 --width 1280 --fps 60 --encoder av1_amf --quality speed --bitrate 8M --preview-release --out qa/mv/check-44-56.mp4
```

`--output-range A B` 把边界分别取 `round(A * fps)`、`round(B * fps)`，区间右端不包含。上例输出整片帧号 2640–3359，共 720 帧、12 秒；音乐从歌曲 44 秒取用，画面 source PTS 从 43.936 秒开始，和整片使用同一帧网格。

另一接口 `--range A B` 的 A/B 是 **source PTS**，也可用 `--range-start`、`--range-end`。它从 source A 开始以 `1 / fps` 步长取样，帧数按 `round((endPTS - startPTS) * fps) + 1` 计算，音频从 `startPTS + audioOffset` 开始。比如 `--range 44 56` 是 721 帧，音频从 44.064 秒开始。不要把这种片段直接当成整片输出 44–56 秒的替换补丁。

检查摄影棚人物、SNS 手机、电车入口、朋友至广告及片尾接点时，应让局部区间覆盖转场前后，保留完整的进入与离开过程。

## 整片 720p60

AMD AV1 硬件编码的快速审看片：

```powershell
npm run render -- --width 1280 --fps 60 --encoder av1_amf --quality speed --bitrate 8M --preview-release --out renders/mv-720p60-av1.mp4
```

CPU H.264 编码：

```powershell
npm run render -- --width 1280 --fps 60 --encoder libx264 --preset veryfast --crf 18 --preview-release --out renders/mv-720p60-h264.mp4
```

`av1_amf` 需要 FFmpeg 构建、AMD 硬件与驱动同时支持；可以用 `ffmpeg -hide_banner -encoders` 查看当前构建是否列出该编码器，真正可用还需实际编码验证。CPU 命令使用 `libx264`，也要求 FFmpeg 提供该编码器。Canvas 绘图仍在 Node.js 端执行，硬件编码不会自动将场景绘制移到 GPU。

## 整片 4K60

AMD AV1，目标码率 30 Mbps：

```powershell
npm run render -- --width 3840 --fps 60 --encoder av1_amf --quality balanced --bitrate 30M --preview-release --out renders/mv-4k60-av1.mp4
```

CPU H.264：

```powershell
npm run render -- --width 3840 --fps 60 --encoder libx264 --preset fast --crf 18 --preview-release --out renders/mv-4k60-h264.mp4
```

4K 输出的程序背景、几何与 SVG 按输出密度绘制，原始人物图片的细节取决于其母版。CPU 编码速度和内存消耗也取决于场景、图片缓存和系统，不应直接按 720p 速度预测。

目前入口对 `av1_amf` 生成 `-quality`、`-b:v`；对其他 encoder 生成 `-preset`、`-crf`。因此上述命令分别使用已对应的 AMD AV1 与 CPU libx264 参数，不能只把 `--encoder` 换成 `h264_amf` 或任意 FFmpeg 编码器就假定参数仍有效。

AV1 AMF 对某些非 16 倍数尺寸可能产生编码尺寸填充。1280×720 与 3840×2160 都符合此约束；使用其他尺寸时应实际核对 ffprobe 报告，避免把 960×540 请求当成未填充的输出。

## 音轨、无声输出与 SRT

完整输出的歌曲从 0 秒开始。默认画面时钟为 `clamp(歌曲秒数 - 0.064, 0.129, 252.130)`，音轨本身不因此裁掉开头的 64 ms。`--audio-offset` 调整的是画面相对歌曲的映射；它还会参与整片长度的计算。

无声局部示例：

```powershell
npm run render -- --output-range 44 56 --width 1280 --fps 60 --encoder libx264 --preset veryfast --crf 18 --no-audio --preview-release --out qa/mv/check-silent.mp4
```

`--no-audio` 跳过歌曲输入和音频编码，可在没有歌曲文件时渲染已具备图片输入的场景；`assets/ASSET_INDEX.json` 本身仍会读取。缺少图片或登记数据时，该选项不会补齐它们。

歌词使用外挂 SRT，不烧入画面。入口目前只明确选择两种输入：

| 参数 | 字幕源 |
| --- | --- |
| `--srt ja` | `assets/subtitles/KAWAIKU NARITAI.ja.srt` |
| `--srt bilingual` | `assets/subtitles/KAWAIKU NARITAI.bilingual.srt` |

将所需参数附在渲染命令后，会在视频成功编码后写出同名 `.ja.srt` 或 `.bilingual.srt`。其他字符串会落入日文输入分支；当前没有 `--srt zh-CN` 的中文输入选择。需要单独中文时，应另外提供已校时且具备相应使用条件的中文 SRT。

字幕源使用歌曲时钟。整片字幕不施加 64 ms 画面偏移；局部字幕按 `AUDIO_SEEK` 减去区间起点，因此 `--output-range 44 56` 减去 44 秒，`--range 44 56` 默认减去 44.064 秒。程序仅处理 SRT 时刻和文本，不自动理解歌词，也不生成翻译。

当前字幕写出器只去掉片段起点之前已经结束的条目，并将负起点夹到零；它不会按局部视频的尾端裁掉后续条目。交付独立短片时，需要另行裁剪超出时长的字幕并核对首尾。

## 输出检查与常见问题

成功结束会生成视频和 `<输出名>.render.json`。旁车记录尺寸、fps、帧数、渲染耗时、编码器、音轨定位、FFmpeg 参数和登记状态。不要只以视频文件已出现或变大判定完成。

基础参数可检查为：

```powershell
ffprobe -v error -show_streams -show_format -of json renders/mv-720p60-av1.mp4
```

完整文件的解码检查可用：

```powershell
ffmpeg -v error -xerror -i renders/mv-720p60-av1.mp4 -map 0:v:0 -f null -
```

这些检查不替代动态画面、转场连续性、字幕与声画同步的审看。

| 现象 | 应核对的位置 |
| --- | --- |
| 无法加载 `@napi-rs/canvas` 或其原生包 | 在当前平台重新执行 `npm ci`，确认实际 Node 与 CPU 架构。 |
| 模块导入阶段读取 JSON 失败 | 检查活动场景所需的 `assets/runtime/` 数据是否存在；coverage 也会加载这些数据。 |
| `Audio track declared by ASSET_INDEX.audio not found` | 准备已声明的音轨或使用 `--no-audio`；coverage 和 dry-run 本身不要求 MP3 存在。 |
| 图片解码报路径错误 | 对照素材清单与场景 JSON 找输入；公开克隆缺少的素材需要合法取得或自行替换。 |
| 输出被 `ready` 门槛拒绝 | 区分登记字段与渲染模式；检查参数是否包含适当的 `--qa` 或 `--preview-release`。 |
| 无法启动 FFmpeg、未知编码器或 AMF 初始化失败 | 核对 PATH、`FFMPEG_PATH`、`--ffmpeg` 及 FFmpeg/驱动实际能力；准备完整输入后可选 CPU libx264。 |
| 字形不同、缺字或换行变化 | 核对字体文件、环境变量与图片中的文字；不同系统默认字体不保证相同像素。 |
| SNS 没有随文案变化 | 检查烘焙纹理、投影帧和两个 timeline；仅修改 UI 文案数据不会自动重做已有纹理。 |
| 局部与整片拼接时错帧或音频起点不同 | 检查是否混用了 `--range` 与 `--output-range`，以及 fps 和 `--audio-offset`。 |

`--fill-gaps` 只为未覆盖的帧路由绘制明显的诊断占位，并禁止输出到 `deliverables/`。它不修复缺失图片，也不构成有效的完整作品。

## 验证范围

Windows、Node.js 24.19.0、Canvas 0.1.100 环境下，`npm run coverage` 可完成路由检查；AMD AV1 与 CPU libx264 两组 44–56 秒参数通过了 `--dry-run` 规划核对，均为 720 帧、12 秒，source PTS 首帧为 43.936。无声 CPU 规划不包含音轨输入。

在补齐素材的 Windows 工作副本中，另已完成 `npm ci`，并实际编码歌曲时间 49.5–49.7 秒的 1280×720、60fps 短片：CPU libx264 与 AMD AV1 均得到 12 帧、0.2 秒输出，完整解码通过；CPU 样例同时写出 AAC 音轨与日文 SRT。该检查验证实际短区间路径，不代表重新渲染了完整 4K 影片，也不代替短片的动态美术验收。

素材布局和源码命名调整前后，使用完整本地输入比较了覆盖场景及关键转场的 172 个 320×180 采样帧，像素 SHA256 一致。只含公开文件的独立目录也已通过独立 `npm ci` 和零缺口覆盖检查，未额外复制音乐、字体或私有媒体。采样回归不覆盖每一个输出帧，公开目录的覆盖检查也不代表整片素材已齐全。

参数规划不会运行编码器或解码全部素材。Linux、macOS、其他 CPU 架构、其他 GPU 编码器及其字体输出没有相同的实际验证记录；应在目标环境先完成输入核对、短区间编码和播放检查，再进行整片导出。
