// dashboard.js - Single Plant Monitoring Dashboard
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
const MAX_HISTORY_MINUTES = 60;
const MAX_RECORDS = 20;
let currentChartView = 'minutes';
let historyChartInstance = null;

// Generate initial data for the last 60 minutes
function generateInitialMinuteData() {
    const now = new Date();
    const data = [];
    
    for (let i = 59; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60000);
        
        // Generate realistic moisture data
        const baseMoisture = 50 + Math.sin(i * 0.1) * 20;
        const moisture = Math.max(0, Math.min(100, baseMoisture + (Math.random() * 3 - 1.5)));
        
        data.push({
            time: timestamp,
            moisture: moisture,
            temperature: 22 + Math.sin(i * 0.05) * 2 + (Math.random() * 1 - 0.5),
            humidity: 45 + Math.sin(i * 0.08) * 8 + (Math.random() * 2 - 1)
        });
    }
    
    return data;
}

// Generate sample records for the last 24 hours
function generateSampleRecords() {
    const now = new Date();
    const records = [];
    
    for (let i = 0; i < 20; i++) {
        const hoursAgo = 24 - (i * 1.2); // Spread over 24 hours
        const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
        
        // Generate realistic data with some variation
        const baseMoisture = 45 + Math.sin(i * 0.5) * 25;
        const moisture = Math.max(0, Math.min(100, baseMoisture + (Math.random() * 10 - 5)));
        
        let status;
        if (moisture <= 30) status = "NEED WATER";
        else if (moisture <= 70) status = "OK";
        else status = "TOO WET";
        
        records.push({
            timestamp: timestamp.toLocaleString(),
            moistureLevel: moisture,
            temperature: 22 + Math.sin(i * 0.3) * 3 + (Math.random() * 2 - 1),
            humidity: 45 + Math.sin(i * 0.4) * 10 + (Math.random() * 5 - 2.5),
            status: status
        });
    }
    
    return records;
}

// Initialize with sample data
let minuteData = generateInitialMinuteData();
let plantRecords = generateSampleRecords();

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
    minMoisture: document.getElementById('minMoisture'),
    plantName: document.getElementById('plantName'),
    plantType: document.getElementById('plantType'),
    plantLocation: document.getElementById('plantLocation'),
    refreshStatus: document.getElementById('refreshStatus')
};

// Chart instances
let moistureGauge = null;

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

// Main initialization function
function initDashboard() {
    console.log("Single Plant Monitoring Dashboard initializing...");
    
    // Initialize gauge chart
    initializeGauge();
    
    // Initialize history chart
    initializeHistoryChart();
    
    // Get device ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'PLANT-SENSOR-001';
    
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
    
    console.log("Dashboard initialized for single plant monitoring");
}

