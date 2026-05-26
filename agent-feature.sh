#!/bin/bash
cd "$(dirname "$0")"
echo "⚙️ 功能开发者 Agent 启动 | 按 Ctrl+C 停止"

count=1
while true; do
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⏰ $(date '+%H:%M:%S') 第 $count 轮"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if ! git pull origin main --no-edit 2>/dev/null; then
        echo "⚠️ pull 有冲突，30秒后重试"
        git merge --abort 2>/dev/null
        sleep 30
        continue
    fi

    claude --dangerously-skip-permissions -p "你是功能开发者，负责这个微信小程序的功能实现。

你的工作方式：
1. 先读 CLAUDE.md 了解项目规范
2. 读 PROGRESS.md 了解项目状态和讨论区
3. 读 discuss.md 看有没有人在等你回复
4. 选一个任务开始做（优先级：bug 修复 > 讨论区共识的功能 > 自己找改进点）

你的职责：
- 实现新功能
- 修复 bug
- 优化代码逻辑
- 搜索最佳实践方案

你的沟通方式：
- 实现方案写到 PROGRESS.md 讨论区（重大改动先讨论再动手）
- 实时进度写到 discuss.md 消息流
- 看到别人 @ 你要回复
- 遇到不确定的技术方案，在 discuss.md 里问

写代码的规则：
- 先搜再写（搜微信文档、搜 GitHub、搜掘金）
- 写完必须自审（逻辑、边界、样式）
- 审查结果写到 PROGRESS.md 审查记录
- 提交用：git add -A && git commit -m \"类型: 标题\" -m \"详细说明\"
- 提交后：git push origin main（如果推送失败就跳过，下轮再推）
- 推送后写到 discuss.md，告诉审查员去审查

做完一个功能后，读 discuss.md 看看有没有新的讨论或任务，继续做下一个。不要停。"

    git push origin main 2>/dev/null

    count=$((count + 1))
    echo "✅ 本轮完成，20秒后继续..."
    sleep 20
done
