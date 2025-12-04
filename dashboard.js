// dashboard.js - COMPLETE DASHBOARD WITH SINGLE BIG CHART CARD AND PAST RECORDS
// For Arduino ESP32 with device ID: smart-plant-reminder

const FIREBASE_CONFIG = {
    databaseURL: "https://smart-plant-watering-e2811-default-rtdb.firebaseio.com"
};

// Global variables
let currentDeviceId = "smart-plant-reminder";
let records = []; // For recent records (10 items)
let pastRecords = []; // For permanent past records
let pastRecordsLimit = 50;
let allHistoryData = []; // Store all historical data for charts
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
    console.log("🌱 Dashboard loading with single chart card and past records...");
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
    
    // Load existing past records from localStorage
    loadPastRecordsFromStorage();
    
    // Auto refresh every 10 seconds
    startAutoRefresh();
    
    // Countdown timer
    startCountdownTimer();
    
    console.log("✅ Dashboard initialized with past records system");
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
    
    // Add to recent records
    addToRecords(processedData);
    
    // Add to past records (permanent)
    addToPastRecords(processedData);
    
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
            options: getChartOptions('Moisture (%)', '%', '#667eea')
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
            options: getChartOptions('Temperature (°C)', '°C', '#ff6b6b')
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
            options: getChartOptions('Humidity (%)', '%', '#4CAF50')
        });
    }
}

function getChartOptions(title, unit, color) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                display: true,
                labels: {
                    font: {
                        size: 13,
                        weight: 'bold'
                    }
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}${unit}`;
                    }
                },
                titleFont: {
                    size: 12
                },
                bodyFont: {
                    size: 12
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                grid: { 
                    color: 'rgba(0,0,0,0.05)',
                    drawBorder: false
                },
                ticks: { 
                    callback: value => value + unit,
                    font: { 
                        size: 12,
                        weight: 'bold'
                    },
                    padding: 10
                },
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 14,
                        weight: 'bold'
                    },
                    color: color
                }
            },
            x: {
                grid: { 
                    color: 'rgba(0,0,0,0.05)',
                    drawBorder: false
                },
                ticks: { 
                    maxTicksLimit: 8,
                    font: { 
                        size: 11,
                        weight: 'bold'
                    },
                    padding: 10,
                    callback: function(value, index, values) {
                        if (this.getLabelForValue(value)) {
                            const date = new Date(this.getLabelForValue(value));
                            return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        }
                        return '';
                    }
                },
                title: {
                    display: true,
                    text: 'Time',
                    font: {
                        size: 14,
                        weight: 'bold'
                    },
                    color: '#4a5568'
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
window.updateAllChartRanges = function(minutes) {
    chartRanges.moisture = minutes;
    chartRanges.temperature = minutes;
    chartRanges.humidity = minutes;
    
    updateAllCharts();
    
    // Update time range text
    if (document.getElementById('timeRange')) {
        document.getElementById('timeRange').textContent = `Showing last ${minutes} minutes`;
    }
    
    showNotification(`Charts updated: Showing last ${minutes} minutes`, "info");
};

// Keep the old function for backward compatibility
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

// ==================== RECENT RECORDS TABLE ====================
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
    
    // Keep only last 10 records
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
                    <i class="fas fa-spinner fa-spin" style="margin-right: 10px;"></i>
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

// ==================== PAST RECORDS FUNCTIONS ====================
function addToPastRecords(data) {
    const pastRecord = {
        id: Date.now(), // Unique ID
        date: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }),
        time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }),
        moisture: data.moisture,
        temperature: data.temperature,
        humidity: data.humidity,
        status: data.status,
        rawValue: data.rawValue,
        fullTimestamp: new Date(),
        deviceId: data.deviceId
    };
    
    pastRecords.unshift(pastRecord);
    
    // Keep only limited number of past records
    if (pastRecords.length > pastRecordsLimit) {
        pastRecords.pop();
    }
    
    // Save to localStorage
    savePastRecordsToStorage();
    
    updatePastRecordsTable();
}

function updatePastRecordsTable() {
    const tableBody = document.getElementById('pastRecordsTableBody');
    if (!tableBody) return;
    
    if (pastRecords.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #718096;">
                    <i class="fas fa-database" style="margin-right: 10px; font-size: 2rem;"></i>
                    <div style="margin-top: 10px; font-size: 1.2rem;">
                        No past records yet. Data will appear here automatically.
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    pastRecords.forEach(record => {
        let statusClass = '';
        
        if (record.status.includes("NEED WATER")) {
            statusClass = 'status-need-water-badge';
        } else if (record.status.includes("LOW")) {
            statusClass = 'status-low-badge';
        } else if (record.status.includes("OK")) {
            statusClass = 'status-ok-badge';
        } else if (record.status.includes("MOIST")) {
            statusClass = 'status-moist-badge';
        } else if (record.status.includes("TOO WET")) {
            statusClass = 'status-too-wet-badge';
        } else {
            statusClass = '';
        }
        
        // Determine moisture color class
        let moistureClass = '';
        if (record.moisture < 20) {
            moistureClass = 'water-level-low';
        } else if (record.moisture < 35) {
            moistureClass = 'water-level-low';
        } else if (record.moisture < 65) {
            moistureClass = 'water-level-ok';
        } else if (record.moisture < 85) {
            moistureClass = 'water-level-moist';
        } else {
            moistureClass = 'water-level-high';
        }
        
        html += `
            <tr>
                <td class="timestamp-col">${record.date}</td>
                <td class="timestamp-col">${record.time}</td>
                <td class="percent-col ${moistureClass}">${record.moisture.toFixed(1)}%</td>
                <td class="value-col">${record.temperature.toFixed(2)}°C</td>
                <td class="percent-col">${record.humidity.toFixed(2)}%</td>
                <td class="status-col">
                    <span class="status-badge ${statusClass}">${record.status}</span>
                </td>
                <td class="value-col">${record.rawValue}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    updateElement('pastRecordCount', pastRecords.length);
}

