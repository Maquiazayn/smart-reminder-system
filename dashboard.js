// dashboard.js - Smart Plant Watering Dashboard
// WORKING VERSION

const FIREBASE_CONFIG = {
  databaseURL: "https://smart-plant-watering-e2811-default-rtdb.firebaseio.com"
};

let currentDeviceId = null;
let updateCount = 0;
let moistureHistory = [];
const MAX_HISTORY = 60;

let realRecords = [];
let currentData = null;

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

let moistureGauge = null;
let historyChart = null;

function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.toggle('hidden', !show);
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);

function initDashboard() {
    showLoading(true);
    console.log("🌱 Dashboard starting...");
    
    initializeGauge();
    initializeHistoryChart();
    
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'PLANT-SENSOR-001';
    
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    fetchData();
    setInterval(fetchData, 60000);
    setInterval(fetchHistoryData, 300000);
    
    document.querySelector('.refresh-btn').addEventListener('click', fetchData);
    fetchHistoryData();
    startCountdownTimer();
}

function startCountdownTimer() {
    let countdown = 60;
    const countdownElement = document.getElementById('countdownTimer');
    
    if (!countdownElement) {
        const lastUpdateElement = elements.lastUpdate.parentElement;
        if (lastUpdateElement) {
            const timerSpan = document.createElement('div');
            timerSpan.id = 'countdownTimer';
            timerSpan.style.marginTop = '5px';
            timerSpan.style.fontSize = '0.85rem';
            timerSpan.style.color = '#667eea';
            timerSpan.style.fontWeight = '500';
            timerSpan.textContent = `Next refresh in: ${countdown} seconds`;
            lastUpdateElement.appendChild(timerSpan);
            
            setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    countdown = 60;
                }
                timerSpan.textContent = `Next refresh in: ${countdown} seconds`;
                timerSpan.style.color = countdown <= 10 ? '#ff6b6b' : '#667eea';
            }, 1000);
        }
    }
}

