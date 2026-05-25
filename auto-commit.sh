#!/bin/bash
# 自动版本提交脚本
# 用法: ./auto-commit.sh "feat: 新增xxx功能"

cd "$(dirname "$0")"

MSG="${1:-feat: 自动提交}"

# 检查是否有改动
if git diff --quiet && git diff --cached --quiet; then
    echo "没有改动需要提交"
    exit 0
fi

# 安全检查：扫描敏感信息
SENSITIVE_PATTERNS=("\.env" "SECRET" "PRIVATE_KEY" "password\s*=" "api_key\s*=")
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git diff --cached --name-only | xargs grep -li "$pattern" 2>/dev/null; then
        echo "❌ 检测到敏感信息，已阻止提交！请检查以上文件"
        git reset HEAD . 2>/dev/null
        exit 1
    fi
done

# 提交
git add -A
git commit -m "$MSG"
echo "✅ 已提交: $MSG"

# 推送（如果配置了远程仓库）
if git remote | grep -q origin; then
    git push origin main 2>/dev/null && echo "✅ 已推送到 GitHub" || echo "⚠️ 推送失败，可稍后手动推送"
fi
