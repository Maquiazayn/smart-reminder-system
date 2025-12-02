// dashboard.js - Smart Plant Watering Dashboard - COMPLETE WORKING VERSION

// Firebase configuration - MUST MATCH ARDUINO
const FIREBASE_CONFIG = {
    databaseURL: "https://smart-plant-watering-e2811-default-rtdb.firebaseio.com"
};

// Global variables
let currentDeviceId = 'PLANT-SENSOR-001';
let updateCount = 0;
let moistureHistory = [];
let realRecords = [];
let currentData = null;
let isDemoMode = false;

// DOM Elements
const elements = {
    moisturePercent: document.getElementById('moisturePercent'),
    statusIndicator: document.getElementById('statusIndicator'),
    temperature: document.getElementById('temperature'),
    humidity: document.getElementById('humidity'),
    rawValue: document.getElementById('rawValue'),
    updateCount: document.getElementById('updateCount'),
    deviceId: document.getElementById('deviceId'),
    lastUpdate: document.getElementById('lastUpdate'),
    recordsTableBody: document.getElementById('recordsTableBody'),
    recordCount: document.getElementById('recordCount')
};

// Chart instances
let moistureGauge = null;
let historyChart = null;

// Loading overlay control
function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        if (show) {
            loadingOverlay.classList.remove('hidden');
        } else {
            loadingOverlay.classList.add('hidden');
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

function initDashboard() {
    showLoading(true);
    console.log("🚀 Smart Plant Watering Dashboard Initializing...");
    console.log("📡 Firebase URL:", FIREBASE_CONFIG.databaseURL);
    
    // Initialize charts
    initializeGauge();
    initializeHistoryChart();
    
    // Get device ID
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'PLANT-SENSOR-001';
    
    // Set device ID in UI
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Update refresh button text
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Refresh Data (Device: ${currentDeviceId})`;
    }
    
    // Start fetching data
    testFirebaseConnection();
    fetchData();
    
    // Set up auto-refresh every 60 seconds
    setInterval(fetchData, 60000);
    
    // Fetch history data initially
    fetchHistoryData();
    
    // Set up history refresh every 5 minutes
    setInterval(fetchHistoryData, 300000);
    
    // Start countdown timer
    startCountdownTimer();
    
    console.log("✅ Dashboard initialized for device:", currentDeviceId);
}

// Test Firebase connection
async function testFirebaseConnection() {
    console.log("🔗 Testing Firebase connection...");
    try {
        const testUrl = `${FIREBASE_CONFIG.databaseURL}/.json?shallow=true`;
        const response = await fetch(testUrl);
        
        if (response.ok) {
            const data = await response.json();
            console.log("✅ Firebase connection SUCCESS");
            console.log("📁 Available data paths:", data);
            isDemoMode = false;
        } else {
            console.log("❌ Firebase connection FAILED");
            isDemoMode = true;
        }
    } catch (error) {
        console.log("❌ Firebase connection ERROR:", error.message);
        isDemoMode = true;
    }
}

// Start countdown timer for next refresh
function startCountdownTimer() {
    let countdown = 60;
    const timerElement = document.getElementById('countdownTimer');
    
    if (timerElement) {
        setInterval(() => {
            countdown--;
            if (countdown <= 0) {
                countdown = 60;
                fetchData(); // Auto refresh
            }
            timerElement.textContent = `Next refresh in: ${countdown} seconds`;
            timerElement.style.color = countdown <= 10 ? '#ff6b6b' : '#667eea';
        }, 1000);
    }
}

// Fetch latest data from Firebase
async function fetchData() {
    console.log(`🔍 Fetching latest data for device: ${currentDeviceId}`);
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        console.log("📡 Fetching from:", url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("📊 Received data:", data);
        
        if (data === null) {
            console.warn("⚠️ No data found at this path.");
            showDemoData();
            return;
        }
        
        // Check if we have the required data
        if (typeof data.moisture_percent === 'undefined') {
            console.warn("⚠️ Invalid data structure:", data);
            showDemoData();
            return;
        }
        
        // Fix inverted readings if needed
        const correctedData = fixSensorReadings(data);
        updateUI(correctedData);
        
    } catch (error) {
        console.error('❌ Error fetching data:', error);
        showDemoData();
    } finally {
        showLoading(false);
    }
}

// Fix sensor readings (correct inversion if needed)
function fixSensorReadings(data) {
    if (!data) return data;
    
    const rawValue = data.raw_value || 0;
    let moisturePercent = data.moisture_percent || 0;
    
    // Check if readings might be inverted
    // Most soil moisture sensors: HIGH raw value = DRY, LOW raw value = WET
    
    // If raw value is very high (>3000) but moisture% is also high, it's inverted
    if (rawValue > 3000 && moisturePercent > 50) {
        console.log(`🔄 Fixing inverted reading: ${moisturePercent}% -> ${100 - moisturePercent}%`);
        data.moisture_percent = 100 - moisturePercent;
        data.status = getStatusText(data.moisture_percent);
    }
    // If raw value is very low (<1000) but moisture% is low, it's inverted
    else if (rawValue < 1000 && moisturePercent < 30) {
        console.log(`🔄 Fixing inverted reading: ${moisturePercent}% -> ${100 - moisturePercent}%`);
        data.moisture_percent = 100 - moisturePercent;
        data.status = getStatusText(data.moisture_percent);
    }
    
    return data;
}

// Fetch history data from Firebase
async function fetchHistoryData() {
    console.log("📚 Fetching history data for device:", currentDeviceId);
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/history.json?orderBy="timestamp"&limitToLast=50`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data === null) {
            console.warn("⚠️ No history data found");
            return;
        }
        
        // Convert Firebase object to array
        realRecords = [];
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const record = data[key];
                
                // Fix sensor readings
                const correctedRecord = fixSensorReadings(record);
                
                // Format timestamp
                let timestamp;
                if (correctedRecord.millis) {
                    const date = new Date(parseInt(correctedRecord.millis));
                    timestamp = date.toLocaleString();
                } else if (correctedRecord.timestamp) {
                    timestamp = correctedRecord.timestamp;
                } else {
                    timestamp = new Date().toLocaleString();
                }
                
                correctedRecord.formattedTimestamp = timestamp;
                correctedRecord.sortKey = correctedRecord.millis || Date.parse(timestamp) || Date.now();
                realRecords.push(correctedRecord);
            }
        }
        
        // Sort by timestamp (newest first)
        realRecords.sort((a, b) => b.sortKey - a.sortKey);
        
        // Update the records table
        updateRecordsTable();
        
        // Update history chart
        updateHistoryChartWithRealData();
        
    } catch (error) {
        console.error('❌ Error fetching history data:', error);
    }
}

