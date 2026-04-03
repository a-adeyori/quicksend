/**
 * Vercel serverless entry: re-exports the compiled Express app from `dist/`.
 * Build must run first (`npm run build`). Do not start `app.listen` here — handled in src/index.ts.
 */
const app = require('../dist/index').default;
module.exports = app;
