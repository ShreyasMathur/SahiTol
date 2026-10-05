import { config } from './config.js';
import { createApp } from './app.js';
import { prepareFirstRunSetup } from './setup.js';

prepareFirstRunSetup();

createApp().listen(config.port, () => {
  console.log(`NAWI API listening on http://localhost:${config.port}`);
});
