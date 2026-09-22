# 合战守格小游戏软件 Android 离线试玩包

## 安装

将 `output/android/DefendMerge-1.0.0-playtest.apk` 发到安卓手机，允许发送应用安装此测试包后打开安装。最低 Android 8.0，建议使用已更新 Android System WebView 的设备。APK 内置游戏页面、图片、动画和伤害位图字体，不依赖电脑、Cloudflare 或网络；iPhone 不能安装 APK。

本包用于协作试玩，不是抖音/微信小程序发布包。广告为模拟按钮，暂无广告 SDK、支付或账号系统；不申请网络、存储、相机等权限。当前游戏未实现持久存档，退出应用/进程被系统回收后进度会重置。WebView 不会改变原游戏玩法或数值。

## 重新构建

本机可复用 Unity 2022.3.30f1c1 自带的 OpenJDK 和 Android SDK，无须联网下载 Gradle 依赖：

```powershell
powershell -ExecutionPolicy Bypass -File .\android\build-apk.ps1
```

其他开发机可用 `-AndroidRoot` 指定包含 `OpenJDK` 和 `SDK` 的目录。构建需要 Android platform 34、build-tools 32.0.0 和 Java 11。源文件位于 `android/src`，每次构建会复制最新网页与运行时美术，排除文档、源码压缩包和 Git 文件。

测试签名首次自动生成于 `android/.local/playtest.keystore`（密码 `android`），请保留它以便覆盖安装后续测试包；不可用于正式发布。正式上架必须独立保管发布签名并调整应用 ID、版本和平台 SDK。构建脚本会执行 APK 签名、ZIP 对齐及包名检查。

WebView 使用 `shouldInterceptRequest` 将固定 HTTPS 资源地址映射到包内 assets，没有真实网络请求；禁用任意文件和内容 URI 访问。应用进入后台时暂停游戏计时器，返回前台恢复。
