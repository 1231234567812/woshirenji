@echo off
cd /d "D:\Desktop\WeChatProjects\a"
:loop
echo === 功能开发者 开始新一轮 ===
call claude --dangerously-skip-permissions -p "你是功能开发者。读PROGRESS.md和CLAUDE.md，去GitHub搜同类小程序，继续加新功能，查微信文档，写完审查，提交推送。所有输出用中文。做完结束。"
echo === 完成一轮，10秒后继续 ===
timeout /t 10 /nobreak
goto loop
