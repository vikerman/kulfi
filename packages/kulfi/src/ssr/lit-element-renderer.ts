/* eslint-disable import/order */
/**
 * @license
 * Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {ElementRenderer} from './element-renderer.js';
import {LitElement, CSSResult, ReactiveElement} from 'lit';
import {_Φ} from 'lit-element/private-ssr-support.js';
import {render, renderValue, RenderInfo} from './render-lit-html.js';

export type Constructor<T> = {new (): T};

const {attributeToProperty, changedProperties} = _Φ;

/**
 * ElementRenderer implementation for LitElements
 */
export class LitElementRenderer extends ElementRenderer {
  constructor(public element: LitElement) {
    super(element);
  }

  connectedCallback() {
    // Call LitElement's `willUpdate` method.
    // Note, this method is required not to use DOM APIs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.element as any)?.willUpdate(changedProperties(this.element as any));
    // Reflect properties to attributes by calling into ReactiveElement's
    // update, which _only_ reflects attributes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ReactiveElement.prototype as any).update.call(this.element);
  }

  attributeChangedCallback(
    name: string,
    _old: string | null,
    value: string | null
  ) {
    attributeToProperty(this.element as LitElement, name, value);
  }

  *renderShadow(): IterableIterator<string> {
    // Render styles.
    const styles = (this.element.constructor as typeof LitElement)
      .elementStyles;
    if (styles !== undefined && styles.length > 0) {
      yield '<style>';
      for (const style of styles) {
        yield (style as CSSResult).cssText;
      }
      yield '</style>';
    }
    // Render template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yield* render((this.element as any).render());
  }

  *renderLight(renderInfo: RenderInfo): IterableIterator<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (this.element as any)?.renderLight();
    if (value) {
      yield* renderValue(value, renderInfo);
    } else {
      yield '';
    }
  }
}
