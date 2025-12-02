/ dashboard.js - Smart Plant Watering Dashboard/
const firebaseConfig = {
  apiKey: "AIzaSyB0L0_NE_bXquh0utC00if7PU45NDJtUrE",
  authDomain: "smart-plant-watering-e2811.firebaseapp.com",
  databaseURL: "https://smart-plant-watering-e2811-default-rtdb.firebaseio.com",
  projectId: "smart-plant-watering-e2811",
  storageBucket: "smart-plant-watering-e2811.firebasestorage.app",
  messagingSenderId: "422921066008",
  appId: "1:422921066008:web:e05a601fe06871dd0b156d"
};

// Global variables
let currentDeviceId = null;
let updateCount = 0;
let moistureHistory = [];
const MAX_HISTORY = 20;

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
    recordCount: document.getElementById('recordCount')
};

// Chart instances
let moistureGauge = null;
let historyChart = null;

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

// Main initialization function
function initDashboard() {
    console.log("Smart Plant Watering Dashboard initializing...");
    
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
    
    // Start fetching data
    fetchData();
    
    // Set up auto-refresh every 10 seconds
    setInterval(fetchData, 10000);
    
    // Add click event to refresh button
    document.querySelector('.refresh-btn').addEventListener('click', fetchData);
    
    console.log("Dashboard initialized for device:", currentDeviceId);
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
                tension: 0.4,
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
    
    // Update charts
    updateGauge(percentage);
    updateHistoryChart(percentage, data.timestamp || Date.now());
    
    console.log("UI updated successfully");
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
            return;
        }
        
        updateUI(data);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        
        // Show connection error in UI
        elements.moisturePercent.textContent = 'ERROR';
        elements.statusIndicator.textContent = 'CONNECTION FAILED';
        elements.statusIndicator.className = 'status-indicator status-need-water';
        
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
    elements.statusIndicator.textContent = 'DEMO MODE';
    elements.deviceId.textContent = currentDeviceId + ' (DEMO)';
}

// Refresh records table
function refreshRecords() {
    console.log("Refreshing records table...");
    
    // Simulate getting new data
    const now = new Date();
    const moisture = Math.floor(Math.random() * 100);
    const status = getStatusText(moisture);
    
    const newRecord = {
        timestamp: now.toLocaleString(),
        moistureLevel: moisture,
        temperature: 22 + (Math.random() * 3),
        humidity: 40 + (Math.random() * 20),
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
    
    // Show notification
    showNotification("Plant records updated with new data");
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
    // Create notification element
    const notification = document.createElement('div');
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
            document.body.removeChild(notification);
            document.head.removeChild(style);
        }, 300);
    }, 3000);
}

// Simulate real-time updates for demo
function simulateRealTimeUpdates() {
    setInterval(() => {
        const now = new Date();
        const moisture = Math.floor(Math.random() * 100);
        const status = getStatusText(moisture);
        
        const newRecord = {
            timestamp: now.toLocaleString(),
            moistureLevel: moisture,
            temperature: 22 + (Math.random() * 3),
            humidity: 40 + (Math.random() * 20),
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
    }, 60000); // Update every minute for demo
}

// Start simulation when page loads (optional)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(simulateRealTimeUpdates, 5000);
});
