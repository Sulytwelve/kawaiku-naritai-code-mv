# Arch Linux / Intel Kaby Lake 测试记录

对象：`kawaiku-naritai-code-mv` 公开克隆（commit `8a344e2`），Arch Linux + Intel Core i5-7200U / HD Graphics 620。
环境细节见 [environment.md](environment.md)，逐项结果与证据见 [results.json](results.json)。原始视频、边车、日志和硬件探测输出全部放在被忽略的 `qa/linux/kaby_lake/`。

## 结论

1. **能渲染，但只能渲染公开素材齐全的区间。** 当前克隆可以安装、测试、跑覆盖检查、做 CPU `libx264` dry-run，并真实渲染标题、色彩网格、片尾等不依赖缺失素材的区间；实际输出了 640×360@60fps 和 320×180@60fps 的 H.264 短片，ffprobe 与完整解码均通过。
2. **任务示例区间 `--output-range 49.5 50.5` 不能渲染。** 该区间落在 `home-studio` 场景，公开克隆缺少 4 个本机未提供且不可再分发的输入；入口在 frame 0 以 `ERROR: ... Invalid URL` 退出 1，不生成视频。整片渲染同样 blocked。
3. **音轨、字幕、字体机制可用。** 使用本地 Sana 版 MP3（`MV_AUDIO_PATH`）渲染的片段解码出 AAC LC 44.1 kHz 立体声；输出音频与歌曲 19.000 s 起点的归一化互相关为 0.9969、最佳偏移 0 采样。真实 `ja`/`bilingual` SRT 能按窗口平移、裁剪、重新编号；无歌词窗口写出 0 字节 SRT；缺失字体在 plan/旁车记录状态并只打印一次 WARNING，不阻断渲染。
4. **Intel GPU 编解码：VAAPI 与 QSV 均已实测通过。**
   - VAAPI：`h264_vaapi` 实际硬件编码成功（`VAProfileH264High` / `VAEntrypointEncSlice`），640×360 与 1280×720@60fps 短样本均成功；`-hwaccel vaapi` 硬件解码成功；HEVC 编/解码、VP9 解码同样成功。
   - QSV：使用者补齐 `intel-media-driver` + `intel-media-sdk` 后复测，`h264_qsv`/`hevc_qsv` 编码、QSV H.264/HEVC/VP9 解码、1280×720@60 编码、真实 MV 片段重编码与项目 CPU 输出硬解全部 exit 0。日志显示 oneVPL `implementation version 1.35`，普通 `h264_qsv` 明确报告 `hardware accelerated implementation`；坏 `qsv_device` 对照 exit 234，未发生软件回退。
   - 首轮因缺 oneVPL GPU 运行时 QSV 曾记为 blocked；运行时由使用者安装后该问题已解决，报告按最终状态记录并保留历史证据。项目入口仍拒绝 `h264_qsv`/`h264_vaapi`（`REFUSED`，exit 2），这是设计约束，不是硬件能力证据。
