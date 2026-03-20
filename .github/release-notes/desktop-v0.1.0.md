## 本次更新

### Review Item 体验重构
- 重做了 Review Item 详情页，头部、证据区和底部决策区分层更清晰
- `needs_review` 状态固定展示 `接受并解决 / 继续让 AI 修改 / 重新打开`
- `跳到代码` 调整到头部，避免和 review 决策操作混在一起
- `Reviewer Note / Last Error / AI Summary / Changed Files / Timeline` 的阅读顺序重新整理，更适合连续 review

### 交互与反馈优化
- 新建或编辑 Review Item 后，面板先关闭，再给轻量反馈
- 保存失败时会恢复草稿，避免输入内容丢失
- 创建成功后自动选中新建项，减少来回查找

### 持久化修复
- 修复桌面端 `store.load not allowed. Plugin not found`
- 已补齐 Tauri store 插件注册与权限配置，Review Item 保存可正常落盘
