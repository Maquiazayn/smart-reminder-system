// dashboard.js - Enhanced with real-time updates and better UI
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
let currentDeviceId = 'PLANT-001';
let updateCount = 0;
let currentTimeRange = 'minutes';
let historyChartInstance = null;
let moistureGauge = null;
let connectionStatus = true;

// Store readings for history
let recentReadings = [];
let allReadings = [];

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

// Initialize dashboard
document.addEventListener('DOMContentLoaded', initDashboard);

function initDashboard() {
    console.log("🚀 Smart Plant Dashboard Initializing...");
    
    initializeGauge();
    initializeHistoryChart();
    
    // Get device ID
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'PLANT-001';
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Initialize with sample data
    initializeSampleData();
    updateRecordsTable();
    updateHistoryChart();
    
    // Start real-time updates
    startRealtimeUpdates();
    
    // Auto-refresh every 5 seconds
    setInterval(fetchData, 5000);
    
    // Animate elements
    animateUIElements();
    
    console.log("✅ Dashboard Initialized Successfully!");
}

function initializeSampleData() {
    // Generate 30 minutes of sample data
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000);
        const moisture = 45 + Math.sin(i * 0.3) * 20 + Math.random() * 10 - 5;
        
        recentReadings.push({
            timestamp: time.getTime(),
            moisture: Math.max(0, Math.min(100, moisture)),
            temperature: 22 + Math.sin(i * 0.1) * 3,
            humidity: 50 + Math.sin(i * 0.2) * 15
        });
    }
}

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
                borderRadius: 15,
                borderWidth: 3,
                borderColor: 'rgba(255, 255, 255, 0.3)'
            }]
        },
        options: {
            cutout: '80%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

function initializeHistoryChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    // Gradient for chart
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(52, 152, 219, 0.3)');
    gradient.addColorStop(1, 'rgba(52, 152, 219, 0.05)');
    
    historyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: recentReadings.map(r => 
                new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            ),
            datasets: [{
                label: 'Soil Moisture (%)',
                data: recentReadings.map(r => r.moisture),
                borderColor: '#3498db',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 4,
                pointRadius: 4,
                pointBackgroundColor: '#3498db',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#2ecc71'
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
                        color: '#2c3e50',
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: "'Poppins', sans-serif"
                        },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(44, 62, 80, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3498db',
                    borderWidth: 2,
                    cornerRadius: 10,
                    padding: 15,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `Moisture: ${context.parsed.y.toFixed(1)}%`,
                        title: (context) => {
                            const time = new Date(recentReadings[context[0].dataIndex].timestamp);
                            return time.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                            });
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.08)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#7f8c8d',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        callback: (value) => `${value}%`,
                        padding: 10
                    },
                    title: {
                        display: true,
                        text: 'Moisture Level (%)',
                        color: '#2c3e50',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: { top: 10, bottom: 20 }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#7f8c8d',
                        font: {
                            size: 11,
                            weight: 'bold'
                        },
                        maxRotation: 45,
                        callback: (value, index) => {
                            if (index % 5 === 0 || index === recentReadings.length - 1) {
                                const time = new Date(recentReadings[index].timestamp);
                                return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            }
                            return '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time (Last 30 Minutes)',
                        color: '#2c3e50',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: { top: 20, bottom: 10 }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

function updateHistoryChart() {
    if (!historyChartInstance) return;
    
    const dataToShow = recentReadings.slice(-30); // Last 30 readings
    
    historyChartInstance.data.labels = dataToShow.map(r => 
        new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
    
    historyChartInstance.data.datasets[0].data = dataToShow.map(r => r.moisture);
    
    // Update statistics
    if (dataToShow.length > 0) {
        const moistureValues = dataToShow.map(r => r.moisture);
        const current = moistureValues[moistureValues.length - 1];
        const average = moistureValues.reduce((a, b) => a + b, 0) / moistureValues.length;
        const max = Math.max(...moistureValues);
        const min = Math.min(...moistureValues);
        
        elements.currentStat.textContent = `${current.toFixed(1)}%`;
        elements.averageStat.textContent = `${average.toFixed(1)}%`;
        elements.maxStat.textContent = `${max.toFixed(1)}%`;
        elements.minStat.textContent = `${min.toFixed(1)}%`;
    }
    
    historyChartInstance.update();
}

function updateGauge(percentage) {
    if (!moistureGauge) return;
    
    moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
    
    // Update color based on moisture level
    let color;
    if (percentage <= 20) {
        color = '#e74c3c'; // Red for dry
    } else if (percentage <= 75) {
        color = '#2ecc71'; // Green for optimal
    } else {
        color = '#3498db'; // Blue for too wet
    }
    
    moistureGauge.data.datasets[0].backgroundColor = [color, 'rgba(255, 255, 255, 0.2)'];
    moistureGauge.update();
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
    const banner = elements.warningBanner;
    
    if (percentage <= 20) {
        banner.style.display = 'flex';
        banner.innerHTML = '<i class="fas fa-exclamation-circle"></i> WARNING: Plant needs water immediately!';
        banner.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
    } else if (percentage >= 90) {
        banner.style.display = 'flex';
        banner.innerHTML = '<i class="fas fa-exclamation-circle"></i> ALERT: Soil is too wet!';
        banner.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
    } else {
        banner.style.display = 'none';
    }
}

function updateRecordsTable() {
    const tableBody = elements.recordsTableBody;
    
    // Clear table
    tableBody.innerHTML = '';
    
    // Show last 15 readings (newest first)
    const readingsToShow = [...recentReadings].reverse().slice(0, 15);
    
    readingsToShow.forEach(reading => {
        const row = document.createElement('tr');
        const date = new Date(reading.timestamp);
        
        // Determine status and color
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
                <span class="status-badge ${statusClass}">${getStatusText(reading.moisture)}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update record count
    elements.recordCount.textContent = recentReadings.length;
}

function updateUI(data) {
    console.log("📊 Updating UI with:", data);
    
    if (!data) {
        console.warn("No data received");
        showDemoData();
        return;
    }
    
    const moisture = data.moisture || 0;
    const rawValue = data.rawValue || 0;
    const temperature = data.temperature || 0;
    const humidity = data.humidity || 0;
    const status = data.moistureStatus || 'OK';
    
    // Update display values
    elements.moisturePercent.textContent = moisture.toFixed(1);
    elements.percentageLarge.textContent = `${moisture.toFixed(1)}%`;
    
    // Update status with animation
    const statusClass = getStatusClass(moisture);
    const statusText = getStatusText(moisture);
    elements.plantStatusText.textContent = statusText;
    elements.plantStatusText.className = `plant-status-text ${statusClass}`;
    
    // Update warning banner
    updateWarningBanner(moisture);
    
    // Update sensor values
    elements.temperature.textContent = temperature.toFixed(1);
    elements.humidity.textContent = humidity.toFixed(1);
    elements.rawValue.textContent = rawValue;
    
    // Update counters
    updateCount++;
    elements.updateCount.textContent = updateCount;
    elements.refreshStatus.textContent = 'Just now';
    elements.refreshStatus.style.color = '#2ecc71';
    
    // Update timestamp
    const now = new Date();
    elements.lastUpdate.textContent = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Update device ID
    if (data.deviceId && data.deviceId !== currentDeviceId) {
        currentDeviceId = data.deviceId;
        elements.deviceId.textContent = currentDeviceId;
        localStorage.setItem('plantDeviceId', currentDeviceId);
    }
    
    // Add to recent readings
    const newReading = {
        timestamp: Date.now(),
        moisture: moisture,
        temperature: temperature,
        humidity: humidity
    };
    
    recentReadings.push(newReading);
    allReadings.push(newReading);
    
    // Keep only recent data
    if (recentReadings.length > 100) {
        recentReadings.shift();
    }
    
    // Update charts and table
    updateGauge(moisture);
    updateHistoryChart();
    updateRecordsTable();
    
    // Animate update
    animateUpdate();
    
    console.log("✅ UI Updated Successfully");
}

async function fetchData() {
    console.log(`🔍 Fetching data for device: ${currentDeviceId}`);
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}.json`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data === null) {
            console.warn("No data found at this path");
            showDemoData();
            return;
        }
        
        updateUI(data);
        connectionStatus = true;
        
    } catch (error) {
        console.error('❌ Error fetching data:', error);
        connectionStatus = false;
        showDemoData();
    }
}

function showDemoData() {
    console.log("🔄 Showing demo data");
    
    // Generate realistic demo data
    const lastMoisture = recentReadings.length > 0 ? recentReadings[recentReadings.length - 1].moisture : 50;
    const moisture = Math.max(0, Math.min(100, lastMoisture + (Math.random() * 4 - 2)));
    
    const demoData = {
        deviceId: currentDeviceId,
        moisture: moisture,
        rawValue: Math.floor(1000 + moisture * 30),
        temperature: 22 + Math.sin(Date.now() * 0.0001) * 3,
        humidity: 50 + Math.cos(Date.now() * 0.00008) * 15,
        moistureStatus: getStatusText(moisture)
    };
    
    updateUI(demoData);
    
    // Indicate demo mode
    elements.deviceId.textContent = currentDeviceId + ' (DEMO)';
    elements.refreshStatus.textContent = 'Demo Mode • Waiting for sensor';
    elements.refreshStatus.style.color = '#e74c3c';
}

function changeTimeRange(range) {
    // Update active tab
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update time range
    currentTimeRange = range;
    
    // Update display
    switch(range) {
        case 'minutes':
            elements.timeRangeValue.textContent = 'Last 30 Minutes';
            elements.chartInfoText.textContent = 'for the last 30 minutes (real-time data)';
            // Show last 30 readings
            recentReadings = allReadings.slice(-30);
            break;
        case 'hours':
            elements.timeRangeValue.textContent = 'Last 24 Hours';
            elements.chartInfoText.textContent = 'for the last 24 hours (hourly averages)';
            // Generate hourly data
            generateHourlyData();
            break;
        case 'days':
            elements.timeRangeValue.textContent = 'Last 7 Days';
            elements.chartInfoText.textContent = 'for the last 7 days (daily averages)';
            // Generate daily data
            generateDailyData();
            break;
    }
    
    updateHistoryChart();
}

function generateHourlyData() {
    // Generate 24 hourly averages
    recentReadings = [];
    const now = Date.now();
    
    for (let i = 23; i >= 0; i--) {
        const hourStart = now - i * 3600000;
        const hourEnd = hourStart + 3600000;
        
        // Get readings for this hour
        const hourReadings = allReadings.filter(r => 
            r.timestamp >= hourStart && r.timestamp < hourEnd
        );
        
        if (hourReadings.length > 0) {
            const avgMoisture = hourReadings.reduce((sum, r) => sum + r.moisture, 0) / hourReadings.length;
            const avgTemp = hourReadings.reduce((sum, r) => sum + r.temperature, 0) / hourReadings.length;
            const avgHumidity = hourReadings.reduce((sum, r) => sum + r.humidity, 0) / hourReadings.length;
            
            recentReadings.push({
                timestamp: hourStart,
                moisture: avgMoisture,
                temperature: avgTemp,
                humidity: avgHumidity
            });
        } else {
            // If no data, generate sample
            recentReadings.push({
                timestamp: hourStart,
                moisture: 45 + Math.sin(i * 0.3) * 15,
                temperature: 22 + Math.sin(i * 0.1) * 3,
                humidity: 50 + Math.sin(i * 0.2) * 15
            });
        }
    }
}

function generateDailyData() {
    // Generate 7 daily averages
    recentReadings = [];
    const now = Date.now();
    
    for (let i = 6; i >= 0; i--) {
        const dayStart = now - i * 86400000;
        const dayEnd = dayStart + 86400000;
        
        // Get readings for this day
        const dayReadings = allReadings.filter(r => 
            r.timestamp >= dayStart && r.timestamp < dayEnd
        );
        
        if (dayReadings.length > 0) {
            const avgMoisture = dayReadings.reduce((sum, r) => sum + r.moisture, 0) / dayReadings.length;
            const avgTemp = dayReadings.reduce((sum, r) => sum + r.temperature, 0) / dayReadings.length;
            const avgHumidity = dayReadings.reduce((sum, r) => sum + r.humidity, 0) / dayReadings.length;
            
            recentReadings.push({
                timestamp: dayStart,
                moisture: avgMoisture,
                temperature: avgTemp,
                humidity: avgHumidity
            });
        } else {
            // If no data, generate sample
            recentReadings.push({
                timestamp: dayStart,
                moisture: 45 + Math.sin(i * 0.8) * 20,
                temperature: 22 + Math.sin(i * 0.3) * 4,
                humidity: 50 + Math.sin(i * 0.4) * 20
            });
        }
    }
}

function refreshData() {
    console.log("🔄 Manual refresh requested");
    fetchData();
    showNotification("Plant data refreshed successfully!");
    
    // Add animation to refresh button
    const btn = event.target.closest('.refresh-btn') || event.target.closest('.action-btn');
    if (btn) {
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 300);
    }
}

function startRealtimeUpdates() {
    // Initial fetch
    fetchData();
    
    // Update every 5 seconds
    setInterval(() => {
        if (connectionStatus) {
            fetchData();
        }
    }, 5000);
}

function animateUIElements() {
    // Add floating animation to cards
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('floating');
    });
    
    // Add pulse to status indicator
    setInterval(() => {
        const statusText = elements.plantStatusText;
        if (statusText.classList.contains('status-need-water')) {
            statusText.style.animation = 'pulse 2s infinite';
        }
    }, 1000);
}

function animateUpdate() {
    // Animate the percentage change
    const percentageElement = elements.percentageLarge;
    percentageElement.style.transform = 'scale(1.1)';
    percentageElement.style.color = '#2ecc71';
    
    setTimeout(() => {
        percentageElement.style.transform = 'scale(1)';
        percentageElement.style.color = '';
    }, 500);
}

function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    const bgColor = type === 'success' ? '#2ecc71' : '#e74c3c';
    
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    // Add styles
    Object.assign(notification.style, {
        position: 'fixed',
        top: '30px',
        right: '30px',
        background: bgColor,
        color: 'white',
        padding: '20px 30px',
        borderRadius: '15px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        zIndex: '9999',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        border: '3px solid rgba(255, 255, 255, 0.3)',
        backdropFilter: 'blur(10px)',
        animation: 'slideInRight 0.5s ease, fadeOut 0.5s ease 2.5s',
        maxWidth: '400px'
    });
    
    // Add keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
        if (style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }, 3000);
}

// Add floating animation to CSS
document.head.insertAdjacentHTML('beforeend', `
    <style>
        .floating {
            animation: float 6s ease-in-out infinite;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
    </style>
`);

// Initialize on load
window.addEventListener('load', initDashboard);
