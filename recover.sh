#!/bin/bash
# 紧急恢复脚本 - 项目被改乱时使用
cd "$(dirname "$0")"

echo "=== 最近 10 个版本 ==="
git log --oneline -10
echo ""
echo "输入要回退的版本号（前7位），或直接回车回退到上一个版本："
read -r COMMIT

if [ -z "$COMMIT" ]; then
    COMMIT="HEAD~1"
fi

echo "正在回退到 $COMMIT ..."
git reset --hard "$COMMIT"
echo "✅ 已回退"
echo ""
echo "当前版本："
git log --oneline -1