// Update the records table with plant data
function updateRecordsTable() {
    const tableBody = elements.recordsTableBody;
    tableBody.innerHTML = '';
    
    // Sort records by timestamp (newest first)
    const sortedRecords = [...plantRecords].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    // Populate table rows (show only latest 20)
    const recordsToShow = sortedRecords.slice(0, 20);
    
    recordsToShow.forEach(record => {
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
                    pointRadius: 2,
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1,
                    pointHoverRadius: 5
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
                            // Show labels based on chart view
                            if (currentChartView === 'minutes') {
                                // Show every 10th minute for 60-minute view
                                if (index % 10 === 0 && minuteData[index]) {
                                    return minuteData[index].time.toLocaleTimeString([], { minute: '2-digit' });
                                }
                                return '';
                            } else if (currentChartView === 'hours') {
                                // Show every 3rd hour for 24-hour view
                                if (index % 3 === 0 && minuteData[index]) {
                                    return minuteData[index].time.toLocaleTimeString([], { hour: '2-digit' });
                                }
                                return '';
                            } else {
                                // Show day names for 7-day view
                                if (index % 1 === 0 && minuteData[index]) {
                                    return minuteData[index].time.toLocaleDateString('en-US', { weekday: 'short' });
                                }
                                return '';
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time',
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
    
    // Add new minute data
    const baseMoisture = 50 + Math.sin(minuteData.length * 0.1) * 20;
    const newMoisture = Math.max(0, Math.min(100, baseMoisture + (Math.random() * 3 - 1.5)));
    
    minuteData.push({
        time: now,
        moisture: newMoisture,
        temperature: 22 + Math.sin(minuteData.length * 0.05) * 2,
        humidity: 45 + Math.sin(minuteData.length * 0.08) * 8
    });
    
    // Keep only data for current view
    let maxDataPoints;
    switch(currentChartView) {
        case 'minutes':
            maxDataPoints = 60; // 60 minutes
            break;
        case 'hours':
            maxDataPoints = 24; // 24 hours (in minutes)
            break;
        case 'days':
            maxDataPoints = 7 * 24; // 7 days (in hours, simplified)
            break;
    }
    
    if (minuteData.length > maxDataPoints) {
        minuteData = minuteData.slice(-maxDataPoints);
    }
    
    // Update the chart
    updateHistoryChart();
}

// Update history chart with data
function updateHistoryChart() {
    if (!historyChartInstance) return;
    
    // Prepare data based on current view
    let labels = [];
    let moistureData = [];
    
    minuteData.forEach((data, index) => {
        let timeLabel;
        
        if (currentChartView === 'minutes') {
            timeLabel = data.time.toLocaleTimeString([], { minute: '2-digit' });
        } else if (currentChartView === 'hours') {
            timeLabel = data.time.toLocaleTimeString([], { hour: '2-digit' });
        } else {
            timeLabel = data.time.toLocaleDateString('en-US', { weekday: 'short' });
        }
        
        labels.push(timeLabel);
        moistureData.push(data.moisture);
    });
    
    // Update chart data
    historyChartInstance.data.labels = labels;
    historyChartInstance.data.datasets[0].data = moistureData;
    
    // Update chart title based on view
    switch(currentChartView) {
        case 'minutes':
            historyChartInstance.options.scales.x.title.text = 'Last 60 Minutes';
            break;
        case 'hours':
            historyChartInstance.options.scales.x.title.text = 'Last 24 Hours';
            break;
        case 'days':
            historyChartInstance.options.scales.x.title.text = 'Last 7 Days';
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
    
    // Regenerate data for new time range
    if (view === 'hours') {
        // Generate 24 hours of data (one per hour)
        const now = new Date();
        minuteData = [];
        for (let i = 23; i >= 0; i--) {
            const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
            const baseMoisture = 50 + Math.sin(i * 0.3) * 20;
            const moisture = Math.max(0, Math.min(100, baseMoisture + (Math.random() * 5 - 2.5)));
            
            minuteData.push({
                time: timestamp,
                moisture: moisture,
                temperature: 22 + Math.sin(i * 0.2) * 3,
                humidity: 45 + Math.sin(i * 0.3) * 10
            });
        }
    } else if (view === 'days') {
        // Generate 7 days of data (one per day)
        const now = new Date();
        minuteData = [];
        for (let i = 6; i >= 0; i--) {
            const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const baseMoisture = 50 + Math.sin(i * 0.8) * 25;
            const moisture = Math.max(0, Math.min(100, baseMoisture + (Math.random() * 10 - 5)));
            
            minuteData.push({
                time: timestamp,
                moisture: moisture,
                temperature: 22 + Math.sin(i * 0.5) * 4,
                humidity: 45 + Math.sin(i * 0.7) * 15
            });
        }
    } else {
        // Default to 60 minutes
        minuteData = generateInitialMinuteData();
    }
    
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
    
    // Keep only last 20 records
    if (plantRecords.length > MAX_RECORDS) {
        plantRecords.pop();
    }
    
    // Update the table
    updateRecordsTable();
    
    // Add to minute data
    minuteData.push({
        time: now,
        moisture: percentage,
        temperature: data.temperature || 0,
        humidity: data.humidity || 0
    });
    
    // Keep only data for current view
    if (minuteData.length > 60) {
        minuteData = minuteData.slice(-60);
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
    elements.refreshStatus.textContent = 'Just now';
    
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
    
    // Update plant info if available
    if (data.plant_name) {
        elements.plantName.textContent = data.plant_name;
    }
    if (data.plant_type) {
        elements.plantType.textContent = data.plant_type;
    }
    if (data.plant_location) {
        elements.plantLocation.textContent = data.plant_location;
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
        elements.refreshStatus.textContent = 'Connection Error';
        
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
        status: 'OK',
        plant_name: 'My Indoor Plant',
        plant_type: 'Snake Plant',
        plant_location: 'Living Room • Window Side'
    };
    
    updateUI(demoData);
    
    // Update UI to indicate demo mode
    elements.plantStatusText.textContent = 'DEMO MODE';
    elements.deviceId.textContent = currentDeviceId + ' (DEMO)';
    elements.refreshStatus.textContent = 'Demo Mode';
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
            status: 'OK',
            plant_name: 'My Indoor Plant',
            plant_type: 'Snake Plant',
            plant_location: 'Living Room • Window Side'
        };
        
        updateUI(demoData);
        
    }, 60000); // Update every minute for demo
}

// Start simulation when page loads (optional)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(simulateRealTimeUpdates, 5000);
});
