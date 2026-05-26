#!/bin/bash
# 清理 discuss.md，只保留最近 70 条消息
cd "$(dirname "$0")"
FILE="discuss.md"
MAX=70

[ ! -f "$FILE" ] && exit 0

# 统计消息数（格式：角色名 | 时间 | 内容）
count=$(grep -cE '^\S+.*\|.*20[0-9]{2}-[0-9]{2}-[0-9]{2}.*\|' "$FILE" 2>/dev/null || echo 0)

if [ "$count" -le "$MAX" ]; then
    echo "📝 discuss.md: ${count}/${MAX} 条，无需清理"
    exit 0
fi

# 保留头部（到"## 消息流"为止）+ 最近 MAX 条消息
head=$(sed -n '1,/^## 消息流/p' "$FILE")
body=$(sed -n '/^## 消息流$/,$p' "$FILE" | tail -n +1)

# 从 body 中提取消息（以 --- 分隔的消息块）
# 保留最后 MAX 个消息块
messages=$(echo "$body" | awk -v max="$MAX" '
    BEGIN { block=""; count=0 }
    /^---$/ { blocks[count]=block; block=""; count++; next }
    { block = block $0 "\n" }
    END {
        blocks[count]=block; count++
        start = count - max
        if (start < 1) start = 1
        for (i = start; i < count; i++) {
            printf "%s", blocks[i]
            if (i < count - 1) print "\n---\n"
        }
    }
')

echo "$head" > "$FILE"
echo "" >> "$FILE"
echo "$messages" >> "$FILE"

new_count=$(grep -cE '^\S+.*\|.*20[0-9]{2}-[0-9]{2}-[0-9]{2}.*\|' "$FILE" 2>/dev/null || echo 0)
echo "🧹 discuss.md: ${count} → ${new_count} 条（保留最近 ${MAX} 条）"
