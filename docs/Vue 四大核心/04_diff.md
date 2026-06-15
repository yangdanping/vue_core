# Diff 算法

> 使用快速 diff，目的是**最小代价更新视图** → 核心手段包括 Patch Flag 缩小对比范围、预处理剔除相同节点、最长递增子序列减少 DOM 移动。

## Diff 算法的作用

Diff 算法用于对比**新旧虚拟 DOM 树**，找出**最小更新路径**，只把变化同步到真实 DOM。

**核心策略：**

| 策略 | 含义 |
|------|------|
| 同层级比较 | 不跨层级对比，降低算法复杂度 |
| Key 标识节点身份 | 通过唯一 key 精准复用节点 |
| 最小化 DOM 操作 | 只更新发生变化的部分 |

在 Vue 3 中，结合 **Patch Flag** 与**编译阶段优化**，进一步缩小了 Diff 的对比范围，提高了渲染效率。

> **优化重点不在「完全避免比较」，而在于「尽可能少比较、尽可能少更新」。**

**源码入口：** `packages/runtime-core/src/renderer.ts`

`patch` 是整个 Diff 的入口函数。每次组件重新渲染时，都会用新的 VNode 树与旧的做对比：

```typescript
// packages/runtime-core/src/renderer.ts (约 379 行)
const patch: PatchFn = (n1, n2, container, ...) => {
  // n1 = 旧 VNode，n2 = 新 VNode
  if (n1 === n2) return  // 引用相同，直接跳过

  // 类型或 key 不同 → 卸载旧树，挂载新树（不做逐层 diff）
  if (n1 && !isSameVNodeType(n1, n2)) {
    unmount(n1, ...)
    n1 = null
  }

  // 根据节点类型（文本 / 元素 / 组件 / Fragment ...）分发到不同处理函数
  switch (type) { ... }
}
```

**通俗理解：** 把 `patch` 想象成「装修验收员」——拿着新旧两份图纸（VNode 树）逐房间核对，只处理有改动的部分，而不是整栋楼推倒重建。

---

## 1. 同层级比较

Vue 的 Diff **只在同一层级的兄弟节点之间**进行比较，**不会**把旧树中深层的节点拿去和新树另一层的节点匹配。

**源码体现：**

```typescript
// packages/runtime-core/src/renderer.ts (约 396 行)
// 类型或 key 不同，直接卸载整棵旧子树，再挂载新子树
if (n1 && !isSameVNodeType(n1, n2)) {
  unmount(n1, parentComponent, parentSuspense, true)
  n1 = null
}
```

```typescript
// packages/runtime-core/src/renderer.ts (约 1586 行)
// patchChildren 只处理当前节点的 children，不会跨父节点比较
const patchChildren = (n1, n2, container, ...) => {
  const c1 = n1 && n1.children  // 旧子节点
  const c2 = n2.children          // 新子节点
  // 在 c1 与 c2 之间做 diff ...
}
```

**通俗理解：** 就像对比两棵树的同一层树枝，不会拿 A 树第 3 层的叶子去和 B 树第 5 层的叶子配对。如果某层结构类型变了（比如 `div` 变成 `span`），整棵子树直接拆掉重建，避免 O(n³) 的跨层搜索。

---

## 2. Key 标识节点身份

`key` 用来告诉 Diff：**这两个节点是不是「同一个东西」**，从而决定是**复用并更新**，还是**卸载后新建**。

**源码路径：** `packages/runtime-core/src/vnode.ts`

```typescript
// packages/runtime-core/src/vnode.ts (约 392 行)
export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}
```

在列表 Diff 中，key 用于建立「旧节点 → 新节点」的映射：

```typescript
// packages/runtime-core/src/renderer.ts (约 1869 行，patchKeyedChildren)
// 为新子节点建立 key → index 映射表
const keyToNewIndexMap: Map<PropertyKey, number> = new Map()
for (i = s2; i <= e2; i++) {
  if (nextChild.key != null) {
    keyToNewIndexMap.set(nextChild.key, i)
  }
}

// 遍历旧节点时，通过 key 找到新列表中的对应位置
if (prevChild.key != null) {
  newIndex = keyToNewIndexMap.get(prevChild.key)
}
```

**通俗理解：** `key` 就像学生的学号。班级名单打乱重排时，靠学号就能认出「张三还是张三」，只需更新他的座位（DOM 位置），而不是把他开除再招一个新人。没有 key 时，只能按位置和类型猜测，容易误复用。

---

## 3. 最小化 DOM 操作

Diff 的终极目标：**能复用就复用，能跳过就跳过，能改属性就不移动节点**。

### 3.1 元素节点：复用 DOM，按需更新

