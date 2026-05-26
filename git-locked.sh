#!/bin/bash
# 共享 git 操作锁 - 所有 Agent 用这个脚本做 git pull/push
# 用法: bash git-locked.sh pull   (带锁的 pull)
#       bash git-locked.sh push   (带锁的 push)
#       bash git-locked.sh sync   (先 pull 再 push)

cd "$(dirname "$0")"
LOCKFILE=".git/agent.lock"
TIMEOUT=120

acquire_lock() {
    local waited=0
    while ! mkdir "$LOCKFILE" 2>/dev/null; do
        if [ $waited -ge $TIMEOUT ]; then
            echo "⏰ 等锁超时，强制获取"
            rm -rf "$LOCKFILE"
            continue
        fi
        echo "🔒 等待 git 锁... (${waited}s)"
        sleep 3
        waited=$((waited + 3))
    done
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
