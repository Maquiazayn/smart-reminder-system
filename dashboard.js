// dashboard.js - Fixed for Arduino Firebase integration
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
let currentDeviceId = 'PLANT-001'; // Default device ID
let updateCount = 0;
let currentTimeRange = 'minutes';
let historyChartInstance = null;

// Chart instances
let moistureGauge = null;

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

// Store recent readings
let recentReadings = [];

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

function initDashboard() {
    console.log("Plant Monitoring Dashboard initializing...");
    
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
    
    // Start fetching data
    fetchData();
    
    // Set up auto-refresh every 5 seconds (matching Arduino)
    setInterval(fetchData, 5000);
    
    // Update chart every minute
    setInterval(updateChartData, 60000);
    
    console.log("Dashboard initialized for plant monitoring");
}

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

function initializeHistoryChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    historyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
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
            }]
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
                        maxRotation: 45
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
            }
        }
    });
}

function updateChartData() {
    if (!historyChartInstance || recentReadings.length === 0) return;
    
    // Get last 30 readings for the chart
    const last30Readings = recentReadings.slice(-30);
    const labels = last30Readings.map(r => 
        new Date(r.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        })
    );
    const data = last30Readings.map(r => r.moisture);
    
    historyChartInstance.data.labels = labels;
    historyChartInstance.data.datasets[0].data = data;
    
    // Calculate statistics
    if (data.length > 0) {
        const current = data[data.length - 1];
        const average = data.reduce((a, b) => a + b, 0) / data.length;
        const max = Math.max(...data);
        const min = Math.min(...data);
        
        elements.currentStat.textContent = `${current.toFixed(1)}%`;
        elements.averageStat.textContent = `${average.toFixed(1)}%`;
        elements.maxStat.textContent = `${max.toFixed(1)}%`;
        elements.minStat.textContent = `${min.toFixed(1)}%`;
    }
    
    historyChartInstance.update();
}

function updateGauge(percentage) {
    if (moistureGauge) {
        moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
        
        // Set color based on moisture level
        let color;
        if (percentage <= 20) {
            color = '#e74c3c';
        } else if (percentage <= 75) {
            color = '#2ecc71';
        } else {
            color = '#3498db';
        }
        
        moistureGauge.data.datasets[0].backgroundColor = [color, 'rgba(255, 255, 255, 0.2)'];
        moistureGauge.update('active');
    }
}

function getStatusClass(percentage) {
    if (percentage <= 20) return 'status-need-water';
    if (percentage <= 75) return 'status-ok';
    return 'status-too-wet';
}

function getStatusText(percentage) {
    if (percentage <= 20) return 'NEED WATER';
    if (percentage <= 75) return 'OK';
    return 'TOO WET';
}

function updateWarningBanner(percentage) {
    const warningBanner = elements.warningBanner;
    
    if (percentage <= 20) {
        warningBanner.style.display = 'block';
        warningBanner.innerHTML = '<i class="fas fa-exclamation-circle"></i> WARNING: Plant needs water immediately!';
        warningBanner.style.background = '#e74c3c';
    } else if (percentage >= 90) {
        warningBanner.style.display = 'block';
        warningBanner.innerHTML = '<i class="fas fa-exclamation-circle"></i> ALERT: Soil is too wet!';
        warningBanner.style.background = '#3498db';
    } else {
        warningBanner.style.display = 'none';
    }
}

function addToRecentReadings(data) {
    const now = new Date();
    const reading = {
        timestamp: now.getTime(),
        moisture: data.moisture || 0,
        temperature: data.temperature || 0,
        humidity: data.humidity || 0,
        status: getStatusText(data.moisture || 0)
    };
    
    recentReadings.push(reading);
    
    // Keep only last 100 readings
    if (recentReadings.length > 100) {
        recentReadings.shift();
    }
    
    // Update records table
    updateRecordsTable();
}

