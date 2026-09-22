# 武将品质外形与动作

## 品质与类型

- 本次接入白、绿、蓝、紫、橙、红共6档，每档3种武将，共18套外形。
- 金色独立武将按需求留待后续扩展，本次不制作、不导入金色模型。旧存档若已有金色品质，仅回退显示红色模型，避免资源缺失；品质、装备、永久属性不降级。
- 外形由局外 `state.warriorQuality[type]` 决定，与棋盘上的合成等级 `piece.tier` 分开。局内升级、消除补位或广告洗牌都不会重置已突破外形。

| 现有存档类型键 | 武将模型 | 攻击规则 |
| --- | --- | --- |
| sword | 男法师 / mage | 同列 |
| fan | 男战士 / warrior | 同行 |
| rock | 女祭司 / priest | 范围 |

保留原类型键、范围算法、装备归属和数值，仅按用户指定的攻击类别重新绑定模型与显示名称。原“红剑”列攻单位对应男法师，原“羽扇”行攻单位对应男战士，原“岩甲”范围单位对应女祭司。

## 运行时表现

- 成长页、主界面阵容及武将名册显示当前品质的待机动图。
- 突破成功后立即更新成长页与主界面，下次进入战斗时所有同类型棋子统一使用新品质外形。
- 战斗棋子平时待机，仅向范围内存活目标发起攻击时切换对应品质的攻击动作（被闪避也播放）；没有后续攻击时约460ms回到待机。攻击强度和间隔仍由局内等级与装备加成决定。
- 同一模型的待机和攻击使用统一画布与定位，避免动作切换时人物突变大小。显示尺寸按每套模型的待机轮廓进行校准；`WARRIORS.modelBounds` 对应构建清单的 idle.bounds。
- 预加载当前3类武将的待机、攻击及展示动图；突破时预加载新品质。没有一次性加载所有品质的动图。

## 工程资源

来源：`C:\Users\Admin\Desktop\录屏吧\武将模型动作`。品质、职业以用户整理的文件夹名称为准，不根据内部 Spine/GIF 文件名前缀推断。

- `public/assets/warriors/sources/<role>/<quality>/`：原始待机/攻击 GIF、Spine 工程、贴图散件、二进制导出与来源记录。相关素材完整保存在项目内。
- `public/assets/warriors/quality/<role>/<quality>/idle.webp`：棋盘待机。
- `public/assets/warriors/quality/<role>/<quality>/attack.webp`：棋盘攻击。
- `public/assets/warriors/quality/<role>/<quality>/preview.webp`：成长页和主界面的紧凑待机展示。
- `public/assets/warriors/quality/<role>/<quality>/portrait.png`：静态校验图。
- `public/assets/warriors/quality/manifest.json`：源文件映射、帧数、时长、轮廓坐标。
- `asset-contact-sheets/warrior-qualities.jpg`：六品质、三职业的对照图。

当前 Web Demo 沿用位图动作播放方案，使用源目录中已有的 GIF 转换成透明 WebP，不将 Spine 工程当作网页可直接播放的文件。原始 Spine 资源保留供后续引擎接入。

## 重新构建

安装 Python、Pillow、NumPy 后，在工程根目录执行：

```powershell
python tools/build_warrior_models.py
```

无需访问原素材目录，直接用工程内的原始资源重建。需要重新导入时：

```powershell
python tools/build_warrior_models.py --source "C:\Users\Admin\Desktop\录屏吧\武将模型动作"
```

构建过程只去除与图像边缘相连的近似灰色背景，保留人物内部同色部件；统一画布，降低帧率并压缩为透明动画 WebP。攻击动画按现有约0.46秒的播放窗口压缩时长，不调整实际攻速。更换源动作后，应据 manifest 的轮廓数据更新 `WARRIORS.modelBounds`，并复核待机、攻击的透明边缘与棋盘构图。
