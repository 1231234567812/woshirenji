#!/bin/bash
# 自动版本提交脚本
# 用法: ./auto-commit.sh "feat: 标题" "详细说明"

cd "$(dirname "$0")"

TITLE="${1:-feat: 自动提交}"
DETAIL="${2:-无详细说明}"

# 检查是否有改动
if git diff --quiet && git diff --cached --quiet; then
    echo "没有改动需要提交"
    exit 0
fi

# 提交
git add -A && git commit -m "$TITLE" -m "$DETAIL"
echo "✅ 已提交: $TITLE"

# 推送
if git remote | grep -q origin; then
    git push origin main 2>/dev/null && echo "✅ 已推送到 GitHub" || echo "⚠️ 推送失败，可稍后手动推送"
fi
