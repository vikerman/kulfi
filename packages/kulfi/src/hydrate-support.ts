/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
import {PropertyValues, ReactiveElement} from '@lit/reactive-element';
import {render} from 'lit-html';
import {hydrate} from 'lit-html/hydrate.js';

// Different Lazy states LazyElement takes before being in
// regularly renderable READY state.
const enum ElementState {
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

interface PatchableLitElement extends HTMLElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-new
  new (...args: any[]): PatchableLitElement;
  createRenderRoot(): Element | ShadowRoot;
  renderRoot: Element | ShadowRoot;
  render(): unknown;
  _$isFirstUpdate: boolean;
  _$eagerHydration: boolean;
  _$state: ElementState;
  _$initialValues: Map<String | number | Symbol, unknown>;
  _$saveInitialPropertyValues(): void;
  _$onVisible(): void;
  _$convertShadowRoot(): void;
  _$hydrate(updated: boolean): void;
  _$initialize(): void;
}

let observer: IntersectionObserver;
function setupIntersectionObserver(el: PatchableLitElement) {
  if (observer == null) {
    observer = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          (e.target as PatchableLitElement)?._$onVisible();
          observer?.unobserve(e.target);
        }
      }
    }, INTERSECTION_CONFIG);
  }
  observer.observe(el);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)['litElementHydrateSupport'] = ({
  LitElement,
}: {
  LitElement: PatchableLitElement;
}) => {
  LitElement.prototype._$initialize = function (this: PatchableLitElement) {
    this._$initialValues = new Map();
    this._$isFirstUpdate = true;
    this._$eagerHydration = this.getAttribute('data-eager') != null;

    if (this._$state < ElementState.READY) {
      if (!window.IntersectionObserver) {
        // If IntersectionObserver is not available or polyfilled
        // just hydrate on first update.
        this._$eagerHydration = true;
      } else if (!this._$eagerHydration) {
        // Setup first level loading based on visibility.
        setupIntersectionObserver(this);
      }

      // Store initial attribute values for lazy hydration.
      this._$saveInitialPropertyValues();
    }
  };

  LitElement.prototype._$saveInitialPropertyValues = function (
    this: PatchableLitElement
  ) {
    for (const [k] of (this.constructor as typeof ReactiveElement)
      .elementProperties!) {
      this._$initialValues.set(k, (this as any)[k]);
    }
  };

  LitElement.prototype._$convertShadowRoot = function (
    this: PatchableLitElement
  ) {
    // Fill shadow root from declarative shadow dom nodes from the server.
    if (this._$state !== ElementState.NEEDS_SHADOW_ROOT) {
      return;
    }
    const t = this.querySelector('template[shadowroot]');
    if (t == null) {
      // We should not be here.
      // But if we are just proceed as if we don't need hydration.
      this._$state = ElementState.READY;
      return;
    }
    this.attachShadow({mode: 'open'}).appendChild(
      (t as HTMLTemplateElement).content
    );
    t.remove();
    (this as {
      renderRoot: Element | DocumentFragment;
    }).renderRoot = this.shadowRoot!;
    this._$state = ElementState.NEEDS_HYDRATION;
  };

  LitElement.prototype._$hydrate = function (
    this: PatchableLitElement,
    updated: boolean
  ) {
    if (this._$state !== ElementState.NEEDS_HYDRATION) {
      return;
    }

    // Save current values and restore initial properties if there has been an updated.
    const currentValues: Map<String | number | symbol, unknown> = new Map();
    if (updated) {
      for (const [k] of (this.constructor as typeof ReactiveElement)
        .elementProperties!) {
        currentValues.set(k, (this as any)[k]);
        (this as any)[k] = this._$initialValues.get(k);
      }
    }

    // Hydrate with initial properties.
    const result = this.render();
    hydrate(result, this.renderRoot, {host: this});

    // Restore current properties.
    if (updated) {
      for (const [k] of (this.constructor as typeof ReactiveElement)
        .elementProperties!) {
        (this as any)[k] = currentValues.get(k);
      }
    }

    // TODO: Check pending events to replay
    this._$state = ElementState.READY;
  };

  LitElement.prototype._$onVisible = function (this: PatchableLitElement) {
    // Move SSR-ed Declarative Shadow DOM nodes to shadow DOM if not already done so.
    this._$convertShadowRoot();

    // Hydrate the DOM nodes - ready to respond to events.
    this._$hydrate(/* updated */ false);
  };

  // Capture whether we need hydration or not
  const {createRenderRoot, disconnectedCallback} = LitElement.prototype;
  LitElement.prototype.createRenderRoot = function (this: PatchableLitElement) {
    let renderRoot: Element | ShadowRoot;
    if (this.firstElementChild?.tagName === 'TEMPLATE') {
      this._$state = ElementState.NEEDS_SHADOW_ROOT;
      // Just return `this` for now and create actual shadowroot later.
      renderRoot = this;
    } else if (this.shadowRoot) {
      this._$state = ElementState.NEEDS_HYDRATION;
      renderRoot = this.shadowRoot;
    } else {
      this._$state = ElementState.READY;
      renderRoot = createRenderRoot.call(this);
    }

    this._$initialize();

    return renderRoot;
  };

  LitElement.prototype.disconnectedCallback = function (
    this: PatchableLitElement
  ) {
    if (disconnectedCallback) {
      disconnectedCallback.call(this);
    }
    if (observer) {
      observer.unobserve(this);
    }
  };

  // Hydrate on first update when needed
  LitElement.prototype.update = function (
    this: PatchableLitElement,
    changedProperties: PropertyValues
  ) {
    // Since this is a patch, we can't call super.update()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ReactiveElement.prototype as any).update.call(this, changedProperties);

    if (this._$state < ElementState.READY && this._$isFirstUpdate) {
      this._$isFirstUpdate = false;
      if (!this._$eagerHydration) {
        return;
      }
    }

    // We are ready to start doing actual UI updates.
    // Go through the states till READY.
    switch (this._$state) {
      case ElementState.NEEDS_SHADOW_ROOT:
        this._$convertShadowRoot();
      // falls through
      case ElementState.NEEDS_HYDRATION:
        this._$hydrate(/* updated */ true);
        if (this._$eagerHydration) {
          this._$eagerHydration = false;
          return;
        }
      // falls through
      case ElementState.READY:
        render(this.render(), this.renderRoot as HTMLElement, {host: this});
        break;
      default:
      // Should never get here.
    }
  };
};
