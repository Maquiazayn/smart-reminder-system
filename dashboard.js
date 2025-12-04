// dashboard.js - COMPLETE DASHBOARD WITH MULTIPLE CHARTS
// For Arduino ESP32 with device ID: smart-plant-reminder

const FIREBASE_CONFIG = {
    databaseURL: "https://smart-plant-watering-e2811-default-rtdb.firebaseio.com"
};

// Global variables
let currentDeviceId = "smart-plant-reminder";
let records = [];
let allHistoryData = []; // Store all historical data
let currentData = null;
let moistureGauge = null;
let moistureHistoryChart = null;
let temperatureHistoryChart = null;
let humidityHistoryChart = null;
let countdownInterval = null;
let currentCountdown = 10;
let updateInterval = null;

// Chart configurations
let chartRanges = {
    moisture: 10, // minutes
    temperature: 10,
    humidity: 10
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🌱 Dashboard loading with multiple charts...");
    initializeDashboard();
});

function initializeDashboard() {
    // Set device ID
    currentDeviceId = "smart-plant-reminder";
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Update displays
    updateElement('deviceId', currentDeviceId);
    updateElement('refreshDeviceId', currentDeviceId);
    
    // Hide loading
    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }, 500);
    
    // Initialize all charts
    initializeGauge();
    initializeHistoryCharts();
    
    // Setup events
    setupEventListeners();
    
    // Initial data fetch
    fetchLiveData();
    fetchHistoryData(); // Get historical data for charts
    
    // Auto refresh every 10 seconds
    startAutoRefresh();
    
    // Countdown timer
    startCountdownTimer();
    
    console.log("✅ Dashboard initialized with 3 charts");
}

// ==================== FIREBASE DATA FETCHING ====================
async function fetchLiveData() {
    try {
        const firebasePath = `/plants/${currentDeviceId}/latest.json`;
        const url = `${FIREBASE_CONFIG.databaseURL}${firebasePath}?t=${Date.now()}`;
        
        console.log("📡 Fetching:", url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data) {
            showNoDataWarning();
            return;
        }
        
        console.log("✅ Live data:", data);
        processArduinoData(data);
        resetCountdown();
        
    } catch (error) {
        console.error("❌ Fetch error:", error);
        showConnectionError();
    }
}

