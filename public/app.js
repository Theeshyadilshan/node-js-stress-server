const socket = io();

// ApexCharts Configuration
const chartOptions = {
    series: [{
        name: 'Usage',
        data: Array(20).fill(0)
    }],
    chart: {
        height: 250,
        type: 'area',
        toolbar: { show: false },
        animations: {
            enabled: true,
            easing: 'linear',
            dynamicAnimation: { speed: 800 }
        },
        background: 'transparent'
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    grid: { borderColor: 'rgba(255, 255, 255, 0.05)', strokeDashArray: 5 },
    xaxis: { 
        labels: { show: false }, 
        axisBorder: { show: false }, 
        axisTicks: { show: false },
        crosshairs: { show: false }
    },
    yaxis: { 
        min: 0, 
        max: 100, 
        labels: { style: { colors: '#94a3b8' } },
        crosshairs: { show: false }
    },
    colors: ['#4f46e5'],
    markers: { 
        size: 0,
        hover: {
            size: 5,
            sizeOffset: 3
        }
    },
    tooltip: {
        theme: 'dark',
        shared: false,
        intersect: false,
        followCursor: true,
        x: { show: false },
        marker: { show: false },
        y: {
            formatter: (val) => val + "%"
        }
    },
    fill: {
        type: 'gradient',
        gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.45,
            opacityTo: 0.05,
            stops: [20, 100, 100, 100]
        }
    }
};

const cpuChart = new ApexCharts(document.querySelector("#cpu-chart"), {
    ...chartOptions,
    colors: ['#8b5cf6']
});

const memChart = new ApexCharts(document.querySelector("#mem-chart"), {
    ...chartOptions,
    colors: ['#ec4899']
});

cpuChart.render();
memChart.render();

// DOM Elements
const cpuPercent = document.getElementById('cpu-percent');
const memPercent = document.getElementById('mem-percent');
const coreCountDisplay = document.getElementById('core-count');
const activeStatus = document.getElementById('active-status');
const cpuThreadsInput = document.getElementById('cpu-threads');
const ramAmountInput = document.getElementById('ram-amount');

// Update UI on metrics
socket.on('metrics', (data) => {
    cpuPercent.innerText = `${data.cpu}%`;
    memPercent.innerText = `${data.mem}%`;
    coreCountDisplay.innerText = data.cpuCores;
    
    // Update charts
    const cpuData = [...cpuChart.w.config.series[0].data];
    cpuData.push(parseFloat(data.cpu));
    if (cpuData.length > 20) cpuData.shift();
    cpuChart.updateSeries([{ data: cpuData }]);
    
    const memData = [...memChart.w.config.series[0].data];
    memData.push(parseFloat(data.mem));
    if (memData.length > 20) memData.shift();
    memChart.updateSeries([{ data: memData }]);
    
    // Update status color if high load
    if (parseFloat(data.cpu) > 80 || parseFloat(data.mem) > 90) {
        activeStatus.innerText = 'High Stress';
        activeStatus.style.background = 'rgba(239, 68, 68, 0.1)';
        activeStatus.style.color = '#ef4444';
    } else {
        activeStatus.innerText = 'System Stable';
        activeStatus.style.background = 'rgba(34, 197, 94, 0.1)';
        activeStatus.style.color = '#22c55e';
    }
});

// Event Listeners
document.getElementById('start-cpu').addEventListener('click', () => {
    socket.emit('start-cpu', { threads: parseInt(cpuThreadsInput.value) });
});

document.getElementById('stop-cpu').addEventListener('click', () => {
    socket.emit('stop-cpu');
});

document.getElementById('allocate-ram').addEventListener('click', () => {
    socket.emit('allocate-ram', { mb: parseInt(ramAmountInput.value) });
});

document.getElementById('clear-ram').addEventListener('click', () => {
    socket.emit('clear-ram');
});

socket.on('status', (data) => {
    console.log('Status update:', data);
});
