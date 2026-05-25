@echo off
cd /d "D:\Desktop\WeChatProjects\a"
:loop
echo === UI设计师 开始新一轮 ===
call claude --dangerously-skip-permissions -p "你是UI设计师。读PROGRESS.md和CLAUDE.md，搜dribbble找设计参考，继续优化UI，写完审查，遵守微信规则，提交推送。所有输出用中文。做完结束。"
echo === 完成一轮，10秒后继续 ===
timeout /t 10 /nobreak
goto loop
