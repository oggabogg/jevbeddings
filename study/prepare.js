import { downloadData, loadSplit } from './data.js';
const manifest = await downloadData();
const train = loadSplit('train');
console.log(JSON.stringify({ manifest, train_count: train.length, labels: [...new Set(train.map(r => r.label))].sort(), test_downloaded: false }, null, 2));
