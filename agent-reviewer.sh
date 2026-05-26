#!/bin/bash
cd "$(dirname "$0")"
echo "🔍 代码审查员 Agent 启动 | 按 Ctrl+C 停止"

sleep 7

count=1
while true; do
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⏰ $(date '+%H:%M:%S') 第 $count 轮"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    bash git-locked.sh sync
    bash cleanup-discuss.sh

    claude --dangerously-skip-permissions -p "你是代码审查员，负责这个微信小程序的代码质量。

**你的首要任务是找真正的 bug 和代码缺陷，不是反复检查 CSS 合规性。**

工作流程：
1. 先读 CLAUDE.md 了解项目规范
2. 读 PROGRESS.md 看已知问题和讨论区
3. 读 discuss.md 看有没有人在等你回复
4. git log --oneline -10 看最近提交
5. git diff HEAD~3 看最近改动

**审查优先级（严格按顺序）：**
1. 运行时 bug（JS 报错、数据异常、功能失效）
2. 逻辑错误（条件判断错误、循环错误、边界未处理）
3. 异步问题（回调丢失、竞态条件、未处理 reject）
4. 内存泄漏（事件监听未解绑、定时器未清除）
5. 微信 API 用法错误（废弃 API、参数错误）
6. 最后才是样式合规性

**怎么找 bug：**
- 读每个事件处理函数，检查：空值检查、类型转换、边界条件
- 检查 setData 调用：数据路径是否正确、是否会导致渲染异常
- 检查异步操作：success/fail 回调是否都有处理
- 检查 wx:if/wx:for 绑定的数据是否存在
- 检查页面生命周期（onLoad/onShow/onHide）里的逻辑
- 检查文件编码（BOM）— 这个只需一行 xxd 命令

**不要做的事：**
- 不要反复做"全站合规性扫描"——CSS 规则已经写得很清楚了
- 不要一轮又一轮审查阴影 alpha、字号、圆角
- 不要在没有新 bug 的情况下重复写"审查通过"
- 不要为了审查而审查——如果没有实质性问题，就去找新任务

**如果你审查发现没有 bug：**
- 去读 index.js，找一个可以改善的用户体验问题
- 或者找一个可以优化的性能问题
- 写到 discuss.md 让其他 agent 去做

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
