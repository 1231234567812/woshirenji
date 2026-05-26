#!/bin/bash
# 共享 git 操作锁 - 所有 Agent 用这个脚本做 git pull/push
# 用法: bash git-locked.sh pull   (带锁的 pull)
#       bash git-locked.sh push   (带锁的 push)
#       bash git-locked.sh sync   (先 pull 再 push)

cd "$(dirname "$0")"
LOCKFILE=".git/agent.lock"
TIMEOUT=60

acquire_lock() {
    local waited=0
    while ! mkdir "$LOCKFILE" 2>/dev/null; do
        # 检查持锁进程是否还活着
        if [ -f "$LOCKFILE/pid" ]; then
            local lock_pid=$(cat "$LOCKFILE/pid" 2>/dev/null)
            if [ -n "$lock_pid" ] && ! kill -0 "$lock_pid" 2>/dev/null; then
                echo "💀 持锁进程 $lock_pid 已死，清理锁"
                rm -rf "$LOCKFILE"
                continue
            fi
        fi
        if [ $waited -ge $TIMEOUT ]; then
            echo "⏰ 等锁超时，强制获取"
            rm -rf "$LOCKFILE"
            continue
        fi
        echo "🔒 等待 git 锁... (${waited}s)"
        sleep 2
        waited=$((waited + 2))
    done
    echo $$ > "$LOCKFILE/pid"
}

release_lock() {
    rm -rf "$LOCKFILE"
}

trap release_lock EXIT

case "${1:-sync}" in
    pull)
        acquire_lock
        echo "📥 git pull..."
        git pull origin main --no-edit 2>/dev/null || git merge --abort 2>/dev/null
        release_lock
        ;;
    push)
        acquire_lock
        echo "📤 git push..."
        git push origin main 2>/dev/null
        release_lock
        ;;
    sync)
        acquire_lock
        echo "🔄 git sync (pull + push)..."
        git pull origin main --no-edit 2>/dev/null || git merge --abort 2>/dev/null
        git push origin main 2>/dev/null
        release_lock
        ;;
esac
