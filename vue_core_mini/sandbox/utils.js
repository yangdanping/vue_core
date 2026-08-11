/** 当前正在执行的 effect 函数，track 靠它知道「谁在读这个属性」 */
let activeEffect = null;

/** 依赖表：对象 → 属性名 → 依赖该属性的 effect 集合 */
const depsMap = new Map(); // target -> key -> Set<effect>

/**
 * track 依赖收集（读属性时调用）
 *
 * 通俗理解：effect 执行时会「读」数据（如 product.price）。
 * 读的时候在 getter 里调用 track，相当于登记：
 * 「这个 effect 用到了 target 的 key，以后 key 变了请通知它。」
 *
 * @param {object} target - 被读取的原始对象（如 reactive 包装前的 obj）
 * @param {string|symbol} key - 被读取的属性名（如 'price'、'quantity'）
 *
 * @example
 * // 在 defineProperty / Proxy 的 get 里：
 * get() {
 *   track(obj, 'price');  // 登记：当前 effect 依赖 price
 *   return value;
 * }
 */
function track(target, key) {
  if (!activeEffect) return;
  let deps = depsMap.get(target);
  if (!deps) {
    deps = new Map();
    depsMap.set(target, deps);
  }
  let dep = deps.get(key);
  if (!dep) {
    dep = new Set();
    deps.set(key, dep);
  }
  dep.add(activeEffect);
}

/**
 * trigger 触发更新（写属性时调用）
 *
 * 通俗理解：修改数据（如 product.quantity = 5）时，
 * 在 setter 里调用 trigger，去依赖表里找：
 * 「谁曾经依赖过这个 key？」然后把登记过的 effect 全部重新跑一遍。
 *
 * @param {object} target - 被修改的原始对象
 * @param {string|symbol} key - 被修改的属性名
 *
 * @example
 * // 在 defineProperty / Proxy 的 set 里：
 * set(newVal) {
 *   value = newVal;
 *   trigger(obj, 'quantity');  // 通知所有依赖 quantity 的 effect 重算
 * }
 */
function trigger(target, key) {
  const dep = depsMap.get(target)?.get(key);
  dep?.forEach(fn => fn());
}

/**
 * 副作用函数：把「读数据 + 写派生值」包成可自动重跑的函数
 *
 * 通俗理解：
 * 1. 把 fn 设为 activeEffect（告诉 track：接下来读属性的是谁）
 * 2. 立刻执行 fn 一次（首次计算，同时完成依赖收集）
 * 3. 清空 activeEffect（平时读属性不算依赖，只有 effect 里的读才算）
 *
 * 【与实际开发的关系】
 * - 业务代码里通常不会直接写 effect()；日常用 template 自动更新、computed、watch 即可
 * - 官方文档也不把它作为公开 API 推荐（最接近的手写 API 是 watchEffect）
 *
 * 【在 Vue 源码中的位置】
 * - 可视为 watch / computed / 组件 render 的底层抽象：它们内部都是 ReactiveEffect，
 *   模式与这里的 effect 相同（标记 activeSub → 跑 fn → track 收集 → trigger 重跑）
 * - 本 sandbox 用裸函数简化教学；真实 Vue 还有 scheduler、依赖清理、批量更新等
 *
 * @param {Function} fn - 会读取响应式数据并产生副作用的函数（如计算 total）
 *
 * @example
 * effect(() => {
 *   total = product.price * product.quantity; // 读 price、quantity → 自动 track
 * });
 * product.quantity = 5; // setter → trigger → 上面的 fn 自动再跑 → total 更新
 */
function effect(fn) {
  activeEffect = fn;
  fn();
  activeEffect = null;
}