// Update records table
function updateRecordsTable() {
    const tableBody = elements.recordsTableBody;
    
    const recordsToShow = realRecords.length > 0 ? 
                         realRecords.slice(0, 10) : 
                         getDemoRecords();
    
    if (recordsToShow.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #718096;">
                    <i class="fas fa-leaf" style="margin-right: 10px;"></i>
                    No plant records available yet. Waiting for sensor data...
                </td>
            </tr>
        `;
        elements.recordCount.textContent = '0';
        return;
    }
    
    tableBody.innerHTML = '';
    
    recordsToShow.forEach(record => {
        const row = document.createElement('tr');
        
        const moisture = record.moisture_percent || 0;
        const status = record.status || getStatusText(moisture);
        
        let statusClass = '';
        let moistureColorClass = '';
        
        if (status.includes("NEED WATER")) {
            statusClass = 'status-need-water-badge';
            moistureColorClass = 'water-level-low';
        } else if (status.includes("OK")) {
            statusClass = 'status-ok-badge';
            moistureColorClass = 'water-level-ok';
        } else if (status.includes("TOO WET")) {
            statusClass = 'status-too-wet-badge';
            moistureColorClass = 'water-level-high';
        }
        
        let displayTime = record.formattedTimestamp || '--';
        
        row.innerHTML = `
            <td class="timestamp-col">${displayTime}</td>
            <td class="percent-col ${moistureColorClass}">${moisture.toFixed(1)}%</td>
            <td class="value-col">${(record.temperature || 22.5).toFixed(1)}°C</td>
            <td class="percent-col">${(record.humidity || 45.0).toFixed(1)}%</td>
            <td class="status-col">
                <span class="status-badge ${statusClass}">${status}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    elements.recordCount.textContent = recordsToShow.length;
}

// Generate demo records (fallback)
function getDemoRecords() {
    const demoRecords = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
        const time = new Date(now.getTime() - (i * 60000));
        const moisture = 20 + Math.random() * 60;
        const status = getStatusText(moisture);
        
        demoRecords.push({
            formattedTimestamp: time.toLocaleString(),
            moisture_percent: moisture,
            temperature: 22 + Math.random() * 3,
            humidity: 45 + Math.random() * 10,
            status: status,
            sortKey: time.getTime()
        });
    }
    
    return demoRecords;
}

