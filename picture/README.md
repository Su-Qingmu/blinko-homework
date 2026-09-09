# E2E 测试截图

Playwright 自动化测试生成的截图，用于：
1. 验证修复效果（图标/Lute/Iconify）
2. 记录 E2E 流程实际状态
3. 发现和定位 bug

## 测试版本

- `v3-*.png` — 基础页面流程（10 步全过）✓
- `v4-*.png` — 第一次深度测试（10 步，发现 home 加载问题）
- `v5-*.png` — 第二次深度测试（16 张，含 AI 对话和团队创建）

## 关键截图

- `v3-06-home-loaded.png` — 首页正常加载（修复 Lute 后的完整状态）
- `v5-09-ai-typed.png` — AI 对话页输入框
- `v5-10-ai-wait-3.png` — AI 请求发出但无响应（无 AI Provider）
- `v5-11-collab.png` — 协作页空状态
- `v5-13-team-typed.png` — 创建团队（被 Cmd+K 拦了）
- `v5-15-final-home.png` — 最终首页（卡 spinner）

## 已知问题截图证据

- `v5-01-home.png`, `v5-04-notes-page.png` — 首页/all 页卡 spinner
  - 服务端日志：Main AI model not configured!
  - 但 home 不应直接调 AI，可能是 useQuery 的 loadingLock 死锁
