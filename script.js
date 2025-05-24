// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {
  getDatabase, ref, onValue, set, remove, off
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

const hargaPerLiter = 1550 / 1000;

let selectedUser = document.getElementById("userSelect").value || "esp1";
let monitoringRef, riwayatRef, batasRef;

let chart = window.realtimeChart;
let labels = [], debitData = [], biayaData = [];

function listenFirebase() {
  detachFirebase();
  
  monitoringRef = ref(db, `/${selectedUser}/monitoring`);
  riwayatRef = ref(db, `/${selectedUser}/riwayat`);
  batasRef = ref(db, `/${selectedUser}/settings/batasLiter`);

  onValue(monitoringRef, snap => {
    const data = snap.val();
    if (!data) return;
    document.getElementById("debit").textContent = `${(data.debit || 0).toFixed(2)} L/m`;
    document.getElementById("total").textContent = `${(data.total || 0).toFixed(2)} L`;
    document.getElementById("estimasi").textContent = `Rp ${(data.total * hargaPerLiter).toFixed(2)}`;
    const batas = parseFloat(document.getElementById("batasDebit").value || "0");
    const alert = document.getElementById("statusAlert");
    if (batas > 0 && data.total > batas) {
      alert.textContent = "PERINGATAN: Total liter melebihi batas!";
      alert.classList.remove("bg-green-700");
      alert.classList.add("bg-red-600");
    } else {
      alert.textContent = "Status: Normal";
      alert.classList.remove("bg-red-600");
      alert.classList.add("bg-green-700");
    }
    addChartPoint(data);
  });

  onValue(riwayatRef, snap => {
    const table = document.getElementById("riwayat-body");
    table.innerHTML = "";
    if (!snap.exists()) return;
    const rows = Object.values(snap.val()).sort((a,b) => new Date(b.waktu) - new Date(a.waktu)).slice(0, 30);
    for (let row of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class='border px-4 py-2'>${row.waktu}</td><td class='border px-4 py-2'>${row.debit.toFixed(2)}</td><td class='border px-4 py-2'>${row.total.toFixed(2)}</td><td class='border px-4 py-2'>Rp ${row.biaya.toFixed(2)}</td>`;
      table.appendChild(tr);
    }
  });

  onValue(batasRef, snap => {
    const val = snap.val();
    document.getElementById("batasDebit").value = val;
    document.getElementById("batasLiterValue").textContent = val || "-";
  });
}

function detachFirebase() {
  if (monitoringRef) off(monitoringRef);
  if (riwayatRef) off(riwayatRef);
  if (batasRef) off(batasRef);
}

function addChartPoint(data) {
  const now = new Date();
  const label = now.toLocaleTimeString();
  labels.push(label);
  debitData.push(data.debit);
  biayaData.push((data.total * hargaPerLiter) / 100);
  if (labels.length > 20) {
    labels.shift(); debitData.shift(); biayaData.shift();
  }
  chart.data.labels = labels;
  chart.data.datasets[0].data = debitData;
  chart.data.datasets[1].data = biayaData;
  chart.update();
}

// Listeners
window.addEventListener("DOMContentLoaded", () => {
  listenFirebase();

  document.getElementById("userSelect").addEventListener("change", e => {
    selectedUser = e.target.value;
    listenFirebase();
  });

  document.getElementById("saveBatas").addEventListener("click", () => {
    const val = parseFloat(document.getElementById("batasDebit").value);
    if (isNaN(val)) return alert("Nilai tidak valid");
    set(ref(db, `/${selectedUser}/settings/batasLiter`), val).then(() => {
      document.getElementById("batasDebit").value = "";
    });
  });

  document.getElementById("exportExcel").addEventListener("click", () => {
    const rows = document.querySelectorAll("#riwayat-body tr");
    const data = [["Waktu", "Debit", "Total", "Biaya"]];
    rows.forEach(r => {
      const cells = Array.from(r.children).map(td => td.textContent);
      data.push(cells);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `Riwayat_${selectedUser}.xlsx`);
  });

  document.getElementById("clearHistory").addEventListener("click", () => {
    if (!confirm("Hapus semua riwayat?")) return;
    remove(ref(db, `/${selectedUser}/riwayat`));
  });
});
