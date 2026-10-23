# 安装与复现

主入口为 [`production/mv/render-film.mjs`](../production/mv/render-film.mjs)，根目录 npm 脚本只是调用该入口。以下命令在仓库根目录执行；源码与场景数据的关系见 [架构说明](ARCHITECTURE.md)。

## 先区分代码包与完整制作输入

公开仓库分发代码、登记数据和素材清单中允许分发的图片。素材清单中有 79 张 `commitAllowed: true` 图片；它们不能单独组成整片所需的全部输入。音乐、字幕原件、字体、原 MV 取材层、其他角色图及混合角色烘焙结果分别有自己的来源和许可，部分文件只在完整制作目录中存在。

完整渲染需要让活动代码和 JSON 引用的输入实际存在：

| 输入 | 位置与要求 |
| --- | --- |
| 场景与规划数据 | `production/mv/tracks.json`、`production/mv/plan.json`。 |
| 场景登记与预处理数据 | `assets/runtime/` 各场景组中的 JSON；部分文件在模块导入时就会读取。 |
| 人物、表情、封面与道具 | `assets/visuals/`、`assets/props/` 与运行资源中的局部层；保持对应的原始尺寸、alpha 与登记关系。 |
| 原作派生图 | `assets/third-party-derived/` 中的清理背景、手部等；代码包不授予其再分发许可。 |
| SNS 烘焙输入 | `assets/runtime/social-web-export/` 的两个 timeline 清单、屏幕纹理、投影前面板与侧壁。 |
| 歌曲 | `assets/ASSET_INDEX.json` 的 `audio` 字段；默认指向 `assets/audio/KAWAIKU NARITAI (feat. Sana).mp3`，也可用 `MV_AUDIO_PATH` 覆盖。 |
| 字体 | 系统字体或明确指定的字体文件；字体更换会影响字形、排版和像素结果。 |
| 可选外挂字幕源 | `assets/subtitles/` 中对应的 SRT，仅在使用 `--srt` 时读取。 |

按 [素材许可清单](../assets/asset-licenses.json) 的 `path`、`sha256`、`authors`、`sourceUrls`、`changes`、`license` 与 `commitAllowed` 核对素材。原作者和换装参考见 [素材出处](ASSET_ATTRIBUTION.md)，权利范围见 [LICENSING.md](../LICENSING.md)。从作者允许的渠道取得素材或自行制作具有相应使用权的替代素材；替换后同步调整轨道与登记数据。代码可运行不等于音乐、原 MV 或全部角色已获得同一许可。

原 MV 视频不是渲染器的逐帧解码输入。只把一段原 MV 放入工程，不能补出缺少的清理底板、透明人物、表情补层或 SNS 烘焙纹理。

音乐与字体目录仅随仓库提供占位说明：Agent 应先阅读 [音轨准备](../assets/audio/README.md) 与 [字体替换](../assets/fonts/README.md)，自行查找并准备有使用依据的输入。音轨获取默认优先雨宮天版，也可使用 Sana 版；现有音轨声明与校时基于 Sana 版，换版本后需同步路径、时序核对与署名。`assets/runtime/` 中公开数据与本地图片的区别见 [运行输入说明](../assets/runtime/README.md)。

## 运行环境

根 `package.json` 锁定 `@napi-rs/canvas` 为 `0.1.100`，`package-lock.json` 固定 npm 依赖解析。使用：

```powershell
node --version
npm ci
npm test
ffmpeg -version
```

参考运行环境为 Windows、Node.js 24.19.0、`@napi-rs/canvas` 0.1.100，以及 FFmpeg n9.0.2（含 `libx264`、`libx265`、`av1_amf`、AAC、rawvideo 与 MP4 支持）。Canvas 的原生二进制由对应平台 npm 包提供；不要把别的平台 `node_modules/` 当作跨平台安装包。

`npm test` 运行 `node --test "production/mv/tests/*.test.mjs"`，使用 `node:test`、不新增依赖，也不要求音乐、字体或字幕文件存在。测试命令保留在 `package.json`，不要自行改成目录参数。

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

