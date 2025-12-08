// dashboard.js - UPDATED FOR 60 SECONDS INTERVAL AND SIMPLIFIED STATUS
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
let currentCountdown = 60; // 60 seconds interval
let updateInterval = null;

// Chart configurations
let chartRanges = {
    moisture: 10, // minutes
    temperature: 10,
    humidity: 10
};

// SIMPLIFIED STATUS RANGES (from your Arduino code)
const MOISTURE_RANGES = {
    NEED_WATER: 30,   // 0-30%: NEED TO WATER
    OK: 50,           // 31-50%: OK
    MOIST: 70,        // 51-70%: MOIST
    // 71-100%: TOO WET
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
    
    // Update interval info - FIXED TO SHOW CORRECTLY
    const countdownElement = document.getElementById('refreshCountdown');
    if (countdownElement) {
        countdownElement.innerHTML = 'Next refresh in: <span style="color: red; font-weight: bold;">60</span> seconds';
    }
    
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
    
    // Auto refresh every 60 seconds (1 minute)
    startAutoRefresh();
    
    // Countdown timer
    startCountdownTimer();
    
    console.log("✅ Dashboard initialized with past records system");
    console.log("🔄 Auto-refresh interval: 60 seconds");
    console.log("📊 Simplified moisture ranges:", MOISTURE_RANGES);
}

// ==================== FIREBASE DATA FETCHING ====================
async function fetchLiveData() {
    try {
        const firebasePath = `/plants/${currentDeviceId}/latest.json`;
        const url = `${FIREBASE_CONFIG.databaseURL}${firebasePath}?t=${Date.now()}`;
        
        console.log("📡 Fetching live data:", url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data) {
            showNoDataWarning();
            return;
        }
        
        console.log("✅ Live data received:", data);
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
        
        console.log("📡 Fetching history data...");
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data) {
            // Convert to array with proper date parsing
            const historyArray = Object.keys(data).map(key => {
                let timestamp;
                const dataPoint = data[key];
                
                if (dataPoint.timestamp) {
                    timestamp = new Date(dataPoint.timestamp);
                } else if (key && typeof key === 'string' && key.includes('-')) {
                    // Try to parse from Firebase key
                    timestamp = new Date(key.replace('_', ':').replace('_', ':'));
                } else {
                    timestamp = new Date();
                }
                
                // Validate date
                if (isNaN(timestamp.getTime())) {
                    timestamp = new Date();
                }
                
                return {
                    timestamp: timestamp,
                    moisture: parseFloat(dataPoint.moisture) || 0,
                    temperature: parseFloat(dataPoint.temperature) || 0,
                    humidity: parseFloat(dataPoint.humidity) || 0,
                    status: dataPoint.plant_status || dataPoint.status || "OK"
                };
            });
            
            // Sort by timestamp
            historyArray.sort((a, b) => a.timestamp - b.timestamp);
            
            // Store in global variable
            allHistoryData = historyArray;
            
            console.log(`📊 History data loaded: ${historyArray.length} records`);
            console.log("Sample timestamps:", historyArray.slice(0, 3).map(d => d.timestamp.toString()));
            
            // Update all charts
            updateAllCharts();
        } else {
            console.log("📊 No history data found");
        }
    } catch (error) {
        console.log("History fetch error:", error);
    }
}

function processArduinoData(data) {
    // Extract Arduino fields - using the new simplified structure
    let moisture = data.moisture_percent !== undefined ? parseFloat(data.moisture_percent) : 
                  data.moisture !== undefined ? parseFloat(data.moisture) : 50;
    
    let temperature = data.temperature !== undefined ? parseFloat(data.temperature) : 25.00;
    let humidity = data.humidity !== undefined ? parseFloat(data.humidity) : 50.00;
    let rawValue = data.moisture_raw !== undefined ? parseInt(data.moisture_raw) : 
                  data.raw_value !== undefined ? parseInt(data.raw_value) : 2000;
    let status = data.plant_status || data.status || "OK";
    
    // Clamp moisture values
    moisture = Math.max(0, Math.min(100, moisture));
    
    // Get correct status based on simplified ranges
    status = getMoistureStatus(moisture);
    
    const processedData = {
        moisture: moisture,
        temperature: temperature,
        humidity: humidity,
        rawValue: rawValue,
        status: status,
        deviceId: currentDeviceId,
        timestamp: new Date()
    };
    
    console.log("📊 Processed data:", processedData);
    
    // Update dashboard
    updateDashboard(processedData);
    
    // Add to recent records (WITH DATE)
    addToRecords(processedData);
    
    // Add to past records (permanent)
    addToPastRecords(processedData);
    
    // Add to history data for charts
    addToHistoryData(processedData);
    
    // Update charts
    updateGauge(moisture);
    updateAllCharts();
    
    showNotification("Data updated successfully", "success");
}

