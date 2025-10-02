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

request.onerror = (e) => {
  console.error("IndexedDB error:", e);
};

// Track dirty state
function updateSaveStatus() {
  const status = document.getElementById("save-status");
  if (isDirty) {
    status.textContent = "Not Saved";
    status.style.color = "red";
  } else {
    status.textContent = "Saved";
    status.style.color = "lightgreen";
  }
}

function markDirty() {
  isDirty = true;
  updateSaveStatus();
}

// Form handling
const form = document.getElementById("casualty-form");
form.addEventListener("input", markDirty);
form.addEventListener("submit", (e) => {
  e.preventDefault();
  saveReport();
});

// Signature pad
const canvas = document.getElementById("signature-pad");
const ctx = canvas.getContext("2d");
let drawing = false;

function getPos(e) {
  if (e.touches && e.touches[0]) {
    return { x: e.touches[0].clientX - canvas.getBoundingClientRect().left,
             y: e.touches[0].clientY - canvas.getBoundingClientRect().top };
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
  markDirty();
});

// Touch support
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
  markDirty();
}, { passive: false });

function clearSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  markDirty();
}

document.getElementById("clear-signature").addEventListener("click", clearSignature);

// Diagram handling
const injuryCodes = ["A","L","B","P","S","O","Am","C","T","D","E"];

function initDiagram(canvasId, imgSrc) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  const markers = [];
  const img = new Image();

  img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.src = imgSrc;

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    markers.forEach(m => {
      ctx.fillStyle = "black";
      ctx.font = "14px Arial";
      ctx.fillText(m.code, m.x, m.y);
    });
  }

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dropdown = document.createElement("select");
    injuryCodes.forEach(code => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = code;
      dropdown.appendChild(opt);
    });

    dropdown.style.position = "absolute";
    dropdown.style.left = `${e.clientX}px`;
    dropdown.style.top = `${e.clientY}px`;
    document.body.appendChild(dropdown);

    dropdown.addEventListener("change", () => {
      markers.push({x, y, code: dropdown.value});
      redraw();
      dropdown.remove();
      markDirty();
    });
  });

  return {
    get: () => markers,
    set: (arr) => { markers.length = 0; arr.forEach(m => markers.push(m)); redraw(); },
    undo: () => { markers.pop(); redraw(); markDirty(); }
  };
}

const frontDiagram = initDiagram("diagram-front", "docs/front.png");
const backDiagram  = initDiagram("diagram-back", "docs/back.png");

document.getElementById("undo-front").addEventListener("click", () => frontDiagram.undo());
document.getElementById("undo-back").addEventListener("click", () => backDiagram.undo());

// Save report
function saveReport() {
  const signature = canvas.toDataURL();

  const injuries = Array.from(document.querySelectorAll("input[name='injuries']:checked"))
    .map(cb => cb.value);

  const fluidInjury = document.querySelector("input[name='fluidInjury']:checked")?.value || "";
  const breathSounds = Array.from(document.querySelectorAll("input[name='breathSounds']:checked"))
    .map(cb => cb.value);

  const report = {
    patientName: document.getElementById("patientName").value,
    dob: document.getElementById("dob").value,
    heartRate: document.getElementById("heartRate").value,
    bloodPressure: document.getElementById("bloodPressure").value,
    treatment: document.getElementById("treatment").value,
    history: document.getElementById("history").value,
    recurring: document.querySelector("input[name='recurring']:checked")?.value || "",
    signature,
    injuries,
    fluidInjury,
    breathSounds,
    diagrams: {
      front: frontDiagram.get(),
      back: backDiagram.get()
    },
    created: new Date().toISOString(),
    id: currentEditId || undefined
  };

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
    frontDiagram.set([]);
    backDiagram.set([]);
    currentEditId = null;
    isDirty = false;
    updateSaveStatus();
    loadRecords();
  };
}

// Load saved records
function loadRecords() {
  const activeList = document.getElementById("records-list");
  const archivedList = document.getElementById("archived-list");
  activeList.innerHTML = "";
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
      pdfBtn.onclick = () => exportPDF(report);

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "btn-edit";
      editBtn.onclick = () => editReport(report.id);

      const archiveBtn = document.createElement("button");
      archiveBtn.textContent = report.archived ? "Unarchive" : "Archive";
      archiveBtn.className = "btn-archive";
      archiveBtn.onclick = () => toggleArchive(report.id, !report.archived);

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "btn-delete";
      delBtn.onclick = () => {
        if (confirm("Are you sure you want to delete this report?")) {
          deleteReport(report.id);
        }
      };

      li.appendChild(pdfBtn);
      li.appendChild(editBtn);
      li.appendChild(archiveBtn);
      li.appendChild(delBtn);

      if (report.archived) {
        archivedList.appendChild(li);
      } else {
        activeList.appendChild(li);
      }

      cursor.continue();
    }
  };
}

