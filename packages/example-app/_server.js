import * as p0 from './js/pages/index.js';
import * as p1 from './js/pages/about.js';
import * as p2 from './js/pages/about/more.js';
import * as p3 from './js/pages/items/[id].js';
import * as d3 from './js/pages/items/[id].data.js';
import * as p4 from './js/pages/items/[id]/name.js';
import * as p5 from './js/pages/items/[id]/part.js';
import * as p6 from './js/pages/items/[id]/part/[num].js';

import * as _shell from './js/pages/_shell.js';

const ROUTES = {
  _shell,
  '/': p0,
  '/about': p1,
  '/about/more': p2,
  '/items/[id]': [p3, d3],
  '/items/[id]/name': p4,
  '/items/[id]/part': p5,
  '/items/[id]/part/[num]': p6,
};

runServer(ROUTES);
