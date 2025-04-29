import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    onValue, 
    push, 
    set, 
    remove, 
    query, 
    orderByChild, 
    limitToLast,
    get
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAorkSRFuT1CwZtXMpJaEvmjW51a3LAse8",
    authDomain: "monitoringairpdam-bd78d.firebaseapp.com",
    databaseURL: "https://monitoringairpdam-bd78d-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "monitoringairpdam-bd78d",
    storageBucket: "monitoringairpdam-bd78d.appspot.com",
    messagingSenderId: "1050691156280",
    appId: "1:1050691156280:web:8c5bc1da03e15dc69069cd"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const fixedUserUid = "kw4TetVsOLVLNSJPNFfaKmVTv173";

let historicalChart;
let currentViewMode = "daily";
const hargaPerLiter = 1550 / 1000;

const elemTotal = document.getElementById("total");
const elemEstimasi = document.getElementById("estimasi");
const elemStatusAlert = document.getElementById("statusAlert");
const elemBatasDebit = document.getElementById("batasDebit");
const elemRiwayatBody = document.getElementById("riwayat-body");
const elemChartView = document.getElementById("chartView");
const elemSaveBatas = document.getElementById("saveBatas");
const elemExportExcel = document.getElementById("exportExcel");
const elemClearHistory = document.getElementById("clearHistory");

document.addEventListener('DOMContentLoaded', function() {
    initializeChart();
    loadBatasDebit();
    loadHistoricalData();
    
    elemChartView.addEventListener('change', handleChartViewChange);
    elemSaveBatas.addEventListener('click', saveBatasDebit);
    elemExportExcel.addEventListener('click', exportToExcel);
    elemClearHistory.addEventListener('click', confirmClearHistory);
});

function initializeChart() {
    const historicalCtx = document.getElementById('historicalChart').getContext('2d');
    historicalChart = new Chart(historicalCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Total Air (L)',
                    data: [],
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Biaya (Rp)',
                    data: [],
                    backgroundColor: 'rgba(245, 158, 11, 0.6)',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1',
                    type: 'line',
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tanggal'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Total Air (L)'
                    },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Biaya (Rp)'
                    },
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Penggunaan Air PDAM (30 Hari Terakhir)'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.datasetIndex === 1) {
                                return label + 'Rp ' + context.parsed.y.toFixed(2);
                            }
                            return label + context.parsed.y.toFixed(2) + ' L';
                        }
                    }
                }
            }
        }
    });
}

function loadBatasDebit() {
    const batasRef = ref(db, `/users/${fixedUserUid}/settings/batasDebit`);
    onValue(batasRef, (snapshot) => {
        if (snapshot.exists()) {
            elemBatasDebit.value = snapshot.val();
        }
    });
}

