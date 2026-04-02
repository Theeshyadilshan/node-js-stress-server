const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const osUtils = require('os-utils');
const { Worker } = require('worker_threads');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let cpuWorkers = [];
let memoryAllocations = [];

// CPU Stress Management
function startCpuStress(threads) {
    stopCpuStress();
    const coreCount = os.cpus().length;
    const count = Math.min(threads, coreCount);
    
    for (let i = 0; i < count; i++) {
        const worker = new Worker(path.join(__dirname, 'cpu-worker.js'));
        worker.postMessage('start');
        cpuWorkers.push(worker);
    }
}

function stopCpuStress() {
    cpuWorkers.forEach(w => w.terminate());
    cpuWorkers = [];
}

// Memory Stress Management
function allocateMemory(mb) {
    const bytes = mb * 1024 * 1024;
    try {
        const buffer = Buffer.alloc(bytes);
        // Fill buffer to actually use memory
        for (let i = 0; i < buffer.length; i += 1024) {
            buffer[i] = 1;
        }
        memoryAllocations.push(buffer);
        return true;
    } catch (e) {
        console.error('Failed to allocate memory:', e);
        return false;
    }
}

function clearMemory() {
    memoryAllocations = [];
    if (global.gc) {
        global.gc();
    }
}

// Socket Communication
io.on('connection', (socket) => {
    console.log('Client connected');
    
    socket.on('start-cpu', (data) => {
        startCpuStress(data.threads);
        io.emit('status', { cpuActive: true, threadCount: cpuWorkers.length });
    });
    
    socket.on('stop-cpu', () => {
        stopCpuStress();
        io.emit('status', { cpuActive: false, threadCount: 0 });
    });
    
    socket.on('allocate-ram', (data) => {
        const success = allocateMemory(data.mb);
        io.emit('status', { ramAllocated: memoryAllocations.length > 0, totalMb: memoryAllocations.length * data.mb, success });
    });
    
    socket.on('clear-ram', () => {
        clearMemory();
        io.emit('status', { ramAllocated: false, totalMb: 0 });
    });
});

// Broadcast metrics every second
setInterval(() => {
    osUtils.cpuUsage((v) => {
        const freeMem = os.freemem();
        const totalMem = os.totalmem();
        const usedMem = totalMem - freeMem;
        
        io.emit('metrics', {
            cpu: (v * 100).toFixed(2),
            mem: ((usedMem / totalMem) * 100).toFixed(2),
            memBytes: usedMem,
            memTotal: totalMem,
            cpuCores: os.cpus().length
        });
    });
}, 1000);

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
