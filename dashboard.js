// dashboard.js - Smart Plant Watering Dashboard
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

// Data smoothing for consistent readings
const SENSOR_BUFFER_SIZE = 5;
let moistureBuffer = [];
let temperatureBuffer = [];
let humidityBuffer = [];

// Calibration settings
const CALIBRATION = {
    DRY_VALUE: 4095,
    WET_VALUE: 1800,
    MIN_PERCENTAGE: 0,
    MAX_PERCENTAGE: 100
};

// Sample records data for plant watering system
const sampleRecords = [
    {
        timestamp: "11/19/2025, 10:29:04 PM",
        moistureLevel: 25.4,
        temperature: 22.5,
        humidity: 45.2,
        status: "NEED WATER"
    },
    {
        timestamp: "11/19/2025, 10:30:04 PM",
        moistureLevel: 65.2,
        temperature: 22.7,
        humidity: 46.8,
        status: "OK"
    },
    {
        timestamp: "11/19/2025, 10:31:04 PM",
        moistureLevel: 75.8,
        temperature: 23.1,
        humidity: 48.3,
        status: "TOO WET"
    },
    {
        timestamp: "11/19/2025, 10:32:04 PM",
        moistureLevel: 68.5,
        temperature: 22.9,
        humidity: 47.1,
        status: "OK"
    },
    {
        timestamp: "11/19/2025, 10:33:04 PM",
        moistureLevel: 72.4,
        temperature: 23.2,
        humidity: 49.5,
        status: "TOO WET"
    },
    {
        timestamp: "11/19/2025, 10:34:04 PM",
        moistureLevel: 28.7,
        temperature: 22.3,
        humidity: 44.8,
        status: "NEED WATER"
    },
    {
        timestamp: "11/19/2025, 10:35:04 PM",
        moistureLevel: 42.1,
        temperature: 22.6,
        humidity: 46.2,
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
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'plant-sensor-001';
    
    // Set device ID in UI
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Initialize records table with data
    updateRecordsTable();
    
    // Clear data buffers
    clearDataBuffers();
    
    // Start fetching data
    fetchData();
    
    // Set up auto-refresh every 10 seconds
    setInterval(fetchData, 10000);
    
    // Add click event to refresh button
    document.querySelector('.refresh-btn').addEventListener('click', fetchData);
    
    console.log("Dashboard initialized for device:", currentDeviceId);
}

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
        background: rgba(255, 212, 59, 0.2);
        color: #ffd43b;
        border: 2px solid #ffd43b;
    `;
    header.appendChild(statusDiv);
    elements.connectionStatus = statusDiv;
    updateConnectionStatus('connecting', 'Connecting to Firebase...');
}

// Update connection status
function updateConnectionStatus(status, message = '') {
    if (!elements.connectionStatus) return;
    
    elements.connectionStatus.style.background = '';
    elements.connectionStatus.style.color = '';
    elements.connectionStatus.style.borderColor = '';
    
    switch(status) {
        case 'connected':
            elements.connectionStatus.style.background = 'rgba(81, 207, 102, 0.2)';
            elements.connectionStatus.style.color = '#51cf66';
            elements.connectionStatus.style.borderColor = '#51cf66';
            elements.connectionStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${message || 'Connected to Firebase'}`;
            break;
        case 'disconnected':
            elements.connectionStatus.style.background = 'rgba(255, 107, 107, 0.2)';
            elements.connectionStatus.style.color = '#ff6b6b';
            elements.connectionStatus.style.borderColor = '#ff6b6b';
            elements.connectionStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message || 'Disconnected from Firebase'}`;
            break;
        case 'connecting':
            elements.connectionStatus.style.background = 'rgba(255, 212, 59, 0.2)';
            elements.connectionStatus.style.color = '#ffd43b';
            elements.connectionStatus.style.borderColor = '#ffd43b';
            elements.connectionStatus.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> ${message || 'Connecting...'}`;
            break;
        case 'demo':
            elements.connectionStatus.style.background = 'rgba(102, 126, 234, 0.2)';
            elements.connectionStatus.style.color = '#667eea';
            elements.connectionStatus.style.borderColor = '#667eea';
            elements.connectionStatus.innerHTML = `<i class="fas fa-flask"></i> ${message || 'Demo Mode Active'}`;
            break;
    }
}

// Clear data buffers
function clearDataBuffers() {
    moistureBuffer = [];
    temperatureBuffer = [];
    humidityBuffer = [];
}

