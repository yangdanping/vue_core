# Vue 响应式 Sandbox — 渐进式最简逻辑链条

用 4 个 HTML 示例 + 1 个工具文件，从「普通 JS 不会自动更新」一路推到「Vue 3 Proxy + track/trigger + Reflect」。

## 总览

```
问题 → 拦截读写 → 自动通知 → 拦截方式升级 → 依赖收集补全
```

| 步骤 | 文件 | 核心收获 |
|------|------|----------|
| 1 | `01_程序响应式的必要.html` | 源数据变了，派生值不会自动更新 |
| 2 | `02_vue2的做法.html` + `utils.js` | track / trigger / effect 三件套 |
| 3 | `03_vue3基于proxy的做法.html` | 换 Proxy 拦截，思路不变 |
| 4 | `04_Proxy与Reflect.html` + `utils.js` | Reflect 保证链式读取不丢依赖 |

直接在浏览器打开 HTML 即可运行（02、04 依赖同目录下的 `utils.js`）。

---

## 第 1 步：发现「不会自动更新」

**文件：** `01_程序响应式的必要.html`

```js
let total = product.price * product.quantity  // 只算一次
product.quantity = 5                          // 源数据变了
// total 仍是旧值，必须手动再调 effect()
```

**结论：** 需要在「读」时记住谁在用、「写」时通知谁重算。

---

## 第 2 步：最小响应式三件套

**文件：** `02_vue2的做法.html`、`utils.js`

| 角色 | 做什么 |
|------|--------|
| `effect(fn)` | 执行 fn，并标记「当前正在跑的副作用」 |
| `track(target, key)` | **读**属性时登记：`key → 这个 effect` |
| `trigger(target, key)` | **写**属性时查找并重新执行所有登记的 effect |

Vue 2 用 `Object.defineProperty` 在 getter/setter 里挂 `track` / `trigger`：

```
effect 跑 → 读 price/quantity → getter 里 track
改 quantity → setter 里 trigger → effect 自动重跑 → total 更新
```

**局限：** 只能监听初始化时已有的属性，新增属性无响应性。

---

## 第 3 步：换拦截方式，不换核心逻辑

**文件：** `03_vue3基于proxy的做法.html`

Proxy 代理整个对象，任意属性（含新增）的 get/set 都能拦截：

```
读 proxy.xxx  → get trap  → （后续会加 track）
写 proxy.xxx  → set trap  → （后续会加 trigger）
```

本示例里暂时直接调用 `effect()`，还没接入 `utils.js` 的 depsMap，但已经说明：

> **拦截层可以换，track/trigger 思路不变。**

---

## 第 4 步：Proxy + track/trigger + Reflect

**文件：** `04_Proxy与Reflect.html`、`utils.js`

把第 2 步的 depsMap 机制接到 Proxy 上，并解决 getter 链式读取问题：

```
effect 读 proxyGood.fullName
  → get trap: track(fullName)
  → Reflect.get → fullName getter 内 this 指向 proxy
  → 再读 lastName、firstName → 各自 track
改 lastName → trigger → effect 重跑 → display 更新
```

| 写法 | 结果 |
|------|------|
| `return target[key]` | getter 内 `this` 指向原对象，漏收集 |
| `Reflect.get(target, key, receiver)` | `this` 指向代理，依赖完整 |

---

## utils.js：三件套速查

```
effect(fn)
  ├─ activeEffect = fn     ← 开收集
  ├─ fn()                  ← 读属性 → track 登记
  └─ activeEffect = null   ← 关收集

product.quantity = 5
  └─ setter → trigger → depsMap 里的 fn 再跑
```

**关于 `effect()`：**

- 业务代码里通常**不会**直接写 `effect()`，日常用 template、`computed`、`watch` 即可
- 官方文档也不把它作为公开 API 推荐（最接近的手写 API 是 `watchEffect`）
- 可视为 `watch` / `computed` / 组件 render 的底层抽象（内部都是 `ReactiveEffect`）

---

## 与 Vue 3 源码的对应

### reactivity 层（`packages/reactivity/src/dep.ts`）

数据变更后的通知链（以新增属性为例）：

```
obj.x = 1
  → Proxy set（baseHandlers）
  → Reflect.set(...)                    ← 属性已写入，trigger 不负责写
  → trigger(target, ADD, 'x')
  → dep.trigger() → notify()
  → computed / watch / 组件 render 重跑
```

### runtime 层（`packages/runtime-core/src/renderer.ts`）

每个组件挂载时创建 render 专用的 `ReactiveEffect(componentUpdateFn)`：

```
template 中的 {{ count }} 等在 componentUpdateFn 执行时读响应式数据
  → Proxy get → track → 依赖登记到此 effect

数据变更 → trigger → dep.notify()
  → 本 effect 重跑 componentUpdateFn（组件 render 重跑）
  → 生成新 VNode → queueJob → patch DOM（视图更新）
```

**区分两点：**

- **组件 render 重跑** = render effect 再次执行 `componentUpdateFn`
- **视图更新** = 上面一步 + DOM diff/patch（不在 `dep.ts` 内）

---

## 一句话总链

> **effect 执行时 track 收集依赖 → 数据变化时 trigger 重跑 effect → 用 getter/setter（Vue 2）或 Proxy trap（Vue 3）在读写时自动调用 track/trigger → Vue 3 还需 Reflect 保证嵌套读取不丢依赖 → 真实项目中 template / watch / computed 底层都是同一套 ReactiveEffect。**
