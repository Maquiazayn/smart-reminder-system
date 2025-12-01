// dashboard.js - Smart Plant Watering Dashboard with Minute-by-Minute History
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

// Global variables
let currentDeviceId = null;
let updateCount = 0;
let minuteHistory = [];
const MAX_HISTORY_MINUTES = 60; // 60 minutes of history
const MAX_RECORDS = 10;
let currentChartView = 'minutes';
let historyChartInstance = null;

// Generate initial minute-by-minute data for the last 60 minutes
function generateInitialMinuteData() {
    const now = new Date();
    const data = [];
    
    for (let i = 59; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60000); // Each minute
        const minute = timestamp.getMinutes();
        
        // Generate realistic moisture data with some variation
        const baseMoisture = 45 + Math.sin(i * 0.1) * 15;
        const moisture = Math.max(0, Math.min(100, baseMoisture + (Math.random() * 5 - 2.5)));
        
        data.push({
            time: timestamp,
            minute: minute,
            moisture: moisture,
            temperature: 22 + Math.sin(i * 0.05) * 2 + (Math.random() * 1 - 0.5),
            humidity: 45 + Math.sin(i * 0.08) * 8 + (Math.random() * 3 - 1.5)
        });
    }
    
    return data;
}

// Initialize with sample minute data
let minuteData = generateInitialMinuteData();

// Sample records data for plant watering system
let plantRecords = [
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
    percentageLarge: document.getElementById('percentageLarge'),
    plantStatusText: document.getElementById('plantStatusText'),
    warningBanner: document.getElementById('warningBanner'),
    temperature: document.getElementById('temperature'),
    humidity: document.getElementById('humidity'),
    rawValue: document.getElementById('rawValue'),
    updateCount: document.getElementById('updateCount'),
    deviceId: document.getElementById('deviceId'),
    lastUpdate: document.getElementById('lastUpdate'),
    recordsTableBody: document.getElementById('recordsTableBody'),
    recordCount: document.getElementById('recordCount'),
    currentMoisture: document.getElementById('currentMoisture'),
    averageMoisture: document.getElementById('averageMoisture'),
    maxMoisture: document.getElementById('maxMoisture'),
    minMoisture: document.getElementById('minMoisture')
};

// Chart instances
let moistureGauge = null;

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

// Main initialization function
function initDashboard() {
    console.log("Smart Plant Watering Dashboard initializing...");
    
    // Initialize gauge chart
    initializeGauge();
    
    // Initialize history chart
    initializeHistoryChart();
    
    // Get device ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'PLANT-001';
    
    // Set device ID in UI
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Initialize records table with data
    updateRecordsTable();
    
    // Update history chart with initial data
    updateHistoryChart();
    
    // Start fetching data
    fetchData();
    
    // Set up auto-refresh every 60 seconds (1 minute)
    setInterval(fetchData, 60000);
    
    // Update chart every minute for demo
    setInterval(updateMinuteData, 60000);
    
    console.log("Dashboard initialized for device:", currentDeviceId);
}

// Update the records table with plant data
function updateRecordsTable() {
    const tableBody = elements.recordsTableBody;
    tableBody.innerHTML = '';
    
    // Populate table rows
    plantRecords.forEach(record => {
        const row = document.createElement('tr');
        
        // Determine status badge class and color for moisture level
        let statusClass = '';
        let moistureColorClass = '';
        
        if (record.status === "NEED WATER") {
            statusClass = 'status-need-water-badge';
            moistureColorClass = 'moisture-low';
        } else if (record.status === "OK") {
            statusClass = 'status-ok-badge';
            moistureColorClass = 'moisture-ok';
        } else {
            statusClass = 'status-too-wet-badge';
            moistureColorClass = 'moisture-high';
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
    elements.recordCount.textContent = plantRecords.length;
}

// Initialize the moisture gauge chart
function initializeGauge() {
    const ctx = document.getElementById('moistureGauge').getContext('2d');
    
    moistureGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [50, 50],
                backgroundColor: ['#3498db', 'rgba(255, 255, 255, 0.2)'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270,
                borderRadius: 10
            }]
        },
        options: {
            cutout: '85%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            animation: {
                animateRotate: true,
                animateScale: true
            }
        }
    });
}

