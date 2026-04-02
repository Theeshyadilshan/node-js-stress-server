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

// Structured Logging Helper
function log(level, message, data = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message: message,
        app: 'stress-monitor',
        ...data
    };
    console.log(JSON.stringify(logEntry));
}

// CPU Stress Management
function startCpuStress(threads) {
    stopCpuStress();
    const coreCount = os.cpus().length;
    const count = Math.min(threads, coreCount);
    
    log('info', 'Starting CPU Stress', { threads_requested: threads, threads_started: count });
    
    for (let i = 0; i < count; i++) {
        const worker = new Worker(path.join(__dirname, 'cpu-worker.js'));
        worker.postMessage('start');
        cpuWorkers.push(worker);
    }
}

function stopCpuStress() {
    if (cpuWorkers.length > 0) {
        log('info', 'Stopping CPU Stress', { threads_stopped: cpuWorkers.length });
    }
    cpuWorkers.forEach(w => w.terminate());
    cpuWorkers = [];
}

// Memory Stress Management
function allocateMemory(mb) {
    const bytes = mb * 1024 * 1024;
    try {
        const buffer = Buffer.alloc(bytes);
        for (let i = 0; i < buffer.length; i += 1024) {
            buffer[i] = 1;
        }
        memoryAllocations.push(buffer);
        log('info', 'RAM Allocated', { amount_mb: mb, total_allocations: memoryAllocations.length });
        return true;
    } catch (e) {
        log('error', 'Failed to allocate memory', { error: e.message, amount_mb: mb });
        return false;
    }
}

function clearMemory() {
    log('info', 'Memory Cleared', { previous_allocations: memoryAllocations.length });
    memoryAllocations = [];
    if (global.gc) {
        global.gc();
    }
}

// Socket Communication
io.on('connection', (socket) => {
    log('debug', 'Client connected');
    
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

// Log metrics to Loki every 10 seconds for persistent monitoring
setInterval(() => {
    osUtils.cpuUsage((v) => {
        const freeMem = os.freemem();
        const totalMem = os.totalmem();
        const usedMem = totalMem - freeMem;
        const stats = {
            cpu_usage_pct: (v * 100).toFixed(2),
            mem_usage_pct: ((usedMem / totalMem) * 100).toFixed(2),
            mem_used_bytes: usedMem,
            active_cpu_stress_threads: cpuWorkers.length,
            active_ram_allocations: memoryAllocations.length
        };
        
        // Emit for UI (every 1s)
        io.emit('metrics', {
            cpu: stats.cpu_usage_pct,
            mem: stats.mem_usage_pct,
            memBytes: usedMem,
            memTotal: totalMem,
            cpuCores: os.cpus().length
        });

        // Log for Loki (every 10 queries, roughly every 10 seconds)
        if (Date.now() % 10 == 0) { // Simple throttler
             log('info', 'System Stats Snapshot', stats);
        }
    });
}, 1000);

server.listen(PORT, () => {
    log('info', `Server started on port ${PORT}`);
});
