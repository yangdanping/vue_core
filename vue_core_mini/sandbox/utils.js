let activeEffect = null;
const depsMap = new Map(); // target -> key -> Set<effect>

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

function trigger(target, key) {
  const dep = depsMap.get(target)?.get(key);
  dep?.forEach(fn => fn());
}

function effect(fn) {
  activeEffect = fn;
  fn();
  activeEffect = null;
}
