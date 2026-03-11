# diff

> 使用 快速diff,目的是最小代价更新视图 -> 最长递增子序列

## Vue3 diff优化

1.静态标记 + 非全量Diff

> Vue3在创建虚拟DOM树的时候，会根据DOM中的内容会不会发生变化，添加一个静态标记。之后在与上次虚拟节点进行对比的时候，就只会对比这些带有静态标记的节点

2.使用**最长递增子序列优**化对比流程

> 可以最大程度的减少DOM的移动，达到最少的DOM操作；

## 最长递增子序列

这是快速 diff 算法的核心，我们非常有必要将其单独取出进行讲解。

对应 LeetCode，https://leetcode.cn/problems/longest-increasing-subsequence/description/

比如现在有一个数组，[4,6,7]，那么它的递增子序列有以下几个：

- [4,6]
- [4,6,7]
- [4,7]
- [6,7]
- [7]

那么可以看出，最长递增子序列是 [4,6,7]

## 预处理

Vue3 在 diff 时会预先进行优化处理，怎么做呢？我们可以看看如下示例：

```javascript
const text1 = 'Hello World'
const text2 = 'Hello'
```

那其实，我们真正需要的 diff 的只有 'World'，为什么，因为字符串前面我们可以先剔除掉相同子串。

那在 Vue diff 时，也一样
