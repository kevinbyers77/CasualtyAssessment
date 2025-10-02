let currentEditId = null;
let existingCreated = null;
let isDirty = false;

// IndexedDB setup
let db;
const request = indexedDB.open("casualtyDB", 2);

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

// -----------------------------
// Form handling
// -----------------------------
const form = document.getElementById("casualty-form");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  saveReport();
  isDirty = false;
  updateSaveStatus();
});

// Mark form dirty on input
form.addEventListener("input", () => {
  isDirty = true;
  updateSaveStatus();
});

// -----------------------------
// Signature pad setup
// -----------------------------
const canvas = document.getElementById("signature-pad");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  ctx.scale(ratio, ratio);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

let drawing = false;

function getPos(e) {
  if (e.touches && e.touches[0]) {
    return { 
      x: e.touches[0].clientX - canvas.getBoundingClientRect().left,
      y: e.touches[0].clientY - canvas.getBoundingClientRect().top 
    };
  } else {
    return { x: e.offsetX, y: e.offsetY };
  }
}

canvas.addEventListener("mousedown", (e) => {
  drawing = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
});
canvas.addEventListener("mouseup", () => {
  drawing = false;
  isDirty = true;
  updateSaveStatus();
});
canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  const pos = getPos(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
});

// Touch support
canvas.addEventListener("touchstart", (e) => {
  drawing = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
});
canvas.addEventListener("touchend", () => {
  drawing = false;
  isDirty = true;
  updateSaveStatus();
});
canvas.addEventListener("touchmove", (e) => {
  if (!drawing) return;
  const pos = getPos(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  e.preventDefault();
}, { passive: false });

function clearSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  isDirty = true;
  updateSaveStatus();
}

// -----------------------------
// Save report
// -----------------------------
function saveReport() {
  const signature = canvas.toDataURL();

  const report = {
    patientName: document.getElementById("patientName").value,
    dob: document.getElementById("dob").value,
    heartRate: document.getElementById("heartRate").value,
    bloodPressure: document.getElementById("bloodPressure").value,
    treatment: document.getElementById("treatment").value,
    signature,
    created: currentEditId ? existingCreated : new Date().toISOString(),
    updated: currentEditId ? new Date().toISOString() : null,
    archived: false
  };

  if (currentEditId) {
    report.id = currentEditId;
  }

  const tx = db.transaction("reports", "readwrite");
  const store = tx.objectStore("reports");

  if (currentEditId) {
    store.put(report);
  } else {
    store.add(report);
  }

  tx.oncomplete = () => {
    alert(currentEditId ? "Report updated!" : "Report saved!");
    form.reset();
    clearSignature();
    currentEditId = null;
    existingCreated = null;
    loadRecords();
    isDirty = false;
    updateSaveStatus();
  };
}

// -----------------------------
// Load saved & archived records
// -----------------------------
function loadRecords() {
  const list = document.getElementById("records-list");
  const archivedList = document.getElementById("archived-list");
  list.innerHTML = "";
  archivedList.innerHTML = "";

  const tx = db.transaction("reports", "readonly");
  const store = tx.objectStore("reports");

  store.openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const report = cursor.value;
      const li = document.createElement("li");
      li.textContent = `${report.patientName} (Created: ${report.created})`;

      // Button group container
      const buttonGroup = document.createElement("div");
      buttonGroup.className = "button-group";

      // Export PDF
      const exportBtn = document.createElement("button");
      exportBtn.textContent = "Export PDF";
      exportBtn.className = "btn-pdf";
      exportBtn.onclick = () => exportPDF(report);

      // Edit
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "btn-edit";
      editBtn.onclick = () => editReport(report.id);

      // Archive/Unarchive
      const archiveBtn = document.createElement("button");
      archiveBtn.textContent = report.archived ? "Unarchive" : "Archive";
      archiveBtn.className = "btn-archive";
      archiveBtn.onclick = () => toggleArchive(report.id, !report.archived);

      // Delete
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "btn-delete";
      deleteBtn.onclick = () => deleteReport(report.id);

      // Add buttons to group
      buttonGroup.appendChild(exportBtn);
      buttonGroup.appendChild(editBtn);
      buttonGroup.appendChild(archiveBtn);
      buttonGroup.appendChild(deleteBtn);

      li.appendChild(buttonGroup);

      // Append report to the correct list
      if (report.archived) {
        archivedList.appendChild(li);
      } else {
        list.appendChild(li);
      }

      cursor.continue();
    }
  };
}

