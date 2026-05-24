const e = require('electron');
console.log('type:', typeof e);
console.log('value:', typeof e === 'string' ? e : 'object');
if (typeof e === 'object' && e.app) {
  console.log('SUCCESS: electron.app found');
  e.app.quit();
} else {
  console.log('FAIL: electron is not the expected module');
  process.exit(1);
}
