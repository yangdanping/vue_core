# 同步官方 vue 代码并更新学习分支
# 约定：
#   - main 永远跟 upstream/main 对齐，不做任何本地提交
#   - study 基于最新 main 做 rebase，叠加学习注释与 docs 笔记
# 首次使用需配置 upstream 远程仓库：
#   git remote add upstream https://github.com/vuejs/core.git

# 默认显示所有可用命令
default:
    @just --list

# 查看当前分支追踪状态与领先/落后情况
status:
    @git branch -vv

# 一键同步：fetch upstream main → push origin main → rebase study
sync-all:
    #!/usr/bin/env bash
    set -euo pipefail

    current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$current_branch" != "study" ]; then
        echo "❌ 请在 study 分支执行（当前：$current_branch）"
        exit 1
    fi

    stashed=0
    if ! git diff-index --quiet HEAD -- || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        echo "⚠️  检测到未提交改动，自动 stash（含未追踪文件）..."
        git stash push -u -m "auto-stash by just sync-all"
        stashed=1
    fi

    echo "📥 拉取 upstream/main 到本地 main..."
    git fetch upstream main:main

    if [ "$(git rev-parse main)" != "$(git rev-parse origin/main 2>/dev/null || echo none)" ]; then
        echo "📤 推送 main 到 origin..."
        git push origin main
    else
        echo "✅ origin/main 已是最新，跳过 push"
    fi

    echo "🔀 rebase study 到 main..."
    if ! git rebase main; then
        echo ""
        echo "⚠️  rebase 遇到冲突，请按以下步骤处理："
        echo "   1) 解决冲突后: git add <文件> && git rebase --continue"
        echo "   2) 放弃 rebase: git rebase --abort"
        if [ "$stashed" = "1" ]; then
            echo "   3) rebase 完成后手动恢复工作区: git stash pop"
        fi
        exit 1
    fi

    if [ "$stashed" = "1" ]; then
        echo "↩️  恢复 stash..."
        git stash pop
    fi

    echo "🚀 同步完成：study 已基于最新 main rebase"
    echo "   如需同步到远程 fork，执行: just push-study"

# rebase 后推 study 到远程 fork（安全强推，防止覆盖他人提交）
push-study:
    git push --force-with-lease origin study

# 清理本地已合并的临时分支（保留 main/study）
clean-branches:
    @git branch --merged main | grep -vE '^\*|main|study' | xargs -r git branch -d
