# 测试环境：Arch Linux / Intel Kaby Lake

本文件记录本轮实际观测到的硬件、系统软件、媒体运行时和本地输入。文中不包含主机名、用户名或私人绝对路径：仓库内路径相对仓库根目录，本地媒体路径统一写作 `<local-media>`。

## 采集时间与对象

| 项目 | 值 |
| --- | --- |
| 测试日期 | 2026-10-22 23:44 至 2026-10-23 00:20；QSV 运行时补齐后复测至 2026-10-23 00:58（+08:00） |
| 仓库 | `kawaiku-naritai-code-mv`，commit `8a344e2`（`git rev-parse HEAD`） |
| 工作树 | 测试开始时干净；仅新增 `qa/linux/kaby_lake/`（忽略）与本报告；未修改源码、动画、时间轴、素材或 `assets/ASSET_INDEX.json` |
| 测试性质 | 公开克隆 + 使用者本地提供的合法音轨、字体、字幕；本地媒体未提交、未进入 `docs/` |

### 执行环境说明

初次探测在受限执行沙箱中完成：`/dev/` 不暴露 `dri`、`systemd-detect-virt` 返回 `container-other`。该阶段只用于静态与无设备项目。硬件编解码结论全部来自随后可访问宿主设备的执行环境（`/dev/dri/renderD128` 可打开、`systemd-detect-virt` 返回 `none`）；两阶段内核与系统版本一致。沙箱内看不到设备节点不代表主机没有 GPU。

### QSV 运行时变更（测试中途）

初始轮次本机未安装 `intel-media-driver` 与 `intel-media-sdk`，QSV 只能记为 blocked。使用者在两轮测试之间安装了这两个包，随后复测 QSV 全部通过。本文件与 `results.json` 记录最终状态；早期 blocked 的日志仍保留在 `qa/linux/kaby_lake/hw/30-*.log` 至 `35-*.log` 作为历史证据。测试 Agent 未执行安装或系统修改。

## 主机

| 项目 | 值 |
| --- | --- |
| 发行版 | Arch Linux（rolling，`/etc/os-release` ID=arch） |
| 内核 | `7.2.11-arch1-1`（PREEMPT_DYNAMIC，x86_64） |
| 虚拟化 | 最终硬件测试阶段为物理机宿主（`systemd-detect-virt` = none） |
| 机型 | Lenovo ThinkPad（PCI 子系统 `17aa:5062`；主机名略） |
| CPU | Intel Core i5-7200U @ 2.50 GHz（Kaby Lake，2 核 4 线程，最高 3.10 GHz，微码 0xf6） |
| GPU | Intel HD Graphics 620（Kaby Lake-U GT2，PCI `8086:5916` rev 02，内核驱动 `i915`） |
| 内存 | 7.5 GiB |

## 设备节点与访问权限

| 节点 | 主次设备号 | 权限 | 属主 | 结果 |
| --- | --- | --- | --- | --- |
| `/dev/dri/renderD128` | 226:128 | `crw-rw-rw-`（0666） | root:render | 可读写；本轮 VAAPI 测试使用该节点 |
| `/dev/dri/card1` | 226:1 | `crw-rw----`（0660）+ ACL `user:<tester>:rw-` | root:video | 可读写；测试用户 uid=1000 在 `video` 组 |
| `/sys/class/drm/renderD128` | — | sysfs 只读 | — | 存在；`uevent` 报告 `DRIVER=i915`、`PCI_ID=8086:5916` |

`ls /dev/dri` 在最终环境中返回 `card1` 与 `renderD128`，`by-path` 为符号链接目录；没有其他渲染节点。

## 图形与媒体运行时

| 组件 | 版本 / 状态 |
| --- | --- |
| `mesa` | `1:26.2.5-1` |
| `libva` | `2.24.1-1`（运行时报告 VA-API 1.24） |
| `libva-utils`（含 `vainfo`） | `2.24.0-1` |
| `libva-intel-driver`（i965 旧驱动，含 `i965_drv_video.so`） | `2.4.5-1`，**实际启用** |
| `libvpl` | `2.17.0-1` |
| `libmfx` | `23.2.2-6`（dispatcher/兼容层；QSV 的 GPU 实现由 `intel-media-sdk` 的 `libmfxhw64.so.1.35` 提供） |
| `intel-media-driver`（iHD） | `26.3.5-1`（测试中途由使用者安装；`iHD_drv_video.so` 存在，`vainfo` 默认选中） |
| `intel-media-sdk`（Kaby Lake 可用的旧 oneVPL/MSDK GPU 运行时） | `23.2.2-6`（测试中途由使用者安装；提供 `libmfxhw64.so.1.35`，QSV 经此实现） |
| `vpl-gpu-rt` | 未安装；Arch 包描述仅支持 Tiger Lake 及更新，本机 Kaby Lake 不需要 |
| `ffmpeg` / `ffprobe` | `2:9.0.2-2`（FFmpeg n9.0.2，GCC 16 构建） |

`vainfo` 结果（最终状态，exit 0，节选）：

