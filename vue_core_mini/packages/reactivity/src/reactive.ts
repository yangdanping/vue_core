import { mutableHandlers } from './baseHandlers';

/**
 * 响应性 Map 缓存对象
 * key: target
 * val: proxy
 */
export const reactiveMap = new WeakMap<object, any>();

/**
 * 为复杂数据类型，创建响应性对象
 * @param target 被代理对象
 * @returns 代理对象
 */
export function reactive(target: object) {
  return createReactiveObject(target, mutableHandlers, reactiveMap);
}

/**
 * 创建响应性对象
 * @param target 被代理对象
 * @param baseHandlers handler
 */
function createReactiveObject(
  target: object,
  baseHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<object, any>
) {
  // ================= 🌟若同样的 target 触发 reactive，则直接返回已有对应的代理 =================
  // target already has corresponding Proxy
  const existingProxy = proxyMap.get(target); // proxyMap 的最主要作用就是看当前对象有无被代理过
  if (existingProxy) {
    return existingProxy; // 若已经代理过了，则直接 return
  }

  // ================= 🌟返回的最终 proxy =================
  // 若未被代理过，则生成 proxy 实例返回
  // mini 版简化只使用 baseHandlers；原实现还会按 COLLECTION 类型选用 collectionHandlers
  const proxy = new Proxy(target, baseHandlers); // 代理对象
  proxyMap.set(target, proxy); // 设置 target → proxy 的映射
  return proxy;
}

/* 
运行 reactive.html 可见打印了个 proxy 对象实例
那么此我们已经得到了个基础的reactive函数，但是在reactive函数中我们还存在三个问题：
1.WeakMap是什么？它和Map有什么区别呢?
2.mutableHandlers现在是个空的，我们又应该如何实现呢？
3.难不成以后每次测试时，都要打包一次吗？

*/