async function fetchHistoryData() {
    console.log("📚 Getting history...");
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/history.json?orderBy="timestamp"&limitToLast=50`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data === null) {
            console.log("No history data yet");
            if (currentData) {
                addCurrentDataToRecords(currentData);
            }
            updateRecordsTable();
            return;
        }
        
        realRecords = [];
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const record = data[key];
                let timestamp;
                if (record.timestamp && typeof record.timestamp === 'string') {
                    timestamp = record.timestamp;
                } else if (record.millis) {
                    const date = new Date(parseInt(record.millis));
                    timestamp = date.toLocaleString();
                } else {
                    timestamp = new Date().toLocaleString();
                }
                record.formattedTimestamp = timestamp;
                record.sortKey = record.millis || Date.parse(timestamp) || Date.now();
                realRecords.push(record);
            }
        }
        
        realRecords.sort((a, b) => b.sortKey - a.sortKey);
        
        if (currentData) {
            addCurrentDataToRecords(currentData);
        }
        
        updateRecordsTable(realRecords);
        updateHistoryChartWithRealData();
        
    } catch (error) {
        console.error('Error getting history:', error);
        if (currentData) {
            addCurrentDataToRecords(currentData);
        }
        updateRecordsTable();
    }
}

function addCurrentDataToRecords(currentData) {
    if (!currentData) return;
    
    const now = new Date();
    const currentRecord = {
        formattedTimestamp: now.toLocaleString(),
        moisture_percent: currentData.moisture_percent || 0,
        temperature: currentData.temperature || 22.5,
        humidity: currentData.humidity || 45.0,
        status: currentData.status || getStatusText(currentData.moisture_percent || 0),
        sortKey: now.getTime(),
        timestamp: now.toISOString(),
        device_id: currentDeviceId,
        raw_value: currentData.raw_value || currentData.moisture_value || 0
    };
    
    const isDuplicate = realRecords.some(record => {
        const timeDiff = Math.abs(record.sortKey - currentRecord.sortKey);
        return timeDiff < 60000;
    });
    
    if (!isDuplicate) {
        realRecords.unshift(currentRecord);
        
        if (realRecords.length > 50) {
            realRecords = realRecords.slice(0, 50);
        }
    }
}

function updateHistoryChartWithRealData() {
    if (!historyChart || realRecords.length === 0) return;
    
    const chartData = realRecords.slice(0, 60).reverse();
    
    const labels = chartData.map(record => {
        const date = new Date(record.sortKey);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    });
    
    const dataPoints = chartData.map(record => record.moisture_percent || record.moistureLevel || 0);
    
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = dataPoints;
    historyChart.update();
}

function updateRecordsTable(records = []) {
    const tableBody = elements.recordsTableBody;
    
    const recordsToShow = records.length > 0 ? records.slice(0, 10) : 
                         (realRecords.length > 0 ? realRecords.slice(0, 10) : getDemoRecords());
    
    if (recordsToShow.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #718096;">
                    <i class="fas fa-leaf" style="margin-right: 10px;"></i>
                    No plant records available. Waiting for sensor data...
                </td>
            </tr>
        `;
        elements.recordCount.textContent = '0';
        return;
    }
    
    tableBody.innerHTML = '';
    
    recordsToShow.forEach(record => {
        const row = document.createElement('tr');
        
        const moisture = record.moisture_percent || record.moistureLevel || 0;
        const status = record.status || getStatusText(moisture);
        
        let statusClass = '';
        let moistureColorClass = '';
        
        if (status.includes("NEED WATER")) {
            statusClass = 'status-need-water-badge';
            moistureColorClass = 'water-level-low';
        } else if (status.includes("OK")) {
            statusClass = 'status-ok-badge';
            moistureColorClass = 'water-level-ok';
        } else if (status.includes("TOO WET")) {
            statusClass = 'status-too-wet-badge';
            moistureColorClass = 'water-level-high';
        }
        
        let displayTime = '--';
        if (record.formattedTimestamp) {
            const date = new Date(record.sortKey || Date.now());
            displayTime = date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }) + ' ' + date.toLocaleDateString();
        }
        
        row.innerHTML = `
            <td class="timestamp-col">${displayTime}</td>
            <td class="percent-col ${moistureColorClass}">${moisture.toFixed(1)}%</td>
            <td class="value-col">${(record.temperature || 22.5).toFixed(1)}°C</td>
            <td class="percent-col">${(record.humidity || 45.0).toFixed(1)}%</td>
            <td class="status-col">
                <span class="status-badge ${statusClass}">${status}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    elements.recordCount.textContent = recordsToShow.length;
}

function getDemoRecords() {
    const demoRecords = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
        const time = new Date(now.getTime() - (i * 60000));
        const moisture = 30 + Math.random() * 50;
        const status = getStatusText(moisture);
        
        demoRecords.push({
            formattedTimestamp: time.toLocaleString(),
            moisture_percent: moisture,
            temperature: 22 + Math.random() * 3,
            humidity: 45 + Math.random() * 10,
            status: status,
            sortKey: time.getTime()
        });
    }
    
    return demoRecords;
}

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
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Last 60 Minutes',
                    color: '#4a5568',
                    font: {
                        size: 14,
                        weight: '500'
                    }
                }
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
                    },
                    title: {
                        display: true,
                        text: 'Moisture Level',
                        color: '#4a5568'
                    }
                },
                x: {
                    grid: { display: false },
                    title: {
                        display: true,
                        text: 'Time',
                        color: '#4a5568'
                    }
                }
            }
        }
    });
}

function updateGauge(percentage) {
    if (moistureGauge) {
        moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
        
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

function getStatusClass(percentage) {
    if (percentage <= 30) return 'status-need-water';
    if (percentage <= 70) return 'status-ok';
    return 'status-too-wet';
}

function getStatusText(percentage) {
    if (percentage <= 30) return 'NEED WATER';
    if (percentage <= 70) return 'OK';
    return 'TOO WET';
}

function updateUI(data) {
    console.log("🔄 Updating UI:", data);
    
    if (!data) {
        console.warn("No data");
        return;
    }
    
    currentData = data;
    
    const percentage = data.moisture_percent || 0;
    const rawValue = data.raw_value || data.moisture_value || 0;
    const status = data.status || getStatusText(percentage);
    const statusClass = getStatusClass(percentage);
    
    elements.moisturePercent.textContent = `${percentage.toFixed(1)}%`;
    elements.statusIndicator.textContent = status;
    elements.statusIndicator.className = `status-indicator ${statusClass}`;
    
    elements.temperature.textContent = data.temperature ? `${data.temperature.toFixed(1)}°C` : '--°C';
    elements.humidity.textContent = data.humidity ? `${data.humidity.toFixed(1)}%` : '--%';
    elements.rawValue.textContent = rawValue;
    
    updateCount++;
    elements.updateCount.textContent = updateCount;
    
    let timestamp;
    if (data.timestamp && typeof data.timestamp === 'string') {
        timestamp = data.timestamp;
    } else if (data.millis) {
        const date = new Date(parseInt(data.millis));
        timestamp = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } else {
        timestamp = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    elements.lastUpdate.textContent = timestamp;
    
    if (data.device_id && data.device_id !== currentDeviceId) {
        currentDeviceId = data.device_id;
        elements.deviceId.textContent = currentDeviceId;
        localStorage.setItem('plantDeviceId', currentDeviceId);
        console.log("Device updated to:", currentDeviceId);
    }
    
    updateGauge(percentage);
    updateHistoryChart(percentage, Date.now());
    
    addCurrentDataToRecords(data);
    updateRecordsTable(realRecords);
    
    console.log("✅ UI Updated:", status, percentage.toFixed(1) + "%");
}

async function fetchData() {
    console.log(`🔍 Getting data for: ${currentDeviceId}`);
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data === null) {
            console.warn("No data found");
            showDemoData();
            showLoading(false);
            return;
        }
        
        updateUI(data);
        showLoading(false);
        
    } catch (error) {
        console.error('Error getting data:', error);
        showLoading(false);
        
        elements.moisturePercent.textContent = 'ERROR';
        elements.statusIndicator.textContent = 'CONNECTION FAILED';
        elements.statusIndicator.className = 'status-indicator status-need-water';
        
        showDemoData();
    }
}

function showDemoData() {
    console.log("Showing demo data");
    
    const rawValue = Math.floor(Math.random() * 4096);
    const percentage = 40 + Math.random() * 30;
    
    const demoData = {
        device_id: currentDeviceId,
        raw_value: rawValue,
        moisture_percent: percentage,
        temperature: 22 + Math.random() * 5,
        humidity: 40 + Math.random() * 30,
        timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }),
        status: getStatusText(percentage)
    };
    
    currentData = demoData;
    
    updateUI(demoData);
    
    elements.deviceId.textContent = currentDeviceId + ' (DEMO)';
    elements.rawValue.textContent = rawValue + ' (DEMO)';
    
    if (realRecords.length === 0) {
        updateRecordsTable();
    }
}

function refreshRecords() {
    console.log("Refreshing records...");
    fetchHistoryData();
    showNotification("Records refreshed");
}

function exportToCSV() {
    console.log("Exporting CSV...");
    
    if (currentData) {
        addCurrentDataToRecords(currentData);
    }
    
    const recordsToExport = realRecords.length > 0 ? realRecords : getDemoRecords();
    
    if (recordsToExport.length === 0) {
        showNotification("No records to export");
        return;
    }
    
    const headers = ["Timestamp", "Moisture Level (%)", "Temperature (°C)", "Humidity (%)", "Plant Status"];
    const csvRows = [];
    
    csvRows.push(headers.join(','));
    
    recordsToExport.forEach(record => {
        const row = [
            `"${record.formattedTimestamp || record.timestamp || '--'}"`,
            (record.moisture_percent || record.moistureLevel || 0).toFixed(1),
            (record.temperature || 22.5).toFixed(1),
            (record.humidity || 45.0).toFixed(1),
            `"${record.status || getStatusText(record.moisture_percent || 0)}"`
        ];
        csvRows.push(row.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `plant_records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showNotification("CSV downloaded");
}

function showNotification(message) {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification';
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
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            document.body.removeChild(notification);
        }
    }, 3000);
}

document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        fetchData();
        fetchHistoryData();
    }
});

window.fetchData = fetchData;
window.refreshRecords = refreshRecords;
window.exportToCSV = exportToCSV;