// Get moisture status based on simplified ranges
function getMoistureStatus(moisture) {
    if (moisture <= MOISTURE_RANGES.NEED_WATER) {
        return "NEED TO WATER";
    } else if (moisture <= MOISTURE_RANGES.OK) {
        return "OK";
    } else if (moisture <= MOISTURE_RANGES.MOIST) {
        return "MOIST";
    } else {
        return "TOO WET";
    }
}

function addToHistoryData(data) {
    // Ensure timestamp is a valid Date object
    let timestamp;
    if (data.timestamp instanceof Date) {
        timestamp = data.timestamp;
    } else if (typeof data.timestamp === 'string' || typeof data.timestamp === 'number') {
        timestamp = new Date(data.timestamp);
    } else {
        timestamp = new Date();
    }
    
    // Check if date is valid
    if (isNaN(timestamp.getTime())) {
        console.warn("Invalid timestamp, using current time");
        timestamp = new Date();
    }
    
    const historyPoint = {
        timestamp: timestamp,
        moisture: data.moisture,
        temperature: data.temperature,
        humidity: data.humidity
    };
    
    allHistoryData.push(historyPoint);
    
    // Keep only last 100 points
    if (allHistoryData.length > 100) {
        allHistoryData.shift();
    }
    
    // Sort by timestamp to ensure proper order
    allHistoryData.sort((a, b) => a.timestamp - b.timestamp);
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
                        const label = this.getLabelForValue(value);
                        if (!label || label === 'Invalid Date') return '';
                        
                        try {
                            const date = new Date(label);
                            if (isNaN(date.getTime())) return label;
                            
                            // Default format for initialization
                            return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        } catch (e) {
                            return label;
                        }
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
    
    if (filteredData.length === 0) return;
    
    // Prepare labels and data
    const labels = filteredData.map(point => {
        // Ensure timestamp is a Date object
        const date = point.timestamp instanceof Date ? point.timestamp : new Date(point.timestamp);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        // Format based on time range
        if (minutes <= 60) {
            // Show hours:minutes:seconds for short ranges
            return date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit'
            });
        } else if (minutes <= 360) {
            // Show hours:minutes for medium ranges
            return date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit'
            });
        } else {
            // Show date + time for long ranges
            return date.toLocaleString([], { 
                month: 'short',
                day: 'numeric',
                hour: '2-digit', 
                minute: '2-digit'
            });
        }
    });
    
    const data = filteredData.map(point => {
        if (type === 'moisture') return point.moisture;
        if (type === 'temperature') return point.temperature;
        if (type === 'humidity') return point.humidity;
        return 0;
    });
    
    // Update chart
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    
    // Update x-axis configuration based on time range
    const xAxisConfig = chart.options.scales.x;
    
    if (minutes <= 60) {
        xAxisConfig.ticks.callback = function(value, index, values) {
            const label = this.getLabelForValue(value);
            if (!label || label === 'Invalid Date') return '';
            
            // For short ranges, show time with seconds
            try {
                const date = new Date(label);
                if (isNaN(date.getTime())) return label;
                return date.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                });
            } catch (e) {
                return label;
            }
        };
    } else if (minutes <= 360) {
        xAxisConfig.ticks.callback = function(value, index, values) {
            const label = this.getLabelForValue(value);
            if (!label || label === 'Invalid Date') return '';
            
            // For medium ranges, show time without seconds
            try {
                const date = new Date(label);
                if (isNaN(date.getTime())) return label;
                return date.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit'
                });
            } catch (e) {
                return label;
            }
        };
    } else {
        xAxisConfig.ticks.callback = function(value, index, values) {
            const label = this.getLabelForValue(value);
            if (!label || label === 'Invalid Date') return '';
            
            // For long ranges, show date and time
            try {
                const date = new Date(label);
                if (isNaN(date.getTime())) return label;
                return date.toLocaleString([], { 
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit'
                });
            } catch (e) {
                return label;
            }
        };
    }
    
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
    
    // Get color based on simplified ranges
    let gaugeColor;
    const status = getMoistureStatus(percentage);
    
    if (status === "NEED TO WATER") {
        gaugeColor = '#ff6b6b';
    } else if (status === "OK") {
        gaugeColor = '#4CAF50';
    } else if (status === "MOIST") {
        gaugeColor = '#339af0';
    } else { // TOO WET
        gaugeColor = '#228be6';
    }
    
    moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
    moistureGauge.data.datasets[0].backgroundColor = [gaugeColor, '#e9ecef'];
    moistureGauge.update();
}