function loadHistoricalData() {
    const totalRef = ref(db, `/monitoring/total`);

    onValue(totalRef, (snapshot) => {
        if (!snapshot.exists()) {
            updateUI({ total: 0, biaya: 0 });
            return;
        }

        const totalValue = snapshot.val();
        updateUI({
            total: totalValue,
            biaya: totalValue * hargaPerLiter
        });
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const riwayatRef = ref(db, `/users/${fixedUserUid}/riwayat`);

    onValue(riwayatRef, (snapshot) => {
        if (!snapshot.exists()) {
            populateHistoryTable([]);
            updateChartData([]);
            return;
        }

        const riwayatData = snapshot.val();
        const riwayatArray = Object.keys(riwayatData).map(key => {
            return {
                key: key,
                ...riwayatData[key],
                date: new Date(riwayatData[key].waktu)
            };
        }).filter(item => {
            return item.date >= thirtyDaysAgo;
        }).sort((a, b) => {
            return a.date - b.date;
        });

        populateHistoryTable(riwayatArray.slice(-50));
        updateChartData(riwayatArray);
    });
}

function updateUI(data) {
    elemTotal.innerText = data.total.toFixed(2) + " L";
    elemEstimasi.innerText = "Rp " + data.biaya.toFixed(2);
    
    const batasDebit = parseFloat(elemBatasDebit.value || "0");
    if (batasDebit > 0 && data.debit && data.debit > batasDebit) {
        elemStatusAlert.innerText = "PERINGATAN: Debit melebihi batas!";
        elemStatusAlert.classList.remove("hidden");
        elemStatusAlert.classList.remove("text-green-600");
        elemStatusAlert.classList.add("text-red-600");
        
        
        set(ref(db, '/control/buzzer'), true);
    } else {
        elemStatusAlert.innerText = "Status: Normal";
        elemStatusAlert.classList.remove("hidden");
        elemStatusAlert.classList.remove("text-red-600");
        elemStatusAlert.classList.add("text-green-600");
        set(ref(db, '/control/buzzer'), false);
    }
}

function populateHistoryTable(data) {
    elemRiwayatBody.innerHTML = "";
    
    data.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${formatDateTime(item.date)}</td>
            <td>${item.total.toFixed(2)} L</td>
            <td>Rp ${item.biaya.toFixed(2)}</td>
        `;
        elemRiwayatBody.appendChild(row);
    });
}

function updateChartData(data) {
    let groupedData;
    
    switch(currentViewMode) {
        case "weekly":
            groupedData = groupDataByWeek(data);
            break;
        case "monthly":
            groupedData = groupDataByMonth(data);
            break;
        case "daily":
        default:
            groupedData = groupDataByDay(data);
            break;
    }
    
    historicalChart.data.labels = groupedData.labels;
    historicalChart.data.datasets[0].data = groupedData.totals;
    historicalChart.data.datasets[1].data = groupedData.costs;
    
    historicalChart.options.plugins.title.text = `Penggunaan Air PDAM (${groupedData.labels.length} ${getTimePeriodLabel()})`;
    
    historicalChart.update();
}

function groupDataByDay(data) {
    const groupedData = {};
    
    data.forEach(item => {
        const dateStr = formatDate(item.date);
        
        if (!groupedData[dateStr]) {
            groupedData[dateStr] = {
                total: 0,
                biaya: 0
            };
        }
        
        if (item.total > groupedData[dateStr].total) {
            groupedData[dateStr].total = item.total;
            groupedData[dateStr].biaya = item.biaya;
        }
    });
    
    const labels = Object.keys(groupedData);
    const totals = labels.map(date => groupedData[date].total);
    const costs = labels.map(date => groupedData[date].biaya);
    
    return { labels, totals, costs };
}

function groupDataByWeek(data) {
    const groupedData = {};
    
    data.forEach(item => {
        const weekStart = getWeekStartDate(item.date);
        const weekKey = formatDate(weekStart);
        
        if (!groupedData[weekKey]) {
            groupedData[weekKey] = {
                total: 0,
                biaya: 0
            };
        }
        
        if (item.total > groupedData[weekKey].total) {
            groupedData[weekKey].total = item.total;
            groupedData[weekKey].biaya = item.biaya;
        }
    });
    
    const labels = Object.keys(groupedData);
    const totals = labels.map(week => groupedData[week].total);
    const costs = labels.map(week => groupedData[week].biaya);
    
    return { labels, totals, costs };
}

function groupDataByMonth(data) {
    const groupedData = {};
    
    data.forEach(item => {
        const monthKey = `${item.date.getFullYear()}-${(item.date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!groupedData[monthKey]) {
            groupedData[monthKey] = {
                total: 0,
                biaya: 0
            };
        }
        
        if (item.total > groupedData[monthKey].total) {
            groupedData[monthKey].total = item.total;
            groupedData[monthKey].biaya = item.biaya;
        }
    });
    
    const labels = Object.keys(groupedData).map(monthKey => {
        const [year, month] = monthKey.split('-');
        return `${month}/${year}`;
    });
    
    const monthKeys = Object.keys(groupedData);
    const totals = monthKeys.map(month => groupedData[month].total);
    const costs = monthKeys.map(month => groupedData[month].biaya);
    
    return { labels, totals, costs };
}

function handleChartViewChange() {
    currentViewMode = elemChartView.value;
    loadHistoricalData();
}

function convertToFlowRate(totalLiters) {
    const calibrationFactor = 7.5; 
    let flowRateEstimate = totalLiters / (1 / 60);  
    let adjustedFlowRate = flowRateEstimate * calibrationFactor;  
    return adjustedFlowRate;
}

function saveBatasDebit() {
    const estimasiLiter = parseFloat(elemBatasDebit.value); 

    if (isNaN(estimasiLiter) || estimasiLiter < 0) {
        alert("Mohon masukkan nilai batas debit yang valid (angka positif)");
        return;
    }

   
    const calibrationFactor = 7.5; 
    const nilaiFlowRate = estimasiLiter * calibrationFactor;

    set(ref(db, '/control/batasDebit'), nilaiFlowRate)
        .then(() => {
            console.log("Flow rate berhasil disimpan di control");

            return set(ref(db, `/users/${fixedUserUid}/settings/batasDebit`), estimasiLiter);
        })
        .then(() => {
            alert("Batas debit berhasil disimpan");
        })
        .catch((error) => {
            console.error("Error menyimpan batas debit: ", error);
            alert("Gagal menyimpan batas debit: " + error.message);
        });
}


function exportToExcel() {
    const total = elemTotal.innerText;
    const estimasi = elemEstimasi.innerText;
    const batasDebit = elemBatasDebit.value;

    const tableRows = document.querySelectorAll("#riwayat-body tr");
    let riwayatData = [["Waktu", "Total (L)", "Biaya (Rp)"]];
    tableRows.forEach(row => {
        const cells = row.querySelectorAll("td");
        const rowData = [];
        cells.forEach(cell => rowData.push(cell.innerText));
        riwayatData.push(rowData);
    });

    const wsData = [
        ["Monitoring Air PDAM"],
        ["Laporan Dibuat Pada: " + new Date().toLocaleString()],
        [""],
        ["Total Air Digunakan:", total],
        ["Estimasi Biaya:", estimasi],
        ["Batas Debit:", batasDebit + " L/m"],
        [""],
        ["Riwayat Penggunaan"]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet([...wsData, ...riwayatData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Monitoring");

    XLSX.writeFile(wb, "Monitoring_Air_PDAM.xlsx");
}

function confirmClearHistory() {
    if (confirm("Apakah Anda yakin ingin menghapus semua riwayat? Tindakan ini tidak dapat dibatalkan.")) {
        clearHistory();
    }
}

function clearHistory() {
    const riwayatRef = ref(db, `/users/${fixedUserUid}/riwayat`);
    
    remove(riwayatRef)
        .then(() => {
            alert("Semua riwayat berhasil dihapus");
            
            historicalChart.data.labels = [];
            historicalChart.data.datasets[0].data = [];
            historicalChart.data.datasets[1].data = [];
            historicalChart.update();
            
            elemRiwayatBody.innerHTML = "";
            
            elemTotal.innerText = "0.00 L";
            elemEstimasi.innerText = "Rp 0.00";
        })
        .catch((error) => {
            console.error("Error menghapus riwayat: ", error);
            alert("Gagal menghapus riwayat: " + error.message);
        });
}

function formatDate(date) {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function formatDateTime(date) {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}
function getWeekStartDate(date) {
    const result = new Date(date);
    const day = result.getDay(); 
    result.setDate(result.getDate() - day);
    return result;
}

function getTimePeriodLabel() {
    switch(currentViewMode) {
        case "weekly":
            return "Minggu Terakhir";
        case "monthly":
            return "Bulan Terakhir";
        case "daily":
        default:
            return "Hari Terakhir";
    }
}

function addMonitoringDataEntry(total, biaya = null) {
    if (biaya === null) {
        biaya = total * hargaPerLiter;
    }
    
    const waktu = new Date().toLocaleString();
    const riwayatRef = ref(db, `/users/${fixedUserUid}/riwayat`);
    
    push(riwayatRef, { 
        waktu, 
        total, 
        biaya
    })
    .then(() => {
        console.log("Data monitoring berhasil disimpan");
    })
    .catch((error) => {
        console.error("Error menyimpan data monitoring: ", error);
    });
}

function initializeMonthlyDataRecording() {
    const today = new Date();
    const todayStr = formatDate(today);
    
    const riwayatRef = query(
        ref(db, `/users/${fixedUserUid}/riwayat`),
        orderByChild('waktu'),
        limitToLast(50)
    );
    
    get(riwayatRef).then((snapshot) => {
        if (!snapshot.exists()) {
            return;
        }
        
        const riwayatData = snapshot.val();
        let hasEntryForToday = false;
        
        Object.values(riwayatData).forEach(item => {
            const itemDate = new Date(item.waktu);
            const itemDateStr = formatDate(itemDate);
            
            if (itemDateStr === todayStr) {
                hasEntryForToday = true;
            }
        });
        
        if (!hasEntryForToday) {
            const entries = Object.values(riwayatData);
            if (entries.length > 0) {
                const lastEntry = entries.sort((a, b) => {
                    return new Date(b.waktu) - new Date(a.waktu);
                })[0];
                
                
                const todayTotal = lastEntry.total + (Math.random() * 2 + 1); 
                addMonitoringDataEntry(todayTotal);
            } else {
             
                addMonitoringDataEntry(10);
            }
        }
    });
}

function setupDailyDataCheck() {
    setTimeout(() => {
        initializeMonthlyDataRecording();
        
        setInterval(() => {
            initializeMonthlyDataRecording();
        }, 6 * 60 * 60 * 1000); 
    }, 5000); 
}

setupDailyDataCheck();