// Initialize the history line chart
function initializeHistoryChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    historyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Soil Moisture (%)',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 3,
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(44, 62, 80, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3498db',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `Moisture: ${context.parsed.y.toFixed(1)}%`;
                        },
                        title: function(context) {
                            const index = context[0].dataIndex;
                            if (minuteData[index]) {
                                const time = minuteData[index].time;
                                return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: '600'
                        },
                        color: '#7f8c8d',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Moisture Level (%)',
                        color: '#2c3e50',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: '600'
                        },
                        color: '#7f8c8d',
                        maxRotation: 45,
                        callback: function(value, index) {
                            // Show every 10th minute label to avoid clutter
                            if (index % 10 === 0 && minuteData[index]) {
                                return minuteData[index].time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            }
                            return '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time (Last 60 Minutes)',
                        color: '#2c3e50',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                line: {
                    tension: 0.4
                }
            }
        }
    });
}

// Update minute data (add new data point every minute)
function updateMinuteData() {
    const now = new Date();
    const currentMinute = now.getMinutes();
    
    // Check if we already have data for this minute
    const lastData = minuteData[minuteData.length - 1];
    if (lastData && lastData.time.getMinutes() === currentMinute) {
        // Update existing minute data
        const variation = (Math.random() * 2 - 1); // Small random variation
        lastData.moisture = Math.max(0, Math.min(100, lastData.moisture + variation));
    } else {
        // Add new minute data
        const baseMoisture = 45 + Math.sin(minuteData.length * 0.1) * 15;
        const newMoisture = Math.max(0, Math.min(100, baseMoisture + (Math.random() * 3 - 1.5)));
        
        minuteData.push({
            time: now,
            minute: currentMinute,
            moisture: newMoisture,
            temperature: 22 + Math.sin(minuteData.length * 0.05) * 2,
            humidity: 45 + Math.sin(minuteData.length * 0.08) * 8
        });
        
        // Keep only last 60 minutes
        if (minuteData.length > MAX_HISTORY_MINUTES) {
            minuteData.shift();
        }
    }
    
    // Update the chart
    updateHistoryChart();
}

// Update history chart with minute data
function updateHistoryChart() {
    if (!historyChartInstance) return;
    
    // Prepare data based on current view
    let labels = [];
    let moistureData = [];
    
    // Always use minute data, just change display
    minuteData.forEach((data, index) => {
        const timeLabel = data.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        labels.push(timeLabel);
        moistureData.push(data.moisture);
    });
    
    // Update chart data
    historyChartInstance.data.labels = labels;
    historyChartInstance.data.datasets[0].data = moistureData;
    
    // Update chart info based on view
    switch(currentChartView) {
        case 'minutes':
            historyChartInstance.data.datasets[0].label = 'Soil Moisture (%) - Per Minute';
            break;
        case 'average':
            // Calculate 5-minute averages
            const averagedData = [];
            for (let i = 0; i < moistureData.length; i += 5) {
                const slice = moistureData.slice(i, i + 5);
                const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
                averagedData.push(avg);
            }
            historyChartInstance.data.datasets[0].data = averagedData;
            historyChartInstance.data.datasets[0].label = 'Soil Moisture (%) - 5-Min Average';
            break;
        case 'trend':
            historyChartInstance.data.datasets[0].label = 'Soil Moisture (%) - Trend';
            break;
    }
    
    // Calculate statistics
    if (moistureData.length > 0) {
        const current = moistureData[moistureData.length - 1];
        const average = moistureData.reduce((a, b) => a + b, 0) / moistureData.length;
        const max = Math.max(...moistureData);
        const min = Math.min(...moistureData);
        
        // Update statistics display
        elements.currentMoisture.textContent = `${current.toFixed(1)}%`;
        elements.averageMoisture.textContent = `${average.toFixed(1)}%`;
        elements.maxMoisture.textContent = `${max.toFixed(1)}%`;
        elements.minMoisture.textContent = `${min.toFixed(1)}%`;
    }
    
    historyChartInstance.update();
}

// Change chart view
function changeChartView(view) {
    // Update active button
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update chart view
    currentChartView = view;
    updateHistoryChart();
}