```text
vainfo: VA-API version: 1.24 (libva 2.24.0)
vainfo: Driver version: Intel iHD driver for Intel(R) Gen Graphics - 26.3.5 ()
      VAProfileH264High               : VAEntrypointVLD
      VAProfileH264High               : VAEntrypointEncSlice
      VAProfileH264High               : VAEntrypointEncSliceLP
      VAProfileHEVCMain               : VAEntrypointVLD
      VAProfileHEVCMain               : VAEntrypointEncSlice
      VAProfileHEVCMain10             : VAEntrypointVLD
      VAProfileHEVCMain10             : VAEntrypointEncSlice
      VAProfileVP9Profile0            : VAEntrypointVLD
      VAProfileVP9Profile0            : VAEntrypointEncSlice
```

- 安装 iHD 前默认选中的是 i965（`Intel i965 driver for Intel(R) Kaby Lake - 2.4.5`）；`LIBVA_DRIVER_NAME=i965 vainfo` 现在仍成功，`LIBVA_DRIVER_NAME=iHD vainfo` 也从安装前的 exit 3 变为 exit 0。
- QSV 通过 oneVPL 装载 `libmfxhw64.so.1.35`（MSDK 兼容运行时），日志报告 `Initialize MFX session: implementation version is 1.35`；直接 `h264_qsv` 编码日志写明 `Initialized an internal MFX session using hardware accelerated implementation`。
- `vainfo` 输出还包含 MPEG2、VC1、VP8、JPEG 的 VLD/编码 entrypoint、`VAEntrypointFEI` 与 `VAEntrypointStats`。

可选的 GPU 观测工具在本机**不存在**：`intel_gpu_top`、`vulkaninfo`、`clinfo`、`nvtop` 均不可用。因此硬件路径判定依据 FFmpeg 的显式 hwaccel/hwupload 初始化日志、VA-API entrypoint 日志、无效设备对照实验和输出文件分析，而不是外部 GPU 占用率曲线。

## FFmpeg 构建与能力

```text
ffmpeg version n9.0.2
configuration: --prefix=/usr --enable-libvpl --enable-libx264 --enable-libx265
               --enable-amf --enable-vulkan --enable-opencl --enable-gpl
               --enable-shared ...（其余为 Arch 常规构建选项）
```

`ffmpeg -hwaccels` 报告：`vdpau cuda vaapi qsv drm opencl vulkan amf`。

编码器与解码器列表（仅描述“该构建列出”，不等于硬件可用）：

- 视频/音频编码器条目共 229 行；其中匹配 QSV/VAAPI 的编码器 13 条。
- 解码器条目共 556 行；其中匹配 QSV/VAAPI 的解码器 9 条（全部是 `*_qsv`；VAAPI 解码通过通用 `h264`/`hevc` 解码器加 `-hwaccel vaapi` 使用，列表中不存在 `*_vaapi` 解码器 wrapper）。
- QSV/VAAPI 编码器包括：`h264_qsv`、`hevc_qsv`、`av1_qsv`、`vp9_qsv`、`mpeg2_qsv`、`mjpeg_qsv`、`h264_vaapi`、`hevc_vaapi`、`av1_vaapi`、`vp8_vaapi`、`vp9_vaapi`、`mpeg2_vaapi`、`mjpeg_vaapi`。
- QSV 解码器包括：`h264_qsv`、`hevc_qsv`、`av1_qsv`、`vp8_qsv`、`vp9_qsv`、`mpeg2_qsv`、`vc1_qsv`、`mjpeg_qsv`、`vvc_qsv`。
- `ffmpeg -h encoder=h264_qsv` 支持像素格式 `nv12 qsv`；`ffmpeg -h encoder=h264_vaapi` 支持 `vaapi`。这两项只是构建能力，不是硬件初始化结果。

## Node.js 与 Canvas

| 组件 | 版本 / 状态 |
| --- | --- |
| `nodejs` | `26.12.0-1`（`node --version` 为 v26.12.0，`/usr/bin/node`） |
| `npm` | `12.2.1-1`（`/usr/lib/node_modules/npm/bin/npm-cli.js`） |
| `@napi-rs/canvas` | `0.1.100`（`package-lock.json` 固定） |
| 原生二进制 | `@napi-rs/canvas-linux-x64-gnu@0.1.100` |
| 导入检查 | `import("@napi-rs/canvas")` 成功，导出 26 个键；Cairo 版本未暴露 |

复现文档的参考环境是 Windows + Node.js 24.19.0。本机 Node 26.12.0 高于参考值；本轮安装、测试与渲染路径未观察到与 Node 版本相关的失败。

### 安装记录与沙箱差异

- 最终环境执行 `npm ci`：exit 0，安装 2 个包（`@napi-rs/canvas` 与其 linux-x64-gnu 原生包）。
- 在早期受限沙箱中，默认 `npm ci` 因 `$HOME/.npm` 只读失败（npm error code EROFS，exit 226）；使用项目内可写缓存 `npm ci --cache qa/linux/kaby_lake/npm-cache` 后 exit 0。这是执行沙箱限制，不是仓库问题；本机正常环境不需要该参数。

