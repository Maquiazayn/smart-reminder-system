// dashboard.js - Smart Plant Watering Dashboard
// FIXED WITH DEVICE MATCHING

// Firebase configuration
const FIREBASE_CONFIG = {
  databaseURL: "https://smart-plant-watering-e2811-default-rtdb.firebaseio.com"
};

// Global variables
let currentDeviceId = null;
let updateCount = 0;
let moistureHistory = [];
const MAX_HISTORY = 60;

// This will store real records from Firebase
let realRecords = [];
let currentData = null;

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
    recordCount: document.getElementById('recordCount'),
    deviceSelect: document.getElementById('deviceSelect')
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

// Main initialization function
function initDashboard() {
    showLoading(true);
    console.log("Smart Plant Watering Dashboard initializing...");
    
    // Initialize charts
    initializeGauge();
    initializeHistoryChart();
    
    // Get device ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'PLANT-SENSOR-001';
    
    // Set device ID in UI
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Set device select value
    if (elements.deviceSelect) {
        elements.deviceSelect.value = currentDeviceId;
    }
    
    // Start fetching data
    fetchData();
    
    // Set up auto-refresh every 60 seconds (1 minute)
    setInterval(fetchData, 60000);
    
    // Set up auto-refresh for history every 5 minutes
    setInterval(fetchHistoryData, 300000);
    
    // Add click event to refresh button
    document.querySelector('.refresh-btn').addEventListener('click', fetchData);
    
    // Fetch history data initially
    fetchHistoryData();
    
    // Start countdown timer
    startCountdownTimer();
    
    console.log("Dashboard initialized for device:", currentDeviceId);
    console.log("Auto-refresh interval: 60 seconds (1 minute)");
    console.log("Thresholds: 0-30% = NEED WATER, 31-70% = OK, 71-100% = TOO WET");
}

// Change device function
function changeDevice() {
    const select = elements.deviceSelect;
    if (!select) {
        console.error("Device select element not found");
        return;
    }
    
    const newDeviceId = select.value;
    if (newDeviceId && newDeviceId !== currentDeviceId) {
        console.log(`Changing device from ${currentDeviceId} to ${newDeviceId}`);
        
        currentDeviceId = newDeviceId;
        localStorage.setItem('plantDeviceId', currentDeviceId);
        elements.deviceId.textContent = currentDeviceId;
        
        // Clear old data
        realRecords = [];
        currentData = null;
        moistureHistory = [];
        
        // Update refresh button text
        const refreshBtn = document.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Refresh Data (Device: ${currentDeviceId})`;
        }
        
        // Refresh all data
        showLoading(true);
        fetchData();
        fetchHistoryData();
        
        showNotification(`Switched to device: ${currentDeviceId}`);
    }
}

// Start countdown timer for next refresh
function startCountdownTimer() {
    let countdown = 60;
    const countdownElement = document.getElementById('countdownTimer');
    
    if (!countdownElement) {
        const lastUpdateElement = elements.lastUpdate.parentElement;
        if (lastUpdateElement) {
            const timerSpan = document.createElement('div');
            timerSpan.id = 'countdownTimer';
            timerSpan.style.marginTop = '5px';
            timerSpan.style.fontSize = '0.85rem';
            timerSpan.style.color = '#667eea';
            timerSpan.style.fontWeight = '500';
            timerSpan.textContent = `Next refresh in: ${countdown} seconds`;
            lastUpdateElement.appendChild(timerSpan);
            
            setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    countdown = 60;
                }
                timerSpan.textContent = `Next refresh in: ${countdown} seconds`;
                timerSpan.style.color = countdown <= 10 ? '#ff6b6b' : '#667eea';
            }, 1000);
        }
    }
}

// Fetch history data from Firebase
async function fetchHistoryData() {
    console.log("Fetching history data for device:", currentDeviceId);
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/history.json?orderBy="timestamp"&limitToLast=50`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data === null) {
            console.warn("No history data found for device:", currentDeviceId);
            if (currentData) {
                addCurrentDataToRecords(currentData);
            }
            updateRecordsTable();
            return;
        }
        
        // Convert Firebase object to array
        realRecords = [];
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const record = data[key];
                let timestamp;
                if (record.timestamp && typeof record.timestamp === 'string') {
                    timestamp = record.timestamp;
                } else if (record.millis) {
                    const date = new Date(parseInt(record.millis));
                    timestamp = date.toLocaleString();
                } else {
                    timestamp = new Date().toLocaleString();
                }
                record.formattedTimestamp = timestamp;
                record.sortKey = record.millis || Date.parse(timestamp) || Date.now();
                realRecords.push(record);
            }
        }
        
        // Sort by timestamp (newest first)
        realRecords.sort((a, b) => b.sortKey - a.sortKey);
        
        // ADD CURRENT DATA AS FIRST RECORD IF IT'S NOT ALREADY THERE
        if (currentData) {
            addCurrentDataToRecords(currentData);
        }
        
        // Update the records table
        updateRecordsTable(realRecords);
        
        // Update history chart with more data points
        updateHistoryChartWithRealData();
        
    } catch (error) {
        console.error('Error fetching history data:', error);
        if (currentData) {
            addCurrentDataToRecords(currentData);
        }
        updateRecordsTable();
    }
}

