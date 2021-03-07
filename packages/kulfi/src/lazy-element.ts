import {
  noChange,
  PropertyValues,
  ReactiveElement,
  render,
  RenderOptions,
} from 'lit';

import {hydrate} from 'lit/hydrate';

export class LazyRenderer<T> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  render(context: T): unknown {
    return noChange;
  }
}

// Different Lazy states LazyElement takes before being in
// regularly renderable READY state.
const enum LazyState {
  UNINITIALZIED = 0,
  NEEDS_SHADOW_ROOT,
  NEEDS_HYDRATION,
  READY,
}

// TODO: Make this configurable.
const INTERSECTION_CONFIG = {
  root: null,
  rootMargin: '50px',
  threshold: 0,
};

/**
 * A LitElement that executes its render implementation lazily.
 * In the client it avoids performing the hydration until either the input properties
 * are updated or if an event inside the Element is fired.
 */
export abstract class LazyElement extends ReactiveElement {
  private static _observer?: IntersectionObserver;

  private readonly _renderOptions: RenderOptions = {host: this};

  private readonly _initialValues: Map<
    string | number | symbol,
    unknown
  > = new Map();

  private _state = LazyState.UNINITIALZIED;

  private _renderer?: LazyRenderer<this>;

  private _isFirstUpdate = true;

  private convertShadowRoot() {
    // Fill shadow root from declarative shadow dom nodes from the server.
    if (this._state !== LazyState.NEEDS_SHADOW_ROOT) {
      return;
    }
    this.querySelectorAll('template[shadowroot]').forEach(t => {
      t.parentElement!.attachShadow({
        mode: t.getAttribute('shadowroot') as 'closed' | 'open',
      }).appendChild((t as HTMLTemplateElement).content);
      t.remove();
    });
    (this as {
      renderRoot: Element | DocumentFragment;
    }).renderRoot = this.shadowRoot!;
    this._state = LazyState.NEEDS_HYDRATION;
  }

  private prefetchRenderer() {
    if ((window as any)['HAS_HOIST_PREFETCH']) {
      // Use prefetch feature of https://github.com/vikerman/rollup-plugin-hoist-import-deps#prefetch-support
      // to prefetch the LazyRenderer and all its static import deps.
      (window as any)['HOIST_PREFETCH'] = true;
      try {
        this.load();
      } finally {
        (window as any)['HOIST_PREFETCH'] = undefined;
      }
    }
  }

  private onVisible() {
    // Move SSR-ed Declarative Shadow DOM nodes to shadow DOM if not already done so.
    this.convertShadowRoot();

    // Start prefetching the renderer code (and its static dependencies).
    this.prefetchRenderer();
  }

  private static setupIntersectionObserver(el: LazyElement) {
    if (LazyElement._observer == null) {
      LazyElement._observer = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as LazyElement)?.onVisible();
            LazyElement._observer?.unobserve(e.target);
          }
        }
      }, INTERSECTION_CONFIG);
    }
    LazyElement._observer.observe(el);
  }

  private saveInitialPropertyValues() {
    for (const [k] of (this.constructor as typeof ReactiveElement)
      .elementProperties!) {
      this._initialValues.set(k, (this as any)[k]);
    }
  }

  private initialize() {
    if (this._state < LazyState.READY) {
      if (!window.IntersectionObserver) {
        // If IntersectionObserver is no available or polyfilled
        // Just start getting ready on init.
        this.onVisible();
      } else {
        // Setup first level loading based on visibility.
        LazyElement.setupIntersectionObserver(this);
      }

      // Store initial attribute values for lazy hydration.
      this.saveInitialPropertyValues();

      // TODO: Setup temporary event listeners to know when to hydrate.
    }
  }

  private hydrate() {
    if (this._state !== LazyState.NEEDS_SHADOW_ROOT) {
      return;
    }

    // Save current values and restore initial properties.
    const currentValues: Map<String | number | symbol, unknown> = new Map();
    for (const [k] of (this.constructor as typeof ReactiveElement)
      .elementProperties!) {
      currentValues.set(k, (this as any)[k]);
      (this as any)[k] = this._initialValues.get(k);
    }

    // Hydrate with initial properties.
    const result = this._renderer!.render(this);
    hydrate(result, this.renderRoot, this._renderOptions);

    // Restore current properties.
    for (const [k] of (this.constructor as typeof ReactiveElement)
      .elementProperties!) {
      (this as any)[k] = currentValues.get(k);
    }

    // TODO: Check pending events to replay
    this._state = LazyState.READY;
  }

  connectedCallback() {
    super.connectedCallback();
    this.initialize();
  }

  protected createRenderRoot() {
    if (this.firstElementChild?.tagName === 'TEMPLATE') {
      this._state = LazyState.NEEDS_SHADOW_ROOT;
      // Just return `this` for now and create actual shadowroot later.
      return this;
    }

    let renderRoot: Element | ShadowRoot;
    if (this.shadowRoot) {
      this._state = LazyState.NEEDS_HYDRATION;
      renderRoot = this.shadowRoot;
    } else {
      this._state = LazyState.READY;
      renderRoot = super.createRenderRoot();
      // TODO: Where are the right places to stick this?
      // Borrowed from lit-element.ts.
      // When adoptedStyleSheets are shimmed, they are inserted into the
      // shadowRoot by createRenderRoot. Adjust the renderBefore node so that
      // any styles in Lit content render before adoptedStyleSheets. This is
      // important so that adoptedStyleSheets have precedence over styles in
      // the shadowRoot.
      this._renderOptions.renderBefore ??= renderRoot!.firstChild;
    }
    return renderRoot;
  }

  protected async performUpdate() {
    // Skip first update if in non-READY(Lazy) mode.
    if (this._state < LazyState.READY && this._isFirstUpdate) {
      // Do nothing.
    } else if (this._renderer == null) {
      // Load LazyRenderer before doing actual update.
      const Clazz = await this.load();
      this._renderer = new Clazz();
    }
    super.performUpdate();
  }

  protected update(changedProperties: PropertyValues) {
    if (this._state < LazyState.READY && this._isFirstUpdate) {
      this._isFirstUpdate = false;
      return;
    }

    if (this._renderer == null) {
      // We shouldn't be here. Renderer should be loaded in performUpdate.
      return;
    }

    // We are ready to start doing actual UI updates.
    // Go through the states till READY.
    switch (this._state) {
      case LazyState.NEEDS_SHADOW_ROOT:
        this.convertShadowRoot();
      // falls through
      case LazyState.NEEDS_HYDRATION:
        this.hydrate();
      // falls through
      case LazyState.READY:
        render(
          this._renderer.render(this),
          this.renderRoot as HTMLElement,
          this._renderOptions
        );
        break;
      default:
      // Should never get here.
    }

    super.update(changedProperties);
  }

  // Overridden by user to lazily load the actual rendering code.
  abstract load(): Promise<typeof LazyRenderer>;
}