非 Windows 系统应自行指定适合的字体。字体注册结果分为 `registered`、`missing-file`、`register-failed`、`not-configured` 四种状态。不可用槽位在启动时只打印一次 WARNING（包含槽位、原因和替代变量），并写入 `--dry-run` 的 `plan.fonts` 与旁车 `fonts`；`existsSync` 成功只说明文件存在，不等于注册成功，注册成功也不等于字形齐全。缺字体不会阻断 `coverage` 或 `--dry-run`，但文字、缺字、换行与排版仍需视觉验收。

## 编码器与位深

默认输出为 MP4、CPU `libx264`、8-bit `yuv420p`，参数 `-preset fast -crf 19`。内置预设包括下列组合；预设表不是编码器白名单：

| `--encoder` | `--bit-depth` | 输出像素格式 | 质量参数 |
| --- | --- | --- | --- |
| `libx264`（默认） | `8` | `yuv420p` | `-preset` / `-crf` |
| `libx265` | `8` 或 `10` | `yuv420p` / `yuv420p10le` | `-preset` / `-crf` |
| `av1_amf` | `8` | `yuv420p` | `-quality` / `-b:v`（默认 `balanced` / `24M`） |
| `libsvtav1` | `8` 或 `10` | `yuv420p` / `yuv420p10le` | 默认 `-preset 6 -crf 28`，不设置目标码率 |
| `libaom-av1` | `8` 或 `10` | `yuv420p` / `yuv420p10le` | 默认 `-cpu-used 6 -crf 28 -b:v 0` |
| `h264_nvenc` / `hevc_nvenc` / `av1_nvenc` | 由构建及硬件决定 | 输入 `nv12` / `p010le`，解码后为 planar 4:2:0 | 默认 `-preset p4 -rc constqp -qp 23` |
| `h264_qsv` / `hevc_qsv` / `av1_qsv` | H.264 为 `8`；其余由硬件决定 | 输入 `nv12` / `p010le`，解码后为 planar 4:2:0 | 默认 `-global_quality 23` |
| `h264_amf` / `hevc_amf` | 由构建及硬件决定 | `yuv420p` / `yuv420p10le` | 默认 `-quality balanced -rc cqp -qp_i 23 -qp_p 23` |

`--bit-depth` 只接受 `8`、`10`，默认 8。10-bit 可用于软件 AV1、HEVC 及支持该位深的硬件编码器；`libx264` 或 `av1_amf` 加 10 位会在编码前被拒绝并给出替代组合，不会静默退回 8 位。rawvideo 输入始终是 8-bit RGBA：10-bit 只改变编码位深，不恢复输入中不存在的色阶，也不等于端到端 10-bit 制作；其播放兼容性低于 8-bit H.264，编码成本更高。

其他合法 FFmpeg 编码器名也可传入，不需要修改注册表；无内置预设时不注入默认质量参数。通过 `--encoder-options` 传 JSON 对象设置专用选项，通过 `--pixel-format` 指定输入给编码器的像素格式。选项对象的键不带前导短横线，值支持字符串、数值及布尔值；会作为独立 argv 传给 FFmpeg，不经过 shell。选项优先于内置默认值及通用质量参数。不能借此覆盖输入、输出、编码器、帧率、尺寸和滤镜等渲染器管理的选项；需要独立硬件上传滤镜的后端不保证仅指定编码器名就能工作。真实编码前，入口执行 `ffmpeg -hide_banner -encoders` 探测列表；`--dry-run` 不探测，plan 中 `probe` 为 `null`。编码器出现在列表中只说明该 FFmpeg 构建提供它，不代表硬件后端或驱动能初始化。