```typescript
// packages/runtime-core/src/renderer.ts (约 828 行，patchElement)
const patchElement = (n1, n2, ...) => {
  const el = (n2.el = n1.el!)  // 复用旧 DOM 元素，不重新创建
  // 只更新有变化的部分 ...
}
```

### 3.2 文本节点：内容相同则跳过

```typescript
// packages/runtime-core/src/renderer.ts (约 938 行)
if (patchFlag & PatchFlags.TEXT) {
  if (n1.children !== n2.children) {
    hostSetElementText(el, n2.children as string)  // 仅文本变了才写 DOM
  }
}
```

### 3.3 列表节点：预处理 + 最长递增子序列

见下文「预处理」和「最长递增子序列」两节。

**通俗理解：** 装修时不换门窗框架（复用 `el`），只刷变了色的墙（更新 props/text）；搬家具时先确认哪些不用动，只搬真正换了位置的。

---

## 4. Vue 3 编译优化：Patch Flag + 非全量 Diff

Vue 3 在**编译阶段**分析模板，给**可能变化**的节点打上 `patchFlag`（静态标记），运行时只对比这些标记位，静态节点直接跳过。

### 4.1 Patch Flag 定义

**源码路径：** `packages/shared/src/patchFlags.ts`

```typescript
export enum PatchFlags {
  TEXT = 1,           // 动态文本
  CLASS = 1 << 1,     // 动态 class
  STYLE = 1 << 2,     // 动态 style
  PROPS = 1 << 3,     // 动态属性（记录 dynamicProps 列表）
  FULL_PROPS = 1 << 4,// 动态 key 的属性，需全量对比
  // ...
  CACHED = -1,        // 缓存的静态节点，整棵子树可跳过
  BAIL = -2,          // 退出优化模式，回退全量 diff
}
```

### 4.2 编译时生成 patchFlag

**源码路径：** `packages/compiler-core/src/transforms/transformElement.ts`

编译器分析元素的 class、style、props 等绑定，按需组合标记：

```typescript
// packages/compiler-core/src/transforms/transformElement.ts (约 724 行)
if (hasDynamicKeys) {
  patchFlag |= PatchFlags.FULL_PROPS
} else {
  if (hasClassBinding) patchFlag |= PatchFlags.CLASS
  if (hasStyleBinding) patchFlag |= PatchFlags.STYLE
  if (props.length)      patchFlag |= PatchFlags.PROPS
}
```

### 4.3 运行时按标记精准更新

**源码路径：** `packages/runtime-core/src/renderer.ts` → `patchElement`

```typescript
// packages/runtime-core/src/renderer.ts (约 868 行)
if (dynamicChildren) {
  // 优化模式：只 diff 编译器收集的动态子节点（Block Tree）
  patchBlockChildren(n1.dynamicChildren!, dynamicChildren, el, ...)
} else if (!optimized) {
  // 非优化模式：全量 diff 所有子节点
  patchChildren(n1, n2, el, ...)
}

if (patchFlag > 0) {
  // 有标记 → 走快速路径，只处理标记了的维度
  if (patchFlag & PatchFlags.CLASS) { /* 只比 class */ }
  if (patchFlag & PatchFlags.STYLE) { /* 只比 style */ }
  if (patchFlag & PatchFlags.PROPS) {
    // 只遍历 dynamicProps 数组里的 key，不全量扫 props
    for (let i = 0; i < propsToUpdate.length; i++) { ... }
  }
  if (patchFlag & PatchFlags.TEXT) { /* 只比文本 */ }
}
```

`patchBlockChildren` 只遍历 `dynamicChildren` 数组，静态兄弟节点不参与对比：

```typescript
// packages/runtime-core/src/renderer.ts (约 957 行)
const patchBlockChildren = (oldChildren, newChildren, ...) => {
  for (let i = 0; i < newChildren.length; i++) {
    patch(oldChildren[i], newChildren[i], ...)  // 只处理动态节点
  }
}
```

### 4.4 静态节点提升

**源码路径：** `packages/compiler-core/src/transforms/cacheStatic.ts`

编译时把不会变的节点标记为静态并缓存，渲染时直接复用，更新时跳过 Diff。

**通俗理解：** 编译器提前在图纸上用荧光笔标出「会动的零件」（patchFlag），装修验收员只检查荧光笔标记处；没标记的墙、柱子默认不用查。

---

## 5. 预处理：头尾同步（Sync from Start / End）

在列表 Diff（`patchKeyedChildren`）正式开始前，Vue 3 会先从**头部**和**尾部**剔除两边相同、顺序不变的节点，只对中间「不确定」的区间做复杂对比。

