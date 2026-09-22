合战守格小游戏软件 - 开发共享包
版本：2026-09-08 / Web 试玩 + Android 离线试玩

包含：
- 最新网页工程与全部运行时美术资源
- android/：离线 APK 封装源码与构建脚本
- output/android/：已签名测试 APK
- docs/：MVP 与美术说明
- tools/：资源处理与分享服务脚本

排除：Git 元数据、旧压缩包、临时文件、日志、旧截图、软著输出文件。

网页试玩：运行 python -m http.server 5173 后访问 http://localhost:5173/
APK 构建：powershell -ExecutionPolicy Bypass -File .\android\build-apk.ps1
APK 安装包：output/android/DefendMerge-1.0.0-playtest.apk