async function fetchHistoryData() {
    try {
        // Fetch last 50 records for charts
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/history.json?orderBy="$key"&limitToLast=50`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data) {
            // Convert to array and sort
            const historyArray = Object.keys(data).map(key => ({
                timestamp: new Date(data[key].timestamp || Date.now()),
                moisture: parseFloat(data[key].moisture) || 0,
                temperature: parseFloat(data[key].temperature) || 0,
                humidity: parseFloat(data[key].humidity) || 0,
                status: data[key].status || "UNKNOWN"
            }));
            
            // Sort by timestamp
            historyArray.sort((a, b) => a.timestamp - b.timestamp);
            
            // Store in global variable
            allHistoryData = historyArray;
            
            // Update all charts
            updateAllCharts();
        }
    } catch (error) {
        console.log("History fetch error:", error);
    }
}

function processArduinoData(data) {
    // Extract Arduino fields
    let moisture = data.moisture !== undefined ? parseFloat(data.moisture) : 50;
    let temperature = data.temperature !== undefined ? parseFloat(data.temperature) : 25.00;
    let humidity = data.humidity !== undefined ? parseFloat(data.humidity) : 50.00;
    let rawValue = data.raw_value !== undefined ? parseInt(data.raw_value) : 2000;
    let status = data.status || "UNKNOWN";
    
    // Clamp values
    moisture = Math.max(0, Math.min(100, moisture));
    
    const processedData = {
        moisture: moisture,
        temperature: temperature,
        humidity: humidity,
        rawValue: rawValue,
        status: status,
        deviceId: currentDeviceId,
        timestamp: new Date()
    };
    
    console.log("📊 Processed:", processedData);
    
    // Update dashboard
    updateDashboard(processedData);
    
    // Add to records
    addToRecords(processedData);
    
    // Add to history data for charts
    addToHistoryData(processedData);
    
    // Update charts
    updateGauge(moisture);
    updateAllCharts();
    
    showNotification("Data updated", "success");
}

function addToHistoryData(data) {
    // Add new data point
    const historyPoint = {
        timestamp: data.timestamp,
        moisture: data.moisture,
        temperature: data.temperature,
        humidity: data.humidity
    };
    
    allHistoryData.push(historyPoint);
    
    // Keep only last 100 points
    if (allHistoryData.length > 100) {
        allHistoryData.shift();
    }
}

// ==================== CHARTS INITIALIZATION ====================
function initializeGauge() {
    const canvas = document.getElementById('moistureGauge');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    moistureGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [50, 50],
                backgroundColor: ['#4CAF50', '#e9ecef'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        },
        options: {
            cutout: '75%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

function initializeHistoryCharts() {
    // Initialize Moisture History Chart
    const moistureCanvas = document.getElementById('moistureHistoryChart');
    if (moistureCanvas) {
        const ctx = moistureCanvas.getContext('2d');
        
        moistureHistoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Moisture %',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointBackgroundColor: '#667eea'
                }]
            },
            options: getChartOptions('Moisture (%)', '%')
        });
    }
    
    // Initialize Temperature History Chart
    const tempCanvas = document.getElementById('temperatureHistoryChart');
    if (tempCanvas) {
        const ctx = tempCanvas.getContext('2d');
        
        temperatureHistoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Temperature °C',
                    data: [],
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointBackgroundColor: '#ff6b6b'
                }]
            },
            options: getChartOptions('Temperature (°C)', '°C')
        });
    }
    
    // Initialize Humidity History Chart
    const humidityCanvas = document.getElementById('humidityHistoryChart');
    if (humidityCanvas) {
        const ctx = humidityCanvas.getContext('2d');
        
        humidityHistoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Humidity %',
                    data: [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointBackgroundColor: '#4CAF50'
                }]
            },
            options: getChartOptions('Humidity (%)', '%')
        });
    }
}

function getChartOptions(title, unit) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}${unit}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { 
                    callback: value => value + unit,
                    font: { size: 11 }
                }
            },
            x: {
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { 
                    maxTicksLimit: 8,
                    font: { size: 10 },
                    callback: function(value, index, values) {
                        if (this.getLabelForValue(value)) {
                            const date = new Date(this.getLabelForValue(value));
                            return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        }
                        return '';
                    }
                }
            }
        }
    };
}

// ==================== CHARTS UPDATES ====================
function updateAllCharts() {
    updateChart('moisture', moistureHistoryChart);
    updateChart('temperature', temperatureHistoryChart);
    updateChart('humidity', humidityHistoryChart);
}

function updateChart(type, chart) {
    if (!chart || allHistoryData.length === 0) return;
    
    const minutes = chartRanges[type] || 10;
    const cutoffTime = new Date(Date.now() - minutes * 60000);
    
    // Filter data based on time range
    const filteredData = allHistoryData.filter(point => 
        point.timestamp >= cutoffTime
    );
    
    // Prepare labels and data
    const labels = filteredData.map(point => 
        point.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})
    );
    
    const data = filteredData.map(point => {
        if (type === 'moisture') return point.moisture;
        if (type === 'temperature') return point.temperature;
        if (type === 'humidity') return point.humidity;
        return 0;
    });
    
    // Update chart
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
}

// Global function for chart range updates
window.updateChartRange = function(chartType, minutes) {
    chartRanges[chartType] = minutes;
    updateChart(chartType, getChartInstance(chartType));
};

function getChartInstance(type) {
    switch(type) {
        case 'moisture': return moistureHistoryChart;
        case 'temperature': return temperatureHistoryChart;
        case 'humidity': return humidityHistoryChart;
        default: return null;
    }
}

function updateGauge(percentage) {
    if (!moistureGauge) return;
    
    let gaugeColor;
    if (percentage < 20) gaugeColor = '#ff6b6b';
    else if (percentage < 35) gaugeColor = '#ffa94d';
    else if (percentage < 65) gaugeColor = '#4CAF50';
    else if (percentage < 85) gaugeColor = '#339af0';
    else gaugeColor = '#228be6';
    
    moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
    moistureGauge.data.datasets[0].backgroundColor = [gaugeColor, '#e9ecef'];
    moistureGauge.update();
}

// ==================== UI UPDATES ====================
function updateDashboard(data) {
    // Current Plant Status
    updateElement('moisturePercent', `${data.moisture.toFixed(1)}%`);
    updateElement('statusIndicator', data.status);
    updateStatusColor(data.status);
    
    // Environment
    updateElement('temperature', `${data.temperature.toFixed(2)}°C`);
    updateElement('humidity', `${data.humidity.toFixed(2)}%`);
    updateElement('rawValue', data.rawValue);
    
    // Update count
    const countEl = document.getElementById('updateCount');
    if (countEl) {
        const currentCount = parseInt(countEl.textContent) || 0;
        countEl.textContent = currentCount + 1;
    }
    
    // Timestamp
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    updateElement('lastUpdate', timeStr);
    
    currentData = data;
}

function updateStatusColor(status) {
    const statusEl = document.getElementById('statusIndicator');
    if (!statusEl) return;
    
    statusEl.className = 'status-indicator';
    
    const statusUpper = status.toUpperCase();
    if (statusUpper.includes("NEED WATER")) {
        statusEl.classList.add('status-need-water');
    } else if (statusUpper.includes("LOW")) {
        statusEl.classList.add('status-low');
    } else if (statusUpper.includes("OK")) {
        statusEl.classList.add('status-ok');
    } else if (statusUpper.includes("MOIST")) {
        statusEl.classList.add('status-moist');
    } else if (statusUpper.includes("TOO WET")) {
        statusEl.classList.add('status-too-wet');
    } else {
        statusEl.classList.add('status-unknown');
    }
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

// ==================== RECORDS TABLE ====================
function addToRecords(data) {
    const record = {
        timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }),
        moisture: data.moisture,
        temperature: data.temperature,
        humidity: data.humidity,
        status: data.status,
        rawValue: data.rawValue
    };
    
    records.unshift(record);
    
    if (records.length > 10) {
        records.pop();
    }
    
    updateRecordsTable();
}

function updateRecordsTable() {
    const tableBody = document.getElementById('recordsTableBody');
    if (!tableBody) return;
    
    if (records.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 30px; color: #718096;">
                    Waiting for Arduino data...
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    records.forEach(record => {
        let moistureClass = '';
        let statusClass = '';
        
        if (record.moisture < 20) {
            moistureClass = 'water-level-low';
            statusClass = 'status-need-water-badge';
        } else if (record.moisture < 35) {
            moistureClass = 'water-level-low';
            statusClass = 'status-low-badge';
        } else if (record.moisture < 65) {
            moistureClass = 'water-level-ok';
            statusClass = 'status-ok-badge';
        } else if (record.moisture < 85) {
            moistureClass = 'water-level-moist';
            statusClass = 'status-moist-badge';
        } else {
            moistureClass = 'water-level-high';
            statusClass = 'status-too-wet-badge';
        }
        
        html += `
            <tr>
                <td class="timestamp-col">${record.timestamp}</td>
                <td class="percent-col ${moistureClass}">${record.moisture.toFixed(1)}%</td>
                <td class="value-col">${record.temperature.toFixed(2)}°C</td>
                <td class="percent-col">${record.humidity.toFixed(2)}%</td>
                <td class="status-col">
                    <span class="status-badge ${statusClass}">${record.status}</span>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    updateElement('recordCount', records.length);
}

// ==================== TIMER FUNCTIONS ====================
function startCountdownTimer() {
    if (countdownInterval) clearInterval(countdownInterval);
    
    currentCountdown = 10;
    updateCountdownDisplay();
    
    countdownInterval = setInterval(() => {
        currentCountdown--;
        updateCountdownDisplay();
        
        if (currentCountdown <= 0) {
            fetchLiveData();
            currentCountdown = 10;
        }
    }, 1000);
}

function resetCountdown() {
    currentCountdown = 10;
    updateCountdownDisplay();
}

function updateCountdownDisplay() {
    updateElement('countdownValue', currentCountdown);
    updateElement('refreshCountdown', `Next refresh in: ${currentCountdown} seconds`);
}

function startAutoRefresh() {
    if (updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(() => {
        fetchLiveData();
    }, 10000);
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Export CSV
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
    
    // Manual refresh
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchLiveData();
            showNotification("Manual refresh", "info");
        });
    }
}

