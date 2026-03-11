# Vue3 源码解读

## 编译时

> XXX.vue/XXX.jsx 文件不能被 JS 引擎识别

---

口述一下，编译过程：
由于 Vue 项目的工程化设计与组件化开发模式，所有的组件基本上是通过 xxx.vue 来编写的，就好比是 react 的 jsx 语法
这一特性在 Vue 中称为：单文件组件，但是众所周知这类文件是我们自定义的文件，js 引擎是无法识别的，需要对应的编译器来完成编译工作，将编译后的产物给到 js 引擎执行

- compiler-sfc -> compileScript, compileStyle, compileTemplate
- compiler-dom
- compiler-core
  是负责编译时的三个核心包 -> 将XXX.vue 文件编译为 JS 代码

## 🌟数据响应式

> 用来实现Vue3数据的响应式,即 MVVM ,即(model -> view ,view -> model)
> 数据(model) 的变化会自动引起 视图(view) 的更新,视图(view)的更新也会自动引起 数据(model) 的变化
> 我们知道有个 vue 指令是 v-model,即数据双向绑定,
> 很显然 react 里面是没有这个概念的,react 强调单项数据流,这是区别很大的一个点

通过 /reactivity 包实现

## 运行时

runtime-core / runtime-dom

## 🌟diff(快速 diff)

快速diff 是 renderer.ts -> patchChildren -> patchKeyedChildren
