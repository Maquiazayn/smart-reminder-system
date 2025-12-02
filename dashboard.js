// dashboard.js - Smart Plant Watering Dashboard - FINAL COMPLETE VERSION
// UPDATED: Fixed loading overlay, data fetching, and UI display

const FIREBASE_CONFIG = {
  databaseURL: "https://smart-plant-watering-e2811-default-rtdb.firebaseio.com"
};

let currentDeviceId = null;
let updateCount = 0;
let moistureHistory = [];
const MAX_HISTORY = 60;

let realRecords = [];
let currentData = null;

// All HTML elements - make sure these IDs exist in your HTML
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

// Debug: Check which elements exist
console.log("🔍 Dashboard Elements Status:");
Object.keys(elements).forEach(key => {
    console.log(`  ${key}:`, elements[key] ? '✅ Found' : '❌ Missing');
});

let moistureGauge = null;
let historyChart = null;
let countdownInterval = null;
let currentCountdown = 10;

// ==================== LOADING OVERLAY FUNCTIONS ====================
function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (!loadingOverlay) {
        console.warn("⚠️ Loading overlay element not found in HTML");
        return;
    }
    
    if (show) {
        // SHOW LOADING OVERLAY - FULL SCREEN
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 255, 255, 0.98);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        `;
        
        // Create loading content if not exists
        if (!loadingOverlay.querySelector('.loading-content')) {
            const loadingContent = document.createElement('div');
            loadingContent.className = 'loading-content';
            loadingContent.style.cssText = `
                text-align: center;
                max-width: 400px;
                padding: 40px;
            `;
            
            // Add logo/icon
            const logo = document.createElement('div');
            logo.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 20px; color: #4CAF50;">🌱</div>
                <h2 style="color: #2d3748; margin-bottom: 10px;">Smart Plant Watering</h2>
                <div style="color: #718096; margin-bottom: 30px;">Loading dashboard...</div>
            `;
            loadingContent.appendChild(logo);
            
            // Add spinner
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.style.cssText = `
                width: 50px;
                height: 50px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px auto;
            `;
            loadingContent.appendChild(spinner);
            
            // Add loading text
            const loadingText = document.createElement('div');
            loadingText.className = 'loading-text';
            loadingText.id = 'loadingText';
            loadingText.textContent = 'Connecting to plant sensor...';
            loadingText.style.cssText = `
                color: #4a5568;
                font-size: 16px;
                margin-bottom: 15px;
                font-weight: 500;
            `;
            loadingContent.appendChild(loadingText);
            
            // Add device info
            const deviceInfo = document.createElement('div');
            deviceInfo.className = 'loading-device-info';
            deviceInfo.id = 'loadingDeviceInfo';
            deviceInfo.textContent = `Device: ${currentDeviceId || 'PLANT-001'}`;
            deviceInfo.style.cssText = `
                color: #718096;
                font-size: 14px;
                margin-top: 10px;
            `;
            loadingContent.appendChild(deviceInfo);
            
            loadingOverlay.appendChild(loadingContent);
        }
        
        // Update loading text
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = 'Connecting to plant sensor...';
        }
        
        // Update device info
        const deviceInfo = document.getElementById('loadingDeviceInfo');
        if (deviceInfo) {
            deviceInfo.textContent = `Device: ${currentDeviceId || 'PLANT-001'}`;
        }
        
        // Add spin animation if not exists
        if (!document.querySelector('#spin-animation')) {
            const style = document.createElement('style');
            style.id = 'spin-animation';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
    } else {
        // HIDE LOADING OVERLAY
        loadingOverlay.style.display = 'none';
    }
}

function updateLoadingText(text) {
    const loadingText = document.getElementById('loadingText');
    if (loadingText) {
        loadingText.textContent = text;
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🌱 Smart Plant Watering Dashboard - Starting...");
    initDashboard();
});

function initDashboard() {
    console.log("🚀 Initializing dashboard...");
    
    // Show loading immediately
    showLoading(true);
    updateLoadingText("Initializing dashboard...");
    
    // Get device ID
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'PLANT-001';
    
    console.log("📱 Device ID:", currentDeviceId);
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Update loading text with device info
    updateLoadingText(`Loading data for ${currentDeviceId}...`);
    
    // Initialize UI components
    initializeGauge();
    initializeHistoryChart();
    
    // Show initial placeholder data
    showInitialData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Fetch data
    updateLoadingText("Fetching live data...");
    fetchData();
    
    // Start auto-refresh every 10 seconds
    setInterval(fetchData, 10000);
    
    // Fetch history
    fetchHistoryData();
    
    // Start countdown timer
    startCountdownTimer();
    
    console.log("✅ Dashboard initialization complete");
}