`-pix_fmt` 只是请求，FFmpeg 可能自动换成别的格式并仍然成功，所以入口还有两层校验：编码前用 `ffmpeg -h encoder=<名称>` 读取 `Supported pixel formats:`，目标格式不在列表里就打印 `ERROR`（含支持的格式）并退出 1、不启动编码；编码后用 ffprobe 核对实际 `pix_fmt`，与请求不一致同样 `ERROR` 退出 1，并且不写旁车与 SRT。NV12/P010 编码器输入分别按解码后的 yuv420p/yuv420p10le 校验；同时检查应用容器裁剪后的显示宽高和平均帧率，编码尺寸与显示尺寸分别记录。AMD AV1 的 1920×1082 配合底部裁剪两行可满足 1920×1080 显示要求，但具体播放器是否采用裁剪信息仍需验证。ffprobe 依次取 `FFPROBE_PATH`、所选 FFmpeg 同目录的 `ffprobe`、PATH；找不到时只打印 WARNING 并在旁车把 `actualOutput.verified` 记为 `false`，请求值不会被当成已验证的输出。旁车记录 `formatProbe`（真实支持列表）与 `actualOutput`（实际 codec/profile/pix_fmt/宽高）；dry-run 不探测，plan 的 `formatProbe` 为 `null`。不要把请求值当作实测结果。

契约违反（非法编码器名称、非法位深、不兼容组合、非法或缺失的 `--srt`、字幕源缺失、音轨覆盖路径不存在）在启动编码前打印 `REFUSED: ...` 并退出 2；运行期失败（FFmpeg 无法启动、编码器初始化失败、FFmpeg 非零退出）打印 `ERROR: ...` 并退出 1，同时给出所选 ffmpeg 路径、编码器和 stderr 末尾 3000 字符。

入口向 FFmpeg 传 BT.709 的 `-color_primaries`、`-color_trc`、`-colorspace`。本机 FFmpeg n9.0.2 的 `libx264`/`libx265` 输出经 ffprobe 只显示 `color_space=bt709`，`color_primaries` 与 `color_transfer` 为 `unknown`；这是本轮实测的既有编码器行为，没有通过加滤镜修正。不要把它当成完整的 BT.709 标记。

### 跨设备选择示例

软件 AV1 不依赖显卡，也不要求指定码率：

```powershell
npm run render -- --width 1920 --fps 60 --encoder libsvtav1 --preview-release --out renders/mv-1080p60-av1.mp4
```

选择 NVIDIA 或 Intel 硬件时，将编码器改为 `av1_nvenc` 或 `av1_qsv`；也可以选择相应的 H.264/HEVC 名称。用户显式选择的编码器不可用时会报错，不自动换格式。并非所有 NVIDIA、Intel 或 AMD GPU 都支持 AV1 硬编码。

专用选项示例（PowerShell）：

```powershell
npm run render -- --encoder av1_nvenc --encoder-options '{"preset":"p6","qp":20}' --width 1920 --fps 60 --preview-release --out renders/mv-nvenc.mp4
```

各后端质量数值不能直接比较。QSV/NVENC 预设的参数规划不等于硬件实机验收。软件 AV1 可避免本机 AMD AV1 在 1080P 下编码为 1082 行、再依赖容器裁剪两行的兼容性问题；720P 和 UHD 4K 不触发该特例。

## 覆盖检查与参数规划

先运行：

```powershell
npm run coverage
```

默认 60 fps 的时钟为 15,135 帧、252.25 秒；覆盖报告写入 `qa/mv/film-coverage.json`。该命令不需要音轨、不进行视频编码，但仍需加载模块导入阶段读取的 JSON。它检查帧路由，不验证所有图片、字体或 SNS 纹理是否齐全。

`--dry-run` 计算输出区间和 FFmpeg 参数，不调用编码器、不生成视频。它仍会执行契约校验与覆盖检查，并把参数写入 `qa/mv/film-render-plan.json`。示例使用默认 CPU 编码：

```powershell
npm run render -- --output-range 44 56 --width 1280 --fps 60 --preview-release --dry-run --out qa/mv/plan-only.mp4
```

plan 保留原有的 `isFull`、`frames`、`fps`、`seconds`、`audioSeekSeconds`、`sourcePTSAtFirstFrame`、`sourcePTSAtLastFrame`、`songSeconds`、`ffmpegArgs`、`rendered: false`，并新增：