// Initialize the moisture gauge
function initializeGauge() {
    const ctx = document.getElementById('moistureGauge').getContext('2d');
    
    moistureGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [50, 50],
                backgroundColor: ['#667eea', '#e9ecef'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        },
        options: {
            cutout: '80%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

// Initialize the history chart
function initializeHistoryChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Moisture %',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Last 60 Minutes',
                    color: '#4a5568',
                    font: {
                        size: 14,
                        weight: '500'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Update the moisture gauge
function updateGauge(percentage) {
    if (moistureGauge) {
        moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
        
        let color;
        if (percentage <= 30) {
            color = '#ff6b6b'; // RED for NEED WATER
        } else if (percentage <= 70) {
            color = '#51cf66'; // GREEN for OK
        } else {
            color = '#339af0'; // BLUE for TOO WET
        }
        
        moistureGauge.data.datasets[0].backgroundColor = [color, '#e9ecef'];
        moistureGauge.update();
    }
}

// Update history chart with real data
function updateHistoryChartWithRealData() {
    if (!historyChart || realRecords.length === 0) return;
    
    const chartData = realRecords.slice(0, 20).reverse(); // Last 20 records
    
    const labels = chartData.map(record => {
        const date = new Date(record.sortKey);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    });
    
    const dataPoints = chartData.map(record => record.moisture_percent || 0);
    
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = dataPoints;
    historyChart.update();
}

// Get status class based on percentage
function getStatusClass(percentage) {
    if (percentage <= 30) return 'status-need-water';
    if (percentage <= 70) return 'status-ok';
    return 'status-too-wet';
}

// Get status text based on percentage
function getStatusText(percentage) {
    if (percentage <= 30) return 'NEED WATER';
    if (percentage <= 70) return 'OK';
    return 'TOO WET';
}

// Update all UI elements
function updateUI(data) {
    console.log("🔄 Updating UI with data:", data);
    
    if (!data) {
        console.warn("⚠️ No data received");
        return;
    }
    
    // Store current data
    currentData = data;
    
    const percentage = data.moisture_percent || 0;
    const rawValue = data.raw_value || 0;
    const status = data.status || getStatusText(percentage);
    const statusClass = getStatusClass(percentage);
    
    console.log(`📊 Display: ${percentage}% - ${status} - Raw: ${rawValue}`);
    
    // Update main display
    elements.moisturePercent.textContent = `${percentage.toFixed(1)}%`;
    elements.statusIndicator.textContent = status;
    elements.statusIndicator.className = `status-indicator ${statusClass}`;
    
    // Update environment data
    elements.temperature.textContent = data.temperature ? `${data.temperature.toFixed(1)}°C` : '--°C';
    elements.humidity.textContent = data.humidity ? `${data.humidity.toFixed(1)}%` : '--%';
    elements.rawValue.textContent = rawValue;
    
    // Update counters
    updateCount++;
    elements.updateCount.textContent = updateCount;
    
    // Update timestamp
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    elements.lastUpdate.textContent = timestamp;
    
    // Update device ID
    if (data.device_id && data.device_id !== currentDeviceId) {
        currentDeviceId = data.device_id;
        elements.deviceId.textContent = currentDeviceId;
        localStorage.setItem('plantDeviceId', currentDeviceId);
    }
    
    // Update charts
    updateGauge(percentage);
    
    // Add to history for chart
    moistureHistory.push({
        percentage: percentage,
        time: now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    });
    
    if (moistureHistory.length > 20) {
        moistureHistory.shift();
    }
    
    // Update history chart
    historyChart.data.labels = moistureHistory.map(item => item.time);
    historyChart.data.datasets[0].data = moistureHistory.map(item => item.percentage);
    historyChart.update();
    
    // Add current reading to records
    addToRecords(data);
    
    console.log("✅ UI updated successfully");
}

// Add current data to records
function addToRecords(data) {
    if (!data) return;
    
    const now = new Date();
    const currentRecord = {
        formattedTimestamp: now.toLocaleString(),
        moisture_percent: data.moisture_percent || 0,
        temperature: data.temperature || 22.5,
        humidity: data.humidity || 45.0,
        status: data.status || getStatusText(data.moisture_percent || 0),
        sortKey: now.getTime(),
        raw_value: data.raw_value || 0
    };
    
    // Check for duplicates (within last 1 minute)
    const isDuplicate = realRecords.some(record => {
        const timeDiff = Math.abs(record.sortKey - currentRecord.sortKey);
        return timeDiff < 60000;
    });
    
    if (!isDuplicate) {
        realRecords.unshift(currentRecord);
        
        // Keep only last 50 records
        if (realRecords.length > 50) {
            realRecords = realRecords.slice(0, 50);
        }
        
        // Update table
        updateRecordsTable();
    }
}

// Show demo data (fallback)
function showDemoData() {
    console.log("🎮 Showing demo data");
    isDemoMode = true;
    
    // Simulate different conditions
    const rawValue = Math.floor(Math.random() * 1000) + 2000;
    const percentage = Math.floor(Math.random() * 100);
    const status = getStatusText(percentage);
    
    const demoData = {
        device_id: currentDeviceId,
        raw_value: rawValue,
        moisture_percent: percentage,
        temperature: 25 + Math.random() * 5,
        humidity: 30 + Math.random() * 20,
        timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }),
        status: status
    };
    
    currentData = demoData;
    
    updateUI(demoData);
    
    elements.deviceId.textContent = currentDeviceId + ' (DEMO)';
    
    if (realRecords.length === 0) {
        updateRecordsTable();
    }
}

// Export records to CSV
function exportToCSV() {
    console.log("📤 Exporting to CSV...");
    
    const recordsToExport = realRecords.length > 0 ? realRecords : getDemoRecords();
    
    if (recordsToExport.length === 0) {
        showNotification("No records available to export");
        return;
    }
    
    const headers = ["Timestamp", "Moisture (%)", "Temperature (°C)", "Humidity (%)", "Status"];
    const csvRows = [headers.join(',')];
    
    recordsToExport.forEach(record => {
        const row = [
            `"${record.formattedTimestamp || '--'}"`,
            (record.moisture_percent || 0).toFixed(1),
            (record.temperature || 22.5).toFixed(1),
            (record.humidity || 45.0).toFixed(1),
            `"${record.status || '--'}"`
        ];
        csvRows.push(row.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `plant_data_${currentDeviceId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showNotification("CSV file downloaded");
}

// Show notification
function showNotification(message) {
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #51cf66;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        font-weight: 500;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

// Refresh records manually
function refreshRecords() {
    console.log("🔄 Manually refreshing records...");
    fetchData();
    fetchHistoryData();
    showNotification("Data refreshed");
}

// Test function for different moisture levels
function testMoistureLevel(percentage) {
    console.log(`🧪 Testing: ${percentage}% moisture`);
    
    const testData = {
        device_id: currentDeviceId,
        moisture_percent: percentage,
        raw_value: Math.floor(Math.random() * 4096),
        temperature: 25.0,
        humidity: 50.0,
        timestamp: new Date().toLocaleString(),
        status: getStatusText(percentage)
    };
    
    updateUI(testData);
    showNotification(`Test: ${percentage}% → ${getStatusText(percentage)}`);
}

// Export functions to global scope
window.fetchData = fetchData;
window.refreshRecords = refreshRecords;
window.exportToCSV = exportToCSV;
window.testMoistureLevel = testMoistureLevel;

// Add test buttons in development
window.addEventListener('load', function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const testDiv = document.createElement('div');
        testDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 9999;
        `;
        
        const tests = [
            {label: 'Test DRY (15%)', color: '#ff6b6b', value: 15},
            {label: 'Test OK (50%)', color: '#51cf66', value: 50},
            {label: 'Test WET (85%)', color: '#339af0', value: 85}
        ];
        
        tests.forEach(test => {
            const btn = document.createElement('button');
            btn.textContent = test.label;
            btn.style.cssText = `
                background: ${test.color};
                color: white;
                border: none;
                padding: 10px;
                border-radius: 5px;
                cursor: pointer;
            `;
            btn.onclick = () => testMoistureLevel(test.value);
            testDiv.appendChild(btn);
        });
        
        document.body.appendChild(testDiv);
    }
});
