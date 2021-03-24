const objects: Map<string, unknown> = new Map();

type ResolveFn<T> = (val: T | Promise<T | null> | null) => void;
const pending: Map<string, Array<ResolveFn<unknown>>> = new Map();

export function inject<T>(key: string): Promise<T> {
  if (objects.has(key)) {
    return Promise.resolve(objects.get(key) as T);
  }
  const v = pending.get(key) || [];
  return new Promise(resolve => {
    v.push(resolve as ResolveFn<unknown>);
    pending.set(key, v);
  });
}

export function provide<T>(key: string, val: T): void {
  // Register injected value.
  objects.set(key, val);

  // Resolve pending injects.
  const p = pending.get(key);
  if (p) {
    for (const i of p) {
      i(val as unknown);
    }
  }
}
