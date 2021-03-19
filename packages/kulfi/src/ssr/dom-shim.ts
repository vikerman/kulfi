// Copied from https://github.com/Polymer/lit-html/blob/lit-next/packages/lit-ssr/src/lib/dom-shim.ts

/* eslint-disable class-methods-use-this */
/* eslint-disable no-console */
import fetch from 'node-fetch';
import {createRequire} from 'module';

// eslint-disable-next-line no-use-before-define
const attributes: WeakMap<HTMLElement, Map<string, string>> = new WeakMap();
// eslint-disable-next-line no-use-before-define
const attributesForElement = (element: HTMLElement) => {
  let attrs = attributes.get(element);
  if (!attrs) {
    attributes.set(element, (attrs = new Map()));
  }
  return attrs;
};

class Element {}

abstract class HTMLElement extends Element {
  get attributes() {
    return Array.from(attributesForElement(this)).map(([name, value]) => ({
      name,
      value,
    }));
  }

  abstract attributeChangedCallback?(
    name: string,
    old: string | null,
    value: string | null
  ): void;

  setAttribute(name: string, value: string) {
    attributesForElement(this).set(name, value);
  }

  removeAttribute(name: string) {
    attributesForElement(this).delete(name);
  }

  hasAttribute(name: string) {
    return attributesForElement(this).has(name);
  }

  attachShadow() {
    return {host: this};
  }

  getAttribute(name: string) {
    const value = attributesForElement(this).get(name);
    return value === undefined ? null : value;
  }
}

interface CustomHTMLElement {
  new (): HTMLElement;
  observedAttributes?: string[];
}

class ShadowRoot {}

class Document {
  get adoptedStyleSheets() {
    return [];
  }

  createTreeWalker() {
    return {};
  }
}

class CSSStyleSheet {
  replace() {}
}

type CustomElementRegistration = {
  ctor: {new (): HTMLElement};
  observedAttributes: string[];
};

class CustomElementRegistry {
  __definitions = new Map<string, CustomElementRegistration>();

  define(name: string, ctor: CustomHTMLElement) {
    this.__definitions.set(name, {
      ctor,
      observedAttributes: (ctor as CustomHTMLElement).observedAttributes ?? [],
    });
  }

  get(name: string) {
    const definition = this.__definitions.get(name);
    return definition && definition.ctor;
  }
}

const window = {
  Element,
  HTMLElement,
  Document,
  document: new Document(),
  CSSStyleSheet,
  ShadowRoot,
  customElements: new CustomElementRegistry(),
  btoa(s: string) {
    return Buffer.from(s, 'binary').toString('base64');
  },
  fetch: (url: URL, init: {}) => fetch(url, init),

  // Without VM modules we have to allow async tasks or
  // other server stuff might break.
  // No-op any async tasks
  // requestAnimationFrame() {},
  // setTimeout() {},
  // clearTimeout() {},

  // Required for node-fetch
  Buffer,

  // Set below
  window: undefined as unknown,
  global: undefined as unknown,

  // Global require for CJS modules.
  require: createRequire(import.meta.url),

  JSCompiler_renameProperty: <P extends PropertyKey>(
    prop: P,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _obj: unknown
  ): P => prop,
};

window.window = window;
window.global = window; // Required for node-fetch

Object.assign(global, window);
