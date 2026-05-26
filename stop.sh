#!/bin/bash
echo "🛑 停止所有 Agent..."

# 杀掉 agent 的 bash 进程
ps aux 2>/dev/null | grep -E "agent-(ui|reviewer|feature)\.sh" | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null

# 杀掉所有 claude 进程
taskkill //F //IM claude.exe 2>/dev/null

echo "✅ 全部已停止"
