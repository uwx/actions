/* istanbul ignore file - this file is used purely as an entry-point */

import('source-map-support').then(e => e.install()); // happens instantly in rollup

import { main } from './';

main({
  log: console,
  env: process.env,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