function savePastRecordsToStorage() {
    try {
        // Save to localStorage with device ID as key
        const storageKey = `plant_past_records_${currentDeviceId}`;
        localStorage.setItem(storageKey, JSON.stringify(pastRecords));
        console.log("💾 Saved past records to localStorage:", pastRecords.length, "records");
    } catch (error) {
        console.error("❌ Error saving to localStorage:", error);
    }
}

function loadPastRecordsFromStorage() {
    try {
        const storageKey = `plant_past_records_${currentDeviceId}`;
        const storedData = localStorage.getItem(storageKey);
        
        if (storedData) {
            pastRecords = JSON.parse(storedData);
            console.log("📂 Loaded past records from localStorage:", pastRecords.length, "records");
            updatePastRecordsTable();
        }
    } catch (error) {
        console.error("❌ Error loading from localStorage:", error);
        pastRecords = [];
    }
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
    
    // Color coding for low countdown
    const countdownEl = document.getElementById('countdownValue');
    if (countdownEl) {
        countdownEl.style.color = currentCountdown <= 3 ? '#ff6b6b' : '#667eea';
    }
}

function startAutoRefresh() {
    if (updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(() => {
        console.log("🔄 Auto-refresh triggered");
        fetchLiveData();
    }, 10000);
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Export CSV button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportRecentToCSV);
    }
    
    // Manual refresh button
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            console.log("🔄 Manual refresh requested");
            fetchLiveData();
            showNotification("Manual refresh started...", "info");
        });
    }
}