| 字段 | 内容 |
| --- | --- |
| `encoder` | 编码器名、family/backend、质量参数、位深、输入/输出像素格式、色彩参数、`ignoredOptions`、`warnings`。 |
| `probe` | 编码器列表探测结果；`--dry-run` 固定为 `null`，因为不启动 FFmpeg。 |
| `formatProbe` | 编码器支持的像素格式列表；`--dry-run` 固定为 `null`。 |
| `audio` | `enabled`、`source`（`environment` 或 `asset-index`）、`variable`、`declared`、`path`、`exists`、`seekSeconds`。 |
| `fonts` | `slots` 数组（含 `slot`、`family`、`status`、`path`、`source`、`reason`）与 `registered`、`unavailable`。 |
| `subtitles` | `enabled`、`language`、`source`、`shiftSeconds`、`durationSeconds`、`timeBase`、`window`、`sourceExists`、`stats`。dry-run 不读取 cue 数据，`stats` 为 `null`，不是 0。 |

真实编码后，旁车 `<输出>.render.json` 保留原有字段，并新增 `encoding`（与 plan 的 `encoder` 同构）、`fonts`、`subtitles`（此时 `stats` 为真实统计）、`encoderProbe`、`formatProbe` 与 `actualOutput`；`audio` 同时记录来源、解析路径和定位。`actualOutput` 来自 ffprobe，包含实际 `pixelFormat`、`codecName`、`profile`、宽高和 `bitsPerRawSample`，`verified: false` 表示未能用 ffprobe 核对。plan 与旁车里的 `ffmpegArgs` 是实际将运行的参数，可用于核对编码器、像素格式和色彩参数。

当前轨道保留 `ready: false` 等制作登记值。`--qa` 允许绘制这些场景并附内部检查水印；`--preview-release` 同样允许绘制现有场景，但关闭该水印。后者不补齐缺素材、不认证画质，也不修改登记值。这里的复现命令使用它来输出现有实现。

渲染器给 FFmpeg 传入 `-y`；应为 `--out` 选择明确的新文件名，避免覆盖已有输出。`--out` 必须指向文件：Windows 下路径比较不区分大小写，并会忽略各路径段末尾的点和空格，因此大小写变体、`deliverables./...` 或尾部带点的文件名都不能绕过 v1 交付物与 `deliverables/` 的保护；`--fill-gaps` 不能写入 `deliverables/`（包括目录本身），`--out` 指向已存在目录也会被拒绝。

## 先导出与整片对齐的局部

局部检查优先使用**输出时间**：

```powershell
npm run render -- --output-range 44 56 --width 1280 --fps 60 --preview-release --out qa/mv/check-44-56.mp4
```

`--output-range A B` 把边界分别取 `round(A * fps)`、`round(B * fps)`，区间右端不包含。上例输出整片帧号 2640–3359，共 720 帧、12 秒；音乐从歌曲 44 秒取用，画面 source PTS 从 43.936 秒开始，和整片使用同一帧网格。

所有渲染命令的 `--width` 必须是 32 的倍数（例如 320、640、1280、1920、3840）；否则 16:9 高度会不是整数或偶数，入口在规划前以 `REFUSED` 退出 2，不会把小数高度交给 FFmpeg。

另一接口 `--range A B` 的 A/B 是 **source PTS**，也可用 `--range-start`、`--range-end`。它从 source A 开始以 `1 / fps` 步长取样，帧数按 `round((endPTS - startPTS) * fps) + 1` 计算，音频从 `startPTS + audioOffset` 开始。比如 `--range 44 56` 是 721 帧，音频从 44.064 秒开始。不要把这种片段直接当成整片输出 44–56 秒的替换补丁。

`--range` 的 A/B 必须递增，且裁剪到 source PTS 范围 `0.129 .. 252.13` 后不能为空；反向或完全越界的区间会在编码前以 `REFUSED` 退出 2，而不是静默规划成 1 帧。`--range-start`、`--range-end` 可单独使用，未给出的一端默认取片头或片尾，最终区间仍须递增。

