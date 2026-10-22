# 音轨占位与替换

此目录只随仓库提供说明，不分发音乐文件。本地工作副本可自行放入音轨，音频文件保持 Git 忽略。作品为 HoneyWorks《可愛くなりたい》，可使用成海聖奈（CV：雨宮天）版或鎖那（Sana）版；作者与官方来源见 [素材出处](../../docs/ASSET_ATTRIBUTION.md#歌曲与原-mv)。来源链接用于识别作品，不代表取得下载、改编、配乐发布或再分发许可。

## Agent 准备输入

1. **默认优先寻找成海聖奈（CV：雨宮天）版**，参见 [HoneyWorks 官方 MV](https://www.youtube.com/watch?v=o1WXFxHXieM)；也可选择 [Sana 演唱版](https://www.youtube.com/watch?v=AkRPlTrf3d8)。先确认取得渠道和用途许可，通过权利人允许的渠道自行准备音轨，或选择有明确使用依据的替代音乐。不要把原曲文件加入 Git。
2. 将准备好的文件放入本目录，再设置 [`assets/ASSET_INDEX.json`](../ASSET_INDEX.json) 的 `audio` 字段，支持项目相对路径。当前制作输入仍声明为 `assets/audio/KAWAIKU NARITAI (feat. Sana).mp3`，对应已有 Sana 版工作副本；使用雨宮天版时应按实际文件修改该字段，不要将其伪装成 Sana 版文件。
3. 现有镜头与字幕按 Sana 版歌曲时钟制作。两种版本均可作为制作输入，但此处不保证可以直接无差别替换。更换歌曲、版本、速度、前奏长度或音轨起点后，必须重新校对节奏、整片长度、字幕与成片音乐署名，不能只改文件名。
4. 仅检查代码时先运行 `npm run coverage` 或文档中的 `--dry-run`；已有所需画面输入时，可加 `--no-audio` 输出无声短片。

音轨路径、时钟和实际渲染命令见 [复现指南](../../docs/REPRODUCING.md)。此目录默认忽略说明以外的文件；不要用 `git add -f` 绕过排除规则。
