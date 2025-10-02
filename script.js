// IndexedDB setup
let db;
const request = indexedDB.open("casualtyDB", 1);

request.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("reports")) {
    db.createObjectStore("reports", { keyPath: "id", autoIncrement: true });
  }
};

request.onsuccess = (e) => {
  db = e.target.result;
  loadRecords();
};

request.onerror = (e) => {
  console.error("IndexedDB error:", e);
};

// Form handling
const form = document.getElementById("casualty-form");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  saveReport();
});

// Signature pad
const canvas = document.getElementById("signature-pad");
const ctx = canvas.getContext("2d");
let drawing = false;

canvas.addEventListener("mousedown", () => (drawing = true));
canvas.addEventListener("mouseup", () => (drawing = false));
canvas.addEventListener("mousemove", draw);

function draw(e) {
  if (!drawing) return;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "black";
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
}

function clearSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Save report
function saveReport() {
  const signature = canvas.toDataURL();

  const report = {
    patientName: document.getElementById("patientName").value,
    dob: document.getElementById("dob").value,
    heartRate: document.getElementById("heartRate").value,
    bloodPressure: document.getElementById("bloodPressure").value,
    treatment: document.getElementById("treatment").value,
    signature,
    created: new Date().toISOString(),
  };

  const tx = db.transaction("reports", "readwrite");
  const store = tx.objectStore("reports");
  store.add(report);

  tx.oncomplete = () => {
    alert("Report saved!");
    form.reset();
    clearSignature();
    loadRecords();
  };
}

// Load saved records
function loadRecords() {
  const list = document.getElementById("records-list");
  list.innerHTML = "";

  const tx = db.transaction("reports", "readonly");
  const store = tx.objectStore("reports");

  store.openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const report = cursor.value;
      const li = document.createElement("li");
      li.textContent = `${report.patientName} (${report.created})`;
      
      const btn = document.createElement("button");
      btn.textContent = "Export PDF";
      btn.onclick = () => exportPDF(report);

      li.appendChild(btn);
      list.appendChild(li);
      cursor.continue();
    }
  };
}

// Export PDF
function exportPDF(report) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Casualty Assessment Report", 10, 20);

  doc.setFontSize(12);
  doc.text(`Patient: ${report.patientName}`, 10, 40);
  doc.text(`DOB: ${report.dob}`, 10, 50);
  doc.text(`Heart Rate: ${report.heartRate}`, 10, 60);
  doc.text(`Blood Pressure: ${report.bloodPressure}`, 10, 70);
  doc.text(`Treatment Notes:`, 10, 80);
  doc.text(report.treatment, 10, 90, { maxWidth: 180 });

  if (report.signature) {
    doc.text("Signature:", 10, 130);
    doc.addImage(report.signature, "PNG", 40, 120, 50, 25);
  }

  doc.save(`casualty_report_${report.patientName}.pdf`);
}

// Navigation
function showForm() {
  document.getElementById("form-section").style.display = "block";
  document.getElementById("records-section").style.display = "none";
}

function showRecords() {
  document.getElementById("form-section").style.display = "none";
  document.getElementById("records-section").style.display = "block";
}
