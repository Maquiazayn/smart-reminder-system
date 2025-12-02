// dashboard.js - Smart Plant Watering Dashboard (Enhanced for Consistent Data)
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAi17Nr_DVUflPmsMzpx8pptqcZxT2AfUQ",
    authDomain: "smart-plant-watering-rem-e050a.firebaseapp.com",
    databaseURL: "https://smart-plant-watering-rem-e050a-default-rtdb.firebaseio.com",
    projectId: "smart-plant-watering-rem-e050a",
    storageBucket: "smart-plant-watering-rem-e050a.firebasestorage.app",
    messagingSenderId: "658047903398",
    appId: "1:658047903398:web:f94a57849c38e3da37b667",
    measurementId: "G-LY0THX67S2"
};

// Global variables with data smoothing
let currentDeviceId = null;
let updateCount = 0;
let moistureHistory = [];
const MAX_HISTORY = 20;

// Data smoothing buffers
const SENSOR_BUFFER_SIZE = 5; // Number of readings to average
let moistureBuffer = [];
let temperatureBuffer = [];
let humidityBuffer = [];

// Calibration settings
const CALIBRATION = {
    DRY_VALUE: 4095,    // Sensor value when completely dry
    WET_VALUE: 1800,    // Sensor value when completely wet
    MIN_PERCENTAGE: 0,  // Minimum moisture percentage
    MAX_PERCENTAGE: 100 // Maximum moisture percentage
};

// Sample records data
const sampleRecords = [
    {
        timestamp: "11/19/2025, 10:29:04 PM",
        moistureLevel: 45.2,
        temperature: 22.5,
        humidity: 45.2,
        status: "OK"
    },
    {
        timestamp: "11/19/2025, 10:30:04 PM",
        moistureLevel: 46.8,
        temperature: 22.7,
        humidity: 46.8,
        status: "OK"
    },
    {
        timestamp: "11/19/2025, 10:31:04 PM",
        moistureLevel: 48.3,
        temperature: 23.1,
        humidity: 48.3,
        status: "OK"
    }
];

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
    connectionStatus: null
};

// Initialize connection status indicator
function initConnectionStatus() {
    const header = document.querySelector('.header');
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connectionStatus';
    statusDiv.style.cssText = `
        margin-top: 10px;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.9rem;
        font-weight: 500;
        display: inline-block;
        transition: all 0.3s ease;
    `;
    header.appendChild(statusDiv);
    elements.connectionStatus = statusDiv;
    updateConnectionStatus('disconnected');
}

// Update connection status
function updateConnectionStatus(status) {
    if (!elements.connectionStatus) return;
    
    const statusMap = {
        connected: {
            text: 'Connected to Sensor',
            color: '#51cf66',
            bg: 'rgba(81, 207, 102, 0.2)'
        },
        disconnected: {
            text: 'Disconnected - Using Demo Data',
            color: '#ff6b6b',
            bg: 'rgba(255, 107, 107, 0.2)'
        },
        connecting: {
            text: 'Connecting...',
            color: '#ffd43b',
            bg: 'rgba(255, 212, 59, 0.2)'
        }
    };
    
    const statusInfo = statusMap[status] || statusMap.disconnected;
    elements.connectionStatus.textContent = statusInfo.text;
    elements.connectionStatus.style.backgroundColor = statusInfo.bg;
    elements.connectionStatus.style.color = statusInfo.color;
    elements.connectionStatus.style.border = `2px solid ${statusInfo.color}`;
}

// Chart instances
let moistureGauge = null;
let historyChart = null;

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

// Main initialization function
function initDashboard() {
    console.log("Smart Plant Watering Dashboard initializing...");
    
    // Initialize connection status indicator
    initConnectionStatus();
    
    // Initialize charts
    initializeGauge();
    initializeHistoryChart();
    
    // Get device ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'demo-device';
    
    // Set device ID in UI
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Initialize records table with data
    updateRecordsTable();
    
    // Clear data buffers
    clearDataBuffers();
    
    // Start fetching data
    fetchData();
    
    // Set up auto-refresh every 5 seconds (more frequent for testing)
    setInterval(fetchData, 5000);
    
    // Add click event to refresh button
    document.querySelector('.refresh-btn').addEventListener('click', fetchData);
    
    console.log("Dashboard initialized for device:", currentDeviceId);
}

// Clear data buffers
function clearDataBuffers() {
    moistureBuffer = [];
    temperatureBuffer = [];
    humidityBuffer = [];
}

