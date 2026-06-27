# vue_core_mini

手写 Vue 3 核心源码的学习项目，从零实现一个精简版 Vue。

## 项目结构

```
vue_core_mini/
├── packages/
│   ├── compiler-core/    # 编译器核心
│   ├── compiler-dom/     # 浏览器端编译器
│   ├── reactivity/       # 响应式系统
│   ├── runtime-core/     # 运行时核心
│   ├── runtime-dom/      # 浏览器端运行时
│   ├── shared/           # 公共工具方法
│   └── vue/              # 入口包，整合以上模块
├── rollup.config.js      # Rollup 打包配置
├── tsconfig.json         # TypeScript 配置
└── package.json
```

## 技术栈

- **TypeScript** — 类型安全的源码开发
- **Rollup** — 模块打包，输出 IIFE 格式供浏览器直接使用
- **Prettier** — 代码格式化

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式（监听文件变化，自动重新打包）
pnpm dev

# 单次打包
pnpm build
```

## 开发流程

1. 在 `packages/*/src/` 下编写各模块源码
2. 在 `packages/vue/src/index.ts` 作为统一入口，导出或整合各模块
3. 终端运行 `pnpm dev`，修改源码后 Rollup 会自动重新打包
4. 打包产物输出到 `packages/vue/dist/vue.js`

验证打包结果：

```bash
node packages/vue/dist/vue.js
```

或在 HTML 中引入：

```html
<script src="packages/vue/dist/vue.js"></script>
```

## 可用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式，监听文件变化并自动打包 |
| `pnpm build` | 单次打包，生成 `packages/vue/dist/vue.js` |
| `pnpm check` | TypeScript 类型检查 |
| `pnpm format` | Prettier 格式化全部文件 |
| `pnpm format-check` | 检查代码格式是否符合规范 |

## 模块说明

| 包名 | 职责 |
|------|------|
| `reactivity` | 响应式系统（`reactive`、`ref`、`effect` 等） |
| `runtime-core` | 虚拟 DOM、组件、调度器等运行时核心 |
| `runtime-dom` | 浏览器平台相关的 DOM 操作 API |
| `compiler-core` | 模板编译核心逻辑 |
| `compiler-dom` | 浏览器端模板编译 |
| `shared` | 跨包共享的工具函数 |
| `vue` | 对外暴露的统一入口 |

## 路径别名

`tsconfig.json` 中配置了路径映射，模块间可这样引用：

```ts
import { ... } from '@vue/reactivity'
import { ... } from '@vue/runtime-core'
```