function editReport(id) {
  const tx = db.transaction("reports", "readonly");
  const store = tx.objectStore("reports");
  const req = store.get(id);

  req.onsuccess = () => {
    const report = req.result;
    if (!report) return;

    document.getElementById("patientName").value = report.patientName || "";
    document.getElementById("dob").value = report.dob || "";
    document.getElementById("heartRate").value = report.heartRate || "";
    document.getElementById("bloodPressure").value = report.bloodPressure || "";
    document.getElementById("treatment").value = report.treatment || "";
    document.getElementById("history").value = report.history || "";

    if (report.recurring) {
      document.querySelector(`input[name='recurring'][value='${report.recurring}']`).checked = true;
    }

    document.querySelectorAll("input[name='injuries']").forEach(cb => {
      cb.checked = report.injuries?.includes(cb.value) || false;
    });

    if (report.fluidInjury) {
      document.querySelector(`input[name='fluidInjury'][value='${report.fluidInjury}']`).checked = true;
    }

    document.querySelectorAll("input[name='breathSounds']").forEach(cb => {
      cb.checked = report.breathSounds?.includes(cb.value) || false;
    });

    frontDiagram.set(report.diagrams?.front || []);
    backDiagram.set(report.diagrams?.back || []);

    if (report.signature) {
      const img = new Image();
      img.onload = () => {
        clearSignature();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = report.signature;
    }

    currentEditId = report.id;
    showForm();
    isDirty = false;
    updateSaveStatus();
  };
}

// Archive toggle
function toggleArchive(id, archive) {
  const tx = db.transaction("reports", "readwrite");
  const store = tx.objectStore("reports");
  const req = store.get(id);

  req.onsuccess = () => {
    const report = req.result;
    report.archived = archive;
    store.put(report);
    loadRecords();
  };
}

// Delete
function deleteReport(id) {
  const tx = db.transaction("reports", "readwrite");
  tx.objectStore("reports").delete(id);
  tx.oncomplete = () => loadRecords();
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
  doc.text(report.treatment || "", 10, 90, { maxWidth: 180 });

  doc.text(`History: ${report.history || ""}`, 10, 110, { maxWidth: 180 });
  doc.text(`Recurring: ${report.recurring || ""}`, 10, 125);
  doc.text(`Injuries: ${report.injuries?.join(", ") || "None"}`, 10, 135);
  doc.text(`Fluid/Air Injury: ${report.fluidInjury || "No"}`, 10, 145);
  doc.text(`Breath Sounds: ${report.breathSounds?.join(", ") || "None"}`, 10, 155);

  if (report.signature) {
    doc.text("Signature:", 10, 170);
    doc.addImage(report.signature, "PNG", 40, 160, 50, 25);
  }

  doc.save(`casualty_report_${report.patientName}.pdf`);
}

// Navigation
function setActiveTab(tabId) {
  document.querySelectorAll("nav button").forEach(btn => btn.classList.remove("active-tab"));
  document.getElementById(tabId).classList.add("active-tab");
}

function showForm() {
  if (isDirty && !confirm("You have unsaved changes on this report. Do you want to leave without saving?")) return;
  document.getElementById("form-section").style.display = "block";
  document.getElementById("records-section").style.display = "none";
  document.getElementById("archived-section").style.display = "none";
  setActiveTab("btn-new");
}

function showRecords() {
  if (isDirty && !confirm("You have unsaved changes on this report. Do you want to leave without saving?")) return;
  document.getElementById("form-section").style.display = "none";
  document.getElementById("records-section").style.display = "block";
  document.getElementById("archived-section").style.display = "none";
  setActiveTab("btn-saved");
}

function showArchived() {
  if (isDirty && !confirm("You have unsaved changes on this report. Do you want to leave without saving?")) return;
  document.getElementById("form-section").style.display = "none";
  document.getElementById("records-section").style.display = "none";
  document.getElementById("archived-section").style.display = "block";
  setActiveTab("btn-archived");
}

updateSaveStatus();
