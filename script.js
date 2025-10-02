let currentEditId = null;
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

request.onerror = (e) => console.error("DB error:", e);

// Track unsaved changes
document.addEventListener("input", () => {
  isDirty = true;
  updateSaveStatus();
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

// -------------------- OBSERVATIONS TABLE --------------------

function addObservationRow(data = {}) {
  const tbody = document.querySelector("#observations-table tbody");
  const row = document.createElement("tr");

  row.innerHTML = `
    <td><input type="time" value="${data.time || ""}"></td>
    <td><input type="number" value="${data.pulse || ""}"></td>
    <td><input type="text" value="${data.bp || ""}"></td>
    <td><input type="number" value="${data.breaths || ""}"></td>
    <td><input type="number" min="1" max="15" value="${data.gcs || ""}"></td>
    <td><select><option></option>${[1,2,3,4,5].map(v => `<option ${data.pupilL==v?"selected":""}>${v}</option>`).join("")}</select></td>
    <td><select><option></option>${[1,2,3,4,5].map(v => `<option ${data.pupilR==v?"selected":""}>${v}</option>`).join("")}</select></td>
    <td><select><option></option><option ${data.reactL=="Yes"?"selected":""}>Yes</option><option ${data.reactL=="No"?"selected":""}>No</option></select></td>
    <td><select><option></option><option ${data.reactR=="Yes"?"selected":""}>Yes</option><option ${data.reactR=="No"?"selected":""}>No</option></select></td>
    <td><button type="button" onclick="this.closest('tr').remove()">Delete</button></td>
  `;

  tbody.appendChild(row);
}

function getObservations() {
  const rows = document.querySelectorAll("#observations-table tbody tr");
  return Array.from(rows).map(row => {
    const cells = row.querySelectorAll("td input, td select");
    return {
      time: cells[0].value,
      pulse: cells[1].value,
      bp: cells[2].value,
      breaths: cells[3].value,
      gcs: cells[4].value,
      pupilL: cells[5].value,
      pupilR: cells[6].value,
      reactL: cells[7].value,
      reactR: cells[8].value
    };
  });
}

// -------------------- BODY DIAGRAMS --------------------

function initDiagram(canvasId, view, imgSrc) {
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

    // Create dropdown dynamically
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
      isDirty = true;
      updateSaveStatus();
    });
  });

  return {
    get: () => markers,
    set: (arr) => { markers.length = 0; arr.forEach(m => markers.push(m)); redraw(); },
    undo: () => { markers.pop(); redraw(); }
  };
}

const frontDiagram = initDiagram("diagram-front", "front", "docs/front.png");
const backDiagram  = initDiagram("diagram-back", "back", "docs/back.png");

document.getElementById("undo-front").addEventListener("click", () => frontDiagram.undo());
document.getElementById("undo-back").addEventListener("click", () => backDiagram.undo());

// -------------------- SIGNATURE --------------------

const signatureCanvas = document.getElementById("signature-pad");
const sigCtx = signatureCanvas.getContext("2d");
signatureCanvas.width = 300;
signatureCanvas.height = 120;

let drawing = false;
signatureCanvas.addEventListener("mousedown", e => {drawing = true; sigCtx.beginPath(); sigCtx.moveTo(e.offsetX,e.offsetY);});
signatureCanvas.addEventListener("mouseup", ()=>drawing=false);
signatureCanvas.addEventListener("mousemove", e => {if(drawing){sigCtx.lineTo(e.offsetX,e.offsetY);sigCtx.stroke();}});
signatureCanvas.addEventListener("touchstart", e => {drawing=true; const t=e.touches[0]; sigCtx.beginPath(); sigCtx.moveTo(t.clientX-signatureCanvas.offsetLeft, t.clientY-signatureCanvas.offsetTop);});
signatureCanvas.addEventListener("touchend", ()=>drawing=false);
signatureCanvas.addEventListener("touchmove", e => {if(drawing){const t=e.touches[0];sigCtx.lineTo(t.clientX-signatureCanvas.offsetLeft, t.clientY-signatureCanvas.offsetTop);sigCtx.stroke();e.preventDefault();}}, {passive:false});

function clearSignature() {
  sigCtx.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);
}

// -------------------- SAVE/LOAD --------------------

function saveReport() {
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
    danger: document.getElementById("danger").checked,
    response: document.getElementById("response").value,
    help000: document.getElementById("help000").checked,
    help112: document.getElementById("help112").checked,
    airway: document.getElementById("airway").value,
    breathing: document.getElementById("breathing").value,
    signsOfLife: document.getElementById("signsOfLife").value,
    observations: getObservations(),
    diagramFront: frontDiagram.get(),
    diagramBack: backDiagram.get(),
    remember: document.querySelector("input[name='remember']:checked")?.value || "",
    hurtMost: document.getElementById("hurtMost").value,
    painRating: document.getElementById("painRating").value,
    deepBreath: document.querySelector("input[name='deepBreath']:checked")?.value || "",
    allergies: document.querySelector("input[name='allergies']:checked")?.value || "No",
    allergyDetails: document.getElementById("allergyDetails").value,
    illnesses: Array.from(document.querySelectorAll(".illness:checked")).map(c=>c.value),
    regularMeds: document.getElementById("regularMeds").value,
    todayMeds: document.getElementById("todayMeds").value,
    heartRate: document.getElementById("heartRate").value,
    bloodPressure: document.getElementById("bloodPressure").value,
    treatment: document.getElementById("treatment").value,
    signature: signatureCanvas.toDataURL(),
    signerName: document.getElementById("signerName").value,
    created: new Date().toISOString(),
    archived: false
  };

  const tx = db.transaction("reports","readwrite");
  const store = tx.objectStore("reports");
  currentEditId ? store.put(report) : store.add(report);

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