// Add data to buffer and get smoothed value
function addToBuffer(buffer, value, maxSize = SENSOR_BUFFER_SIZE) {
    buffer.push(value);
    if (buffer.length > maxSize) {
        buffer.shift();
    }
    
    // Calculate median (more resistant to outliers than average)
    const sorted = [...buffer].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

// Calculate moving average
function calculateMovingAverage(buffer) {
    if (buffer.length === 0) return 0;
    
    // Weighted average (recent values have more weight)
    let total = 0;
    let weightSum = 0;
    
    for (let i = 0; i < buffer.length; i++) {
        const weight = i + 1; // Linear weighting
        total += buffer[i] * weight;
        weightSum += weight;
    }
    
    return total / weightSum;
}

// Apply exponential smoothing
function exponentialSmoothing(newValue, oldValue, alpha = 0.3) {
    if (oldValue === null || oldValue === undefined) return newValue;
    return (alpha * newValue) + ((1 - alpha) * oldValue);
}

// Convert raw sensor value to percentage with calibration
function convertToPercentage(rawValue) {
    // Ensure raw value is within sensor range
    const clampedValue = Math.max(Math.min(rawValue, CALIBRATION.DRY_VALUE), CALIBRATION.WET_VALUE);
    
    // Map sensor value to percentage (inverse relationship for capacitive sensors)
    const percentage = 100 - ((clampedValue - CALIBRATION.WET_VALUE) / 
        (CALIBRATION.DRY_VALUE - CALIBRATION.WET_VALUE)) * 100;
    
    // Clamp to 0-100 range
    return Math.max(CALIBRATION.MIN_PERCENTAGE, Math.min(CALIBRATION.MAX_PERCENTAGE, percentage));
}

// Filter out noise and spikes
function filterSensorData(currentValue, previousValue, maxChange = 10) {
    if (previousValue === null || previousValue === undefined) return currentValue;
    
    const change = Math.abs(currentValue - previousValue);
    
    // If change is too large, reject it (probably noise/spike)
    if (change > maxChange) {
        console.warn(`Filtered out spike: ${change.toFixed(1)}% change`);
        return previousValue;
    }
    
    return currentValue;
}

// Update the records table with plant data
function updateRecordsTable() {
    const tableBody = elements.recordsTableBody;
    tableBody.innerHTML = '';
    
    // Populate table rows
    sampleRecords.forEach(record => {
        const row = document.createElement('tr');
        
        // Determine status badge class and color for moisture level
        let statusClass = '';
        let moistureColorClass = '';
        
        if (record.status === "NEED WATER") {
            statusClass = 'status-need-water-badge';
            moistureColorClass = 'water-level-low';
        } else if (record.status === "OK") {
            statusClass = 'status-ok-badge';
            moistureColorClass = 'water-level-ok';
        } else {
            statusClass = 'status-too-wet-badge';
            moistureColorClass = 'water-level-high';
        }
        
        // Create row HTML
        row.innerHTML = `
            <td class="timestamp-col">${record.timestamp}</td>
            <td class="percent-col ${moistureColorClass}">${record.moistureLevel.toFixed(1)}%</td>
            <td class="value-col">${record.temperature.toFixed(1)}°C</td>
            <td class="percent-col">${record.humidity.toFixed(1)}%</td>
            <td class="status-col">
                <span class="status-badge ${statusClass}">${record.status}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update record count
    elements.recordCount.textContent = sampleRecords.length;
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
                tension: 0.2, // Lower tension for more accurate representation
                borderWidth: 2
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
            minute: '2-digit',
            second: '2-digit'
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

// Process and smooth sensor data
function processSensorData(data) {
    if (!data) return null;
    
    let rawMoisture = data.moisture_value || 0;
    let rawPercentage = data.moisture_percent || 0;
    
    // If we have raw value but no percentage, calculate it
    if (rawMoisture > 0 && rawPercentage === 0) {
        rawPercentage = convertToPercentage(rawMoisture);
    }
    
    // Get previous values for filtering
    const prevMoisture = moistureBuffer.length > 0 ? moistureBuffer[moistureBuffer.length - 1] : null;
    const prevTemp = temperatureBuffer.length > 0 ? temperatureBuffer[temperatureBuffer.length - 1] : null;
    const prevHumidity = humidityBuffer.length > 0 ? humidityBuffer[humidityBuffer.length - 1] : null;
    
    // Filter out spikes
    const filteredPercentage = filterSensorData(rawPercentage, prevMoisture, 15);
    
    // Add to buffers and get smoothed values
    const smoothedMoisture = addToBuffer(moistureBuffer, filteredPercentage);
    const smoothedTemperature = addToBuffer(temperatureBuffer, data.temperature || 22);
    const smoothedHumidity = addToBuffer(humidityBuffer, data.humidity || 45);
    
    // Apply exponential smoothing for extra stability
    const finalMoisture = exponentialSmoothing(smoothedMoisture, prevMoisture, 0.2);
    const finalTemperature = exponentialSmoothing(smoothedTemperature, prevTemp, 0.3);
    const finalHumidity = exponentialSmoothing(smoothedHumidity, prevHumidity, 0.3);
    
    return {
        ...data,
        moisture_value: rawMoisture,
        moisture_percent: parseFloat(finalMoisture.toFixed(1)),
        temperature: parseFloat(finalTemperature.toFixed(1)),
        humidity: parseFloat(finalHumidity.toFixed(1)),
        timestamp: data.timestamp || Date.now(),
        raw_data: {
            original_percent: rawPercentage,
            filtered_percent: filteredPercentage,
            buffer_size: moistureBuffer.length,
            buffer_values: [...moistureBuffer]
        }
    };
}

// Update all UI elements with sensor data
function updateUI(data) {
    console.log("Updating UI with processed data:", data);
    
    if (!data) {
        console.warn("No data received");
        return;
    }
    
    const percentage = data.moisture_percent || 0;
    const rawValue = data.moisture_value || 0;
    const statusClass = getStatusClass(percentage);
    const statusText = getStatusText(percentage);
    
    // Update main display elements
    elements.moisturePercent.textContent = `${percentage.toFixed(1)}%`;
    elements.statusIndicator.textContent = statusText;
    elements.statusIndicator.className = `status-indicator ${statusClass}`;
    
    // Update environment data
    elements.temperature.textContent = data.temperature ? `${data.temperature.toFixed(1)}°C` : '--°C';
    elements.humidity.textContent = data.humidity ? `${data.humidity.toFixed(1)}%` : '--%';
    elements.rawValue.textContent = rawValue;
    
    // Show buffer status as tooltip
    elements.rawValue.title = `Buffer: ${moistureBuffer.length}/${SENSOR_BUFFER_SIZE} readings`;
    
    // Update counters
    updateCount++;
    elements.updateCount.textContent = updateCount;
    
    // Update timestamp
    const now = new Date();
    elements.lastUpdate.textContent = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Update device ID if available
    if (data.device_id && data.device_id !== currentDeviceId) {
        currentDeviceId = data.device_id;
        elements.deviceId.textContent = currentDeviceId;
        localStorage.setItem('plantDeviceId', currentDeviceId);
        console.log("Updated device ID to:", currentDeviceId);
    }
    
    // Add to records if significant change or first few readings
    if (shouldAddToRecords(data)) {
        addToRecords(data);
    }
    
    // Update charts
    updateGauge(percentage);
    updateHistoryChart(percentage, data.timestamp || Date.now());
    
    console.log("UI updated successfully. Buffer status:", moistureBuffer.length);
}

// Check if data should be added to records
function shouldAddToRecords(data) {
    if (sampleRecords.length === 0) return true;
    
    const lastRecord = sampleRecords[0];
    const timeDiff = new Date() - new Date(lastRecord.timestamp);
    const moistureDiff = Math.abs(data.moisture_percent - lastRecord.moistureLevel);
    
    // Add if: 1 minute has passed OR moisture changed by more than 5%
    return timeDiff > 60000 || moistureDiff > 5;
}

// Add data to records
function addToRecords(data) {
    const newRecord = {
        timestamp: new Date().toLocaleString(),
        moistureLevel: data.moisture_percent,
        temperature: data.temperature || 22,
        humidity: data.humidity || 45,
        status: getStatusText(data.moisture_percent)
    };
    
    sampleRecords.unshift(newRecord);
    
    // Keep only last 20 records
    if (sampleRecords.length > 20) {
        sampleRecords.pop();
    }
    
    updateRecordsTable();
}

// Fetch data from Firebase
async function fetchData() {
    console.log(`Fetching data for device: ${currentDeviceId}`);
    updateConnectionStatus('connecting');
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        console.log("Fetching from URL:", url);
        
        const response = await fetch(url, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        console.log("Response status:", response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rawData = await response.json();
        console.log("Received raw data:", rawData);
        
        if (rawData === null) {
            console.warn("No data found at this path");
            showDemoData();
            return;
        }
        
        // Process and smooth the data
        const processedData = processSensorData(rawData);
        
        // Update UI with processed data
        updateUI(processedData);
        updateConnectionStatus('connected');
        
    } catch (error) {
        console.error('Error fetching data:', error);
        
        // Update connection status
        updateConnectionStatus('disconnected');
        
        // Fall back to demo mode with simulated consistency
        showDemoData();
    }
}

// Show consistent demo data when real data is not available
function showDemoData() {
    console.log("Showing consistent demo data");
    
    // Use the last value or generate consistent demo data
    const lastMoisture = moistureBuffer.length > 0 ? 
        moistureBuffer[moistureBuffer.length - 1] : 45 + Math.random() * 10;
    
    // Simulate gradual changes for more realistic demo
    const baseMoisture = 45;
    const variation = Math.sin(Date.now() / 60000) * 5; // Slow oscillation
    const randomNoise = (Math.random() - 0.5) * 2; // Small random noise
    const percentage = baseMoisture + variation + randomNoise;
    
    const processedPercentage = addToBuffer(moistureBuffer, percentage);
    
    const demoData = {
        device_id: currentDeviceId + ' (DEMO)',
        moisture_value: Math.floor(CALIBRATION.WET_VALUE + 
            ((100 - processedPercentage) / 100) * (CALIBRATION.DRY_VALUE - CALIBRATION.WET_VALUE)),
        moisture_percent: processedPercentage,
        temperature: 22 + Math.sin(Date.now() / 300000) * 2, // Slow temperature variation
        humidity: 45 + Math.cos(Date.now() / 300000) * 5, // Slow humidity variation
        timestamp: Date.now(),
        status: getStatusText(processedPercentage)
    };
    
    updateUI(demoData);
    
    // Update UI to indicate demo mode
    elements.statusIndicator.textContent = 'DEMO MODE';
    elements.deviceId.textContent = currentDeviceId + ' (DEMO)';
}

// Refresh records table
function refreshRecords() {
    console.log("Refreshing records table...");
    fetchData(); // Just fetch new data instead of generating random
    showNotification("Refreshing sensor data...");
}

// Export records to CSV
function exportToCSV() {
    console.log("Exporting to CSV...");
    
    const headers = ["Timestamp", "Moisture Level (%)", "Temperature (°C)", "Humidity (%)", "Plant Status", "Raw Sensor Value"];
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    sampleRecords.forEach(record => {
        const row = [
            `"${record.timestamp}"`,
            record.moistureLevel.toFixed(1),
            record.temperature.toFixed(1),
            record.humidity.toFixed(1),
            `"${record.status}"`,
            'N/A' // Raw value not stored in sample records
        ];
        csvRows.push(row.join(','));
    });
    
    // Create and download CSV file
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `plant_watering_records_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
    
    showNotification("CSV file downloaded successfully");
}

// Show notification
function showNotification(message) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.dashboard-notification');
    existingNotifications.forEach(n => n.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'dashboard-notification';
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
        max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Calibration functions (could be exposed in UI)
function calibrateSensor(dryValue, wetValue) {
    CALIBRATION.DRY_VALUE = dryValue;
    CALIBRATION.WET_VALUE = wetValue;
    console.log(`Calibration updated: Dry=${dryValue}, Wet=${wetValue}`);
    showNotification("Sensor calibration updated");
}

// Reset data buffers
function resetBuffers() {
    clearDataBuffers();
    console.log("Data buffers cleared");
    showNotification("Data buffers reset");
}

// Diagnostic function
function showDiagnostics() {
    const diagnostics = {
        bufferSize: moistureBuffer.length,
        bufferValues: moistureBuffer,
        calibration: { ...CALIBRATION },
        updateCount: updateCount,
        currentMoisture: moistureBuffer.length > 0 ? moistureBuffer[moistureBuffer.length - 1] : 'N/A',
        connectionStatus: elements.connectionStatus ? elements.connectionStatus.textContent : 'N/A'
    };
    
    console.log("Diagnostics:", diagnostics);
    showNotification(`Buffer: ${moistureBuffer.length}/${SENSOR_BUFFER_SIZE} readings`);
}

// Add keyboard shortcuts for debugging
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        showDiagnostics();
    }
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        resetBuffers();
    }
});

// Initialize with a small delay to ensure DOM is ready
setTimeout(() => {
    console.log("Smart Plant Watering Dashboard ready!");
    showNotification("Dashboard initialized. Press Ctrl+D for diagnostics.");
}, 1000);
