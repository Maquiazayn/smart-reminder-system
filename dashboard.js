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
let currentTimeRange = 'minutes';
let historyChartInstance = null;

// Data storage for different time ranges
let minuteData = [];
let hourData = [];
let dayData = [];

// Constants
const MINUTES_IN_HOUR = 60;
const HOURS_IN_DAY = 24;
const DAYS_IN_WEEK = 7;

// Sample records data
let plantRecords = [];

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
    currentStat: document.getElementById('currentStat'),
    averageStat: document.getElementById('averageStat'),
    maxStat: document.getElementById('maxStat'),
    minStat: document.getElementById('minStat'),
    plantName: document.getElementById('plantName'),
    plantType: document.getElementById('plantType'),
    plantLocation: document.getElementById('plantLocation'),
    refreshStatus: document.getElementById('refreshStatus'),
    timeRangeValue: document.getElementById('timeRangeValue'),
    chartInfoText: document.getElementById('chartInfoText')
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
    
    // Generate initial data for all time ranges
    generateInitialData();
    
    // Initialize records table with data
    updateRecordsTable();
    
    // Update history chart with initial data
    updateHistoryChart();
    
    // Start fetching data immediately
    fetchData();
    
    // Set up auto-refresh every 10 seconds
    setInterval(fetchData, 10000);
    
    // Update simulated data every minute
    setInterval(updateData, 60000);
    
    console.log("Dashboard initialized for single plant monitoring");
}

// Generate initial data for all time ranges
function generateInitialData() {
    const now = new Date();
    
    // Generate minute data (last 60 minutes)
    minuteData = [];
    for (let i = MINUTES_IN_HOUR - 1; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60000);
        const moisture = generateRealisticMoisture(i, 'minute');
        
        minuteData.push({
            timestamp: timestamp,
            moisture: moisture,
            rawValue: 4095 - (moisture * 30)  // Simulated raw value
        });
    }
    
    // Generate hour data (last 24 hours)
    hourData = [];
    for (let i = HOURS_IN_DAY - 1; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60 * 60000);
        const moisture = generateRealisticMoisture(i, 'hour');
        
        hourData.push({
            timestamp: timestamp,
            moisture: moisture,
            rawValue: 4095 - (moisture * 30)
        });
    }
    
    // Generate day data (last 7 days)
    dayData = [];
    for (let i = DAYS_IN_WEEK - 1; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 24 * 60 * 60000);
        const moisture = generateRealisticMoisture(i, 'day');
        
        dayData.push({
            timestamp: timestamp,
            moisture: moisture,
            rawValue: 4095 - (moisture * 30)
        });
    }
    
    // Generate sample records (last 50 readings)
    plantRecords = [];
    for (let i = 0; i < 50; i++) {
        const hoursAgo = i * 0.5; // Every 30 minutes for 25 hours
        const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60000);
        const moisture = generateRealisticMoisture(i, 'record');
        
        let status;
        if (moisture <= 30) status = "NEED WATER";
        else if (moisture <= 70) status = "OK";
        else status = "TOO WET";
        
        plantRecords.push({
            timestamp: timestamp.toLocaleString(),
            moistureLevel: moisture,
            sensorValue: Math.round(4095 - (moisture * 30)),
            status: status
        });
    }
}

