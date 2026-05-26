#!/bin/bash
echo "🛑 停止所有 Agent..."

taskkill //F //IM claude.exe 2>/dev/null
taskkill //F //IM node.exe 2>/dev/null

# 杀掉所有正在跑 agent 脚本的 bash 进程
powershell -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'bash.exe' -and \$_.CommandLine -match 'agent-(ui|reviewer|feature)\.sh' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>/dev/null

rm -f .agent-pids

echo "✅ 全部已停止"
