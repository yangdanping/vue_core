# 说说 Vue3 响应式原理，并对比说明与 Vue2 实现的区别

**答案：**

Vue3 响应式系统是 Vue 框架的核心之一，它允许数据的变化自动反映在视图中。在 Vue3 中，响应式系统得到了显著的改进和优化。以下是 Vue3 响应式原理的详细说明，并与 Vue2 的实现细节进行对比。

## Vue3 响应式原理

Vue3 使用 Proxy 对象来实现响应式系统，主要依赖 `reactive` 和 `ref` 函数。

### 核心概念

1. **reactive 函数**

   `reactive` 函数接收一个对象并返回一个代理对象（Proxy），这个代理对象能够在属性被读取和修改时进行依赖收集和触发更新。

```js
import { reactive } from 'vue'
const state = reactive({ count: 0 })
```

2. **ref 函数**

`ref` 函数用于创建一个包含单一值的响应式对象，适用于基本类型（如字符串、数字）以及引用类型。

```js
import { ref } from 'vue'
const count = ref(0)
```

3. **依赖收集和追踪**

   当响应式对象的属性被读取时，当前的副作用（effect）会被记录为该属性的依赖。当该属性变化时，所有依赖于该属性的副作用都会被重新执行。

## Proxy 对象的优势

- **动态属性检测：** Proxy 可以动态地拦截对属性的读取和写入操作，支持新增或删除属性时的响应式更新。
- **性能优化：** 相比于 Vue2 中的 `Object.defineProperty`，Proxy 的性能和灵活性更高。

## Vue2 响应式原理

Vue2 使用 `Object.defineProperty` 来实现响应式系统，主要依赖 `data` 和 `computed`。

### Object.defineProperty 的局限性

- **新增/删除属性的限制：** 无法动态检测对象属性的新增或删除，必须使用 `Vue.set` 或 `Vue.delete` 来确保响应式。
- **数组的局限性：** 数组的某些变动（如索引赋值）无法被侦测，需要特殊处理。
