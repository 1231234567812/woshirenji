#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 启动多智能体协作系统"
echo ""

# 先清理上次启动的旧 agent 进程，防止堆积
if [ -f .agent-pids ]; then
    echo "🧹 清理旧 agent 进程..."
    while read pid; do
        taskkill //F //PID "$pid" 2>/dev/null
    done < .agent-pids
    rm -f .agent-pids
    sleep 2
    echo "🧹 清理完成"
fi

# 先拉最新代码
git pull origin main 2>/dev/null

# 后台启动 3 个 Agent，日志写到文件
bash agent-ui.sh > log-ui.txt 2>&1 &
PID1=$!

bash agent-reviewer.sh > log-reviewer.txt 2>&1 &
PID2=$!

bash agent-feature.sh > log-feature.txt 2>&1 &
PID3=$!

# 保存 PID，下次启动时用来清理旧进程
echo "$PID1" > .agent-pids
echo "$PID2" >> .agent-pids
echo "$PID3" >> .agent-pids

echo "✅ 全部已启动"
echo ""
echo "  UI设计师    PID: $PID1  → log-ui.txt"
echo "  代码审查员  PID: $PID2  → log-reviewer.txt"
echo "  功能开发者  PID: $PID3  → log-feature.txt"
echo ""
echo "📋 看讨论：打开 discuss.md"
echo "📋 看日志：tail -f log-ui.txt"
echo "📋 停止：bash stop.sh"
echo ""
echo "按 Ctrl+C 退出本窗口（Agent 继续在后台跑）"

# 保持窗口不关
wait
