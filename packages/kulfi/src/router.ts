import {ReactiveController} from '@lit/reactive-element';
import {provide} from './inject.js';

export interface Router {
  getController(element: HTMLElement, attr: string): ReactiveController;
}

class RouterController implements ReactiveController {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private element: HTMLElement,
    private attr: string,
    // eslint-disable-next-line no-use-before-define
    private router: RouterImpl
  ) {
    /* empty */
  }

  hostDisconnected() {
    this.router._removeController(this);
  }

  /** @internal */
  _update(path: string) {
    this.element.setAttribute(this.attr, path);
  }
}

class RouterImpl implements Router {
  private readonly controllerList: RouterController[] = [];

  getController(element: HTMLElement, attr: string): ReactiveController {
    const c = new RouterController(element, attr, this);
    this.controllerList.push(c);
    return c;
  }

  /** @internal */
  _removeController(r: RouterController) {
    const i = this.controllerList.indexOf(r);
    if (i >= 0) {
      this.controllerList.splice(i, 1);
    }
  }

  /** @internal */
  _update(path: string) {
    this.controllerList.forEach(c => c._update(path));
  }
}

// Create and provide the router instance to the injector.
const router = new RouterImpl();
provide('ROUTER', router);

function replaceHead(head: string) {
  const walker = document.createTreeWalker(
    document.head,
    NodeFilter.SHOW_COMMENT,
    null
  );
  let startComment: Node | null = walker.currentNode;
  while (
    startComment &&
    !(startComment instanceof Comment && startComment.textContent === 'HEAD')
  ) {
    startComment = walker.nextNode();
  }
  if (startComment) {
    let nextNode = startComment.nextSibling;
    while (
      nextNode &&
      !(nextNode instanceof Comment && nextNode.textContent === '/HEAD')
    ) {
      const t = nextNode;
      nextNode = startComment.nextSibling;
      t.remove();
    }
    const fragment: Document = new DOMParser().parseFromString(
      head,
      'text/html'
    );
    while (fragment.head.childNodes.length > 0) {
      const newNode = document.adoptNode(fragment.head.childNodes.item(0));
      if (nextNode) {
        startComment.parentNode?.insertBefore(newNode, nextNode);
      } else {
        startComment.parentNode?.appendChild(newNode);
      }
    }
  }
}

let pageRoot: Element | null = null;
function replacePage(page: string) {
  pageRoot = pageRoot || document.querySelector('#__page__');
  if (!pageRoot) {
    return;
  }
  const fragment: Document = (new DOMParser().parseFromString as any)(
    page,
    'text/html',
    {
      includeShadowRoots: true,
    }
  );
  const newPage = document.createElement('div');
  while (fragment.body.childNodes.length > 0) {
    newPage.appendChild(document.adoptNode(fragment.body.childNodes.item(0)));
  }
  // TODO: what's the fastest way to clear contents of an element?
  while (pageRoot.children.length > 0) {
    pageRoot.firstChild?.remove();
  }
  pageRoot.appendChild(newPage);

  // Script tags inserted with innerHTML are not loaded.
  // Support only script tags that load JS and not inline JS.
  // Activate all script tags by reinserting an active clone
  // (and removing the older one).
  newPage.querySelectorAll('script').forEach(s => {
    const newScript = document.createElement('script');
    if (s.src) {
      newScript.src = s.src;
      newScript.type = s.type;
      newScript.async = true;

      s.parentElement?.insertAdjacentElement('afterend', newScript);
      s.remove();
    }
  });
}

async function locationUpdated(location: Location) {
  // Fetch the page data for the new page.
  let path = location.pathname;
  if (path.endsWith('/index.html')) {
    path = path.substring(0, path.length - 11);
  }
  if (path.endsWith('/')) {
    path = path.substring(0, path.length - 1);
  }
  const data = await (
    await fetch(new URL(`${path}/index.json`, location.origin).toString())
  ).json();

  replaceHead(data.head);
  replacePage(data.page);

  // Convert to ShadowDOM for elements that don't have definition loaded yet.
  (window as any)['convertShadowRoot']();

  // Update the Router and RouterController
  router._update(path === '' ? '/' : path);
}

// Copied from https://github.com/Polymer/pwa-helpers/blob/master/src/router.ts
document.body.addEventListener('click', e => {
  if (
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey
  ) {
    return;
  }

  const anchor = e
    .composedPath()
    .filter(n => (n as HTMLElement).tagName === 'A')[0] as
    | HTMLAnchorElement
    | undefined;
  if (
    !anchor ||
    anchor.target ||
    anchor.hasAttribute('download') ||
    anchor.getAttribute('rel') === 'external'
  ) {
    return;
  }

  const {href} = anchor;
  if (!href || href.indexOf('mailto:') !== -1) {
    return;
  }

  const {location} = window;
  const origin = location.origin || `${location.protocol}//${location.host}`;
  if (href.indexOf(origin) !== 0) {
    return;
  }

  e.preventDefault();

  if (href !== location.href) {
    window.history.pushState({}, '', href);
    locationUpdated(location);
  }
});

window.addEventListener('popstate', () => locationUpdated(window.location));
