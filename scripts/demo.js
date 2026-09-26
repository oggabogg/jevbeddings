import { Store } from '../src/store.js';
import { seedFixtures } from '../fixtures/support.js';
import { createApp } from '../src/server.js';
import { JevClient } from '../src/jev.js';

const store = new Store(':memory:');
seedFixtures(store);
const server = createApp({ store, client: new JevClient({ apiKey: '' }), demo: true });
server.listen(3211, '127.0.0.1', () => console.log('Offline fixture demo: http://127.0.0.1:3211 — scores are authored labels, not JEV predictions.'));
