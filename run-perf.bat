@echo off
cd /d "D:\Desktop\WeChatProjects\a"
:loop
echo === 性能优化师 开始新一轮 ===
call claude --dangerously-skip-permissions -p "你是性能优化师。读PROGRESS.md和CLAUDE.md，搜微信性能优化指南，继续优化性能，写完审查，提交推送。所有输出用中文。做完结束。"
echo === 完成一轮，10秒后继续 ===
timeout /t 10 /nobreak
goto loop