// ==================== EXPORT FUNCTIONS ====================
function exportRecentToCSV() {
    if (records.length === 0) {
        showNotification("No recent data to export", "warning");
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
    
    exportCSV(headers, rows, `plant-recent-data-${currentDeviceId}-${new Date().toISOString().slice(0,10)}.csv`, records.length, "recent");
}

// Function to export all past records
window.exportAllRecords = function() {
    if (pastRecords.length === 0) {
        showNotification("No past records to export", "warning");
        return;
    }
    
    const headers = ["Date", "Time", "Moisture (%)", "Temperature (°C)", "Humidity (%)", "Status", "Raw Value", "Device ID"];
    const rows = pastRecords.map(record => [
        `"${record.date}"`,
        `"${record.time}"`,
        record.moisture.toFixed(1),
        record.temperature.toFixed(2),
        record.humidity.toFixed(2),
        `"${record.status}"`,
        record.rawValue,
        `"${record.deviceId || currentDeviceId}"`
    ]);
    
    exportCSV(headers, rows, `plant-all-records-${currentDeviceId}-${new Date().toISOString().slice(0,10)}.csv`, pastRecords.length, "all");
};

function exportCSV(headers, rows, filename, count, type) {
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Exported ${count} ${type} records to CSV`, "success");
}

// ==================== PAST RECORDS MANAGEMENT ====================
window.loadMorePastRecords = function() {
    pastRecordsLimit += 50;
    showNotification(`Now showing up to ${pastRecordsLimit} past records`, "info");
    
    // Update table if we have more records than limit
    if (pastRecords.length > pastRecordsLimit) {
        pastRecords = pastRecords.slice(0, pastRecordsLimit);
    }
    
    updatePastRecordsTable();
    savePastRecordsToStorage();
};

window.clearPastRecords = function() {
    if (confirm("Are you sure you want to clear ALL past records?\n\nThis action cannot be undone and will delete all historical data from this device.")) {
        pastRecords = [];
        pastRecordsLimit = 50;
        savePastRecordsToStorage();
        updatePastRecordsTable();
        showNotification("All past records cleared", "info");
    }
};

// ==================== ERROR HANDLING ====================
function showNoDataWarning() {
    updateElement('moisturePercent', '--%');
    updateElement('statusIndicator', 'NO DATA');
    updateElement('temperature', '--°C');
    updateElement('humidity', '--%');
    updateElement('rawValue', '--');
    
    const statusEl = document.getElementById('statusIndicator');
    if (statusEl) statusEl.className = 'status-indicator status-unknown';
    
    showNotification("No data received from Arduino", "warning");
}

function showConnectionError() {
    updateElement('moisturePercent', 'ERR');
    updateElement('statusIndicator', 'CONNECTION ERROR');
    updateElement('temperature', 'ERR');
    updateElement('humidity', 'ERR');
    updateElement('rawValue', 'ERR');
    
    const statusEl = document.getElementById('statusIndicator');
    if (statusEl) statusEl.className = 'status-indicator status-error';
    
    showNotification("Connection error. Retrying...", "error");
}

// ==================== NOTIFICATION SYSTEM ====================
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(el => el.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    // Styling
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
    
    // Colors based on type
    switch(type) {
        case 'success': 
            notification.style.backgroundColor = '#4CAF50'; 
            break;
        case 'warning': 
            notification.style.backgroundColor = '#ffa94d'; 
            break;
        case 'error': 
            notification.style.backgroundColor = '#ff6b6b'; 
            break;
        default: 
            notification.style.backgroundColor = '#667eea';
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }, 3000);
    
    // Add animation styles if needed
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
    showDemo: function() {
        const demoData = {
            moisture: Math.floor(Math.random() * 100),
            temperature: 25.00 + (Math.random() * 5),
            humidity: 50.00 + (Math.random() * 20),
            rawValue: Math.floor(1500 + (Math.random() * 2000)),
            status: "OK",
            deviceId: currentDeviceId
        };
        
        processArduinoData(demoData);
        showNotification("Demo data loaded", "info");
    },
    testFirebase: async function() {
        console.log("🧪 Testing Firebase connection...");
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        console.log("URL:", url);
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            console.log("Firebase Data:", data);
            showNotification("Firebase test successful", "success");
            return data;
        } catch (error) {
            console.error("Error:", error);
            showNotification("Firebase test failed", "error");
            return null;
        }
    },
    getData: () => currentData,
    getRecords: () => records,
    getPastRecords: () => pastRecords,
    clearAllData: function() {
        if (confirm("Clear ALL data including past records?")) {
            records = [];
            pastRecords = [];
            allHistoryData = [];
            updateRecordsTable();
            updatePastRecordsTable();
            updateAllCharts();
            localStorage.removeItem(`plant_past_records_${currentDeviceId}`);
            showNotification("All data cleared", "info");
        }
    }
};

// ==================== STARTUP ====================
console.log("🚀 Smart Plant Dashboard v4.0");
console.log("📊 Features: Single Big Chart Card + Past Records System");
console.log("📱 Device ID:", currentDeviceId);
console.log("🔄 Auto-refresh: 10 seconds");
console.log("💾 Storage: Past records saved to localStorage");
console.log("💡 Debug commands:");
console.log("  - debug.fetchData()      - Manual refresh");
console.log("  - debug.testFirebase()   - Test Firebase");
console.log("  - debug.getData()        - View current data");
console.log("  - debug.getRecords()     - View recent records");
console.log("  - debug.getPastRecords() - View all past records");
console.log("  - debug.clearAllData()   - Clear all data");

// Initial state
updateElement('statusIndicator', 'CONNECTING...');
document.getElementById('statusIndicator').className = 'status-indicator status-unknown';

// Initial UI updates
updateElement('deviceId', currentDeviceId);
updateElement('refreshDeviceId', currentDeviceId);
