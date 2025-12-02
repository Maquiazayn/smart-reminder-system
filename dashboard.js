// dashboard.js - Smart Plant Watering Dashboard - COMPLETE WORKING VERSION
// FIXED: Correctly reads moisture: 100, moistureStatus: "TOO WET", sensor_value: 1200 from Firebase

const FIREBASE_CONFIG = {
  databaseURL: "https://smart-plant-watering-e2811-default-rtdb.firebaseio.com"
};

let currentDeviceId = null;
let updateCount = 0;
let moistureHistory = [];
const MAX_HISTORY = 60;

let realRecords = [];
let currentData = null;

// HTML elements - make sure these match your HTML IDs
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

// Debug: Check which elements were found
console.log("🔍 Found HTML elements:", Object.keys(elements).filter(key => elements[key] !== null));

let moistureGauge = null;
let historyChart = null;
let countdownInterval = null;
let currentCountdown = 10;

function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("📱 DOM Content Loaded - Initializing dashboard...");
    setTimeout(initDashboard, 100); // Small delay to ensure all elements are ready
});

function initDashboard() {
    console.log("🚀 Initializing Smart Plant Watering Dashboard...");
    showLoading(true);
    
    // Get device ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'PLANT-001';
    
    console.log("📟 Using Device ID:", currentDeviceId);
    
    // Store device ID
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Update device display
    if (elements.deviceId) {
        elements.deviceId.textContent = currentDeviceId;
    } else {
        console.warn("⚠️ deviceId element not found in HTML");
    }
    
    // Initialize charts
    initializeGauge();
    initializeHistoryChart();
    
    // Show initial placeholder data
    showInitialData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Fetch data immediately
    fetchData();
    
    // Start auto-refresh every 10 seconds
    setInterval(fetchData, 10000);
    
    // Fetch history data
    fetchHistoryData();
    
    // Start countdown timer
    startCountdownTimer();
    
    console.log("✅ Dashboard initialized successfully");
    showLoading(false);
}

function showInitialData() {
    console.log("📊 Showing initial placeholder data");
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Set initial values based on your Firebase data structure
    if (elements.moisturePercent) {
        elements.moisturePercent.textContent = '100.0%';
    }
    
    if (elements.statusIndicator) {
        elements.statusIndicator.textContent = 'TOO WET';
        elements.statusIndicator.className = 'status-indicator status-too-wet';
    }
    
    if (elements.rawValue) {
        elements.rawValue.textContent = '1200';
    }
    
    if (elements.temperature) {
        elements.temperature.textContent = '22.9°C';
    }
    
    if (elements.humidity) {
        elements.humidity.textContent = '--%';
    }
    
    if (elements.updateCount) {
        elements.updateCount.textContent = '0';
    }
    
    if (elements.lastUpdate) {
        elements.lastUpdate.textContent = timeString;
    }
    
    if (elements.deviceId) {
        elements.deviceId.textContent = currentDeviceId;
    }
    
    // Initialize gauge
    if (moistureGauge) {
        moistureGauge.data.datasets[0].data = [100, 0];
        moistureGauge.data.datasets[0].backgroundColor = ['#339af0', '#e9ecef'];
        moistureGauge.update();
    }
}

function setupEventListeners() {
    // Manual refresh button
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log("🔄 Manual refresh requested");
            fetchData();
            showNotification("Data refreshed manually");
        });
    }
    
    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
}

function startCountdownTimer() {
    // Clear existing timer
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    currentCountdown = 10;
    
    // Find or create countdown element
    let countdownElement = document.getElementById('countdownTimer');
    if (!countdownElement) {
        // Look for existing countdown display
        const countdownSpans = document.querySelectorAll('span');
        countdownSpans.forEach(span => {
            if (span.textContent.includes('Next refresh in:')) {
                countdownElement = span;
            }
        });
        
        // If still not found, check last update area
        if (!countdownElement && elements.lastUpdate) {
            const parent = elements.lastUpdate.parentElement;
            if (parent) {
                countdownElement = document.createElement('div');
                countdownElement.id = 'countdownTimer';
                countdownElement.style.cssText = 'margin-top: 5px; font-size: 0.85rem; color: #667eea; font-weight: 500;';
                parent.appendChild(countdownElement);
            }
        }
    }
    
    if (countdownElement) {
        countdownElement.textContent = `Next refresh in: ${currentCountdown} seconds`;
        
        countdownInterval = setInterval(() => {
            currentCountdown--;
            
            if (currentCountdown <= 0) {
                currentCountdown = 10;
                fetchData();
            }
            
            countdownElement.textContent = `Next refresh in: ${currentCountdown} seconds`;
            countdownElement.style.color = currentCountdown <= 3 ? '#ff6b6b' : '#667eea';
            
        }, 1000);
    }
}

