import {ReactiveController, ReactiveElement} from 'lit-element';

const objects: Map<string, unknown> = new Map();

type ResolveFn<T> = (val: T | Promise<T | null> | null) => void;
const pending: Map<string, Array<ResolveFn<unknown>>> = new Map();

export interface ControllerProvider {
  getController(element: HTMLElement, attr: string): ReactiveController;
}

function inject(key: string): Promise<ControllerProvider> {
  if (objects.has(key)) {
    return Promise.resolve(objects.get(key) as ControllerProvider);
  }
  const v = pending.get(key) || [];
  return new Promise(resolve => {
    v.push(resolve as ResolveFn<unknown>);
    pending.set(key, v);
  });
}

export function bind(key: string, element: ReactiveElement, prop: string) {
  inject(key).then((r: ControllerProvider) => {
    element.addController(r.getController(element, prop));
  });
}

export function provide(key: string, val: ControllerProvider): void {
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
