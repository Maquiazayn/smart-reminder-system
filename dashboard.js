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

// Global variables
let currentDeviceId = null;
let updateCount = 0;
let moistureHistory = [];
const MAX_HISTORY = 20;

// Demo plant data for table
const demoPlants = [
    {
        id: 1,
        name: "Monstera Deliciosa",
        temperature: 24,
        moisturePercent: 25,
        status: "NEED WATER",
        lastWatered: "2 days ago",
        location: "Living Room"
    },
    {
        id: 2,
        name: "Snake Plant",
        temperature: 22,
        moisturePercent: 65,
        status: "OK",
        lastWatered: "5 days ago",
        location: "Bedroom"
    },
    {
        id: 3,
        name: "Peace Lily",
        temperature: 21,
        moisturePercent: 85,
        status: "TOO WET",
        lastWatered: "1 day ago",
        location: "Kitchen"
    },
    {
        id: 4,
        name: "Spider Plant",
        temperature: 23,
        moisturePercent: 55,
        status: "OK",
        lastWatered: "3 days ago",
        location: "Office"
    },
    {
        id: 5,
        name: "Fiddle Leaf Fig",
        temperature: 25,
        moisturePercent: 20,
        status: "NEED WATER",
        lastWatered: "4 days ago",
        location: "Balcony"
    },
    {
        id: 6,
        name: "Aloe Vera",
        temperature: 26,
        moisturePercent: 40,
        status: "OK",
        lastWatered: "7 days ago",
        location: "Kitchen Window"
    },
    {
        id: 7,
        name: "English Ivy",
        temperature: 20,
        moisturePercent: 75,
        status: "TOO WET",
        lastWatered: "2 days ago",
        location: "Bathroom"
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
    plantTableBody: document.getElementById('plantTableBody'),
    totalPlants: document.getElementById('totalPlants'),
    needsWater: document.getElementById('needsWater'),
    okStatus: document.getElementById('okStatus'),
    tooWet: document.getElementById('tooWet')
};

// Chart instances
let moistureGauge = null;
let historyChart = null;

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

// Main initialization function
function initDashboard() {
    console.log("Dashboard initializing...");
    
    // Initialize charts
    initializeGauge();
    initializeHistoryChart();
    
    // Get device ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'demo-device';
    
    // Set device ID in UI
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Initialize plant table with data
    updatePlantTable();
    
    // Start fetching data
    fetchData();
    
    // Set up auto-refresh every 10 seconds
    setInterval(fetchData, 10000);
    
    // Add click event to refresh button
    document.querySelector('.refresh-btn').addEventListener('click', fetchData);
    
    console.log("Dashboard initialized for device:", currentDeviceId);
}

// Update the plant table with data
function updatePlantTable() {
    const tableBody = elements.plantTableBody;
    tableBody.innerHTML = '';
    
    // Counters for summary
    let needWaterCount = 0;
    let okCount = 0;
    let tooWetCount = 0;
    
    // Populate table rows
    demoPlants.forEach(plant => {
        const row = document.createElement('tr');
        
        // Determine status class and update counters
        let statusClass = '';
        let actionText = '';
        
        if (plant.status === 'NEED WATER') {
            statusClass = 'status-need-water';
            actionText = 'Water immediately';
            needWaterCount++;
        } else if (plant.status === 'OK') {
            statusClass = 'status-ok';
            actionText = 'No action needed';
            okCount++;
        } else {
            statusClass = 'status-too-wet';
            actionText = 'Reduce watering';
            tooWetCount++;
        }
        
        // Determine moisture range
        let moistureRange = '';
        if (plant.moisturePercent <= 30) {
            moistureRange = '0% – 30%';
        } else if (plant.moisturePercent <= 70) {
            moistureRange = '31% – 70%';
        } else {
            moistureRange = '71% – 100%';
        }
        
        // Create row HTML
        row.innerHTML = `
            <td>
                <div class="plant-name">
                    <div class="plant-icon">
                        <i class="fas fa-leaf"></i>
                    </div>
                    ${plant.name}
                </div>
            </td>
            <td class="temp-cell">${plant.temperature}°C</td>
            <td class="moisture-percent">${plant.moisturePercent}%</td>
            <td class="moisture-range-cell">${moistureRange}</td>
            <td><span class="status-label ${statusClass}">${plant.status}</span></td>
            <td class="action-cell">${actionText}</td>
            <td class="last-watered">${plant.lastWatered}</td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update summary counters
    elements.totalPlants.textContent = demoPlants.length;
    elements.needsWater.textContent = needWaterCount;
    elements.okStatus.textContent = okCount;
    elements.tooWet.textContent = tooWetCount;
}

// Initialize the moisture gauge chart
function initializeGauge() {
    const ctx = document.getElementById('moistureGauge').getContext('2d');
    
    moistureGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [50, 50], // Start at 50%
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
            color = '#ff6b6b'; // Red for dry
        } else if (percentage <= 70) {
            color = '#51cf66'; // Green for optimal
        } else {
            color = '#339af0'; // Blue for too wet
        }
        
        moistureGauge.data.datasets[0].backgroundColor = [color, '#e9ecef'];
        moistureGauge.update();
    }
}

// Update the history chart with new data point
function updateHistoryChart(percentage, timestamp) {
    if (historyChart) {
        // Format time for display
        const timeLabel = new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Add new data point
        moistureHistory.push({percentage, time: timeLabel});
        
        // Keep only last MAX_HISTORY points
        if (moistureHistory.length > MAX_HISTORY) {
            moistureHistory.shift();
        }
        
        // Update chart data
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
    
    // Generate realistic demo values
    const rawValue = Math.floor(Math.random() * 4096);
    const percentage = 40 + Math.random() * 30; // Between 40-70%
    
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

// Randomly update demo plant data for simulation
function simulatePlantUpdates() {
    setInterval(() => {
        // Randomly update one plant's moisture level
        const randomIndex = Math.floor(Math.random() * demoPlants.length);
        const plant = demoPlants[randomIndex];
        
        // Random change between -10% and +10%
        const change = (Math.random() * 20) - 10;
        plant.moisturePercent = Math.max(0, Math.min(100, plant.moisturePercent + change));
        
        // Update status based on new moisture level
        if (plant.moisturePercent <= 30) {
            plant.status = "NEED WATER";
        } else if (plant.moisturePercent <= 70) {
            plant.status = "OK";
        } else {
            plant.status = "TOO WET";
        }
        
        // Update the table
        updatePlantTable();
    }, 30000); // Update every 30 seconds
}

// Start simulation when page loads (optional)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(simulatePlantUpdates, 5000);
});