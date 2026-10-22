# Kawaiku Naritai · 代码动画 MV

以 HoneyWorks《可愛くなりたい》的镜头与动作时序为参考，用 Canvas 2D、SVG 和代码动画，让大肥鱼与 AI 拟人角色进入这支 MV。画面按帧合成，人物图层、镜头轨迹、转场与社交界面共同组成完整动画。

本仓库同时提供制作结构与接手方法，方便开发者和具备工具调用能力的 AI Agent 修改镜头、替换角色或重建素材。

## 从哪里开始

- 首次运行或复刻：阅读 [复现条件与命令](docs/REPRODUCING.md)，区分公开仓库与补齐素材的工作副本。
- AI Agent 接手：先读 [AGENTS.md](AGENTS.md)，其中列出能力要求、修改规范与验证顺序。
- 理解工程：阅读 [架构、时间轴与合成系统](docs/ARCHITECTURE.md)。
- 修改一个镜头或重新生成角色：按照 [制作、替换与 QA 流程](docs/PRODUCTION.md) 从局部短片开始。
- 复用素材：同时查 [许可范围](LICENSING.md)、[署名来源](docs/ASSET_ATTRIBUTION.md) 和 [逐文件清单](assets/asset-licenses.json)。

## 实现范围

现有时间轴包含 54 个场景，默认 60fps 整片为 15135 帧、252.25 秒。合成器包含镜头与关键帧、人物表情补层、Canvas 几何动画、SVG 镜框、转场及 SNS 预烘焙画面消费逻辑。技术栈为 JavaScript ES modules、Node.js、`@napi-rs/canvas`、Canvas 2D/SVG、JSON 登记数据和 FFmpeg。

公开仓库包含代码、登记数据、创作提示词及 78 张按独立许可分发的图像，**不包含完整复现所需的全部媒体**。尤其是混合角色图、原片派生背景、SNS 烘焙序列、歌曲和字体，需要按来源取得使用依据或自行替换。公开树没有完整的 SNS 序列生成器，也没有自动调用生图服务的脚本；复刻这部分需要外部工具与新的制作工作。

## 安装与运行

需要 Node.js、FFmpeg，以及具有相应文字字形的字体。使用 Node.js 24 系列可与已验证环境对齐；本地原生 Canvas 依赖版本由 `package-lock.json` 固定：

```sh
npm ci
npm run coverage
```

FFmpeg 默认从 PATH 查找，也可通过 `FFMPEG_PATH` 或 `--ffmpeg` 指定。字体可用 `MV_FONT_PATH`、`MV_TITLE_FONT_PATH`、`MV_SOURCE_FONT_PATH` 配置；Windows 默认使用现有系统字体，标题源字体需按其自身许可另行准备。更换字体会影响字形与排版。

音乐、字体、原 MV 派生图及未获再分发许可的素材不随代码仓库提供。完整渲染前，按 [素材清单](assets/asset-licenses.json) 准备对应输入；正式音轨的位置由 `assets/ASSET_INDEX.json` 声明。人物素材的源图与运行时派生图有各自文件记录，不应相互替代。

AMD GPU 的 720p60 快速输出：

```sh
npm run render -- --width 1280 --fps 60 --encoder av1_amf --quality speed --bitrate 8M --preview-release --out deliverables/mv-720p60.mp4
```

CPU 编码可将编码选项替换为 `--encoder libx264 --preset fast --crf 19`。输出 4K60 时使用 `--width 3840 --fps 60`。`--preview-release` 关闭内部检查水印；`--output-range 44 56` 可只输出歌曲时间 44–56 秒，保持整片时钟与取样相位。

歌曲从零开始，维持原速与原音高。歌词使用单独 SRT，不默认烧入画面。`--no-audio` 可导出无音轨的画面；`--srt ja` 可同时写出日文外挂字幕，需要另行准备相应歌词文件。

## 目录

| 路径 | 内容 |
| --- | --- |
| `production/mv/render-film.mjs` | 整片与区间渲染入口 |
| `production/mv/scene.mjs` | 合成器与场景调度 |
| `production/mv/tracks.json` | 镜头、图层、轨迹和转场 |
| `production/mv/prompts/` | 图像创作提示词 |
| `AGENTS.md`、`docs/` | AI 接手指南、架构、复现和制作文档 |
| `LICENSE`、`LICENSES/`、`LICENSING.md` | 代码许可、素材协议全文与分层说明 |
| `assets/visuals/` | 人物、合照与背景图像 |
| `assets/runtime/` | 登记数据、表情补层与烘焙画面 |
| `assets/third-party-derived/` | 需自行准备的原片派生素材 |
| `assets/audio/`、`assets/fonts/` | 需自行准备的音乐与字体 |

SNS 烘焙帧、人物表情补层及轨迹数据都是渲染输入。替换素材时应保留登记坐标、透明通道与图像比例；技术参数相同不代表替换后画面一致。

## 作者与许可

创作与制作：Sulytwelve（梨希 Lyxii）。AI 制作协作：GPT-6.1 Sol、DeepSeek V4.1 Flash 1017；图像工具：GPT-Image。实际采用的音乐、人物设计、服装参考与素材来源见 [署名清单](docs/ASSET_ATTRIBUTION.md)。

原创代码和可许可的原创文档使用 [BSD-2-Clause](LICENSE)。图像、音乐、字体及第三方素材分别适用 [许可说明](LICENSING.md) 与逐文件清单，不由代码许可证统一覆盖。
