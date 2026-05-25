#!/bin/bash
# 自动循环工作脚本 - 做完一个任务自动接下一个
# 用法: ./auto-work.sh "你的身份描述"
# 停止: Ctrl+C

cd "$(dirname "$0")"
ROLE="${1:-AI开发者}"

echo "🤖 $ROLE 开始自动工作，按 Ctrl+C 停止"
echo ""

while true; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⏰ $(date '+%H:%M:%S') 开始新一轮工作"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    claude --dangerously-skip-permissions -p "你是$ROLE。读 PROGRESS.md 和 CLAUDE.md，看看有什么可以做的（从 PROGRESS.md 的任务池或讨论区找），选一个任务开始做。搜资料、写代码、审查、提交、推送到 GitHub、更新 PROGRESS.md。做完就结束。"

    echo ""
    echo "✅ $(date '+%H:%M:%S') 本轮完成，10秒后开始下一轮..."
    echo ""
    sleep 10
done