// ==================== EXPORT FUNCTION ====================
function exportToCSV() {
    if (records.length === 0) {
        showNotification("No data to export", "warning");
        return;
    }
    
    const headers = ["Timestamp", "Moisture (%)", "Temperature (°C)", "Humidity (%)", "Status", "Raw Value"];
    const rows = records.map(record => [
        `"${record.timestamp}"`,
        record.moisture.toFixed(1),
        record.temperature.toFixed(2),
        record.humidity.toFixed(2),
        `"${record.status}"`,
        record.rawValue
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = `plant-data-${currentDeviceId}-${new Date().toISOString().slice(0,10)}.csv`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Exported ${records.length} records`, "success");
}

// ==================== ERROR HANDLING ====================
function showNoDataWarning() {
    updateElement('moisturePercent', '--%');
    updateElement('statusIndicator', 'NO DATA');
    updateElement('temperature', '--°C');
    updateElement('humidity', '--%');
    updateElement('rawValue', '--');
    
    const statusEl = document.getElementById('statusIndicator');
    if (statusEl) statusEl.className = 'status-indicator status-unknown';
    
    showNotification("No data from Arduino", "warning");
}

function showConnectionError() {
    updateElement('moisturePercent', 'ERR');
    updateElement('statusIndicator', 'CONNECTION ERROR');
    updateElement('temperature', 'ERR');
    updateElement('humidity', 'ERR');
    updateElement('rawValue', 'ERR');
    
    const statusEl = document.getElementById('statusIndicator');
    if (statusEl) statusEl.className = 'status-indicator status-error';
}

// ==================== NOTIFICATION SYSTEM ====================
function showNotification(message, type = 'info') {
    document.querySelectorAll('.notification').forEach(el => el.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    
    switch(type) {
        case 'success': notification.style.backgroundColor = '#4CAF50'; break;
        case 'warning': notification.style.backgroundColor = '#ffa94d'; break;
        case 'error': notification.style.backgroundColor = '#ff6b6b'; break;
        default: notification.style.backgroundColor = '#667eea';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    if (!document.querySelector('#notification-animations')) {
        const style = document.createElement('style');
        style.id = 'notification-animations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// ==================== DEBUG FUNCTIONS ====================
window.debug = {
    fetchData: fetchLiveData,
    testFirebase: async function() {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        console.log("Testing:", url);
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            console.log("Firebase Data:", data);
            return data;
        } catch (error) {
            console.error("Error:", error);
            return null;
        }
    },
    getData: () => currentData,
    getRecords: () => records
};

// ==================== STARTUP ====================
console.log("🚀 Smart Plant Dashboard v3.0");
console.log("📊 Features: 3 Charts + Data Table");
console.log("📱 Device ID:", currentDeviceId);
console.log("🔄 Refresh: 10 seconds");

// Initial state
updateElement('statusIndicator', 'CONNECTING...');
document.getElementById('statusIndicator').className = 'status-indicator status-unknown';