**源码路径：** `packages/runtime-core/src/renderer.ts` → `patchKeyedChildren`（约 1748 行）

```typescript
// 1. 从头开始，相同就 patch，不同就停
while (i <= e1 && i <= e2) {
  if (isSameVNodeType(n1, n2)) { patch(n1, n2, ...) }
  else { break }
  i++
}

// 2. 从尾开始，相同就 patch，不同就停
while (i <= e1 && i <= e2) {
  if (isSameVNodeType(n1, n2)) { patch(n1, n2, ...) }
  else { break }
  e1--; e2--
}

// 3. 中间多出来的 → 挂载或卸载
// 4. 中间乱序的 → 进入 key + 最长递增子序列 逻辑
```

**类比示例：**

```javascript
const text1 = 'Hello World'
const text2 = 'Hello'
// 前面 'Hello' 相同，真正需要处理的只有后面不同的部分
```

列表示例：

```
旧: (a b) c d e
新: (a b) x d e
     ↑ 头部 a、b 相同，直接 patch
              ↑ 尾部 d、e 相同，直接 patch
         只剩中间 c → x 需要处理
```

**通俗理解：** 两列队伍比对时，先从队首、队尾去掉站位没变的人，只处理中间换了人或加了人的那段。

---

## 6. 最长递增子序列（LIS）

这是 `patchKeyedChildren` 处理**中间乱序区间**时的核心优化，目的是**尽量减少 DOM 移动次数**。

**源码路径：** `packages/runtime-core/src/renderer.ts`

- 使用位置：`patchKeyedChildren` 约 1950 行
- 算法实现：`getSequence` 约 2511 行

```typescript
// 5.3 只有节点发生了移动，才计算最长递增子序列
const increasingNewIndexSequence = moved
  ? getSequence(newIndexToOldIndexMap)
  : EMPTY_ARR

// 倒序遍历，不在稳定序列中的节点才需要 move
for (i = toBePatched - 1; i >= 0; i--) {
  if (newIndexToOldIndexMap[i] === 0) {
    patch(null, nextChild, ...)  // 新节点，挂载
  } else if (moved) {
    if (j < 0 || i !== increasingNewIndexSequence[j]) {
      move(nextChild, container, anchor)  // 需要移动
    } else {
      j--  // 在稳定序列中，不用移动
    }
  }
}
```

```typescript
// packages/runtime-core/src/renderer.ts (约 2511 行)
function getSequence(arr: number[]): number[] {
  // 经典 O(n log n) 最长递增子序列算法
  // 返回的是「不需要移动」的节点在新列表中的下标
}
```

**LeetCode 对应：** https://leetcode.cn/problems/longest-increasing-subsequence/description/

**示例：** 数组 `[4, 6, 7]` 的递增子序列有 `[4,6]`、`[4,6,7]`、`[4,7]`、`[6,7]`、`[7]`，最长的是 `[4, 6, 7]`。

**在 Diff 中的含义：** 乱序列表里，**相对顺序没变**的那批节点构成「稳定子序列」，它们**不用移动 DOM**，只需移动其余节点。例如 `[a, b, c, d]` → `[a, c, b, d]`，`a` 和 `d` 位置不变，`c`、`b` 只需少量移动。

**通俗理解：** 一排书被打乱了，先找出「本来就在正确相对顺序」的那一摞（最长递增子序列），这摞书不用动，只搬其他几本，搬家次数最少。

---

## 源码路径速查

| 知识点 | 源码路径 | 关键函数 / 符号 |
|--------|----------|-----------------|
| Diff 总入口 | `packages/runtime-core/src/renderer.ts` | `patch` |
| 元素更新 | 同上 | `patchElement` |
| 子节点对比 | 同上 | `patchChildren` |
| 带 key 列表对比 | 同上 | `patchKeyedChildren` |
| Block 树优化对比 | 同上 | `patchBlockChildren` |
| 节点是否可复用 | `packages/runtime-core/src/vnode.ts` | `isSameVNodeType` |
| Patch Flag 枚举 | `packages/shared/src/patchFlags.ts` | `PatchFlags` |
| 编译时打标记 | `packages/compiler-core/src/transforms/transformElement.ts` | `buildProps` / `patchFlag` |
| 静态节点缓存 | `packages/compiler-core/src/transforms/cacheStatic.ts` | `cacheStatic` |
| 最长递增子序列 | `packages/runtime-core/src/renderer.ts` | `getSequence` |

---

## 一句话总结

Vue 3 的 Diff 不是「不比」，而是**分层、分标记、分区间**地比：同层比、有 key 精准复用、Patch Flag 跳过静态内容、头尾预处理缩小战场、最长递增子序列减少移动——每一步都在逼近「最小更新路径」。