// Add current data to records array
function addCurrentDataToRecords(currentData) {
    if (!currentData) return;
    
    const now = new Date();
    const currentRecord = {
        formattedTimestamp: now.toLocaleString(),
        moisture_percent: currentData.moisture_percent || 0,
        temperature: currentData.temperature || 22.5,
        humidity: currentData.humidity || 45.0,
        status: currentData.status || getStatusText(currentData.moisture_percent || 0),
        sortKey: now.getTime(),
        timestamp: now.toISOString(),
        device_id: currentDeviceId,
        raw_value: currentData.raw_value || currentData.moisture_value || 0
    };
    
    // Check if this record already exists (within last 1 minute)
    const isDuplicate = realRecords.some(record => {
        const timeDiff = Math.abs(record.sortKey - currentRecord.sortKey);
        return timeDiff < 60000;
    });
    
    if (!isDuplicate) {
        realRecords.unshift(currentRecord);
        
        if (realRecords.length > 50) {
            realRecords = realRecords.slice(0, 50);
        }
    }
}

// Update history chart with real data from Firebase
function updateHistoryChartWithRealData() {
    if (!historyChart || realRecords.length === 0) return;
    
    const chartData = realRecords.slice(0, 60).reverse();
    
    const labels = chartData.map(record => {
        const date = new Date(record.sortKey);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    });
    
    const dataPoints = chartData.map(record => record.moisture_percent || record.moistureLevel || 0);
    
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = dataPoints;
    historyChart.update();
}