5. **测试基线有一处与公开克隆不完全兼容。** 未准备本地字幕时 `npm test` 为 72 项中 67 通过、1 失败、4 跳过；补齐本地 `ja` SRT 后为 68 通过、0 失败、4 跳过。失败项是测试对本地字幕文件的隐式依赖，不是渲染代码失败，详见[问题与最小修复建议](#问题与最小修复建议)。
6. **没有修改源码、动画、时间轴、素材或 `assets/ASSET_INDEX.json`。** 新增内容只有本报告与忽略目录 `qa/linux/kaby_lake/`；QSV 运行时由使用者安装，不属于本轮代码或素材变更。

## 测试对象与输入状态

- 仓库是**公开克隆**：`assets/asset-licenses.json` 共 3201 条图片登记，其中 78 条 `commitAllowed: true` 全部存在；3123 条 `commitAllowed: false` 的本地/第三方素材全部缺失（按设计不随公开仓库分发）。
- 使用者另外提供了音轨、字体和字幕：Sana 版 MP3、`汉仪跳跳体简5.0.ttf`、`ja`/`bilingual`（及 CLI 不接受的 `zh-CN`）SRT。音轨与字体通过环境变量引用，未复制；字幕因入口固定读取 `assets/subtitles/` 路径，以忽略的符号链接指向本地文件。
- 未下载任何商业字体、歌曲或来源不明素材，未修改本机系统或驱动。

## 支持矩阵

状态口径：`pass` = 实际命令结果符合预期且有输出证据；`fail` = 实际结果不符合预期；`skip` = 平台/工具不适用或按任务范围未执行；`blocked` = 因缺失合法输入或环境运行时无法执行，不能记为通过。

| 测试项 | 状态 | 结果摘要 |
| --- | --- | --- |
| `npm ci` | pass | 最终环境 exit 0，2 个包；原生 Canvas 导入成功 |
| `npm test`（公开克隆原样） | fail | exit 1；72 项：67 通过 / 1 失败 / 4 跳过（缺本地 `ja` SRT） |
| `npm test`（有本地字幕输入） | pass | exit 0；72 项：68 通过 / 0 失败 / 4 跳过 |
| `npm run coverage` | pass | exit 0；15135 帧、252.250 s、零缺口、54 个 draft 场景、0 ready |
| CPU `libx264` dry-run（文档命令，44–56 s） | pass | exit 0；720 帧 / 12 s；`probe`、`formatProbe` 为 null |
| dry-run + 本地音轨/字体/字幕 | pass | 三个字体槽位 registered；音轨 `exists: true`；字幕 `sourceExists: true` |
| 缺失字体 dry-run / 真实渲染 | pass | WARNING 各一次；plan/旁车记录 `missing-file`；渲染不中断 |
| 默认 CPU 真实 MV 短片（49.5–50.5 s） | blocked | exit 1；缺 `home-studio` 的 4 个本地素材，frame 0 失败 |
| 可渲染区间真实短片（标题 / 色彩网格 / 片尾） | pass | H.264 High / yuv420p / 60fps；ffprobe 核对、完整解码通过 |
| 真实歌曲音轨覆盖（`MV_AUDIO_PATH`） | pass | AAC LC 44.1 kHz 立体声；与源曲定位互相关 0.9969、最佳偏移 0 采样 |
| 音轨错误路径 / 目录路径 | pass | 二者均在编码前 `REFUSED`，exit 2，无输出文件 |
| 中文/非法 `--srt`、`zh-CN` | pass | `REFUSED`，exit 2 |
| `ja` / `bilingual` SRT 导出 | pass | 按输出窗口平移、裁剪、重新编号；旁车 stats 与文件一致 |
| 无歌词窗口 | pass | 写出 0 字节 SRT，`stats.output: 0`，不视为错误 |
| Intel VAAPI H.264 硬件编码 | pass | exit 0；`VAProfileH264High` / `VAEntrypointEncSlice`；PSNR 平均 45.91 |
| Intel VAAPI H.264 硬件解码 | pass | exit 0；显式 `-hwaccel vaapi`，坏设备对照 exit 234 |
| Intel VAAPI HEVC 编码 / 解码 | pass | 各 exit 0；`VAProfileHEVCMain` 编码、HEVC 硬解 60 帧 |
| Intel VAAPI VP9 解码 | pass | exit 0；VP9 30 帧硬解 |
| Intel VAAPI 1280×720@60 硬件编码 | pass | exit 0；120 帧 / 2 s；短样本速度 4.38× |
| Intel QSV H.264 编码 / 解码 | pass | exit 0；oneVPL 1.35 / MSDK；日志明确 `hardware accelerated implementation`；坏设备对照 exit 234 |
| Intel QSV HEVC 编/解码、VP9 解码、720p60 | pass | 各 exit 0；短样本速度 4.23×–18.4× |
| 整片 MV 渲染 | blocked | 公开克隆缺失 2186 个代码/JSON 引用的本地素材 |
| 动态播放、声画同步与整片观感 | skip | 只有静帧抽查与解码检查，未做人工连续审看 |
| 10-bit、4K、`av1_amf` | skip | 按任务范围不扩展，本机也无 AMD 硬件 |

## 工程流程结果

### 安装

最终环境 `npm ci` exit 0，`npm ls` 显示 `@napi-rs/canvas@0.1.100` 与 `@napi-rs/canvas-linux-x64-gnu@0.1.100`。`import("@napi-rs/canvas")` 成功（26 个导出键）。

早期受限沙箱内默认 `npm ci` 因 `$HOME/.npm` 只读以 exit 226 失败（EROFS）；项目内缓存重试 exit 0。这属于沙箱限制，最终环境不需要该变通。

### 测试

| 条件 | 命令 | 退出码 | 数量 |
| --- | --- | --- | --- |
| 公开克隆原样 | `npm test` | 1 | 72 tests / 67 pass / 1 fail / 4 skip |
| 本地 `ja` 字幕就位 | `npm test` | 0 | 72 tests / 68 pass / 0 fail / 4 skip |

4 个跳过项：3 个 Windows 专用路径/交付保护用例，1 个“系统字体默认注册”用例（本机非 Windows 且未配置默认字体目录）。与文档中“72 项通过”的 Windows 基线相比，Linux 上总项数相同，但可执行项少 4 个。

失败项位于 `production/mv/tests/cli-plan.test.mjs:168`：`--srt ja --no-audio plans subtitles without reading cue data` 断言 `plan.subtitles.sourceExists === true`，而公开克隆没有 `assets/subtitles/KAWAIKU NARITAI.ja.srt`。补齐本地字幕文件（或符号链接）后该用例通过。复现见 `qa/linux/kaby_lake/logs/npm-test.log` 与 `npm-test-final.log`。

### 覆盖检查

`npm run coverage` exit 0：

```text
film            : 6043 source frames, 252.250s, output 15135 @ 60fps = 252.250s
source PTS span : 0.129 .. 252.13
covered, draft scene : 252.250s (100.0%)
UNCOVERED: 0.000s (0.0%)    Gaps (0 intervals)
Draft scenes: 54 run(s)
```

与基线一致：72 项测试对应 15135 帧、252.250 秒、零覆盖缺口。覆盖检查只证明帧路由，不证明素材齐全或画面正确。

### CPU `libx264` dry-run

文档命令（44–56 s、1280 宽）exit 0，plan 记录 720 帧 / 12 秒、`audioSeekSeconds: 44`、`encoder: libx264 8-bit yuv420p`、`probe: null`、`formatProbe: null`。默认非 Windows 环境三个字体槽位不可用（2 个 `not-configured`、1 个 `missing-file`），与文档描述一致，不阻断 dry-run。

配置本地输入后的 dry-run 显示：`MV Gothic`、`TitleRound`、`SourceDisplay` 全部 `registered`；`MV_AUDIO_PATH` 来源为 `environment`、`exists: true`；`subtitles.sourceExists: true`，`stats: null`（dry-run 不读 cue）。

## 真实短片渲染

### 请求的 49.5–50.5 s 区间：blocked

执行：

```sh
npm run render -- --output-range 49.5 50.5 --width 640 --fps 60 \
  --preset veryfast --crf 23 --preview-release --no-audio \
  --out qa/linux/kaby_lake/mv-cpu-silent.mp4
```

结果：exit 1，无输出文件。

```text
ERROR: frame 0 at source PTS 49.436 failed: Invalid URL
```

该窗口属于 `home-studio`（source PTS 44.582–52.45）。按活动代码路径，缺少以下 4 个不可再分发输入；第一个被 `loadImage` 打开的是 `curled-base.png`：

| 缺失输入 | 用途 |
| --- | --- |
| `assets/third-party-derived/home-assets/curled-base.png` | `home-scenes.mjs` 的 `curled()` 底板（首个失败点） |
| `assets/third-party-derived/home-assets/sigh-source.png` | 同场景叹气补层（该窗口 alpha=1） |
| `assets/runtime/home-assets/studio-backdrop.png` | `studio()` 摄影棚背景 |
| `assets/visuals/grok-hairstylist-exit.png` | `studio-crew-mvp.mjs` 中 t≥49.17 s 的退场精灵 |

用本地音轨、字体、字幕重跑同一区间仍以相同错误失败，确认失败原因是画面素材，不是音轨/字幕/字体。

### 可渲染区间

对 15 个代表性区间做了 320×180、12 帧（0.2 s）探测；以下 4 个区间完全由公开素材 + 程序绘制构成，exit 0：

| 区间（s） | 输出 | 内容 |
| --- | --- | --- |
| 19.1–19.3 | 12 帧 | 标题场景 |
| 21.0–21.2 | 12 帧 | 标题场景 |
| 34.1–34.3 | 12 帧 | 色彩网格转场 |
| 247.2–247.4 | 12 帧 | 片尾 |

其余 11 个探测区间因缺失素材在 frame 0 失败：镜像开场缺 `assets/visuals/props/mirror-princess-user.svg`；居家阅读缺 `assets/third-party-derived/plates/reading-clean-registered.png`；摄影棚缺 `curled-base.png`/`studio-backdrop.png`；朋友至广告缺 `assets/props/dafeiyu-rice-bowl/dafeiyu-rice-bowl.svg`；SNS 缺烘焙纹理；坐姿场景缺 `assets/visuals/pair-calm.png`；广告段缺 `assets/third-party-derived/ad-code-assets/source-hand-alpha.png`；R67 的前置书店场景缺 4 个 bookshop 输入。逐条见 `qa/linux/kaby_lake/probe/scene-probe.tsv`。

### 真实片段 1：标题 19–21 s

- 静默版：`--width 640 --fps 60 --preset veryfast --crf 23 --no-audio`，exit 0。
- 本地 Sana 版歌曲 + 本地 `ja` SRT 版：exit 0。
- ffprobe：H.264 High、`yuv420p`、640×360、60 fps、120 帧、2.000 s；AAC LC、44.1 kHz、立体声、2.000 s、约 268 kbps。
- 旁车：`actualOutput.verified: true`，ffprobe 报告 `yuv420p (h264, profile High)`；`fonts` 三个槽位均 registered。
- 完整解码 `ffmpeg -v error -xerror -i <file> -f null -`：exit 0。
- 抽取 0.5 s / 1.2 s / 1.8 s 静帧用图像工具查看：标题文字与甜点背景正常出现，未观察到缺字方框；这只是静帧抽查，不代表动态播放与字幕同步验收。
- 该窗口内真实歌词没有 cue（歌曲开头为器乐/前奏），输出 SRT 为 0 字节，旁车 `stats.output: 0`、`reason: no cues inside the output window`，这是文档约定的正常行为。

### 真实片段 2：色彩网格 35.9–36.3 s

- 真实歌曲 + 真实 `ja` SRT：24 帧 / 0.4 s，exit 0。输入 43 条 cue，输出 1 条，跨窗口终点被裁到 0.400 s，时间行 `00:00:00,155 --> 00:00:00,400`；旁车 `stats.firstStartMs: 155`、`lastEndMs: 400`、`clippedEnd: 1`。
- 真实 `bilingual` SRT + `--no-audio`：同样 1 条输出，保留多行文本（仅统计行数，未在报告中转写内容）。
- 完整解码 exit 0。

### 媒体参数

- CPU 输出色彩标记：`color_range=tv`、`color_space=bt709`，`color_primaries` 与 `color_transfer` 为 `unknown`——与 `docs/REPRODUCING.md` 记录的既有 libx264 行为一致，本轮未修改。
- 硬件 VAAPI 输出：`color_range=tv`，`color_space`/`color_primaries`/`color_transfer` 均为 `unknown`；没有额外色彩标记，不据此声称完整 BT.709。

## 音轨、字幕与字体

### 音轨（`MV_AUDIO_PATH`）

- 真实 Sana 版 MP3 通过环境变量覆盖，未修改 `assets/ASSET_INDEX.json`；旁车 `audio.source: environment`、`seekSeconds: 19`、`path` 为本地绝对路径（公开报告已省略）。
- 解码输出音频与源曲 19.000–21.000 s 段做归一化互相关（同采样率、单声道、1.9 s）：最佳偏移 **0 采样（0 ms）**，相关系数 **0.9969**，说明定位与封装正确；该检查不构成听感或声画同步验收。
- 缺失路径与目录路径：真实有声编码启动前 `REFUSED`，exit 2，不生成视频；空字符串回退到 `ASSET_INDEX.audio` 并在 dry-run 的 `reason` 中说明，`exists: false`。
- 音轨编码为 AAC 44.1 kHz 立体声（文档约定的 256 kbps 参数）。

### 字幕

- 真实 `ja` 与 `bilingual` 源各 43 条 cue，歌曲时钟 1.170–232.173 s；入口只接受 `--srt ja` / `--srt bilingual`，`zh-CN` 实测 `REFUSED`，exit 2。
- 输出窗口按歌曲时钟平移、裁剪并重新编号；颜色网格片段的 1 条输出与旁车统计一致。真实标题 19–21 s 无歌词，按约定写出 0 字节 SRT。
- 另用自拟占位 SRT 验证了“窗口内有 2 条 cue”的版本：输入 6 条，输出 2 条，丢弃窗口外 4 条，跨终点裁剪 1 条，编号从 1 连续，旁车 stats 与文件一致。占位文本不是歌词，也不代表真实字幕内容。
- 无歌词窗口 `--output-range 21.5 21.7 --srt ja`：exit 0，写出 0 字节 `.ja.srt`，`stats.output: 0`、首尾时间为 null。

### 字体

- 默认非 Windows、未设环境变量：`MV Gothic`、`TitleRound` 为 `not-configured`，`SourceDisplay` 为 `missing-file`（默认路径不存在），启动各打印一次 WARNING；coverage 与 dry-run 不阻断。
- 设置本地字体后：三个槽位均 `registered`（主/标题字体来自系统 Noto CJK，`SourceDisplay` 来自本地汉仪跳跳体）；真实渲染旁车 `fonts.registered` 三项齐全。
- `MV_FONT_PATH=/nonexistent/font.ttf` 时：只打印 1 条 MV Gothic WARNING，plan 与旁车记录 `missing-file`，真实渲染仍 exit 0，`actualOutput.verified: true`。
- 字体注册成功不等于字形齐全；只做了静帧文字观察，未逐字审校日文/中文全部字形。

## Intel 硬件编解码（独立 FFmpeg 测试）

项目入口只接受 `libx264`、`libx265`、`av1_amf`，不包含 QSV/VAAPI 渲染后端。因此本节全部用独立 FFmpeg 对自产测试图（`testsrc2`）和项目自产短片测试，不经过项目入口，也不把入口的 `REFUSED` 当作硬件结论。

实测入口行为：

```text
REFUSED: Unsupported encoder "h264_qsv";   supported encoders: libx264, libx265, av1_amf.  (exit 2)
REFUSED: Unsupported encoder "h264_vaapi"; supported encoders: libx264, libx265, av1_amf.  (exit 2)
```

设备与驱动：`/dev/dri/renderD128`（226:128，0666）可访问；`vainfo` 使用 **i965 旧驱动**（`Intel i965 driver for Intel(R) Kaby Lake - 2.4.5`，VA-API 1.24）。iHD 驱动文件不存在，`LIBVA_DRIVER_NAME=iHD vainfo` 失败。

### VAAPI（硬件路径已确认）

| 测试 | 命令要点 | 退出码 | 关键证据 |
| --- | --- | --- | --- |
| H.264 硬件编码 | `-vaapi_device /dev/dri/renderD128 -vf format=nv12,hwupload -c:v h264_vaapi` | 0 | `VAProfileH264High` / `VAEntrypointEncSlice`；60 帧 640×360 2 s；PSNR 平均 45.91（y 46.47） |
| H.264 硬件解码 | `-hwaccel vaapi -hwaccel_device /dev/dri/renderD128 -hwaccel_output_format vaapi` | 0 | `Selecting decoder 'h264' because of requested hwaccel method vaapi`；60 帧，`pix_fmt: vaapi` |
| 坏设备对照（解码） | `-hwaccel_device /dev/dri/renderD999` | 234 | `Failed to open ... as DRM device node`；证明没有静默软件回退 |
| 坏设备对照（编码） | `-vaapi_device /dev/dri/renderD999` | 234 | 同样失败，无输出文件 |
| HEVC 硬件编码 | `-c:v hevc_vaapi` | 0 | `VAProfileHEVCMain` / `VAEntrypointEncSlice`；60 帧 640×360 |
| HEVC 硬件解码 | 软件 `libx265` 生成源，`-hwaccel vaapi` 解码 | 0 | 60 帧，`pix_fmt: vaapi` |
| VP9 硬件解码 | 软件 `libvpx-vp9` 生成源，`-hwaccel vaapi` 解码 | 0 | 30 帧，`pix_fmt: vaapi` |
| 720p@60 H.264 编码 | 1280×720、60 fps、2 s | 0 | 120 帧；短样本速度 4.38×；随后硬解 exit 0 |
| 真实 MV 片段 H.264 硬件重编码 | 项目标题片段（120 帧）为输入 | 0 | 120 帧，H.264 High；硬解该文件 exit 0 |
| 项目 CPU 输出硬件解码 | `mv-title-fragment-real-audio-ja.mp4` | 0 | 120 视频帧 + 88 音频包 / 87 帧 / 88200 采样，0 decode errors |

判定标准：编码器被列出 ≠ 硬件初始化成功 ≠ 实际硬件编码。上表所有 VAAPI 项目均同时满足“显式指定 hwaccel/hwupload、VAAPI 连接初始化日志、对应 VAentrypoint、输出可解码”，并有过坏设备对照失败，因此记为硬件路径已确认。性能数字只描述本次 60/120 帧短样本，不外推整片或 4K。

### QSV（运行时补齐后实测通过）

首轮测试时本机缺 oneVPL GPU 运行时，QSV 记为 blocked；使用者随后安装 `intel-media-driver` 26.3.5 与 `intel-media-sdk` 23.2.2，复测以下项目全部 exit 0：

| 测试 | 命令要点 | 退出码 | 关键证据 |
| --- | --- | --- | --- |
| H.264 硬件编码（显式设备） | `-init_hw_device qsv=hw -filter_hw_device hw` + `hwupload=extra_hw_frames=64,format=qsv` + `-c:v h264_qsv` | 0 | oneVPL `implementation version 1.35`；`Encoder: input is video memory surface`；60 帧 640×360 2 s；PSNR 平均 44.69 |
| H.264 硬件编码（系统内存输入） | 直接 `-c:v h264_qsv` | 0 | 日志明确 `Initialized an internal MFX session using hardware accelerated implementation`；短样本 18.4× |
| H.264 硬件解码 | `-hwaccel qsv -qsv_device /dev/dri/renderD128 -hwaccel_output_format qsv` | 0 | `Selecting decoder 'h264_qsv'`；60 帧，0 errors |
| HEVC 硬件编码 | `-c:v hevc_qsv` | 0 | 60 帧 640×360，HEVC Main；短样本 17× |
| HEVC 硬件解码 | 软件 `libx265` 源 + `-hwaccel qsv` | 0 | `Selecting decoder 'hevc_qsv'`；60 帧 |
| VP9 硬件解码 | 软件 `libvpx-vp9` 源 + `-hwaccel qsv` | 0 | `Selecting decoder 'vp9_qsv'`；30 帧 |
| 720p@60 H.264 编码 | 1280×720、60 fps、2 s | 0 | 120 帧；短样本 4.23×；QSV 硬解 exit 0 |
| 真实 MV 片段 H.264 重编码 | 项目标题片段为输入 | 0 | 120 帧 640×360 60fps；QSV 硬解 exit 0 |
| 项目 CPU 输出 QSV 解码 | `mv-title-fragment-real-audio-ja.mp4` | 0 | 120 视频帧 + 88 音频包 / 88200 采样，0 errors |

- 硬件判定：oneVPL 装载 `libmfxhw64.so.1.35`（`LD_DEBUG=libs` 可见），session 报告 implementation 1.35，普通 QSV 编码明确打印 “hardware accelerated implementation”；`vainfo` 的 iHD 26.3.5 同时给出 H.264/HEVC 的 `VAEntrypointEncSlice`。
- 无软件回退对照：`-qsv_device /dev/dri/renderD999` 与 `-init_hw_device qsv=hw -qsv_device /dev/dri/renderD999` 均 exit 234，无输出文件。
- 性能数字仅描述本次 60/120 帧短样本，不外推整片或 4K。
- 历史证据：运行时缺失阶段的失败日志在 `qa/linux/kaby_lake/hw/30-*.log` 至 `35-*.log`，只说明当时的 blocked 原因，不代表最终能力。

## 缺失资源清单（公开克隆）

权威清单来自 `assets/asset-licenses.json`：3201 条登记中 78 条 `commitAllowed: true` 全部存在，3123 条 `commitAllowed: false` 全部缺失。按目录汇总：

| 缺失目录 | 数量 | 内容/用途 |
| --- | ---: | --- |
| `assets/runtime/social-web-export/` | 811 | SNS 屏幕纹理、手机投影帧、侧壁（`timeline.json`/`phone-timeline.json` 存在，位图缺失） |
| `assets/runtime/home-assets/` | 587 | 居家/摄影棚背景、日历序列、设备序列 |
| `assets/runtime/social-assets/` | 498 | 社交场景合成层 |
| `assets/runtime/ad-assets/` | 400 | 广告段 4K 广告牌/杂志/城市层 |
| `assets/runtime/photo-assets/` | 344 | 相片链道具与合成图 |
| `assets/runtime/opening-assets/` | 263 | 镜子开场/片尾轨迹与补层 |
| `assets/runtime/performance/` | 60 | 祈愿/回忆场景合成 |
| `assets/runtime/core-transitions/` | 42 | 转场合成层 |
| `assets/runtime/magazine/` 等 | 30 | 杂志、换装、书店、交互场景 |
| `assets/visuals/` 各子目录与单图 | 64 | 混合角色图、清理底板、SNS 截图等 |
| `assets/third-party-derived/` | 23 | 原 MV 派生清理板、手指、广告手部等 |
| `assets/props/dafeiyu-rice-bowl/` | 1 | 鱼碗 SVG |

另对活动代码与运行时 JSON 做了静态引用扫描（排除测试目录）：2236 个 `assets/...` 引用中仅 50 个存在、2186 个缺失；该数字包含序列帧清单等，只用于量化缺口，不等于逐帧精确需求。`qa/linux/kaby_lake/missing-inputs-code-scan.json` 保存完整列表。

本地已提供但不在公开仓库中的输入：歌曲、字体、`ja`/`bilingual` 字幕。它们不随报告提交；`zh-CN` 字幕虽由使用者提供，但入口不支持该值。

## 问题与最小修复建议

> 后续状态（本次修复已提交）：F1–F4 均已按建议修复——`cli-plan` 测试改为对照 `fs.existsSync` 判断 `sourceExists`，不再要求本地字幕；覆盖报告的 draft 模式提示改为按实际旗标输出，`--preview-release` 不再被写成 `--qa`；图片加载统一经 `load-asset.mjs`，缺图/坏图错误带 `assets/...` 相对路径；编码失败时会删除本次新建的不完整输出（运行前已存在的 `--out` 不会被主动删除）。F5 已由运行时安装解决，F6 仍是已知限制。**F4 复核补记**：`43eca7b` 的失败清理在 frame 0 时存在竞态（打印 `removed` 后 ffmpeg 仍可能重建 261 字节头部文件），已由 `765c2d5` 改为等待编码子进程 `close` 后再删除，并对仍存活的子进程 `SIGKILL` + 3 秒兜底；复验 frame 0 ×4、后段失败、运行前已存在输出对照与成功路径均通过，证据在 `qa/linux/kaby_lake/logs/fixcheck-fixed2-f4-*.log`（已忽略）。本页其余计数与证据仍是基线 `8a344e2` 的测试记录。

### F1（重要）测试对本地字幕文件存在隐式依赖

- 复现：干净公开克隆 → `npm ci` → `npm test`，退出码 1，失败项 `production/mv/tests/cli-plan.test.mjs:168` 的 `sourceExists === true` 断言。
- 影响：`docs/REPRODUCING.md` 声称测试不要求字幕文件存在；实际公开克隆会红一项，容易被误读为渲染代码回归。
- 最小修复建议（未实施）：让该测试自带 fixture——在测试开始前于固定路径写入自拟占位 SRT，并在 `t.after` 中恢复/删除；或者把断言改成读取实际 `fs.existsSync` 结果，并在文档注明该用例依赖本地字幕输入。两种改法都不应改变编码前的字幕校验逻辑。

### F2（可诊断性）缺图时错误只显示 `Invalid URL`，不含路径

- 复现：`loadImage("assets/third-party-derived/home-assets/curled-base.png")` 对不存在的路径抛 `TypeError: Invalid URL`；真实渲染 49.5 s 区间时入口只打印 `ERROR: frame 0 ... failed: Invalid URL`。镜像开场等 SVG 缺失则报 ENOENT 并带路径。
- 影响：公开克隆用户无法从错误日志直接定位缺失素材，排查成本高。
- 最小修复建议（未实施）：在 `loadImage` 调用处包一层，先检查文件存在或捕获异常并重新抛出带相对路径的错误；或在启动阶段集中检查当前区间所需输入并列出缺失文件。

### F3（提示信息）`--preview-release` 被描述成 `--qa`

- 复现：仅传 `--preview-release` 时日志打印 `--qa supplied, drafts render with the watermark.`，但实际 `watermark = qa && !previewRelease` 为 false，水印被关闭。
- 影响：只影响日志可读性，不影响输出；测试记录时容易误判渲染模式。
- 最小修复建议（未实施）：按 `qa`、`previewRelease`、`fillGaps` 分别生成提示，或直接打印实际的 watermark 状态。

### F4（交付检查）失败渲染可能留下 0 字节或部分 MP4

- 复现：QSV 运行时缺失阶段，直接编码失败曾留下 0 字节 mp4；部分画布帧失败的探测也曾留下不完整 mp4。
- 影响：只看“文件存在/变大”会误判成功。
- 最小修复建议（未实施）：失败时删除本次 `--out` 的部分文件，或先写临时文件、成功后再改名；现有 exit code 与旁车已是可靠判据，文档也可再次强调不要用文件存在性判定。

### F5（已解决）QSV 需要额外运行时

- 首轮：i965 VAAPI 正常，但 QSV 缺 oneVPL GPU 运行时（iHD/旧 MSDK 未安装），session 初始化失败，如实记为 blocked。
- 处理：使用者在两轮测试之间安装 `intel-media-driver` 26.3.5 + `intel-media-sdk` 23.2.2；复测 QSV H.264/HEVC 编解码、VP9 解码、720p60 与真实片段重编码全部通过，坏设备对照失败。该问题已关闭；安装由使用者完成，测试 Agent 未执行系统修改，项目入口也仍不接入 QSV。
- `vpl-gpu-rt` 仅声明支持 Tiger Lake 及更新，本机 Kaby Lake 不需要。

### F6（已知限制，非回归）色彩标记不完整

- CPU `libx264` 输出仅 `color_space=bt709`，`color_primaries`/`color_transfer` 为 unknown；VAAPI 输出三项均 unknown。与复现文档已记录的 Windows 行为一致，本轮未加滤镜修正，也不声称完整 BT.709。

## 未验证与限制

- 未渲染整片；未做 4K；未改变或扩展 10-bit 制作流程；未测试 `av1_amf`（本机无 AMD 硬件）。
- 未做逐帧播放、连续动态审看、听音、字幕实际显示与声画同步验收；只有解码检查与少量静帧观察。
- 未验证所有场景的素材完整性；可渲染区间仅证明这些区间所需输入齐全。
- 未用外部 GPU 占用工具独立确认 GPU 利用率（`intel_gpu_top` 不存在）；硬件路径判定基于 VA-API 显式初始化日志、entrypoint、坏设备对照与输出可解码性。
- QSV 与 VAAPI 路线均已确认可用；但未用外部 GPU 占用工具独立观测利用率，也未逐帧比较硬件编码相对 CPU 编码的画质差异。
- 未测试 Windows/macOS 或非 Intel 平台的对照行为。

## 复现命令

以下路径均以仓库根为基准；`<local-media>` 表示使用者自备且未提交的媒体目录。

```sh
# 环境与安装
node --version && npm --version
npm ci
npm test
npm run coverage

# 文档中的 CPU libx264 dry-run
npm run render -- --output-range 44 56 --width 1280 --fps 60 \
  --preview-release --dry-run --out qa/mv/plan-only.mp4

# 本地输入（示例）
export MV_AUDIO_PATH="<local-media>/audio/KAWAIKU NARITAI (feat. Sana).mp3"
export MV_FONT_PATH=/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc
export MV_TITLE_FONT_PATH=/usr/share/fonts/noto-cjk/NotoSerifCJK-Bold.ttc
export MV_SOURCE_FONT_PATH="<local-media>/fonts/汉仪跳跳体简5.0.ttf"
# 入口固定读取 assets/subtitles/KAWAIKU NARITAI{,.bilingual}.srt
# 可将本地 SRT 放入该忽略目录，或建立忽略的符号链接（本轮采用后者）

# 可渲染的真实片段（标题 19–21 s）
npm run render -- --output-range 19 21 --width 640 --fps 60 \
  --preset veryfast --crf 23 --preview-release --no-audio \
  --out qa/linux/kaby_lake/mv-title-fragment-silent.mp4
npm run render -- --output-range 19 21 --width 640 --fps 60 \
  --preset veryfast --crf 23 --preview-release --srt ja \
  --out qa/linux/kaby_lake/mv-title-fragment-real-audio-ja.mp4

# 请求的 49.5–50.5 s（公开克隆预期 blocked）
npm run render -- --output-range 49.5 50.5 --width 640 --fps 60 \
  --preset veryfast --crf 23 --preview-release --no-audio \
  --out qa/linux/kaby_lake/mv-cpu-silent.mp4

# 输出检查
ffprobe -v error -show_streams -show_format -of json \
  qa/linux/kaby_lake/mv-title-fragment-silent.mp4
ffmpeg -v error -xerror -i qa/linux/kaby_lake/mv-title-fragment-silent.mp4 -f null -

# Intel VAAPI H.264 硬件编码 / 解码
ffmpeg -vaapi_device /dev/dri/renderD128 -f lavfi \
  -i "testsrc2=size=640x360:rate=30:duration=2" \
  -vf "format=nv12,hwupload" -c:v h264_vaapi -profile:v high -qp 23 \
  qa/linux/kaby_lake/hw/vaapi-h264-encode.mp4
ffmpeg -hwaccel vaapi -hwaccel_device /dev/dri/renderD128 \
  -hwaccel_output_format vaapi -i qa/linux/kaby_lake/hw/vaapi-h264-encode.mp4 -f null -

# 硬件解码坏设备对照（应失败，证明无静默软件回退）
ffmpeg -hwaccel vaapi -hwaccel_device /dev/dri/renderD999 \
  -hwaccel_output_format vaapi -i qa/linux/kaby_lake/hw/vaapi-h264-encode.mp4 -f null -

# QSV（需已安装 intel-media-driver + intel-media-sdk）
ffmpeg -init_hw_device qsv=hw -filter_hw_device hw -f lavfi \
  -i "testsrc2=size=640x360:rate=30:duration=2" \
  -vf "hwupload=extra_hw_frames=64,format=qsv" \
  -c:v h264_qsv -preset veryfast -global_quality 23 \
  qa/linux/kaby_lake/hw/qsv-h264-encode.mp4
ffmpeg -hwaccel qsv -qsv_device /dev/dri/renderD128 \
  -hwaccel_output_format qsv -i qa/linux/kaby_lake/hw/qsv-h264-encode.mp4 -f null -

# QSV 坏设备对照（应失败，exit 234）
ffmpeg -qsv_device /dev/dri/renderD999 -f lavfi \
  -i "testsrc2=size=320x180:rate=30:duration=0.2" \
  -c:v h264_qsv qa/linux/kaby_lake/hw/qsv-bad-device.mp4
```

## 证据与变更

- 视频、音频、字幕边车、日志、硬件探测输出：`qa/linux/kaby_lake/`（`.gitignore` 已忽略 `qa/`、`*.mp4`、`*.render.json`、`*.srt`、`*.log`）。
- 逐项结果、退出码和证据路径：[results.json](results.json)。
- 环境与驱动：[environment.md](environment.md)。
- 变更：仅新增 `docs/linux/kaby_lake/{README.md,environment.md,results.json}`；源码、动画、时间轴、素材、`assets/ASSET_INDEX.json` 均未修改；未提交、未推送。工作树只保留上述新文档和忽略目录，`git diff --check` 无空白错误。
