const { parentPort } = require('worker_threads');

// Intensive calculation to pin the CPU core
function stress() {
  let count = 0;
  while (true) {
    count++;
    if (count > 1000000000) count = 0;
  }
}

parentPort.on('message', (msg) => {
  if (msg === 'start') {
    stress();
  }
});