// Data smoothing functions
function addToBuffer(buffer, value, maxSize = SENSOR_BUFFER_SIZE) {
    buffer.push(value);
    if (buffer.length > maxSize) {
        buffer.shift();
    }
    
    // Calculate median for better noise reduction
    const sorted = [...buffer].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

function exponentialSmoothing(newValue, oldValue, alpha = 0.3) {
    if (oldValue === null || oldValue === undefined) return newValue;
    return (alpha * newValue) + ((1 - alpha) * oldValue);
}

function convertToPercentage(rawValue) {
    const clampedValue = Math.max(Math.min(rawValue, CALIBRATION.DRY_VALUE), CALIBRATION.WET_VALUE);
    const percentage = 100 - ((clampedValue - CALIBRATION.WET_VALUE) / 
        (CALIBRATION.DRY_VALUE - CALIBRATION.WET_VALUE)) * 100;
    return Math.max(CALIBRATION.MIN_PERCENTAGE, Math.min(CALIBRATION.MAX_PERCENTAGE, percentage));
}

function filterSensorData(currentValue, previousValue, maxChange = 10) {
    if (previousValue === null || previousValue === undefined) return currentValue;
    
    const change = Math.abs(currentValue - previousValue);
    
    if (change > maxChange) {
        console.warn(`Filtered out spike: ${change.toFixed(1)}% change`);
        return previousValue;
    }
    
    return currentValue;
}

function processSensorData(data) {
    if (!data) return null;
    
    let rawMoisture = data.moisture_value || 0;
    let rawPercentage = data.moisture_percent || 0;
    
    // Convert raw value to percentage if needed
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
        timestamp: data.timestamp || Date.now()
    };
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
        
        // Create row HTML matching your table format
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

// Update all UI elements with sensor data
function updateUI(data) {
    console.log("Updating UI with data:", data);
    
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
    
    // Keep only last 10 records
    if (sampleRecords.length > 10) {
        sampleRecords.pop();
    }
    
    updateRecordsTable();
}

// TEST FIREBASE CONNECTION FIRST
async function testFirebaseConnection() {
    console.log("Testing Firebase connection...");
    updateConnectionStatus('connecting', 'Testing Firebase connection...');
    
    try {
        // Test the root of the database
        const testUrl = `${FIREBASE_CONFIG.databaseURL}/.json`;
        console.log("Testing URL:", testUrl);
        
        const response = await fetch(testUrl);
        console.log("Test response status:", response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log("Firebase test successful. Database structure:", data);
            
            if (data === null) {
                updateConnectionStatus('connected', 'Firebase connected (empty database)');
                return true;
            } else {
                // Check if plants data exists
                const paths = Object.keys(data);
                console.log("Available paths in database:", paths);
                
                let foundPlants = false;
                for (const path of paths) {
                    if (path.toLowerCase().includes('plant') || 
                        (data[path] && typeof data[path] === 'object' && 
                         (data[path].moisture || data[path].temperature))) {
                        foundPlants = true;
                        console.log("Found plant data at path:", path);
                        // Try to use this device ID
                        if (path !== '.settings' && path !== '.info') {
                            currentDeviceId = path;
                            elements.deviceId.textContent = currentDeviceId;
                            localStorage.setItem('plantDeviceId', currentDeviceId);
                            break;
                        }
                    }
                }
                
                if (foundPlants) {
                    updateConnectionStatus('connected', `Connected to Firebase (Found ${paths.length} paths)`);
                } else {
                    updateConnectionStatus('connected', 'Connected to Firebase (No plant data yet)');
                }
                return true;
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error("Firebase connection test failed:", error);
        updateConnectionStatus('disconnected', `Connection failed: ${error.message}`);
        return false;
    }
}

// Fetch data from Firebase - IMPROVED VERSION
async function fetchData() {
    console.log(`Fetching data for device: ${currentDeviceId}`);
    
    // Test connection first if this is the first fetch
    if (updateCount === 0) {
        const connected = await testFirebaseConnection();
        if (!connected) {
            showDemoData();
            return;
        }
    }
    
    updateConnectionStatus('connecting', 'Fetching sensor data...');
    
    try {
        // Try multiple possible paths
        const possiblePaths = [
            `plants/${currentDeviceId}/latest`,
            `plants/${currentDeviceId}`,
            `devices/${currentDeviceId}`,
            `sensor/${currentDeviceId}`,
            `${currentDeviceId}`,
            `plants`, // Try to get all plants and find first one
            `sensor`  // Try to get all sensors
        ];
        
        let foundData = null;
        let foundPath = null;
        
        for (const path of possiblePaths) {
            const url = `${FIREBASE_CONFIG.databaseURL}/${path}.json`;
            console.log(`Trying path: ${url}`);
            
            try {
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data !== null) {
                        console.log(`Found data at path: ${path}`, data);
                        
                        // Extract data based on structure
                        if (path === 'plants' || path === 'sensor') {
                            // We got a collection, find first device
                            const devices = Object.keys(data);
                            if (devices.length > 0) {
                                const firstDevice = devices[0];
                                const deviceData = data[firstDevice];
                                if (deviceData.latest) {
                                    foundData = deviceData.latest;
                                } else if (deviceData.moisture || deviceData.temperature) {
                                    foundData = deviceData;
                                }
                                currentDeviceId = firstDevice;
                                elements.deviceId.textContent = currentDeviceId;
                                localStorage.setItem('plantDeviceId', currentDeviceId);
                                foundPath = `${path}/${firstDevice}`;
                            }
                        } else if (data.latest) {
                            foundData = data.latest;
                            foundPath = `${path}/latest`;
                        } else {
                            foundData = data;
                            foundPath = path;
                        }
                        
                        if (foundData) break;
                    }
                }
            } catch (error) {
                console.log(`No data at path ${path}:`, error.message);
                continue;
            }
        }
        
        if (!foundData) {
            console.log("No data found in any path, checking root...");
            
            // Check root for any data
            const rootUrl = `${FIREBASE_CONFIG.databaseURL}/.json`;
            const response = await fetch(rootUrl);
            if (response.ok) {
                const rootData = await response.json();
                console.log("Root database content:", rootData);
                
                if (rootData) {
                    // Look for any data that looks like sensor readings
                    for (const key in rootData) {
                        if (key !== '.settings' && key !== '.info' && rootData[key]) {
                            const candidate = rootData[key];
                            if (candidate.moisture !== undefined || candidate.temperature !== undefined) {
                                foundData = candidate;
                                currentDeviceId = key;
                                elements.deviceId.textContent = currentDeviceId;
                                localStorage.setItem('plantDeviceId', currentDeviceId);
                                foundPath = key;
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        if (!foundData) {
            console.warn("No sensor data found in Firebase");
            updateConnectionStatus('demo', 'No data found - Using Demo Mode');
            showDemoData();
            return;
        }
        
        console.log(`Successfully retrieved data from: ${foundPath}`, foundData);
        
        // Process the data with smoothing
        const processedData = processSensorData(foundData);
        
        // Update UI
        updateUI(processedData);
        updateConnectionStatus('connected', `Receiving data from ${currentDeviceId}`);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        updateConnectionStatus('disconnected', `Error: ${error.message}`);
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
    const variation = Math.sin(Date.now() / 600000) * 10; // Slow oscillation over 10 minutes
    const randomNoise = (Math.random() - 0.5) * 2; // Small random noise
    const percentage = Math.max(20, Math.min(80, baseMoisture + variation + randomNoise));
    
    const processedPercentage = addToBuffer(moistureBuffer, percentage);
    
    const demoData = {
        device_id: currentDeviceId,
        moisture_value: Math.floor(CALIBRATION.WET_VALUE + 
            ((100 - processedPercentage) / 100) * (CALIBRATION.DRY_VALUE - CALIBRATION.WET_VALUE)),
        moisture_percent: processedPercentage,
        temperature: 22 + Math.sin(Date.now() / 600000) * 3, // Slow temperature variation
        humidity: 45 + Math.cos(Date.now() / 600000) * 10, // Slow humidity variation
        timestamp: Date.now(),
        status: getStatusText(processedPercentage)
    };
    
    updateUI(demoData);
    
    // Update UI to indicate demo mode
    elements.deviceId.textContent = currentDeviceId + ' (Demo)';
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
    
    const headers = ["Timestamp", "Moisture Level (%)", "Temperature (°C)", "Humidity (%)", "Plant Status"];
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
            `"${record.status}"`
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
    
    // Add keyframes for animation
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
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 300);
    }, 3000);
}

// Manual data test function
function testFirebaseManually() {
    console.log("Manual Firebase test...");
    
    // Direct URL test
    const testUrl = "https://smart-plant-watering-rem-e050a-default-rtdb.firebaseio.com/.json";
    
    fetch(testUrl)
        .then(response => {
            console.log("Manual test response status:", response.status);
            return response.json();
        })
        .then(data => {
            console.log("Manual test data:", data);
            showNotification(`Firebase test: ${data ? 'Connected' : 'Empty database'}`);
        })
        .catch(error => {
            console.error("Manual test error:", error);
            showNotification(`Firebase test failed: ${error.message}`, 'error');
        });
}

// Add this to your index.html to add a test button
function addTestButton() {
    const footer = document.querySelector('.footer');
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Test Firebase Connection';
    testBtn.style.cssText = `
        margin: 10px;
        padding: 8px 16px;
        background: #ffd43b;
        color: #333;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: 600;
    `;
    testBtn.onclick = testFirebaseManually;
    footer.appendChild(testBtn);
}

// Initialize with test button
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(addTestButton, 1000);
});

// Simulate real-time updates for demo (modified for consistency)
function simulateRealTimeUpdates() {
    setInterval(() => {
        // Only update if in demo mode
        if (elements.connectionStatus && 
            (elements.connectionStatus.textContent.includes('Demo') || 
             elements.connectionStatus.textContent.includes('disconnected'))) {
            
            const now = new Date();
            const baseMoisture = 45;
            const variation = Math.sin(Date.now() / 600000) * 5;
            const moisture = Math.max(20, Math.min(80, baseMoisture + variation));
            const status = getStatusText(moisture);
            
            const newRecord = {
                timestamp: now.toLocaleString(),
                moistureLevel: moisture,
                temperature: 22 + Math.sin(Date.now() / 900000) * 2,
                humidity: 45 + Math.cos(Date.now() / 900000) * 8,
                status: status
            };
            
            // Add new record to beginning of array
            sampleRecords.unshift(newRecord);
            
            // Keep only last 10 records
            if (sampleRecords.length > 10) {
                sampleRecords.pop();
            }
            
            // Update the table
            updateRecordsTable();
        }
    }, 60000); // Update every minute for demo
}

// Start simulation when page loads (optional)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(simulateRealTimeUpdates, 5000);
});