检查摄影棚人物、SNS 手机、电车入口、朋友至广告及片尾接点时，应让局部区间覆盖转场前后，保留完整的进入与离开过程。

## 整片 720p60

CPU H.264 编码，使用默认的 `libx264`、8-bit 与 `-preset fast -crf 19`：

```powershell
npm run render -- --width 1280 --fps 60 --preview-release --out renders/mv-720p60-h264.mp4
```

可选：AMD AV1 硬件编码的快速审看片。

```powershell
npm run render -- --width 1280 --fps 60 --encoder av1_amf --quality speed --bitrate 8M --preview-release --out renders/mv-720p60-av1.mp4
```

`av1_amf` 需要 FFmpeg 构建、AMD 硬件与驱动同时支持，不是通用默认路径；`ffmpeg -hide_banner -encoders` 只检查构建是否列出该编码器，真正可用还需实际编码验证。它还可能填充非 16 倍数尺寸。CPU 命令要求 FFmpeg 提供 `libx264`。Canvas 绘图仍在 Node.js 端执行，硬件编码不会自动将场景绘制移到 GPU。`--width` 必须为 32 的倍数，本文的 1280 与 3840 均满足；自定义尺寸按上一节的约束检查。

## 整片 4K60

CPU H.264（默认编码器，8-bit）：

```powershell
npm run render -- --width 3840 --fps 60 --preview-release --out renders/mv-4k60-h264.mp4
```

可选：AMD AV1，目标码率 30 Mbps。

```powershell
npm run render -- --width 3840 --fps 60 --encoder av1_amf --quality balanced --bitrate 30M --preview-release --out renders/mv-4k60-av1.mp4
```

4K 输出的程序背景、几何与 SVG 按输出密度绘制，原始人物图片的细节取决于其母版。CPU 编码速度和内存消耗也取决于场景、图片缓存和系统，不应直接按 720p 速度预测。整片 4K 本轮没有重新渲染，不能把 720p 短片结果外推到 4K 耗时或画质。

内置预设提供便捷默认值；其他编码器走显式选项路径。不存在的编码器在真实运行的能力探测阶段失败，dry-run 只规划、不证明编码器或硬件可用。

AV1 AMF 对某些非 16 倍数尺寸可能产生编码尺寸填充。1280×720 与 3840×2160 都符合此约束；使用其他尺寸时应实际核对 ffprobe 报告，避免把 960×540 请求当成未填充的输出。

## 音轨覆盖、无声输出与 SRT

完整输出的歌曲从 0 秒开始。默认画面时钟为 `clamp(歌曲秒数 - 0.064, 0.129, 252.130)`，音轨本身不因此裁掉开头的 64 ms。`--audio-offset` 调整的是画面相对歌曲的映射；它还会参与整片长度的计算。

音轨输入默认取自 `assets/ASSET_INDEX.json` 的 `audio` 字段。也可以设置 `MV_AUDIO_PATH` 临时覆盖，不必修改被跟踪的清单：

- 非空值优先于清单；绝对路径直接使用，相对路径相对仓库根解析。
- 空字符串或仅空白时回退到清单，并在 plan/旁车的 `reason` 中说明。
- 非空但文件不存在或不是普通文件（例如指向目录）时，真实有声编码会在启动前以 `REFUSED` 退出 2，不会静默改用默认音乐。
- `npm run coverage`、`--dry-run`、`--no-audio` 不要求音轨文件存在；dry-run 仍会如实记录 `exists: false` 与来源。
- 覆盖不会改写 `assets/ASSET_INDEX.json`。

无声局部示例：

```powershell
npm run render -- --output-range 44 56 --width 1280 --fps 60 --encoder libx264 --preset veryfast --crf 18 --no-audio --preview-release --out qa/mv/check-silent.mp4
```

`--no-audio` 跳过歌曲输入和音频编码，可在没有歌曲文件时渲染已具备图片输入的场景；`assets/ASSET_INDEX.json` 本身仍会读取。缺少图片或登记数据时，该选项不会补齐它们。