// Update the moisture gauge with new value
function updateGauge(percentage) {
    if (moistureGauge) {
        moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
        
        // Set color based on moisture level
        let color;
        if (percentage <= 30) {
            color = '#e74c3c';
        } else if (percentage <= 70) {
            color = '#2ecc71';
        } else {
            color = '#3498db';
        }
        
        moistureGauge.data.datasets[0].backgroundColor = [color, 'rgba(255, 255, 255, 0.2)'];
        moistureGauge.update('active');
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

// Update warning banner based on moisture level
function updateWarningBanner(percentage) {
    const warningBanner = elements.warningBanner;
    
    if (percentage <= 30) {
        warningBanner.style.display = 'block';
        warningBanner.innerHTML = '<i class="fas fa-exclamation-circle"></i> WARNING: Plant needs water immediately!';
        warningBanner.style.background = '#e74c3c';
    } else if (percentage >= 71) {
        warningBanner.style.display = 'block';
        warningBanner.innerHTML = '<i class="fas fa-exclamation-circle"></i> ALERT: Soil is too wet!';
        warningBanner.style.background = '#3498db';
    } else {
        warningBanner.style.display = 'none';
    }
}

// Add new record to history
function addNewRecord(data) {
    const now = new Date();
    const percentage = data.moisture_percent || 0;
    const status = getStatusText(percentage);
    
    const newRecord = {
        timestamp: now.toLocaleString(),
        moistureLevel: percentage,
        temperature: data.temperature || 0,
        humidity: data.humidity || 0,
        status: status
    };
    
    // Add new record to beginning of array
    plantRecords.unshift(newRecord);
    
    // Keep only last N records
    if (plantRecords.length > MAX_RECORDS) {
        plantRecords.pop();
    }
    
    // Update the table
    updateRecordsTable();
    
    // Add to minute data
    const currentMinute = now.getMinutes();
    minuteData.push({
        time: now,
        minute: currentMinute,
        moisture: percentage,
        temperature: data.temperature || 0,
        humidity: data.humidity || 0
    });
    
    // Keep only last 60 minutes
    if (minuteData.length > MAX_HISTORY_MINUTES) {
        minuteData.shift();
    }
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
    elements.moisturePercent.textContent = `${percentage.toFixed(1)}`;
    elements.percentageLarge.textContent = `${percentage.toFixed(1)}%`;
    elements.plantStatusText.textContent = statusText;
    elements.plantStatusText.className = `plant-status-text ${statusClass}`;
    
    // Update warning banner
    updateWarningBanner(percentage);
    
    // Update environment data
    elements.temperature.textContent = data.temperature ? `${data.temperature.toFixed(1)}` : '--';
    elements.humidity.textContent = data.humidity ? `${data.humidity.toFixed(1)}` : '--';
    elements.rawValue.textContent = rawValue;
    
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
    
    // Add to history
    addNewRecord(data);
    
    // Update gauge
    updateGauge(percentage);
    
    // Update history chart with new data point
    updateHistoryChart();
    
    console.log("UI updated successfully");
}

// Fetch data from Firebase
async function fetchData() {
    console.log(`Fetching data for device: ${currentDeviceId}`);
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Received data:", data);
        
        if (data === null) {
            console.warn("No data found at this path");
            showDemoData();
            return;
        }
        
        updateUI(data);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        
        // Show connection error in UI
        elements.moisturePercent.textContent = 'ERR';
        elements.percentageLarge.textContent = 'ERROR';
        elements.plantStatusText.textContent = 'CONNECTION FAILED';
        elements.plantStatusText.className = 'plant-status-text status-need-water';
        
        // Fall back to demo mode
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
        moisture_value: rawValue,
        moisture_percent: percentage,
        temperature: 22 + Math.random() * 5,
        humidity: 40 + Math.random() * 30,
        timestamp: Date.now(),
        status: 'OK'
    };
    
    updateUI(demoData);
    
    // Update UI to indicate demo mode
    elements.plantStatusText.textContent = 'DEMO MODE';
    elements.deviceId.textContent = currentDeviceId + ' (DEMO)';
}

// Refresh all data
function refreshData() {
    console.log("Refreshing all data...");
    fetchData();
    showNotification("Plant data refreshed successfully");
}

// Show notification
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2ecc71;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        z-index: 1000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        border-left: 5px solid #27ae60;
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
    
    notification.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
        }, 300);
    }, 3000);
}

// Simulate real-time updates for demo
function simulateRealTimeUpdates() {
    setInterval(() => {
        const rawValue = Math.floor(Math.random() * 4096);
        const percentage = 40 + Math.random() * 30;
        
        const demoData = {
            device_id: currentDeviceId,
            moisture_value: rawValue,
            moisture_percent: percentage,
            temperature: 22 + Math.random() * 5,
            humidity: 40 + Math.random() * 30,
            timestamp: Date.now(),
            status: 'OK'
        };
        
        updateUI(demoData);
        
    }, 30000); // Update every 30 seconds for demo
}

// Start simulation when page loads (optional)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(simulateRealTimeUpdates, 5000);
});