function showInitialData() {
    console.log("📊 Setting initial display values");
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Set all initial values (will be updated when real data loads)
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
        elements.humidity.textContent = '45.0%';
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
    
    // Initialize gauge to 100%
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
            console.log("🔄 Manual refresh triggered");
            showLoading(true);
            updateLoadingText("Manual refresh...");
            setTimeout(() => {
                fetchData();
                showNotification("Data refreshed");
            }, 500);
        });
    } else {
        console.warn("⚠️ Refresh button not found");
    }
    
    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    } else {
        console.warn("⚠️ Export button not found");
    }
}

function startCountdownTimer() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    currentCountdown = 10;
    
    // Find countdown display element
    let countdownElement = document.getElementById('countdownTimer');
    if (!countdownElement) {
        // Try to find it by text content
        const elements = document.querySelectorAll('*');
        for (let el of elements) {
            if (el.textContent && el.textContent.includes('Next refresh in:')) {
                countdownElement = el;
                break;
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
    } else {
        console.warn("⚠️ Countdown timer element not found");
    }
}

// ==================== DATA FETCHING ====================
async function fetchData() {
    console.log(`🔍 Fetching data for: ${currentDeviceId}`);
    
    updateLoadingText(`Fetching from ${currentDeviceId}...`);
    
    try {
        const timestamp = new Date().getTime();
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json?t=${timestamp}`;
        
        console.log("🌐 Request URL:", url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log("📦 Data received:", data);
        
        if (data === null || Object.keys(data).length === 0) {
            console.warn("⚠️ No data in Firebase");
            updateLoadingText("No data found - showing demo...");
            setTimeout(() => {
                showDemoData();
                showLoading(false);
            }, 1500);
            return;
        }
        
        updateLoadingText("Processing data...");
        
        // Process the actual data
        setTimeout(() => {
            processFirebaseData(data);
            showLoading(false);
        }, 800);
        
    } catch (error) {
        console.error('❌ Fetch error:', error);
        updateLoadingText("Connection error - showing demo...");
        setTimeout(() => {
            showNotification("Connection error - using demo data");
            showDemoData();
            showLoading(false);
        }, 1500);
    }
}

function processFirebaseData(data) {
    console.log("🔄 Processing data:", data);
    
    // Extract values from your Firebase structure
    const moistureValue = data.moisture || data.moisture_percent || 100;
    const statusText = data.moistureStatus || data.status || "TOO WET";
    const rawSensorValue = data.sensor_value || data.value || data.raw || 1200;
    const temperatureValue = data.temperature || 22.9;
    const humidityValue = data.humidity || 45.0;
    const updateCountValue = data.update_count || 0;
    const deviceIdValue = data.device_id || currentDeviceId;
    
    console.log("📊 Extracted:", {
        moisture: moistureValue,
        status: statusText,
        rawValue: rawSensorValue,
        temperature: temperatureValue,
        humidity: humidityValue
    });
    
    // Update UI
    updateAllDisplays({
        moisture: moistureValue,
        status: statusText,
        rawValue: rawSensorValue,
        temperature: temperatureValue,
        humidity: humidityValue,
        updateCount: updateCountValue,
        deviceId: deviceIdValue
    });
    
    // Store current data
    currentData = {
        moisture_percent: moistureValue,
        status: statusText,
        raw_value: rawSensorValue,
        temperature: temperatureValue,
        humidity: humidityValue,
        device_id: deviceIdValue,
        timestamp: new Date().toISOString()
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
    
    console.log("✅ Data processing complete");
    showNotification("Data updated successfully");
}

function updateAllDisplays(data) {
    // Update all UI elements with new data
    if (elements.moisturePercent) {
        elements.moisturePercent.textContent = `${data.moisture.toFixed(1)}%`;
    }
    
    if (elements.statusIndicator) {
        elements.statusIndicator.textContent = data.status;
        
        // Set status class
        let statusClass = 'status-too-wet';
        if (data.status.includes("NEED WATER") || data.moisture < 30) {
            statusClass = 'status-need-water';
        } else if (data.status.includes("OK") || (data.moisture >= 30 && data.moisture <= 70)) {
            statusClass = 'status-ok';
        }
        
        elements.statusIndicator.className = `status-indicator ${statusClass}`;
    }
    
    if (elements.rawValue) {
        elements.rawValue.textContent = data.rawValue;
    }
    
    if (elements.temperature) {
        elements.temperature.textContent = `${data.temperature.toFixed(1)}°C`;
    }
    
    if (elements.humidity) {
        elements.humidity.textContent = `${data.humidity.toFixed(1)}%`;
    }
    
    if (elements.updateCount) {
        elements.updateCount.textContent = data.updateCount || updateCount++;
    }
    
    if (elements.lastUpdate) {
        const now = new Date();
        elements.lastUpdate.textContent = now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
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
        
        updateRecordsTable();
    }
}

async function fetchHistoryData() {
    console.log("📚 Fetching history data...");
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/history.json?orderBy="timestamp"&limitToLast=30`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data === null) {
            console.log("No history data yet");
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
        
        updateRecordsTable();
        
        console.log(`✅ Loaded ${historyArray.length} history records`);
        
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
    
    const recordsToShow = realRecords.length > 0 ? realRecords.slice(0, 10) : [];
    
    if (recordsToShow.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #718096;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                        <i class="fas fa-leaf" style="font-size: 2.5rem; color: #cbd5e0;"></i>
                        <div style="font-size: 1rem;">No plant records available yet.</div>
                        <div style="font-size: 0.9rem; color: #a0aec0;">Data will appear here automatically.</div>
                    </div>
                </td>
            </tr>
        `;
        
        if (elements.recordCount) {
            elements.recordCount.textContent = '0';
        }
        
        return;
    }
    
    tableBody.innerHTML = '';
    
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
        
        // Create row
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
    
    if (elements.recordCount) {
        elements.recordCount.textContent = recordsToShow.length;
    }
}

// ==================== CHARTS ====================
function initializeGauge() {
    const canvas = document.getElementById('moistureGauge');
    if (!canvas) {
        console.error("❌ Gauge canvas not found");
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
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
    
    console.log("✅ Moisture gauge initialized");
}

function initializeHistoryChart() {
    const canvas = document.getElementById('historyChart');
    if (!canvas) {
        console.error("❌ History chart canvas not found");
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
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    console.log("✅ History chart initialized");
}

function updateGauge(percentage) {
    if (!moistureGauge) return;
    
    moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
    
    let gaugeColor;
    if (percentage <= 30) {
        gaugeColor = '#ff6b6b';
    } else if (percentage <= 70) {
        gaugeColor = '#51cf66';
    } else {
        gaugeColor = '#339af0';
    }
    
    moistureGauge.data.datasets[0].backgroundColor = [gaugeColor, '#e9ecef'];
    moistureGauge.update();
}

function updateHistoryChart(percentage) {
    if (!historyChart) return;
    
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    moistureHistory.push({
        time: timeLabel,
        percentage: percentage
    });
    
    if (moistureHistory.length > 30) {
        moistureHistory.shift();
    }
    
    historyChart.data.labels = moistureHistory.map(item => item.time);
    historyChart.data.datasets[0].data = moistureHistory.map(item => item.percentage);
    historyChart.update();
}

// ==================== DEMO DATA ====================
function showDemoData() {
    console.log("🔄 Showing demo data");
    
    const demoData = {
        moisture: 100,
        status: "TOO WET",
        rawValue: 1200,
        temperature: 22.9,
        humidity: 45.5,
        updateCount: Math.floor(Math.random() * 50) + 1,
        deviceId: currentDeviceId
    };
    
    updateAllDisplays(demoData);
    
    updateGauge(demoData.moisture);
    updateHistoryChart(demoData.moisture);
    
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
    
    showNotification("Using demo data - check Firebase connection");
}

// ==================== UTILITY FUNCTIONS ====================
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.dashboard-notification');
    existing.forEach(el => el.remove());
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'dashboard-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ff6b6b' : type === 'warning' ? '#ffd43b' : '#51cf66'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 500;
        font-size: 14px;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Add animation style if needed
    if (!document.querySelector('#notification-style')) {
        const style = document.createElement('style');
        style.id = 'notification-style';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
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
    const csvRows = [headers.join(',')];
    
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
    
    showNotification(`Exported ${realRecords.length} records`);
}

// ==================== EVENT HANDLERS ====================
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log("👀 Page visible - refreshing");
        fetchData();
    }
});

window.addEventListener('online', function() {
    console.log("🌐 Online - refreshing");
    showNotification("Connection restored");
    fetchData();
});

window.addEventListener('offline', function() {
    console.log("📴 Offline");
    showNotification("Connection lost", 'warning');
});

// ==================== DEBUG FUNCTIONS ====================
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
    },
    showLoading: function(show) {
        showLoading(show);
    },
    testFirebase: function() {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        console.log("🌐 Testing Firebase URL:", url);
        fetch(url)
            .then(r => r.json())
            .then(data => console.log("Firebase response:", data))
            .catch(err => console.error("Firebase error:", err));
    }
};

console.log("🎯 Dashboard script loaded - ready!");
console.log("💡 Debug: debugDashboard.fetchData(), debugDashboard.testFirebase()");