歌词使用外挂 SRT，不烧入画面。入口只接受两种 `--srt` 值：

| 参数 | 字幕源 |
| --- | --- |
| `--srt ja` | `assets/subtitles/KAWAIKU NARITAI.ja.srt` |
| `--srt bilingual` | `assets/subtitles/KAWAIKU NARITAI.bilingual.srt` |

其他值（如 `zh`、`japanese`）、空值或把下一个旗标当值都会在编码前被拒绝并给出合法值列表，不会回退成日文，也不会按传入字符串另造后缀；不传 `--srt` 则不导出字幕。歌词文件需另行准备，文件名、格式与校时约定见 [字幕占位与替换说明](../assets/subtitles/README.md)。

真实编码前会读取并解析所选 SRT；文件缺失或无法读取、或整份文件没有任何可解析条目，会以 `REFUSED` 退出 2。所选片段内没有歌词并不算错误：裁剪结果为空时仍会写出空的外挂字幕（0 字节），旁车 `stats.output` 为 0、首尾时间为 `null`，`subtitles.reason` 记为 `no cues inside the output window`，这样无歌词的局部片段仍可正常导出。视频成功编码后才写出同名 `.ja.srt` 或 `.bilingual.srt`。

字幕源使用歌曲时钟。窗口为 `[AUDIO_SEEK, AUDIO_SEEK + n/fps)`：整片 `AUDIO_SEEK = 0`，不额外施加 64 ms 画面偏移；`--output-range 44 56` 平移 44 秒，`--range 44 56` 默认平移 44.064 秒。平移后完全在窗口外的条目删除，跨起点/终点的条目裁剪到 `[0, n/fps]`，裁剪后长度为 0 的删除，再从 1 连续编号。`--no-audio` 只关闭声音，不把字幕 shift 归零。程序仅处理 SRT 时刻和文本，不自动理解歌词，也不生成翻译。

启动时、plan 与旁车都会显示结构化字幕信息：`subtitles.enabled`、`language`、`source`、`shiftSeconds`、`durationSeconds`、`timeBase`、`window`、`sourceExists` 与 `stats`。dry-run 不读取 cue 数据，`stats` 为 `null`；真实编码后旁车的 `stats` 统计输入/输出条目、删除与截断数量以及首尾时间，并与写出的 SRT 一致。

## 输出检查与常见问题

成功结束会生成视频和 `<输出名>.render.json`。旁车记录尺寸、fps、帧数、渲染耗时、编码器、音轨来源与定位、FFmpeg 参数和登记状态，并新增 `encoding`、`fonts`、`subtitles`、`encoderProbe`。不要只以视频文件已出现或变大判定完成。渲染失败时会删除本次运行新建的不完整输出（stderr 会打印 `removed ... (incomplete output from this run)`）；运行前已存在的 `--out` 不会被主动删除，因此仍应以退出码和旁车判断成功。

基础参数可检查为：

```powershell
ffprobe -v error -show_streams -show_format -of json renders/mv-720p60-h264.mp4
```

完整文件的解码检查可用：

```powershell
ffmpeg -v error -xerror -i renders/mv-720p60-h264.mp4 -map 0:v:0 -f null -
```

这些检查不替代动态画面、转场连续性、字幕与声画同步的审看。

