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

  private _isFirstUpdate = true;

  private convertShadowRoot() {
    // Fill shadow root from declarative shadow dom nodes from the server.
    if (this._state !== LazyState.NEEDS_SHADOW_ROOT) {
      return;
    }
    const t = this.querySelector('template[shadowroot]');
    if (t == null) {
      // We should not be here.
      // But if we are just proceed as if we don't need hydration.
      this._state = LazyState.READY;
      return;
    }
    this.attachShadow({mode: 'open'}).appendChild(
      (t as HTMLTemplateElement).content
    );
    t.remove();
    (this as {
      renderRoot: Element | DocumentFragment;
    }).renderRoot = this.shadowRoot!;
    this._state = LazyState.NEEDS_HYDRATION;
  }

  private hydrate(updated: boolean) {
    if (this._state !== LazyState.NEEDS_HYDRATION) {
      return;
    }

    // Save current values and restore initial properties if there has been an updated.
    const currentValues: Map<String | number | symbol, unknown> = new Map();
    if (updated) {
      for (const [k] of (this.constructor as typeof ReactiveElement)
        .elementProperties!) {
        currentValues.set(k, (this as any)[k]);
        (this as any)[k] = this._initialValues.get(k);
      }
    }

    // Hydrate with initial properties.
    const result = this.render();
    hydrate(result, this.renderRoot, this._renderOptions);

    // Restore current properties.
    if (updated) {
      for (const [k] of (this.constructor as typeof ReactiveElement)
        .elementProperties!) {
        (this as any)[k] = currentValues.get(k);
      }
    }

    // TODO: Check pending events to replay
    this._state = LazyState.READY;
  }

  private onVisible() {
    // Move SSR-ed Declarative Shadow DOM nodes to shadow DOM if not already done so.
    this.convertShadowRoot();

    // Hydrate the DOM nodes - ready to respond to events.
    this.hydrate(/* updated */ false);
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

  protected update(changedProperties: PropertyValues) {
    if (this._state < LazyState.READY && this._isFirstUpdate) {
      this._isFirstUpdate = false;
      return;
    }

    // We are ready to start doing actual UI updates.
    // Go through the states till READY.
    switch (this._state) {
      case LazyState.NEEDS_SHADOW_ROOT:
        this.convertShadowRoot();
      // falls through
      case LazyState.NEEDS_HYDRATION:
        this.hydrate(/* updated */ true);
      // falls through
      case LazyState.READY:
        render(
          this.render(),
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
  protected render(): unknown {
    return noChange;
  }
}