// -----------------------------
// Edit report
// -----------------------------
function editReport(id) {
  if (isDirty && !confirm("You have unsaved changes on this report. Do you want to leave without saving?")) return;

  const tx = db.transaction("reports", "readonly");
  const store = tx.objectStore("reports");
  const req = store.get(id);

  req.onsuccess = () => {
    const report = req.result;
    if (!report) return;

    document.getElementById("patientName").value = report.patientName;
    document.getElementById("dob").value = report.dob;
    document.getElementById("heartRate").value = report.heartRate;
    document.getElementById("bloodPressure").value = report.bloodPressure;
    document.getElementById("treatment").value = report.treatment;

    const img = new Image();
    img.onload = () => {
      clearSignature();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = report.signature;

    // Hook up clear signature button
document.getElementById("clear-signature").addEventListener("click", () => {
  clearSignature();
});

    currentEditId = report.id;
    existingCreated = report.created;
    showForm();

    isDirty = false; // mark clean when opening
    updateSaveStatus();
  };
}

// -----------------------------
// Delete report
// -----------------------------
function deleteReport(id) {
  if (confirm("Are you sure you want to delete this report? This action cannot be undone.")) {
    const tx = db.transaction("reports", "readwrite");
    const store = tx.objectStore("reports");
    store.delete(id);

    tx.oncomplete = () => {
      alert("Report deleted.");
      loadRecords();
    };
  }
}

// -----------------------------
// Archive/Unarchive report
// -----------------------------
function toggleArchive(id, newStatus) {
  const tx = db.transaction("reports", "readwrite");
  const store = tx.objectStore("reports");
  const req = store.get(id);

  req.onsuccess = () => {
    const report = req.result;
    if (!report) return;
    report.archived = newStatus;
    store.put(report);

    tx.oncomplete = () => {
      loadRecords();
    };
  };
}

// -----------------------------
// Export PDF
// -----------------------------
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

  if (report.updated) {
    doc.text(`Last Updated: ${report.updated}`, 10, 160);
  }

  doc.save(`casualty_report_${report.patientName}.pdf`);
}

// -----------------------------
// Navigation & highlighting
// -----------------------------
function setActiveTab(tabName) {
  const buttons = document.querySelectorAll("nav button");
  buttons.forEach(btn => btn.classList.remove("active-tab"));

  const map = {
    "form": "New Report",
    "records": "Saved Reports",
    "archived": "Archived Reports"
  };

  buttons.forEach(btn => {
    if (btn.textContent === map[tabName]) {
      btn.classList.add("active-tab");
    }
  });
}

function showForm() {
  if (isDirty && !confirm("You have unsaved changes on this report. Do you want to leave without saving?")) return;
  document.getElementById("form-section").style.display = "block";
  document.getElementById("records-section").style.display = "none";
  document.getElementById("archived-section").style.display = "none";
  setActiveTab("form");
  updateSaveStatus();
}

function showRecords() {
  // Only warn if leaving form
  if (isDirty && document.getElementById("form-section").style.display === "block" &&
      !confirm("You have unsaved changes on this report. Do you want to leave without saving?")) return;

  document.getElementById("form-section").style.display = "none";
  document.getElementById("records-section").style.display = "block";
  document.getElementById("archived-section").style.display = "none";
  setActiveTab("records");
  updateSaveStatus();
}

function showArchived() {
  // Only warn if leaving form
  if (isDirty && document.getElementById("form-section").style.display === "block" &&
      !confirm("You have unsaved changes on this report. Do you want to leave without saving?")) return;

  document.getElementById("form-section").style.display = "none";
  document.getElementById("records-section").style.display = "none";
  document.getElementById("archived-section").style.display = "block";
  setActiveTab("archived");
  updateSaveStatus();
}

function updateSaveStatus() {
  const statusEl = document.getElementById("save-status");
  const saveBtn = document.querySelector("#casualty-form button[type='submit']");

  // Only show status on form screen
  if (document.getElementById("form-section").style.display === "block") {
    statusEl.textContent = isDirty ? "Not Saved" : "Saved";
    statusEl.style.color = isDirty ? "red" : "lime";
    statusEl.style.display = "inline";

    // Enable save button only when dirty
    saveBtn.disabled = !isDirty;
  } else {
    statusEl.style.display = "none";
  }
}

// -----------------------------
// Warn on full page unload
// -----------------------------
window.addEventListener("beforeunload", (e) => {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = ""; // required for Chrome
  }
});
