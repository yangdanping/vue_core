import path from 'node:path';
import { fileURLToPath } from 'node:url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import alias from '@rollup/plugin-alias';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(__dirname, 'packages');

// 与 tsconfig paths 保持一致，供 Rollup 在打包时解析 @vue/* 别名
const aliasEntries = [
  { find: 'vue', replacement: path.join(packagesDir, 'vue/src') },
  ...[
    'shared',
    'reactivity',
    'runtime-core',
    'runtime-dom',
    'compiler-core',
    'compiler-dom'
  ].map(name => ({
    find: `@vue/${name}`,
    replacement: path.join(packagesDir, name, 'src')
  }))
];

// 默认导出一个数组，数组的每一个对象都是一个单独的导出文件配置
// https://www.rollupjs.com/guide/big-list-of-options
export default [
  {
    // 入口文件
    input: 'packages/vue/src/index.ts',
    // 打包出口
    output: [
      // 导出 iife 格式
      {
        // 开启 sourcemap
        sourcemap: true,
        // 导出文件地址
        file: './packages/vue/dist/vue.js',
        // 生成包的格式
        format: 'iife',
        // 变量名
        name: 'Vue'
      }
    ],
    // 插件
    plugins: [
      alias({ entries: aliasEntries }),
      // ts
      typescript({
        sourceMap: true
      }),
      // 模块导入的路径补全
      resolve(),
      // 转 commonjs 为 ESM
      commonjs()
    ]
  }
];