function updateRecordsTable() {
    const tableBody = elements.recordsTableBody;
    
    // Clear table
    tableBody.innerHTML = '';
    
    // Show last 10 readings (newest first)
    const last10Readings = [...recentReadings].reverse().slice(0, 10);
    
    last10Readings.forEach(reading => {
        const row = document.createElement('tr');
        const date = new Date(reading.timestamp);
        
        // Determine status badge class
        let statusClass = '';
        let moistureColorClass = '';
        
        if (reading.moisture <= 20) {
            statusClass = 'status-need-water-badge';
            moistureColorClass = 'moisture-low';
        } else if (reading.moisture <= 75) {
            statusClass = 'status-ok-badge';
            moistureColorClass = 'moisture-ok';
        } else {
            statusClass = 'status-too-wet-badge';
            moistureColorClass = 'moisture-high';
        }
        
        row.innerHTML = `
            <td class="timestamp-col">${date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit' 
            })}</td>
            <td class="percent-col ${moistureColorClass}">${reading.moisture.toFixed(1)}%</td>
            <td class="value-col">${reading.temperature.toFixed(1)}°C</td>
            <td class="percent-col">${reading.humidity.toFixed(1)}%</td>
            <td class="status-col">
                <span class="status-badge ${statusClass}">${reading.status}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update record count
    elements.recordCount.textContent = recentReadings.length;
}

function updateUI(data) {
    console.log("Updating UI with data:", data);
    
    if (!data) {
        console.warn("No data received");
        return;
    }
    
    const moisture = data.moisture || 0;
    const rawValue = data.rawValue || 0;
    const temperature = data.temperature || 0;
    const humidity = data.humidity || 0;
    const statusClass = getStatusClass(moisture);
    const statusText = getStatusText(moisture);
    
    // Update main display
    elements.moisturePercent.textContent = moisture.toFixed(1);
    elements.percentageLarge.textContent = `${moisture.toFixed(1)}%`;
    elements.plantStatusText.textContent = statusText;
    elements.plantStatusText.className = `plant-status-text ${statusClass}`;
    
    // Update warning banner
    updateWarningBanner(moisture);
    
    // Update environment data
    elements.temperature.textContent = temperature.toFixed(1);
    elements.humidity.textContent = humidity.toFixed(1);
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
    if (data.deviceId && data.deviceId !== currentDeviceId) {
        currentDeviceId = data.deviceId;
        elements.deviceId.textContent = currentDeviceId;
        localStorage.setItem('plantDeviceId', currentDeviceId);
    }
    
    // Add to recent readings
    addToRecentReadings({
        moisture: moisture,
        temperature: temperature,
        humidity: humidity
    });
    
    // Update gauge
    updateGauge(moisture);
    
    // Update chart
    updateChartData();
    
    console.log("UI updated successfully");
}

async function fetchData() {
    console.log(`Fetching data for device: ${currentDeviceId}`);
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}.json`;
        
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

function showDemoData() {
    console.log("Showing demo data");
    
    const moisture = 40 + Math.random() * 30;
    
    const demoData = {
        deviceId: currentDeviceId,
        moisture: moisture,
        rawValue: Math.floor(Math.random() * 4096),
        temperature: 22 + Math.random() * 5,
        humidity: 40 + Math.random() * 30,
        moistureStatus: 'OK',
        needsWater: false
    };
    
    updateUI(demoData);
    
    // Update UI to indicate demo mode
    elements.plantStatusText.textContent = 'DEMO MODE';
    elements.deviceId.textContent = currentDeviceId + ' (DEMO)';
    elements.refreshStatus.textContent = 'Demo Mode';
}

function changeTimeRange(range) {
    // Update active tab
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update time range
    currentTimeRange = range;
    
    switch(range) {
        case 'minutes':
            elements.timeRangeValue.textContent = 'Last 30 Minutes';
            elements.chartInfoText.textContent = 'for the last 30 minutes (real-time data)';
            break;
        case 'hours':
            elements.timeRangeValue.textContent = 'Last 24 Hours';
            elements.chartInfoText.textContent = 'for the last 24 hours (hourly averages)';
            break;
        case 'days':
            elements.timeRangeValue.textContent = 'Last 7 Days';
            elements.chartInfoText.textContent = 'for the last 7 days (daily averages)';
            break;
    }
}

function refreshData() {
    console.log("Refreshing all data...");
    fetchData();
    showNotification("Plant data refreshed successfully");
}

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
