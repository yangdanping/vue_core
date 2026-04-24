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

---

## 性能与编译优化

这 3 个点在官方文档里主要对应两处：

- [渲染机制](https://cn.vuejs.org/guide/extras/rendering-mechanism)
- [性能优化 - 包体积与 Tree-shaking 优化](https://cn.vuejs.org/guide/best-practices/performance#bundle-size-and-tree-shaking)

下面按“编译阶段产出什么，运行时如何利用什么”来对应源码。

### 1. 静态提升 `Static Hoisting`

核心理解：
编译器先识别静态内容，把可提升的表达式收集起来，最后生成 `const _hoisted_xxx = ...`；运行时重复渲染时直接复用，不再重复创建这部分 vnode。

文件路径：`packages/compiler-core/src/transform.ts`

```ts
export function transform(root: RootNode, options: TransformOptions): void {
  const context = createTransformContext(root, options)
  traverseNode(root, context)

  if (options.hoistStatic) {
    cacheStatic(root, context) // 开启静态提升扫描
  }

  // ...
  root.hoists = context.hoists // 收集所有被提升的静态表达式
}
```

文件路径：`packages/compiler-core/src/transform.ts`

```ts
hoist(exp) {
  if (isString(exp)) exp = createSimpleExpression(exp)
  context.hoists.push(exp)
  const identifier = createSimpleExpression(
    `_hoisted_${context.hoists.length}`,
    false,
    exp.loc,
    ConstantTypes.CAN_CACHE,
  )
  identifier.hoisted = exp
  return identifier // 返回 _hoisted_n 标识符，供后续代码生成使用
}
```

文件路径：`packages/compiler-core/src/codegen.ts`

```ts
function genHoists(hoists: (JSChildNode | null)[], context: CodegenContext) {
  // ...
  for (let i = 0; i < hoists.length; i++) {
    const exp = hoists[i]
    if (exp) {
      push(`const _hoisted_${i + 1} = `)
      genNode(exp, context) // 把静态节点输出到 render 外部
      newline()
    }
  }
}
```

补充：
`packages/compiler-core/src/transforms/cacheStatic.ts` 还会继续把纯静态子树标成 `PatchFlags.CACHED`，让这类内容在更新时直接跳过。

### 2. 创建 `Patch Flag`

核心理解：
编译器在生成 vnode 时，提前把“这个节点未来可能变什么”编码成数字标记；运行时 diff 时通过按位与判断，只更新真的会变的部分，而不是全量对比。

文件路径：`packages/shared/src/patchFlags.ts`

```ts
export enum PatchFlags {
  TEXT = 1,
  CLASS = 1 << 1,
  STYLE = 1 << 2,
  PROPS = 1 << 3,
  FULL_PROPS = 1 << 4,
  // ...
  CACHED = -1,
  BAIL = -2,
}
```

文件路径：`packages/compiler-core/src/transforms/transformElement.ts`

```ts
let patchFlag: VNodeCall['patchFlag'] | 0 = 0

// ...
if (props.length > 0) {
  const propsBuildResult = buildProps(
    node,
    context,
    undefined,
    isComponent,
    isDynamicComponent,
  )
  vnodeProps = propsBuildResult.props
  patchFlag = propsBuildResult.patchFlag // 编译阶段先算出需要的 patch flag
  dynamicPropNames = propsBuildResult.dynamicPropNames
}

// ...
if (
  hasDynamicTextChild &&
  getConstantType(child, context) === ConstantTypes.NOT_CONSTANT
) {
  patchFlag |= PatchFlags.TEXT // 例如只有文本会变，直接打上 TEXT 标记
}

node.codegenNode = createVNodeCall(
  context,
  vnodeTag,
  vnodeProps,
  vnodeChildren,
  patchFlag === 0 ? undefined : patchFlag,
  vnodeDynamicProps,
  // ...
)
```

文件路径：`packages/runtime-core/src/renderer.ts`

```ts
if (patchFlag > 0) {
  if (patchFlag & PatchFlags.FULL_PROPS) {
    patchProps(el, oldProps, newProps, parentComponent, namespace)
  } else {
    if (patchFlag & PatchFlags.CLASS) {
      if (oldProps.class !== newProps.class) {
        hostPatchProp(el, 'class', null, newProps.class, namespace)
      }
    }

    if (patchFlag & PatchFlags.STYLE) {
      hostPatchProp(el, 'style', oldProps.style, newProps.style, namespace)
    }

    if (patchFlag & PatchFlags.PROPS) {
      const propsToUpdate = n2.dynamicProps!
      // ... 只遍历动态 props
    }
  }

  if (patchFlag & PatchFlags.TEXT) {
    if (n1.children !== n2.children) {
      hostSetElementText(el, n2.children as string)
    }
  }
}
```

补充：
官方文档里把这套机制叫做 `Compiler-Informed Virtual DOM`，也就是“编译器提前告诉运行时应该怎么优化 diff”。

### 3. `Tree-shaking` 支持

核心理解：
Vue 3 的包结构本身就是按模块拆分的，Bundler 可以把没用到的导出和编译器代码裁掉；因此不仅“API 可按需保留”，还可以直接选择“不把模板编译器打进生产包”。

文件路径：`packages/runtime-dom/src/index.ts`

```ts
const rendererOptions = /*@__PURE__*/ extend({ patchProp }, nodeOps)

// lazy create the renderer - this makes core renderer logic tree-shakable
// in case the user only imports reactivity utilities from Vue.
let renderer: Renderer<Element | ShadowRoot> | HydrationRenderer

function ensureRenderer() {
  return (
    renderer ||
    (renderer = createRenderer<Node, Element | ShadowRoot>(rendererOptions))
  )
}
```

说明：
这里通过惰性创建 renderer，避免“只用响应式 API，却把整套 DOM renderer 逻辑提前拉进来”。

文件路径：`packages/vue/src/runtime.ts`

```ts
// This entry exports the runtime only, and is built as
// `dist/vue.esm-bundler.js` which is used by default for bundlers.
export * from '@vue/runtime-dom'

export const compile = (): void => {
  if (__DEV__) {
    warn(`Runtime compilation is not supported in this build of Vue.`)
  }
}
```

文件路径：`packages/vue/src/index.ts`

```ts
import { compile } from '@vue/compiler-dom'
import * as runtimeDom from '@vue/runtime-dom'

function compileToFunction(
  template: string | HTMLElement,
  options?: CompilerOptions,
) {
  const { code } = compile(template, {
    hoistStatic: true,
    // ...
  })
  const render = __GLOBAL__
    ? new Function(code)()
    : new Function('Vue', code)(runtimeDom)
  return render
}

registerRuntimeCompiler(compileToFunction)
export * from '@vue/runtime-dom'
```

说明：
默认 bundler 入口走 `runtime-only`，只导出运行时；只有选择 full build 时才会把 `@vue/compiler-dom` 一起带上，这就是 Vue 3 能显著优化包体积的一个关键实现点。

补充：
`packages/runtime-core/src/featureFlags.ts` 中还专门说明了 `esm-bundler` 构建依赖编译期特性开关来获得更好的 tree-shaking 效果。

### 面试可直接总结

- 静态提升：编译器先找出完全静态的节点或属性，提升成 `render` 外部常量，后续渲染直接复用。
- Patch Flag：编译器把“哪里会变”编码到 vnode 上，运行时通过位运算走快速 diff，只更新动态部分。
- Tree-shaking：Vue 3 采用更细粒度的模块拆分和 runtime/compiler 分离设计，配合 ESM 导出与 bundler，可把未使用 API 和编译器代码从最终产物中移除。
