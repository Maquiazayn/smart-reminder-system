// dashboard.js - Smart Plant Watering Dashboard - FIXED VERSION
// CORRECT Firebase configuration - MUST MATCH ARDUINO

const FIREBASE_CONFIG = {
  databaseURL: "https://smart-plant-watering-rem-e050a-default-rtdb.firebaseio.com"
  // ↑↑↑ MUST MATCH Arduino's FIREBASE_HOST ↑↑↑
};

// Global variables
let currentDeviceId = 'PLANT-SENSOR-001';  // MUST MATCH ARDUINO
let updateCount = 0;
let moistureHistory = [];
const MAX_HISTORY = 60;

// This will store real records from Firebase
let realRecords = [];

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
    refreshInterval: document.getElementById('refreshInterval'),
    countdownTimer: document.getElementById('countdownTimer')
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
            loadingOverlay.innerHTML = `
                <div class="loading"></div>
                <div>Connecting to Smart Plant Sensor...</div>
                <div style="font-size: 1rem; margin-top: 10px; opacity: 0.8;">
                    Device: ${currentDeviceId}<br>
                    Fetching real-time data...
                </div>
            `;
        } else {
            loadingOverlay.classList.add('hidden');
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

// Main initialization function
function initDashboard() {
    console.log("🌱 Smart Plant Watering Dashboard - FIXED VERSION");
    console.log("==============================================");
    
    showLoading(true);
    
    // Get device ID from URL or use default
    const urlParams = new URLSearchParams(window.location.search);
    const urlDeviceId = urlParams.get('device');
    
    if (urlDeviceId) {
        currentDeviceId = urlDeviceId;
        console.log("Using device ID from URL:", currentDeviceId);
    }
    
    // Set device ID in UI
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    console.log("Firebase URL:", FIREBASE_CONFIG.databaseURL);
    console.log("Device ID:", currentDeviceId);
    console.log("Full path:", `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`);
    
    // Initialize charts
    initializeGauge();
    initializeHistoryChart();
    
    // Set up auto-refresh every 60 seconds (1 minute)
    setInterval(fetchData, 60000);
    
    // Set up auto-refresh for history every 2 minutes
    setInterval(fetchHistoryData, 120000);
    
    // Add click event to refresh button
    document.querySelector('.refresh-btn').addEventListener('click', function() {
        console.log("Manual refresh triggered");
        fetchData();
        fetchHistoryData();
        showNotification("Manual refresh complete");
    });
    
    // Start countdown timer
    startCountdownTimer();
    
    // Fetch initial data
    fetchData();
    fetchHistoryData();
    
    console.log("✅ Dashboard initialized successfully");
    console.log("==============================================\n");
}

// Start countdown timer for next refresh
function startCountdownTimer() {
    let countdown = 60;
    
    // Create or update countdown display
    const timerElement = elements.countdownTimer || createCountdownElement();
    
    // Update countdown every second
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            countdown = 60;
        }
        
        if (timerElement) {
            timerElement.textContent = `Next refresh: ${countdown}s`;
            timerElement.style.color = countdown <= 10 ? '#ff6b6b' : '#667eea';
            timerElement.style.fontWeight = countdown <= 10 ? 'bold' : 'normal';
        }
    }, 1000);
}

function createCountdownElement() {
    const lastUpdateElement = elements.lastUpdate.parentElement;
    if (lastUpdateElement) {
        const timerSpan = document.createElement('div');
        timerSpan.id = 'countdownTimer';
        timerSpan.style.marginTop = '5px';
        timerSpan.style.fontSize = '0.85rem';
        timerSpan.style.color = '#667eea';
        timerSpan.style.fontWeight = '500';
        lastUpdateElement.appendChild(timerSpan);
        return timerSpan;
    }
    return null;
}

