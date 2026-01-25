# 同步官方代码并更新学习分支：
# 保证本地 main 是最新的，并同步到 origin，然后 rebase 到 study
# 注：git fetch upstream main:main 可以在不切换分支的情况下
# 直接用远程 upstream 的 main 更新本地的 main 分支（前提是本地 main 没有未提交的修改）。这样 just 进程会始终运行在 study 分支下，不会因为找不到 justfile 而中断。

sync-all:
    git fetch upstream main:main
    git push origin main
    git rebase main
    @echo "🚀 全量同步完成：main 已净化并对齐官方，study 已完成 rebase。"

# 可通过git branch -vv 查看状态：检查当前各分支的追踪情况和版本进度
