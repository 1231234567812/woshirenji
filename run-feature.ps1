# 功能开发者 - 自动循环工作
Set-Location "D:\Desktop\WeChatProjects\a"
while ($true) {
    Write-Host "=== 功能开发者 开始新一轮 ===" -ForegroundColor Cyan
    claude --dangerously-skip-permissions -p "你是功能开发者。读PROGRESS.md和CLAUDE.md，去GitHub搜同类小程序，继续加新功能，查微信文档，写完审查，提交推送。所有输出用中文。做完结束。"
    Write-Host "=== 完成一轮，10秒后继续 ===" -ForegroundColor Green
    Start-Sleep -Seconds 10
}
