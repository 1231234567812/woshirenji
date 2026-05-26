#!/bin/bash
cd "$(dirname "$0")"
echo "🎨 UI设计师 Agent 启动 | 按 Ctrl+C 停止"

sleep 0

count=1
while true; do
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⏰ $(date '+%H:%M:%S') 第 $count 轮"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    bash git-locked.sh sync
    bash cleanup-discuss.sh

    claude --dangerously-skip-permissions -p "你是 UI 设计师，负责这个微信小程序的界面和视觉。

**你的首要任务是找 bug 和修复 bug，不是反复调整 CSS 细节。**

工作流程：
1. 先读 CLAUDE.md 了解设计规则
2. 读 PROGRESS.md 看已知问题和讨论区
3. 读 discuss.md 看有没有人在等你回复
4. 用 git log --oneline -10 看最近改动
5. 用 git diff HEAD~3 看最近改了什么

**优先级（严格按顺序）：**
1. 功能性 bug（页面打不开、按钮点不了、数据丢失、报错）
2. 用户体验问题（操作反馈缺失、加载状态没有、错误提示不友好）
3. 样式问题（布局错乱、文字溢出、适配问题）
4. 最后才是 CLAUDE.md 合规性

**怎么找 bug：**
- 读 index.js 的每个事件处理函数，检查逻辑是否正确
- 检查 setData 的数据结构和 WXML 的绑定是否匹配
- 检查 wx:if/wx:for 条件是否合理
- 检查异步回调里的错误处理（fail 回调）
- 检查边界情况（空数组、null、undefined）
- 检查 wxss 里有没有会导致布局塌陷的样式

**不要做的事：**
- 不要反复调整字号从 26rpx 到 24rpx 这种微调
- 不要反复调整阴影 alpha 值
- 不要反复调整圆角值
- 不要一轮又一轮地做"合规性扫描"——CLAUDE.md 的规则已经够清楚了
- 如果 CSS 没有明显的视觉问题，就不要动它

**做完一个 bug 修复后，立即找下一个 bug。如果没有 bug 了，找用户体验可以改善的地方。**
不要停。" &
    CLAUDE_PID=$!
    wait $CLAUDE_PID 2>/dev/null

    sleep 2
    MY_CLAUDE_PIDS=$(powershell -Command "(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\").ParentProcessId" 2>/dev/null)
    for npid in $MY_CLAUDE_PIDS; do
        if ! tasklist 2>/dev/null | grep -q "claude.exe.*$npid"; then
            taskkill //F //PID "$npid" 2>/dev/null
        fi
    done

    bash git-locked.sh push

    count=$((count + 1))
    DELAY=$((15 + RANDOM % 10))
    echo "✅ 本轮完成，${DELAY}秒后继续..."
    sleep $DELAY
done
