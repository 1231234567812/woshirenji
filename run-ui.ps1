# UI设计师 - 自动循环工作
Set-Location "D:\Desktop\WeChatProjects\a"
while ($true) {
    Write-Host "=== UI设计师 开始新一轮 ===" -ForegroundColor Cyan
    claude --dangerously-skip-permissions -p "你是UI设计师。读PROGRESS.md和CLAUDE.md，搜dribbble找设计参考，继续优化UI，写完审查，遵守微信规则，提交推送。所有输出用中文。做完结束。"
    Write-Host "=== 完成一轮，10秒后继续 ===" -ForegroundColor Green
    Start-Sleep -Seconds 10
}