// Fetch history data from Firebase
async function fetchHistoryData() {
    console.log("📚 Fetching history data...");
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/history.json?orderBy="timestamp"&limitToLast=20`;
        console.log("History URL:", url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data === null) {
            console.warn("No history data found yet");
            return;
        }
        
        // Convert Firebase object to array
        realRecords = [];
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const record = data[key];
                record.id = key;
                record.sortKey = record.timestamp || record.millis || Date.now();
                realRecords.push(record);
            }
        }
        
        // Sort by timestamp (newest first)
        realRecords.sort((a, b) => b.sortKey - a.sortKey);
        
        // Update the records table
        updateRecordsTable();
        
        // Update history chart
        updateHistoryChartWithRealData();
        
    } catch (error) {
        console.error('Error fetching history data:', error);
    }
}

// Update history chart with real data from Firebase
function updateHistoryChartWithRealData() {
    if (!historyChart || realRecords.length === 0) return;
    
    // Get last 20 records for chart
    const chartData = realRecords.slice(0, 20).reverse();
    
    const labels = chartData.map(record => {
        const date = new Date(parseInt(record.sortKey));
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

// Update the records table with REAL data from Firebase
function updateRecordsTable() {
    const tableBody = elements.recordsTableBody;
    
    if (realRecords.length === 0) {
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
    
    // Show only last 10 records
    const recordsToShow = realRecords.slice(0, 10);
    
    recordsToShow.forEach(record => {
        const row = document.createElement('tr');
        
        const moisture = record.moisture_percent || 0;
        const status = record.status || getStatusText(moisture);
        const rawValue = record.raw_value || 0;
        
        // Determine colors
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
        
        // Format timestamp
        let displayTime = '--';
        if (record.timestamp || record.millis) {
            const timestamp = record.timestamp || record.millis;
            const date = new Date(parseInt(timestamp));
            displayTime = date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
        
        // Create row
        row.innerHTML = `
            <td class="timestamp-col">${displayTime}</td>
            <td class="percent-col ${moistureColorClass}">${moisture.toFixed(1)}%</td>
            <td class="value-col">${rawValue}</td>
            <td class="value-col">${(record.calibration?.dry || 0)}</td>
            <td class="status-col">
                <span class="status-badge ${statusClass}">${status}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    elements.recordCount.textContent = recordsToShow.length;
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
                    text: 'Moisture History (Last 20 readings)',
                    color: '#4a5568',
                    font: { size: 14, weight: '500' }
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
        
        // Set color based on moisture level
        let color;
        if (percentage <= 30) {
            color = '#ff6b6b';  // RED for dry
        } else if (percentage <= 70) {
            color = '#51cf66';  // GREEN for OK
        } else {
            color = '#339af0';  // BLUE for too wet
        }
        
        moistureGauge.data.datasets[0].backgroundColor = [color, '#e9ecef'];
        moistureGauge.update();
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
    if (!data) {
        console.warn("No data received for UI update");
        return;
    }
    
    const percentage = data.moisture_percent || 0;
    const rawValue = data.raw_value || 0;
    const status = data.status || getStatusText(percentage);
    const statusClass = getStatusClass(percentage);
    
    console.log("📊 Updating UI with:", { percentage, rawValue, status });
    
    // Update main display elements
    elements.moisturePercent.textContent = `${percentage.toFixed(1)}%`;
    elements.statusIndicator.textContent = status;
    elements.statusIndicator.className = `status-indicator ${statusClass}`;
    
    // Update environment data
    elements.rawValue.textContent = rawValue;
    
    // Update counters
    updateCount++;
    elements.updateCount.textContent = updateCount;
    
    // Update timestamp
    let timestamp;
    if (data.timestamp) {
        const date = new Date(parseInt(data.timestamp));
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
    
    // Update device ID if different
    if (data.device_id && data.device_id !== currentDeviceId) {
        currentDeviceId = data.device_id;
        elements.deviceId.textContent = currentDeviceId;
        localStorage.setItem('plantDeviceId', currentDeviceId);
        console.log("Updated device ID to:", currentDeviceId);
    }
    
    // Update charts
    updateGauge(percentage);
    
    // Add to history array for chart
    moistureHistory.push({
        percentage: percentage,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    });
    
    if (moistureHistory.length > MAX_HISTORY) {
        moistureHistory.shift();
    }
    
    console.log("✅ UI updated successfully");
}

// Fetch data from Firebase - MAIN FUNCTION
async function fetchData() {
    console.log(`🔄 Fetching data for device: ${currentDeviceId}`);
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        console.log("Request URL:", url);
        
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
        
        // Show success notification
        showNotification(`Data updated: ${data.moisture_percent}% - ${data.status}`);
        
    } catch (error) {
        console.error('❌ Error fetching data:', error);
        showLoading(false);
        
        // Show connection error in UI
        elements.moisturePercent.textContent = 'ERROR';
        elements.statusIndicator.textContent = 'CONNECTION FAILED';
        elements.statusIndicator.className = 'status-indicator status-need-water';
        
        // Show error notification
        showNotification(`Connection error: ${error.message}`, true);
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
        timestamp: Date.now().toString(),
        status: getStatusText(percentage)
    };
    
    updateUI(demoData);
    
    // Update UI to indicate demo mode
    elements.deviceId.textContent = currentDeviceId + ' (DEMO)';
    
    console.log("✅ Demo data displayed");
}

// Refresh records table
function refreshRecords() {
    console.log("Refreshing records table...");
    fetchHistoryData();
    showNotification("Records table refreshed");
}

// Export records to CSV
function exportToCSV() {
    if (realRecords.length === 0) {
        showNotification("No records available to export");
        return;
    }
    
    const headers = ["Timestamp", "Moisture %", "Raw Value", "Status"];
    const csvRows = [headers.join(',')];
    
    realRecords.forEach(record => {
        const date = new Date(parseInt(record.timestamp || record.millis || Date.now()));
        const timestamp = date.toLocaleString();
        const row = [
            `"${timestamp}"`,
            (record.moisture_percent || 0).toFixed(1),
            record.raw_value || 0,
            `"${record.status || getStatusText(record.moisture_percent || 0)}"`
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
    
    showNotification("CSV file downloaded successfully");
}

// Show notification
function showNotification(message, isError = false) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${isError ? '#ff6b6b' : '#51cf66'};
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        font-weight: 500;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log("Page became visible, refreshing data...");
        fetchData();
        fetchHistoryData();
    }
});

// Export functions to global scope
window.fetchData = fetchData;
window.refreshRecords = refreshRecords;
window.exportToCSV = exportToCSV;

// Test Firebase connection on load
window.addEventListener('load', function() {
    console.log("Testing Firebase connection...");
    const testUrl = `${FIREBASE_CONFIG.databaseURL}/.json`;
    fetch(testUrl)
        .then(response => {
            console.log("Firebase root test:", response.status);
            if (response.ok) {
                console.log("✅ Firebase connection successful");
            } else {
                console.error("❌ Firebase connection failed:", response.status);
            }
        })
        .catch(error => {
            console.error("❌ Firebase connection error:", error);
        });
});