// Update the records table with REAL data from Firebase
function updateRecordsTable(records = []) {
    const tableBody = elements.recordsTableBody;
    
    const recordsToShow = records.length > 0 ? records.slice(0, 10) : 
                         (realRecords.length > 0 ? realRecords.slice(0, 10) : getDemoRecords());
    
    if (recordsToShow.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #718096;">
                    <i class="fas fa-leaf" style="margin-right: 10px;"></i>
                    No plant records available. Waiting for sensor data...
                </td>
            </tr>
        `;
        elements.recordCount.textContent = '0';
        return;
    }
    
    tableBody.innerHTML = '';
    
    recordsToShow.forEach(record => {
        const row = document.createElement('tr');
        
        const moisture = record.moisture_percent || record.moistureLevel || 0;
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
        
        let displayTime = '--';
        if (record.formattedTimestamp) {
            const date = new Date(record.sortKey || Date.now());
            displayTime = date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }) + ' ' + date.toLocaleDateString();
        }
        
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

// Generate demo records if no real data
function getDemoRecords() {
    const demoRecords = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
        const time = new Date(now.getTime() - (i * 60000));
        const moisture = 30 + Math.random() * 50;
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

// Initialize the moisture gauge chart
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

// Initialize the history line chart
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
                    text: 'Last 60 Minutes (1-minute intervals)',
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
                    },
                    title: {
                        display: true,
                        text: 'Moisture Level',
                        color: '#4a5568'
                    }
                },
                x: {
                    grid: { display: false },
                    title: {
                        display: true,
                        text: 'Time',
                        color: '#4a5568'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// Update the moisture gauge with new value
function updateGauge(percentage) {
    if (moistureGauge) {
        moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
        
        let color;
        if (percentage <= 30) {
            color = '#ff6b6b';
        } else if (percentage <= 70) {
            color = '#51cf66';
        } else {
            color = '#339af0';
        }
        
        moistureGauge.data.datasets[0].backgroundColor = [color, '#e9ecef'];
        moistureGauge.update();
    }
}

// Update the history chart with new data point
function updateHistoryChart(percentage, timestamp) {
    if (historyChart) {
        const timeLabel = new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        moistureHistory.push({percentage, time: timeLabel});
        
        if (moistureHistory.length > MAX_HISTORY) {
            moistureHistory.shift();
        }
        
        historyChart.data.labels = moistureHistory.map(item => item.time);
        historyChart.data.datasets[0].data = moistureHistory.map(item => item.percentage);
        historyChart.update();
    }
}

// Determine status class based on moisture percentage
function getStatusClass(percentage) {
    if (percentage <= 30) return 'status-need-water';
    if (percentage <= 70) return 'status-ok';
    return 'status-too-wet';
}

// Determine status text based on moisture percentage
function getStatusText(percentage) {
    if (percentage <= 30) return 'NEED WATER';
    if (percentage <= 70) return 'OK';
    return 'TOO WET';
}

// Update all UI elements with sensor data
function updateUI(data) {
    console.log("Updating UI with data:", data);
    
    if (!data) {
        console.warn("No data received");
        return;
    }
    
    // Store current data
    currentData = data;
    
    const percentage = data.moisture_percent || 0;
    const rawValue = data.raw_value || data.moisture_value || 0;
    const status = data.status || getStatusText(percentage);
    const statusClass = getStatusClass(percentage);
    
    // Update main display elements
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
    let timestamp;
    if (data.timestamp && typeof data.timestamp === 'string') {
        timestamp = data.timestamp;
    } else if (data.millis) {
        const date = new Date(parseInt(data.millis));
        timestamp = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } else {
        timestamp = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    elements.lastUpdate.textContent = timestamp;
    
    // Update device ID if available
    if (data.device_id && data.device_id !== currentDeviceId) {
        currentDeviceId = data.device_id;
        elements.deviceId.textContent = currentDeviceId;
        localStorage.setItem('plantDeviceId', currentDeviceId);
        if (elements.deviceSelect) {
            elements.deviceSelect.value = currentDeviceId;
        }
        console.log("Updated device ID to:", currentDeviceId);
    }
    
    // Update charts
    updateGauge(percentage);
    updateHistoryChart(percentage, Date.now());
    
    // ADD CURRENT DATA TO RECORDS TABLE IMMEDIATELY
    addCurrentDataToRecords(data);
    updateRecordsTable(realRecords);
    
    console.log("UI updated successfully");
    console.log("Current status:", status, "(" + percentage.toFixed(1) + "%)");
    console.log("Threshold applied:", getStatusText(percentage));
    console.log("Records count:", realRecords.length);
}

// Fetch data from Firebase
async function fetchData() {
    console.log(`Fetching data for device: ${currentDeviceId}`);
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        console.log("Fetching from URL:", url);
        
        const response = await fetch(url);
        console.log("Response status:", response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Received data:", data);
        
        if (data === null) {
            console.warn("No data found at this path");
            showDemoData();
            showLoading(false);
            return;
        }
        
        updateUI(data);
        showLoading(false);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        showLoading(false);
        
        elements.moisturePercent.textContent = 'ERROR';
        elements.statusIndicator.textContent = 'CONNECTION FAILED';
        elements.statusIndicator.className = 'status-indicator status-need-water';
        
        showDemoData();
    }
}

// Show demo data when real data is not available
function showDemoData() {
    console.log("Showing demo data");
    
    const rawValue = Math.floor(Math.random() * 4096);
    const percentage = 40 + Math.random() * 30;
    
    const demoData = {
        device_id: currentDeviceId,
        raw_value: rawValue,
        moisture_percent: percentage,
        temperature: 22 + Math.random() * 5,
        humidity: 40 + Math.random() * 30,
        timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }),
        status: getStatusText(percentage)
    };
    
    currentData = demoData;
    
    updateUI(demoData);
    
    elements.deviceId.textContent = currentDeviceId + ' (PLANT-SENSOR-002)';
    elements.rawValue.textContent = rawValue + ' (PLANT-SENSOR-002)';
    
    if (realRecords.length === 0) {
        updateRecordsTable();
    }
}

// Refresh records table
function refreshRecords() {
    console.log("Refreshing records table...");
    fetchHistoryData();
    showNotification("Records table refreshed");
}

// Export records to CSV
function exportToCSV() {
    console.log("Exporting to CSV...");
    
    if (currentData) {
        addCurrentDataToRecords(currentData);
    }
    
    const recordsToExport = realRecords.length > 0 ? realRecords : getDemoRecords();
    
    if (recordsToExport.length === 0) {
        showNotification("No records available to export");
        return;
    }
    
    const headers = ["Timestamp", "Moisture Level (%)", "Temperature (°C)", "Humidity (%)", "Plant Status"];
    const csvRows = [];
    
    csvRows.push(headers.join(','));
    
    recordsToExport.forEach(record => {
        const row = [
            `"${record.formattedTimestamp || record.timestamp || '--'}"`,
            (record.moisture_percent || record.moistureLevel || 0).toFixed(1),
            (record.temperature || 22.5).toFixed(1),
            (record.humidity || 45.0).toFixed(1),
            `"${record.status || getStatusText(record.moisture_percent || 0)}"`
        ];
        csvRows.push(row.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `plant_watering_records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showNotification("CSV file downloaded successfully");
}

// Show notification
function showNotification(message) {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        notification.remove();
    });
    
    const notification = document.createElement('div');
    notification.className = 'notification';
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
        animation: slideIn 0.3s ease;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
            if (style.parentNode) {
                document.head.removeChild(style);
            }
        }, 300);
    }, 3000);
}

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        fetchData();
        fetchHistoryData();
    }
});

// Export functions to global scope for HTML onclick
window.fetchData = fetchData;
window.refreshRecords = refreshRecords;
window.exportToCSV = exportToCSV;
window.changeDevice = changeDevice;
