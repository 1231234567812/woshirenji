# 微信小程序协作开发规范

## 项目概述
- 类型：微信小程序
- 源码目录：miniprogram/
- AppID：wx48c849c5bb166a07

## 多 AI 协作规则

### 1. 工作前先读进度
每次开始工作前，必须先读取 `PROGRESS.md` 了解当前进度和分工。

### 2. 功能完成后自动提交
每完成一个独立功能，立即执行：
```bash
git add -A
git commit -m "feat: 功能描述"
```
提交信息格式：
- `feat: 新功能` - 新增功能
- `fix: 修复内容` - 修复 bug
- `refactor: 重构内容` - 代码重构
- `style: 样式调整` - UI/样式
- `docs: 文档更新` - 文档

### 3. 推送到 GitHub
完成一组相关功能后推送到远程：
```bash
git push origin main
```

### 4. 安全规则（重要！）
禁止提交以下内容：
- 任何 API 密钥、Secret、Token
- .env 文件
- project.private.config.json
- 个人开发者证书
- 云函数中的密钥配置

### 5. 沟通方式
- 通过 `PROGRESS.md` 记录：做了什么、正在做什么、遇到什么问题
- 通过 git commit message 告知其他 AI 你的改动
- 遇到冲突时，以最新 commit 为准

## 项目结构
```
miniprogram/
├── app.js          # 小程序入口
├── app.json        # 全局配置
├── app.wxss        # 全局样式
├── pages/          # 页面目录
├── images/         # 图片资源
└── custom-tab-bar/ # 自定义 tabBar
```
