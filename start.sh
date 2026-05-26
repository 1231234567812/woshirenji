#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 启动多智能体协作系统"
echo ""

# 先拉最新代码
git pull origin main 2>/dev/null

# 后台启动 3 个 Agent，日志写到文件
bash agent-ui.sh > log-ui.txt 2>&1 &
PID1=$!

bash agent-reviewer.sh > log-reviewer.txt 2>&1 &
PID2=$!

bash agent-feature.sh > log-feature.txt 2>&1 &
PID3=$!

echo "✅ 全部已启动"
echo ""
echo "  UI设计师    PID: $PID1  → log-ui.txt"
echo "  代码审查员  PID: $PID2  → log-reviewer.txt"
echo "  功能开发者  PID: $PID3  → log-feature.txt"
echo ""
echo "📋 看讨论：打开 discuss.md"
echo "📋 看日志：tail -f log-ui.txt"
echo "📋 停止：kill $PID1 $PID2 $PID3"
echo ""
echo "按 Ctrl+C 退出本窗口（Agent 继续在后台跑）"

# 保持窗口不关
wait