const form = document.getElementById("casualty-form");
form.addEventListener("submit", e => {e.preventDefault(); saveReport();});

// -------------------- LOAD RECORDS --------------------

function loadRecords() {
  const list = document.getElementById("records-list");
  const archivedList = document.getElementById("archived-list");
  list.innerHTML = "";
  archivedList.innerHTML = "";

  const tx = db.transaction("reports","readonly");
  const store = tx.objectStore("reports");

  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if(cursor){
      const report = cursor.value;
      const li = document.createElement("li");
      li.textContent = `${report.patientName} (${report.created})`;
      const editBtn=document.createElement("button");
      editBtn.textContent="Edit"; editBtn.onclick=()=>editReport(report.id);
      li.appendChild(editBtn);
      (report.archived?archivedList:list).appendChild(li);
      cursor.continue();
    }
  };
}

function editReport(id){
  const tx=db.transaction("reports","readonly");
  const store=tx.objectStore("reports");
  const req=store.get(id);
  req.onsuccess=()=>{
    const r=req.result; if(!r) return;
    currentEditId=r.id;
    document.getElementById("patientName").value=r.patientName||"";
    document.getElementById("dob").value=r.dob||"";
    document.getElementById("gender").value=r.gender||"";
    document.getElementById("injuryDate").value=r.injuryDate||"";
    document.getElementById("injuryTime").value=r.injuryTime||"";
    document.getElementById("homeAddress").value=r.homeAddress||"";
    document.getElementById("town").value=r.town||"";
    document.getElementById("state").value=r.state||"";
    document.getElementById("postcode").value=r.postcode||"";
    document.getElementById("employeeNo").value=r.employeeNo||"";
    document.getElementById("contractor").value=r.contractor||"";
    document.getElementById("occupation").value=r.occupation||"";
    document.getElementById("shiftStart").value=r.shiftStart||"";
    document.getElementById("injuryLocation").value=r.injuryLocation||"";
    document.getElementById("history").value=r.history||"";
    if(r.recurring==="Yes"){document.querySelector("input[name='recurring'][value='Yes']").checked=true;toggleRecurring(true);document.getElementById("recurringDate").value=r.recurringDate||"";}
    else{document.querySelector("input[name='recurring'][value='No']").checked=true;toggleRecurring(false);}
    document.getElementById("danger").checked=r.danger||false;
    document.getElementById("response").value=r.response||"";
    document.getElementById("help000").checked=r.help000||false;
    document.getElementById("help112").checked=r.help112||false;
    document.getElementById("airway").value=r.airway||"";
    document.getElementById("breathing").value=r.breathing||"";
    document.getElementById("signsOfLife").value=r.signsOfLife||"";
    document.querySelector("#observations-table tbody").innerHTML="";
    (r.observations||[]).forEach(o=>addObservationRow(o));
    frontDiagram.set(r.diagramFront||[]);
    backDiagram.set(r.diagramBack||[]);
    if(r.remember){document.querySelector(`input[name='remember'][value='${r.remember}']`).checked=true;}
    document.getElementById("hurtMost").value=r.hurtMost||"";
    document.getElementById("painRating").value=r.painRating||"";
    if(r.deepBreath){document.querySelector(`input[name='deepBreath'][value='${r.deepBreath}']`).checked=true;}
    if(r.allergies){document.querySelector(`input[name='allergies'][value='${r.allergies}']`).checked=true;}
    document.getElementById("allergyDetails").value=r.allergyDetails||"";
    document.querySelectorAll(".illness").forEach(c=>{c.checked=(r.illnesses||[]).includes(c.value);});
    document.getElementById("regularMeds").value=r.regularMeds||"";
    document.getElementById("todayMeds").value=r.todayMeds||"";
    document.getElementById("heartRate").value=r.heartRate||"";
    document.getElementById("bloodPressure").value=r.bloodPressure||"";
    document.getElementById("treatment").value=r.treatment||"";
    const img=new Image();
    img.onload=()=>{clearSignature();sigCtx.drawImage(img,0,0,signatureCanvas.width,signatureCanvas.height);};
    img.src=r.signature||"";
    document.getElementById("signerName").value=r.signerName||"";
    showForm();
  }
}

// -------------------- NAVIGATION --------------------

function showForm(){if(isDirty&&!confirm("You have unsaved changes. Leave without saving?"))return;
 document.getElementById("form-section").style.display="block";
 document.getElementById("records-section").style.display="none";
 document.getElementById("archived-section").style.display="none";
 isDirty=false;updateSaveStatus();}

function showRecords(){if(isDirty&&!confirm("You have unsaved changes. Leave without saving?"))return;
 document.getElementById("form-section").style.display="none";
 document.getElementById("records-section").style.display="block";
 document.getElementById("archived-section").style.display="none";updateSaveStatus();}

function showArchived(){if(isDirty&&!confirm("You have unsaved changes. Leave without saving?"))return;
 document.getElementById("form-section").style.display="none";
 document.getElementById("records-section").style.display="none";
 document.getElementById("archived-section").style.display="block";updateSaveStatus();}