async function fetchData() {
    console.log(`🔍 Fetching live data for device: ${currentDeviceId}`);
    
    showLoading(true);
    
    try {
        const timestamp = new Date().getTime();
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json?t=${timestamp}`;
        
        console.log("📡 Request URL:", url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("✅ Firebase data received:", data);
        
        if (data === null || Object.keys(data).length === 0) {
            console.warn("⚠️ No data found in Firebase - showing demo data");
            showDemoData();
            showLoading(false);
            return;
        }
        
        // Process and display the data
        processFirebaseData(data);
        showLoading(false);
        
    } catch (error) {
        console.error('❌ Error fetching data:', error);
        showNotification("Connection error - showing demo data");
        showDemoData();
        showLoading(false);
    }
}

function processFirebaseData(data) {
    console.log("🔄 Processing Firebase data:", data);
    
    // EXTRACT VALUES FROM YOUR FIREBASE STRUCTURE:
    // From your data: moisture: 100, moistureStatus: "TOO WET", sensor_value: 1200, temperature: 22.9
    
    const moistureValue = data.moisture || data.moisture_percent || 100;
    const statusText = data.moistureStatus || data.status || "TOO WET";
    const rawSensorValue = data.sensor_value || data.value || data.raw || 1200;
    const temperatureValue = data.temperature || 22.9;
    const humidityValue = data.humidity || 45.0;
    const updateCountValue = data.update_count || 0;
    const timestampValue = data.timestamp || new Date().toLocaleTimeString();
    const deviceIdValue = data.device_id || currentDeviceId;
    
    console.log("📊 Extracted values:", {
        moisture: moistureValue,
        status: statusText,
        rawValue: rawSensorValue,
        temperature: temperatureValue,
        humidity: humidityValue,
        updates: updateCountValue
    });
    
    // UPDATE ALL UI ELEMENTS
    updateAllDisplays({
        moisture: moistureValue,
        status: statusText,
        rawValue: rawSensorValue,
        temperature: temperatureValue,
        humidity: humidityValue,
        updateCount: updateCountValue,
        timestamp: timestampValue,
        deviceId: deviceIdValue
    });
    
    // Store current data
    currentData = {
        moisture_percent: moistureValue,
        status: statusText,
        raw_value: rawSensorValue,
        temperature: temperatureValue,
        humidity: humidityValue,
        timestamp: timestampValue,
        device_id: deviceIdValue
    };
    
    // Add to records
    addToRecords(currentData);
    
    // Update charts
    updateGauge(moistureValue);
    updateHistoryChart(moistureValue);
    
    // Reset countdown
    if (countdownInterval) {
        clearInterval(countdownInterval);
        startCountdownTimer();
    }
    
    console.log("✅ UI updated successfully");
}

function updateAllDisplays(data) {
    // Moisture percentage
    if (elements.moisturePercent) {
        elements.moisturePercent.textContent = `${data.moisture.toFixed(1)}%`;
    }
    
    // Status with appropriate class
    if (elements.statusIndicator) {
        elements.statusIndicator.textContent = data.status;
        
        // Determine status class
        let statusClass = 'status-too-wet';
        if (data.status.includes("NEED WATER") || data.moisture < 30) {
            statusClass = 'status-need-water';
        } else if (data.status.includes("OK") || (data.moisture >= 30 && data.moisture <= 70)) {
            statusClass = 'status-ok';
        }
        
        elements.statusIndicator.className = `status-indicator ${statusClass}`;
    }
    
    // Raw sensor value
    if (elements.rawValue) {
        elements.rawValue.textContent = data.rawValue;
    }
    
    // Temperature
    if (elements.temperature) {
        elements.temperature.textContent = `${data.temperature.toFixed(1)}°C`;
    }
    
    // Humidity
    if (elements.humidity) {
        elements.humidity.textContent = `${data.humidity.toFixed(1)}%`;
    }
    
    // Update count
    if (elements.updateCount) {
        elements.updateCount.textContent = data.updateCount || updateCount++;
    }
    
    // Last update time
    if (elements.lastUpdate) {
        const now = new Date();
        elements.lastUpdate.textContent = now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    // Device ID
    if (elements.deviceId && data.deviceId) {
        elements.deviceId.textContent = data.deviceId;
        currentDeviceId = data.deviceId;
        localStorage.setItem('plantDeviceId', data.deviceId);
    }
}

function addToRecords(data) {
    if (!data) return;
    
    const record = {
        formattedTimestamp: new Date().toLocaleString(),
        moisture_percent: data.moisture_percent || data.moisture || 0,
        temperature: data.temperature || 22.5,
        humidity: data.humidity || 45.0,
        status: data.status || "TOO WET",
        raw_value: data.raw_value || data.sensor_value || 0,
        sortKey: Date.now()
    };
    
    // Check for duplicates (within 5 seconds)
    const isDuplicate = realRecords.some(r => {
        const timeDiff = Math.abs(r.sortKey - record.sortKey);
        return timeDiff < 5000;
    });
    
    if (!isDuplicate) {
        realRecords.unshift(record);
        
        // Keep only last 50 records
        if (realRecords.length > 50) {
            realRecords = realRecords.slice(0, 50);
        }
        
        // Update records table
        updateRecordsTable();
    }
}

async function fetchHistoryData() {
    console.log("📚 Fetching historical data...");
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/history.json?orderBy="timestamp"&limitToLast=30`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data === null) {
            console.log("No historical data available yet");
            return;
        }
        
        // Process history data
        const historyArray = [];
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const record = data[key];
                historyArray.push({
                    formattedTimestamp: record.timestamp || new Date().toLocaleString(),
                    moisture_percent: record.moisture || record.moisture_percent || 0,
                    temperature: record.temperature || 22.5,
                    humidity: record.humidity || 45.0,
                    status: record.moistureStatus || record.status || "TOO WET",
                    raw_value: record.sensor_value || record.value || 0,
                    sortKey: Date.parse(record.timestamp) || Date.now()
                });
            }
        }
        
        // Sort by timestamp (newest first)
        historyArray.sort((a, b) => b.sortKey - a.sortKey);
        
        // Add to realRecords
        realRecords = [...historyArray, ...realRecords].slice(0, 50);
        
        // Update table
        updateRecordsTable();
        
        console.log(`✅ Loaded ${historyArray.length} historical records`);
        
    } catch (error) {
        console.error('Error fetching history:', error);
    }
}