| 现象 | 应核对的位置 |
| --- | --- |
| 无法加载 `@napi-rs/canvas` 或其原生包 | 在当前平台重新执行 `npm ci`，确认实际 Node 与 CPU 架构。 |
| 模块导入阶段读取 JSON 失败 | 检查活动场景所需的 `assets/runtime/` 数据是否存在；coverage 也会加载这些数据。 |
| `REFUSED:` 且退出码为 2 | 契约违反：非法编码器名称、非法位深或组合、非法宽度或区间、非法/空值参数、`--srt` 与字幕源问题、音轨覆盖路径问题、受保护的输出路径等。按 stderr 给出的合法值、替代组合或路径提示修正；此时尚未启动编码。 |
| `ERROR:` 且退出码为 1 | 运行期失败：FFmpeg 无法启动、编码器初始化失败或 FFmpeg 非零退出。stderr 会列出所选 ffmpeg、编码器和末尾日志；先核对 `FFMPEG_PATH` 与 `--ffmpeg`。 |
| 编码器不在探测列表中 | 运行 `ffmpeg -hide_banner -encoders` 检查该构建；`av1_amf` 还需要 AMD 硬件与驱动，列表存在不代表初始化成功。可改用默认 `libx264`。 |
| 非法位深或编码器组合被拒绝 | `--bit-depth` 只有 `8`、`10`；选择支持该位深的编码器，例如 `--encoder libx265 --bit-depth 10` 或 `--encoder libsvtav1 --bit-depth 10`；实际能力以 FFmpeg 构建与硬件初始化为准。显式请求 10-bit 不会静默退回 8-bit。 |
| 宽度不是 32 的倍数 | 16:9 高度会变成小数或奇数，入口在规划前拒绝（例如 `--width 1000` 的高度为 562.5）；改用 320、640、1280、1920、3840 等 32 的倍数。 |
| 取值参数写成空字符串 | `--out ""`、`--audio-offset ""`、`--srt ""`、`--quality ""`、`--width ""` 等按缺值处理，打印 `REFUSED` 并退出 2；不要用空字符串表示默认值。 |
| 字幕缺失、`--srt` 非法 | 只接受 `ja`、`bilingual`，并读取 `assets/subtitles/` 下的固定文件名；准备字幕源或去掉 `--srt`。片段内没有歌词不算错误，会写出空字幕并在旁车记 `stats.output: 0`。 |
| 字体状态异常或出现 WARNING | 查看 plan 或旁车中的 `fonts`、`slots` 与 WARNING 里的变量名；`existsSync` 成功不代表注册成功，缺字体仍可运行 coverage 与 dry-run。 |
| 音轨覆盖路径不存在或不是普通文件 | 检查 `MV_AUDIO_PATH`；改成有效文件、清空变量以回退 `ASSET_INDEX.audio`，或使用 `--no-audio`。 |
| 图片解码报路径错误 | 错误现在会写成 `Asset "assets/…" is missing` 或 `cannot be decoded`；按该路径对照素材清单与场景 JSON 找输入，公开克隆缺少的素材需要合法取得或自行替换。 |
| 输出路径被保护或不是文件 | 不要覆盖 v1 交付物或向 `deliverables/` 写 `--fill-gaps` 结果（Windows 下大小写变体同样被拒绝），`--out` 应指向文件而不是已存在目录。 |
| 输出被 `ready` 门槛拒绝 | 区分登记字段与渲染模式；检查参数是否包含适当的 `--qa` 或 `--preview-release`。 |
| 字形不同、缺字或换行变化 | 核对字体文件、环境变量与图片中的文字；不同系统默认字体不保证相同像素。 |
| SNS 没有随文案变化 | 检查烘焙纹理、投影帧和两个 timeline；仅修改 UI 文案数据不会自动重做已有纹理。 |
| 局部与整片拼接时错帧或音频起点不同 | 检查是否混用了 `--range` 与 `--output-range`，以及 fps 和 `--audio-offset`。 |

`--fill-gaps` 只为未覆盖的帧路由绘制明显的诊断占位，并禁止输出到 `deliverables/`。它不修复缺失图片，也不构成有效的完整作品。

## 验证范围

本轮在 Windows、Node.js 24.19.0、`@napi-rs/canvas` 0.1.100、FFmpeg n9.0.2（含 `libx264`、`libx265`、`av1_amf`、AAC）的工作副本中实际运行：

