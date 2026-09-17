# 拾光软件库

## 启动

在 Windows 上双击 `start.ps1`（若系统阻止脚本，可右键使用 PowerShell 运行）。

默认管理员密码：`admin123456`。建议启动前设置环境变量 `ADMIN_PASSWORD` 修改密码。

后台地址：`http://localhost:8787/admin`

## 安卓端接口

安卓客户端请求 `GET /api/content` 获取公告、轮播图和已上架软件。部署到服务器时，将 `HOST` 设置为 `0.0.0.0`，并通过 HTTPS 反向代理访问。
