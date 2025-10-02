let currentEditId = null;
let isDirty = false;

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

request.onerror = (e) => console.error("DB error:", e);

// Track unsaved changes
document.querySelectorAll("input, textarea").forEach(el => {
  el.addEventListener("input", () => {
    isDirty = true;
    updateSaveStatus();
  });
});

function updateSaveStatus() {
  const status = document.getElementById("save-status");
  if (document.getElementById("form-section").style.display === "block") {
    status.textContent = isDirty ? "Not Saved" : "Saved";
    status.style.color = isDirty ? "red" : "limegreen";
  } else {
    status.textContent = "";
  }
}

function toggleRecurring(show) {
  document.getElementById("recurringDateField").style.display = show ? "block" : "none";
}

// Form handling
const form = document.getElementById("casualty-form");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  saveReport();
});

// Signature pad
const canvas = document.getElementById("signature-pad");
const ctx = canvas.getContext("2d");

// fixed size
canvas.width = 300;
canvas.height = 120;

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
canvas.addEventListener("mouseup", () => (drawing = false));
canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  const pos = getPos(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
});

// Touch
canvas.addEventListener("touchstart", (e) => {
  drawing = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
});
canvas.addEventListener("touchend", () => (drawing = false));
canvas.addEventListener("touchmove", (e) => {
  if (!drawing) return;
  const pos = getPos(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  e.preventDefault();
}, { passive: false });

function clearSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Save report
function saveReport() {
  const signature = canvas.toDataURL();
  const report = {
    id: currentEditId || undefined,
    patientName: document.getElementById("patientName").value,
    dob: document.getElementById("dob").value,
    gender: document.getElementById("gender").value,
    injuryDate: document.getElementById("injuryDate").value,
    injuryTime: document.getElementById("injuryTime").value,
    homeAddress: document.getElementById("homeAddress").value,
    town: document.getElementById("town").value,
    state: document.getElementById("state").value,
    postcode: document.getElementById("postcode").value,
    employeeNo: document.getElementById("employeeNo").value,
    contractor: document.getElementById("contractor").value,
    occupation: document.getElementById("occupation").value,
    shiftStart: document.getElementById("shiftStart").value,
    injuryLocation: document.getElementById("injuryLocation").value,
    history: document.getElementById("history").value,
    recurring: document.querySelector("input[name='recurring']:checked")?.value || "No",
    recurringDate: document.getElementById("recurringDate").value,
    heartRate: document.getElementById("heartRate").value,
    bloodPressure: document.getElementById("bloodPressure").value,
    treatment: document.getElementById("treatment").value,
    signature,
    signerName: document.getElementById("signerName").value,
    created: new Date().toISOString(),
    archived: false
  };

  const tx = db.transaction("reports", "readwrite");
  const store = tx.objectStore("reports");
  if (currentEditId) {
    store.put(report);
  } else {
    store.add(report);
  }

  tx.oncomplete = () => {
    alert("Report saved!");
    form.reset();
    clearSignature();
    currentEditId = null;
    isDirty = false;
    updateSaveStatus();
    loadRecords();
  };
}

// Load records
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

      const pdfBtn = document.createElement("button");
      pdfBtn.textContent = "Export PDF";
      pdfBtn.className = "btn-pdf";
      // hook PDF later
      li.appendChild(pdfBtn);

      (report.archived ? archivedList : list).appendChild(li);
      cursor.continue();
    }
  };
}

// Navigation
function showForm() {
  if (isDirty && !confirm("You have unsaved changes. Leave without saving?")) return;
  document.getElementById("form-section").style.display = "block";
  document.getElementById("records-section").style.display = "none";
  document.getElementById("archived-section").style.display = "none";
  isDirty = false;
  updateSaveStatus();
}

function showRecords() {
  if (isDirty && !confirm("You have unsaved changes. Leave without saving?")) return;
  document.getElementById("form-section").style.display = "none";
  document.getElementById("records-section").style.display = "block";
  document.getElementById("archived-section").style.display = "none";
  updateSaveStatus();
}

function showArchived() {
  if (isDirty && !confirm("You have unsaved changes. Leave without saving?")) return;
  document.getElementById("form-section").style.display = "none";
  document.getElementById("records-section").style.display = "none";
  document.getElementById("archived-section").style.display = "block";
  updateSaveStatus();
}