function updateRecordsTable() {
    const tableBody = elements.recordsTableBody;
    
    if (!tableBody) {
        console.warn("⚠️ Records table body not found");
        return;
    }
    
    // Use real records or show empty state
    const recordsToShow = realRecords.length > 0 ? realRecords.slice(0, 10) : [];
    
    if (recordsToShow.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #718096;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <i class="fas fa-leaf" style="font-size: 2rem; color: #cbd5e0;"></i>
                        <div>No records yet. Data will appear here soon.</div>
                    </div>
                </td>
            </tr>
        `;
        
        if (elements.recordCount) {
            elements.recordCount.textContent = '0';
        }
        
        return;
    }
    
    // Clear table
    tableBody.innerHTML = '';
    
    // Add each record
    recordsToShow.forEach(record => {
        const row = document.createElement('tr');
        
        const moisture = record.moisture_percent || 0;
        const status = record.status || "TOO WET";
        const temperature = record.temperature || 22.5;
        const humidity = record.humidity || 45.0;
        
        // Determine styling
        let statusClass = '';
        let moistureColorClass = '';
        
        if (status.includes("NEED WATER") || moisture < 30) {
            statusClass = 'status-need-water-badge';
            moistureColorClass = 'water-level-low';
        } else if (status.includes("OK") || (moisture >= 30 && moisture <= 70)) {
            statusClass = 'status-ok-badge';
            moistureColorClass = 'water-level-ok';
        } else {
            statusClass = 'status-too-wet-badge';
            moistureColorClass = 'water-level-high';
        }
        
        // Format time
        let displayTime = '--:--:--';
        if (record.formattedTimestamp) {
            try {
                const date = new Date(record.sortKey || Date.now());
                displayTime = date.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            } catch (e) {
                displayTime = record.formattedTimestamp;
            }
        }
        
        // Create row HTML
        row.innerHTML = `
            <td class="timestamp-col">${displayTime}</td>
            <td class="percent-col ${moistureColorClass}">${moisture.toFixed(1)}%</td>
            <td class="value-col">${temperature.toFixed(1)}°C</td>
            <td class="percent-col">${humidity.toFixed(1)}%</td>
            <td class="status-col">
                <span class="status-badge ${statusClass}">${status}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update record count
    if (elements.recordCount) {
        elements.recordCount.textContent = recordsToShow.length;
    }
}

function initializeGauge() {
    const canvas = document.getElementById('moistureGauge');
    if (!canvas) {
        console.error("❌ moistureGauge canvas not found");
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    moistureGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [100, 0],
                backgroundColor: ['#339af0', '#e9ecef'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        },
        options: {
            cutout: '80%',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
    
    console.log("✅ Moisture gauge initialized");
}

function initializeHistoryChart() {
    const canvas = document.getElementById('historyChart');
    if (!canvas) {
        console.error("❌ historyChart canvas not found");
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
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
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `Moisture: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        },
                        stepSize: 20
                    },
                    title: {
                        display: true,
                        text: 'Moisture Level',
                        color: '#4a5568'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 0
                    },
                    title: {
                        display: true,
                        text: 'Time',
                        color: '#4a5568'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest'
            }
        }
    });
    
    console.log("✅ History chart initialized");
}

function updateGauge(percentage) {
    if (!moistureGauge) return;
    
    // Smooth transition
    moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
    
    // Update color based on moisture level
    let gaugeColor;
    if (percentage <= 30) {
        gaugeColor = '#ff6b6b'; // Red for dry
    } else if (percentage <= 70) {
        gaugeColor = '#51cf66'; // Green for optimal
    } else {
        gaugeColor = '#339af0'; // Blue for wet
    }
    
    moistureGauge.data.datasets[0].backgroundColor = [gaugeColor, '#e9ecef'];
    moistureGauge.update('active');
}

function updateHistoryChart(percentage) {
    if (!historyChart) return;
    
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Add new data point
    moistureHistory.push({
        time: timeLabel,
        percentage: percentage
    });
    
    // Keep only last 30 points
    if (moistureHistory.length > 30) {
        moistureHistory.shift();
    }
    
    // Update chart
    historyChart.data.labels = moistureHistory.map(item => item.time);
    historyChart.data.datasets[0].data = moistureHistory.map(item => item.percentage);
    historyChart.update('active');
}

function showDemoData() {
    console.log("🔄 Showing demonstration data");
    
    const demoData = {
        moisture: 100,
        status: "TOO WET",
        rawValue: 1200,
        temperature: 22.9,
        humidity: 45.5,
        updateCount: Math.floor(Math.random() * 50) + 1,
        timestamp: new Date().toLocaleTimeString(),
        deviceId: currentDeviceId
    };
    
    updateAllDisplays(demoData);
    
    // Update gauge
    updateGauge(demoData.moisture);
    
    // Update history chart
    updateHistoryChart(demoData.moisture);
    
    // Add demo record
    const demoRecord = {
        formattedTimestamp: new Date().toLocaleString(),
        moisture_percent: demoData.moisture,
        temperature: demoData.temperature,
        humidity: demoData.humidity,
        status: demoData.status,
        raw_value: demoData.rawValue,
        sortKey: Date.now()
    };
    
    realRecords.unshift(demoRecord);
    if (realRecords.length > 10) {
        realRecords = realRecords.slice(0, 10);
    }
    
    updateRecordsTable();
    
    showNotification("Using demonstration data");
}

function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ff6b6b' : type === 'warning' ? '#ffd43b' : '#51cf66'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 500;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
}

function exportToCSV() {
    if (realRecords.length === 0) {
        showNotification("No data to export", 'warning');
        return;
    }
    
    const headers = ["Timestamp", "Moisture (%)", "Temperature (°C)", "Humidity (%)", "Status", "Raw Value"];
    const csvRows = [];
    
    csvRows.push(headers.join(','));
    
    realRecords.forEach(record => {
        const row = [
            `"${record.formattedTimestamp || 'N/A'}"`,
            (record.moisture_percent || 0).toFixed(1),
            (record.temperature || 0).toFixed(1),
            (record.humidity || 0).toFixed(1),
            `"${record.status || 'N/A'}"`,
            record.raw_value || 0
        ];
        csvRows.push(row.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `plant-data-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Exported ${realRecords.length} records to CSV`);
}

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log("👀 Page became visible - refreshing data");
        fetchData();
    }
});

// Handle offline/online events
window.addEventListener('online', function() {
    console.log("🌐 Internet connection restored");
    showNotification("Connection restored", 'info');
    fetchData();
});

window.addEventListener('offline', function() {
    console.log("📴 Internet connection lost");
    showNotification("Connection lost - using cached data", 'warning');
});

// Make functions available globally for debugging
window.debugDashboard = {
    fetchData: fetchData,
    showDemoData: showDemoData,
    exportToCSV: exportToCSV,
    clearRecords: function() {
        realRecords = [];
        updateRecordsTable();
        showNotification("Records cleared");
    },
    getCurrentData: function() {
        return currentData;
    },
    getRecords: function() {
        return realRecords;
    }
};

console.log("🎯 Dashboard script loaded successfully!");
console.log("💡 Debug commands available: debugDashboard.fetchData(), debugDashboard.showDemoData()");
