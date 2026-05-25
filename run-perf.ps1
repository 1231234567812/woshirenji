# 性能优化师 - 自动循环工作
Set-Location "D:\Desktop\WeChatProjects\a"
while ($true) {
    Write-Host "=== 性能优化师 开始新一轮 ===" -ForegroundColor Cyan
    claude --dangerously-skip-permissions -p "你是性能优化师。读PROGRESS.md和CLAUDE.md，搜微信性能优化指南，继续优化性能，写完审查，提交推送。所有输出用中文。做完结束。"
    Write-Host "=== 完成一轮，10秒后继续 ===" -ForegroundColor Green
    Start-Sleep -Seconds 10
}