// ==================== RECENT RECORDS TABLE (WITH DATE) ====================
function addToRecords(data) {
    const now = new Date();
    const record = {
        date: now.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }),
        time: now.toLocaleTimeString([], {
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
                <td colspan="6" style="text-align: center; padding: 30px; color: #718096;">
                    <i class="fas fa-spinner fa-spin" style="margin-right: 10px;"></i>
                    Waiting for Arduino data...
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    records.forEach(record => {
        // Determine color classes based on simplified ranges
        let moistureClass = '';
        let statusClass = '';
        const status = getMoistureStatus(record.moisture);
        
        if (status === "NEED TO WATER") {
            moistureClass = 'water-level-low';
            statusClass = 'status-need-water-badge';
        } else if (status === "OK") {
            moistureClass = 'water-level-ok';
            statusClass = 'status-ok-badge';
        } else if (status === "MOIST") {
            moistureClass = 'water-level-moist';
            statusClass = 'status-moist-badge';
        } else { // TOO WET
            moistureClass = 'water-level-high';
            statusClass = 'status-too-wet-badge';
        }
        
        html += `
            <tr>
                <td class="date-col">${record.date}</td>
                <td class="timestamp-col">${record.time}</td>
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
    const now = new Date();
    const pastRecord = {
        id: Date.now(), // Unique ID
        date: now.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }),
        time: now.toLocaleTimeString([], {
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
        fullTimestamp: now,
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
        // Determine status based on simplified ranges
        const status = getMoistureStatus(record.moisture);
        let statusClass = '';
        
        if (status === "NEED TO WATER") {
            statusClass = 'status-need-water-badge';
        } else if (status === "OK") {
            statusClass = 'status-ok-badge';
        } else if (status === "MOIST") {
            statusClass = 'status-moist-badge';
        } else { // TOO WET
            statusClass = 'status-too-wet-badge';
        }
        
        // Determine moisture color class
        let moistureClass = '';
        if (status === "NEED TO WATER") {
            moistureClass = 'water-level-low';
        } else if (status === "OK") {
            moistureClass = 'water-level-ok';
        } else if (status === "MOIST") {
            moistureClass = 'water-level-moist';
        } else { // TOO WET
            moistureClass = 'water-level-high';
        }
        
        html += `
            <tr>
                <td class="date-col">${record.date}</td>
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
    const dateStr = now.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    updateElement('lastUpdate', `${dateStr} ${timeStr}`);
    
    currentData = data;
}

function updateStatusColor(status) {
    const statusEl = document.getElementById('statusIndicator');
    if (!statusEl) return;
    
    statusEl.className = 'status-indicator';
    
    const statusUpper = status.toUpperCase();
    if (statusUpper.includes("NEED TO WATER")) {
        statusEl.classList.add('status-need-water');
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

// ==================== TIMER FUNCTIONS (60 SECONDS) ====================
function startCountdownTimer() {
    if (countdownInterval) clearInterval(countdownInterval);
    
    currentCountdown = 60;
    updateCountdownDisplay();
    
    countdownInterval = setInterval(() => {
        currentCountdown--;
        updateCountdownDisplay();
        
        if (currentCountdown <= 0) {
            fetchLiveData();
            currentCountdown = 60;
        }
    }, 1000);
}

function resetCountdown() {
    currentCountdown = 60;
    updateCountdownDisplay();
}

function updateCountdownDisplay() {
    // Update the countdown value
    const countdownValueEl = document.getElementById('countdownValue');
    if (countdownValueEl) {
        countdownValueEl.textContent = currentCountdown;
        
        // Color coding for low countdown
        if (currentCountdown <= 10) {
            countdownValueEl.style.color = '#ff6b6b';
        } else if (currentCountdown <= 30) {
            countdownValueEl.style.color = '#ffa94d';
        } else {
            countdownValueEl.style.color = '#667eea';
        }
    }
    
    // Update the refresh countdown text (RED TEXT)
    const refreshCountdownEl = document.getElementById('refreshCountdown');
    if (refreshCountdownEl) {
        refreshCountdownEl.innerHTML = `Next refresh in: <span style="color: red; font-weight: bold;">${currentCountdown}</span> seconds`;
    }
    
    // Also update loading overlay countdown
    const loadingCountdownEl = document.getElementById('countdownTimer');
    if (loadingCountdownEl) {
        loadingCountdownEl.innerHTML = `Next refresh in: <span style="color: #fff;">${currentCountdown}</span> seconds`;
    }
}

function startAutoRefresh() {
    if (updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(() => {
        console.log("🔄 Auto-refresh triggered");
        fetchLiveData();
    }, 60000); // 60 seconds (1 minute)
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
    
    const headers = ["Date", "Time", "Moisture (%)", "Temperature (°C)", "Humidity (%)", "Status", "Raw Value"];
    const rows = records.map(record => [
        `"${record.date}"`,
        `"${record.time}"`,
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
        const moisture = Math.floor(Math.random() * 100);
        const demoData = {
            moisture: moisture,
            temperature: 25.00 + (Math.random() * 5),
            humidity: 50.00 + (Math.random() * 20),
            rawValue: Math.floor(1500 + (Math.random() * 2000)),
            status: getMoistureStatus(moisture),
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
    },
    // Debug date function
    debugDates: function() {
        console.log("=== Date Debug Information ===");
        console.log("Current time:", new Date().toString());
        console.log("History data length:", allHistoryData.length);
        
        if (allHistoryData.length > 0) {
            console.log("First 5 timestamps:");
            allHistoryData.slice(0, 5).forEach((point, i) => {
                console.log(`[${i}]`, point.timestamp.toString(), 
                    "Valid:", !isNaN(point.timestamp.getTime()),
                    "Type:", typeof point.timestamp,
                    "Instanceof Date:", point.timestamp instanceof Date);
            });
            
            console.log("Last 5 timestamps:");
            allHistoryData.slice(-5).forEach((point, i) => {
                console.log(`[${i}]`, point.timestamp.toString(), 
                    "Valid:", !isNaN(point.timestamp.getTime()));
            });
        }
        
        // Check chart data
        if (moistureHistoryChart) {
            console.log("Moisture chart labels:", moistureHistoryChart.data.labels.slice(0, 5));
        }
    }
};

// ==================== STARTUP ====================
console.log("🚀 Smart Plant Dashboard v4.0 - UPDATED");
console.log("📊 Features: Single Big Chart Card + Past Records System");
console.log("📱 Device ID:", currentDeviceId);
console.log("🔄 Auto-refresh: 60 seconds (1 minute)");
console.log("💾 Storage: Past records saved to localStorage");
console.log("📅 Date Fix: Proper date handling for charts");
console.log("🎯 Simplified Moisture Ranges:");
console.log("   - 0-30%: NEED TO WATER");
console.log("   - 31-50%: OK");
console.log("   - 51-70%: MOIST");
console.log("   - 71-100%: TOO WET");
console.log("💡 Debug commands:");
console.log("  - debug.fetchData()      - Manual refresh");
console.log("  - debug.testFirebase()   - Test Firebase");
console.log("  - debug.getData()        - View current data");
console.log("  - debug.getRecords()     - View recent records");
console.log("  - debug.getPastRecords() - View all past records");
console.log("  - debug.clearAllData()   - Clear all data");
console.log("  - debug.debugDates()     - Debug date issues");

// Initial state
updateElement('statusIndicator', 'CONNECTING...');
document.getElementById('statusIndicator').className = 'status-indicator status-unknown';

// Initial UI updates
updateElement('deviceId', currentDeviceId);
updateElement('refreshDeviceId', currentDeviceId);
updateElement('refreshCountdown', 'Next refresh in: 60 seconds');