## 本地媒体输入（不随仓库分发）

使用者在本机提供了以下合法输入，测试通过环境变量与仓库固定路径使用；这些文件不进入 Git，也不复制到 `docs/`。

| 输入 | 内容 | 使用方式 |
| --- | --- | --- |
| 音轨 | Sana 版《KAWAIKU NARITAI》MP3：44.1 kHz 立体声，135 kbps，时长 252.006168 s（与 `SANA_SECONDS` 一致），含内嵌 PNG 封面 | `MV_AUDIO_PATH=<local-media>/audio/KAWAIKU NARITAI (feat. Sana).mp3` |
| 显示字体 | `汉仪跳跳体简5.0.ttf`（family `HYTiaoTiaoTiJ` / `汉仪跳跳体简`） | `MV_SOURCE_FONT_PATH=<local-media>/fonts/汉仪跳跳体简5.0.ttf` |
| 主字体 / 标题字体 | 系统字体：`/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc`、`/usr/share/fonts/noto-cjk/NotoSerifCJK-Bold.ttc` | `MV_FONT_PATH`、`MV_TITLE_FONT_PATH` |
| 字幕 | `KAWAIKU NARITAI.ja.srt`、`KAWAIKU NARITAI.bilingual.srt`（各 43 条 cue，1.170 s 至 232.173 s，歌曲时钟） | 入口固定读取 `assets/subtitles/` 下同名文件；本机以忽略的符号链接指到本地媒体，不复制歌词 |
| 未使用 | `KAWAIKU NARITAI.zh-CN.srt`（入口不接受 `--srt zh-CN`，已实测被拒绝） | — |

补充说明：

- `assets/ASSET_INDEX.json` **未被修改**；音轨覆盖全部通过 `MV_AUDIO_PATH` 完成。
- 字体替换只影响渲染器文字，位图里的文字不会改变；本机主/标题字体与制作参考不同，字形与排版不保证一致。
- `qa/linux/kaby_lake/` 中的输出、边车与字幕可能包含本地歌曲音频或歌词内容，属于本地测试产物，仓库已忽略，不应提交或公开分发。

## 安装前提（复现参考）

本机已具备的环境；在另一台 Arch Linux 上复现时按需准备（测试 Agent 未执行安装或系统修改，QSV 运行时由使用者安装）：

```sh
# 必需
sudo pacman -S --needed nodejs npm ffmpeg
npm ci

# 硬件编解码测试需要（本机已安装：i965 与 iHD 两条 VAAPI 驱动）
sudo pacman -S --needed libva libva-utils libva-intel-driver

# QSV 路径（Kaby Lake 需要旧 MSDK/iHD 运行时组合，使用者已安装并复测通过）
# sudo pacman -S --needed intel-media-driver intel-media-sdk
# vpl-gpu-rt 仅声明支持 Tiger Lake 及更新，本机不需要
```

CPU 的 Canvas 原生包由 npm 可选依赖自动选择，本机为 `linux-x64-gnu`，不需要本地编译工具链。

## 与参考文档环境的差异

| 维度 | 参考环境（`docs/REPRODUCING.md`） | 本轮实测 |
| --- | --- | --- |
| 系统 | Windows | Arch Linux |
| Node.js | 24.19.0 | 26.12.0 |
| FFmpeg | n9.0.2（Windows 构建） | n9.0.2（Arch 构建，含 `--enable-libvpl`） |
| 字体 | Windows 系统字体 / 工作副本字体 | 系统 Noto CJK + 本地汉仪跳跳体 |
| 音轨 | Sana 版工作副本 | 本地 Sana 版（`MV_AUDIO_PATH`） |
| GPU | 未注明 | Intel HD Graphics 620（VAAPI/i965 实测） |
| 测试跳过项 | 文档记录 72 项通过 | 68 通过 + 4 跳过（3 项 Windows 专用 + 1 项系统字体默认行为） |

## 环境采集命令

以下命令用于生成本文件的事实，均未修改系统：

```sh
uname -a; cat /etc/os-release; lscpu; free -h
lspci -nnk | grep -A3 -Ei 'vga|display|3d'
ls -l /dev/dri; stat -c '%n %a %U:%G %t:%T' /dev/dri/*; getfacl /dev/dri/renderD128
systemd-detect-virt; id
pacman -Q linux mesa libva libva-utils libva-intel-driver libvpl libmfx ffmpeg nodejs npm
vainfo; LIBVA_DRIVER_NAME=i965 vainfo; LIBVA_DRIVER_NAME=iHD vainfo
ffmpeg -version; ffprobe -version
ffmpeg -hide_banner -hwaccels
ffmpeg -hide_banner -encoders
ffmpeg -hide_banner -decoders
ffmpeg -hide_banner -h encoder=h264_qsv
ffmpeg -hide_banner -h encoder=h264_vaapi
command -v intel_gpu_top vulkaninfo clinfo nvtop
```

原始输出保存在 `qa/linux/kaby_lake/hw/` 与 `qa/linux/kaby_lake/logs/`（仓库忽略）。