// Generate realistic moisture data
function generateRealisticMoisture(index, type) {
    let baseMoisture, variation;
    
    switch(type) {
        case 'minute':
            baseMoisture = 50 + Math.sin(index * 0.1) * 20;
            variation = Math.random() * 3 - 1.5;
            break;
        case 'hour':
            baseMoisture = 50 + Math.sin(index * 0.3) * 20;
            variation = Math.random() * 5 - 2.5;
            break;
        case 'day':
            baseMoisture = 50 + Math.sin(index * 0.8) * 25;
            variation = Math.random() * 10 - 5;
            break;
        case 'record':
            baseMoisture = 45 + Math.sin(index * 0.5) * 25;
            variation = Math.random() * 10 - 5;
            break;
        default:
            baseMoisture = 50;
            variation = 0;
    }
    
    return Math.max(0, Math.min(100, baseMoisture + variation));
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
        
        // Create row HTML (NO temperature/humidity columns)
        row.innerHTML = `
            <td class="timestamp-col">${record.timestamp}</td>
            <td class="percent-col ${moistureColorClass}">${record.moistureLevel.toFixed(1)}%</td>
            <td class="value-col">${record.sensorValue || 0}</td>
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
                backgroundColor: ['#2ecc71', 'rgba(255, 255, 255, 0.2)'],
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
                    pointBorderWidth: 1,
                    pointHoverRadius: 6
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
                            const data = getCurrentData();
                            if (data[context[0].dataIndex]) {
                                const timestamp = data[context[0].dataIndex].timestamp;
                                
                                switch(currentTimeRange) {
                                    case 'minutes':
                                        return timestamp.toLocaleTimeString([], { 
                                            hour: '2-digit', 
                                            minute: '2-digit',
                                            second: '2-digit'
                                        });
                                    case 'hours':
                                        return timestamp.toLocaleTimeString([], { 
                                            hour: '2-digit', 
                                            minute: '2-digit'
                                        });
                                    case 'days':
                                        return timestamp.toLocaleDateString('en-US', { 
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric'
                                        });
                                }
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
                            const data = getCurrentData();
                            if (data[index]) {
                                const timestamp = data[index].timestamp;
                                
                                switch(currentTimeRange) {
                                    case 'minutes':
                                        // Show every 10th minute
                                        if (index % 10 === 0) {
                                            return timestamp.toLocaleTimeString([], { 
                                                hour: '2-digit', 
                                                minute: '2-digit'
                                            });
                                        }
                                        return '';
                                    case 'hours':
                                        // Show every 4th hour
                                        if (index % 4 === 0) {
                                            return timestamp.toLocaleTimeString([], { 
                                                hour: '2-digit'
                                            });
                                        }
                                        return '';
                                    case 'days':
                                        // Show all days
                                        return timestamp.toLocaleDateString('en-US', { 
                                            weekday: 'short'
                                        });
                                }
                            }
                            return '';
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

// Get current data based on selected time range
function getCurrentData() {
    switch(currentTimeRange) {
        case 'minutes': return minuteData;
        case 'hours': return hourData;
        case 'days': return dayData;
        default: return minuteData;
    }
}

// Update history chart with data
function updateHistoryChart() {
    if (!historyChartInstance) return;
    
    const data = getCurrentData();
    
    // Prepare labels and data
    let labels = [];
    let moistureData = [];
    
    data.forEach(item => {
        let label;
        switch(currentTimeRange) {
            case 'minutes':
                label = item.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit'
                });
                break;
            case 'hours':
                label = item.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit'
                });
                break;
            case 'days':
                label = item.timestamp.toLocaleDateString('en-US', { 
                    weekday: 'short'
                });
                break;
        }
        
        labels.push(label);
        moistureData.push(item.moisture);
    });
    
    // Update chart data
    historyChartInstance.data.labels = labels;
    historyChartInstance.data.datasets[0].data = moistureData;
    
    // Update chart title
    switch(currentTimeRange) {
        case 'minutes':
            historyChartInstance.options.scales.x.title.text = 'Last 60 Minutes';
            elements.timeRangeValue.textContent = 'Last 60 Minutes';
            elements.chartInfoText.textContent = 'for the last 60 minutes (updated every minute)';
            break;
        case 'hours':
            historyChartInstance.options.scales.x.title.text = 'Last 24 Hours';
            elements.timeRangeValue.textContent = 'Last 24 Hours';
            elements.chartInfoText.textContent = 'for the last 24 hours (hourly averages)';
            break;
        case 'days':
            historyChartInstance.options.scales.x.title.text = 'Last 7 Days';
            elements.timeRangeValue.textContent = 'Last 7 Days';
            elements.chartInfoText.textContent = 'for the last 7 days (daily averages)';
            break;
    }
    
    // Calculate statistics
    if (moistureData.length > 0) {
        const current = moistureData[moistureData.length - 1];
        const average = moistureData.reduce((a, b) => a + b, 0) / moistureData.length;
        const max = Math.max(...moistureData);
        const min = Math.min(...moistureData);
        
        // Update statistics display
        elements.currentStat.textContent = `${current.toFixed(1)}%`;
        elements.averageStat.textContent = `${average.toFixed(1)}%`;
        elements.maxStat.textContent = `${max.toFixed(1)}%`;
        elements.minStat.textContent = `${min.toFixed(1)}%`;
    }
    
    historyChartInstance.update();
}

// Update data every minute
function updateData() {
    const now = new Date();
    
    // Update minute data (add new minute)
    const newMinuteMoisture = generateRealisticMoisture(minuteData.length, 'minute');
    minuteData.push({
        timestamp: now,
        moisture: newMinuteMoisture,
        rawValue: 4095 - (newMinuteMoisture * 30)
    });
    
    // Keep only last 60 minutes
    if (minuteData.length > MINUTES_IN_HOUR) {
        minuteData.shift();
    }
    
    // Update chart if on current time range
    updateHistoryChart();
}

// Change time range
function changeTimeRange(range) {
    // Update active tab
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update time range
    currentTimeRange = range;
    updateHistoryChart();
}

// Update the moisture gauge with new value
function updateGauge(percentage) {
    if (moistureGauge) {
        moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
        
        // Set color based on moisture level
        let color;
        if (percentage <= 30) {
            color = '#e74c3c'; // Red for NEED WATER
        } else if (percentage <= 70) {
            color = '#2ecc71'; // Green for OK
        } else {
            color = '#3498db'; // Blue for TOO WET
        }
        
        moistureGauge.data.datasets[0].backgroundColor = [color, 'rgba(255, 255, 255, 0.2)'];
        moistureGauge.update('active');
    }
}

// Update warning banner based on moisture level
function updateWarningBanner(percentage) {
    const warningBanner = elements.warningBanner;
    
    if (percentage <= 30) {
        warningBanner.style.display = 'block';
        warningBanner.innerHTML = '<i class="fas fa-exclamation-circle"></i> WARNING: Plant needs water immediately! (0-30%)';
        warningBanner.style.background = '#e74c3c';
    } else if (percentage >= 71) {
        warningBanner.style.display = 'block';
        warningBanner.innerHTML = '<i class="fas fa-exclamation-circle"></i> ALERT: Soil is too wet! (71-100%)';
        warningBanner.style.background = '#3498db';
    } else {
        warningBanner.style.display = 'none';
    }
}

// Add new record to history
function addNewRecord(data) {
    const now = new Date();
    const percentage = data.moisture_percent || 0;
    const status = data.moisture_status || "OK";
    
    const newRecord = {
        timestamp: now.toLocaleString(),
        moistureLevel: percentage,
        sensorValue: data.moisture_value || 0,
        status: status
    };
    
    // Add new record to beginning of array
    plantRecords.unshift(newRecord);
    
    // Keep only last 50 records
    if (plantRecords.length > 50) {
        plantRecords.pop();
    }
    
    // Update the table
    updateRecordsTable();
    
    // Update minute data with real sensor data
    minuteData.push({
        timestamp: now,
        moisture: percentage,
        rawValue: data.moisture_value || 0
    });
    
    // Keep only last 60 minutes
    if (minuteData.length > MINUTES_IN_HOUR) {
        minuteData.shift();
    }
    
    // Update history chart if on minutes view
    if (currentTimeRange === 'minutes') {
        updateHistoryChart();
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
    const statusText = data.moisture_status || "OK";
    
    // Update main display elements
    elements.moisturePercent.textContent = `${percentage.toFixed(1)}`;
    elements.percentageLarge.textContent = `${percentage.toFixed(1)}%`;
    elements.plantStatusText.textContent = statusText;
    
    // Set status class based on percentage
    if (percentage <= 30) {
        elements.plantStatusText.className = 'plant-status-text status-need-water';
    } else if (percentage <= 70) {
        elements.plantStatusText.className = 'plant-status-text status-ok';
    } else {
        elements.plantStatusText.className = 'plant-status-text status-too-wet';
    }
    
    // Update warning banner
    updateWarningBanner(percentage);
    
    // Update sensor data - NO temperature/humidity
    elements.temperature.textContent = 'N/A';
    elements.humidity.textContent = 'N/A';
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
    
    console.log("UI updated successfully");
}

// Fetch data from Firebase
async function fetchData() {
    console.log(`Fetching data for device: ${currentDeviceId}`);
    
    try {
        // Correct Firebase path matching Arduino code
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Received data from Firebase:", data);
        
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
    const status = percentage <= 30 ? "NEED WATER" : percentage <= 70 ? "OK" : "TOO WET";
    
    const demoData = {
        device_id: currentDeviceId,
        moisture_value: rawValue,
        moisture_percent: percentage,
        moisture_status: status,
        plant_name: 'My Indoor Plant',
        plant_type: 'Snake Plant',
        plant_location: 'Living Room • Window Side'
    };
    
    updateUI(demoData);
    
    // Update UI to indicate demo mode
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