- `npm run coverage`：零缺口、15135 帧、252.250 秒。
- `npm test`：全部通过（当前 75 项，`node:test`，无新增依赖）。
- 缺图诊断与失败清理：临时移走 `curled-base.png` 后真实渲染，stderr 给出 `Asset "assets/third-party-derived/home-assets/curled-base.png" is missing`，本次新建的 `--out` 被删除；运行前已存在的同名文件保留。未准备本地字幕时 `npm test` 仍为 75 项全通过。
- 新增边界校验由 `npm test` 与手工复现覆盖：`--width` 必须为 32 的倍数、`--range` 必须递增且在 source PTS 裁剪后非空、空字符串值按缺值拒绝、输出路径的大小写/尾部点/目录保护、目录型音轨覆盖拒绝。
- 像素格式：`libx264`/`libx265` 的前置格式列表检查与 ffprobe 后置核对均已实际运行；`yuv420p` 与 `yuv420p10le` 两款输出分别是 h264/High/yuv420p 与 hevc/Main 10/yuv420p10le。把 `FFPROBE_PATH` 指向不存在文件时编码仍成功，但旁车 `actualOutput.verified` 为 `false` 并打印 WARNING。
- 空歌词窗口：`--output-range 0 0.2 --srt ja` 实际导出 12 帧，`stats.output` 为 0、首尾为 `null`、写出 0 字节 `.ja.srt`，未以错误拒绝。
- 640×360、`--output-range 49.5 49.7` 的 12 帧、0.2 秒真实短片：
  - `libx264` + AAC + `--srt ja`：H.264 High、`yuv420p`、640×360、60fps、12 帧、0.2 秒、`bits_per_raw_sample=8`、`color_range=tv`、`color_space=bt709`；AAC LC 音轨 0.2 秒；完整解码通过；写出 1 条 0–200 ms 字幕，旁车 `stats` 与文件一致。
  - `libx265` + 10-bit、`--no-audio`：HEVC Main 10、`yuv420p10le`、640×360、12 帧、0.2 秒、`color_space=bt709`；完整解码通过；无音轨。
  - `av1_amf` 在本机实际可用：请求 640×360 得到 640×362，触发既有的 16 倍数尺寸填充 WARNING。该结果只代表本机环境，硬件编码仍不能在无 AMD 的环境假定可用。
- 用 `--output-range 44 56` 的 12 秒、720 帧局部导出验证字幕裁剪不变式：所有写出条目满足 `0 <= start < end <= 12000 ms`，编号连续。
- 音轨覆盖：`MV_AUDIO_PATH` 指向不存在文件或目录时，真实有声编码在启动前 `REFUSED`、退出 2，且不生成视频；dry-run 仍退出 0 并记录 `exists: false`；空字符串回退到 `ASSET_INDEX.audio` 并在 `reason` 中说明；`git diff assets/ASSET_INDEX.json` 为空。
- 字体：本工作副本三个槽位均为 `registered`；把 `MV_FONT_PATH` 指向不存在文件后，`npm run coverage` 仍零缺口，stderr 只有一条带槽位与变量名的 MV Gothic WARNING；dry-run 的 `fonts.slots` 如实给出 `missing-file`。

已知限制：本机 FFmpeg 的 `libx264`/`libx265` 输出只有 `color_space=bt709`，`color_primaries` 与 `color_transfer` 为 `unknown`；入口虽仍传 BT.709 三项参数，本轮未加滤镜修正。10-bit 只是把 8-bit RGBA 输入编码为 10-bit，不恢复色阶，也不是端到端 10-bit 制作，播放器兼容性未验证。Linux、macOS 与其他 GPU 未验证；整片 4K 未重新渲染。短片编码通过不代表动态画面、字幕同步或整片观感已验收。未在上表列出的平台、硬件与组合没有实际验证记录；参数规划与单元测试不能替代短片编码和播放检查。

Linux 上的公开克隆实机记录（Arch Linux + Intel Kaby Lake，commit `8a344e2`）见 [Arch Linux / Intel Kaby Lake 测试记录](linux/kaby_lake/README.md)：记录了可渲染区间、因缺失素材 blocked 的项、测试在无本地字幕时的历史失败项，以及 VAAPI/QSV 硬件编解码的独立 FFmpeg 结论。该记录的硬件结论不来自本项目入口——该历史测试使用当时仅含三个编码器的入口；当前入口已开放其他编码器，但该记录不构成新增后端的实机验证。
