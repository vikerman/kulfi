import Koa from 'koa';

const PORT = 8000;

export function createApp(routes: {[key: string]: any}) {
  const app = new Koa();

  return app;
}
