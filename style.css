/***********************
 * STATE & INDEXEDDB
 ***********************/
let currentEditId = null;
let isDirty = false;

let db;
const request = indexedDB.open("casualtyDB", 3);

request.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("reports")) {
    db.createObjectStore("reports", { keyPath: "id", autoIncrement: true });
  }
};
request.onsuccess = (e) => { db = e.target.result; loadRecords(); };
request.onerror = (e) => console.error("DB error:", e);

/***********************
 * SAVE STATUS
 ***********************/
function setActiveTab(id){
  document.querySelectorAll("nav button").forEach(b=>b.classList.remove("active-tab"));
  document.getElementById(id)?.classList.add("active-tab");
}
function markDirty(){ isDirty = true; updateSaveStatus(); }
function updateSaveStatus(){
  const s = document.getElementById("save-status");
  const onForm = document.getElementById("form-section").style.display === "block";
  s.textContent = onForm ? (isDirty ? "Not Saved" : "Saved") : "";
  s.style.color = isDirty ? "red" : "lightgreen";
}

/***********************
 * FORM HOOKS
 ***********************/
const form = document.getElementById("casualty-form");
form.addEventListener("input", markDirty);
form.addEventListener("submit", (e)=>{ e.preventDefault(); saveReport(); });

function toggleRecurring(show){
  document.getElementById("recurringDateField").style.display = show ? "block" : "none";
  markDirty();
}

/***********************
 * SIGNATURE
 ***********************/
const sigCanvas = document.getElementById("signature-pad");
const sigCtx = sigCanvas.getContext("2d");
let signing = false;
function sigPos(e){
  const r = sigCanvas.getBoundingClientRect();
  if(e.touches && e.touches[0]) return {x:e.touches[0].clientX-r.left,y:e.touches[0].clientY-r.top};
  return {x:e.offsetX,y:e.offsetY};
}
sigCanvas.addEventListener("mousedown", e=>{ signing=true; const p=sigPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x,p.y); });
sigCanvas.addEventListener("mouseup", ()=> signing=false);
sigCanvas.addEventListener("mousemove", e=>{ if(!signing) return; const p=sigPos(e); sigCtx.lineTo(p.x,p.y); sigCtx.stroke(); markDirty(); });
sigCanvas.addEventListener("touchstart", e=>{ signing=true; const p=sigPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x,p.y); });
sigCanvas.addEventListener("touchend", ()=> signing=false);
sigCanvas.addEventListener("touchmove", e=>{ if(!signing) return; const p=sigPos(e); sigCtx.lineTo(p.x,p.y); sigCtx.stroke(); e.preventDefault(); markDirty(); }, {passive:false});
document.getElementById("clear-signature").addEventListener("click", ()=>{ sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height); markDirty(); });

/***********************
 * OBSERVATIONS TABLE
 ***********************/
function addObservationRow(data={}){
  const tbody = document.querySelector("#observations-table tbody");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="time" value="${data.time||""}"></td>
    <td><input type="number" value="${data.pulse||""}"></td>
    <td><input type="text" value="${data.bp||""}"></td>
    <td><input type="number" value="${data.breaths||""}"></td>
    <td><input type="number" min="1" max="15" value="${data.gcs||""}"></td>
    <td><select>${[1,2,3,4,5].map(v=>`<option ${data.pupilL==v?"selected":""}>${v}</option>`).join("")}</select></td>
    <td><select>${[1,2,3,4,5].map(v=>`<option ${data.pupilR==v?"selected":""}>${v}</option>`).join("")}</select></td>
    <td><select><option></option><option ${data.reactL=="Yes"?"selected":""}>Yes</option><option ${data.reactL=="No"?"selected":""}>No</option></select></td>
    <td><select><option></option><option ${data.reactR=="Yes"?"selected":""}>Yes</option><option ${data.reactR=="No"?"selected":""}>No</option></select></td>
    <td><button type="button" class="btn-outline">Delete</button></td>
  `;
  tr.querySelector("button").onclick = ()=> tr.remove();
  tbody.appendChild(tr);
  markDirty();
}
function collectObservations(){
  return Array.from(document.querySelectorAll("#observations-table tbody tr")).map(tr=>{
    const c = tr.querySelectorAll("td input, td select");
    return {
      time:c[0].value, pulse:c[1].value, bp:c[2].value, breaths:c[3].value,
      gcs:c[4].value, pupilL:c[5].value, pupilR:c[6].value, reactL:c[7].value, reactR:c[8].value
    };
  });
}

/***********************
 * BODY DIAGRAMS (CANVAS)
 ***********************/
const INJURY_CODES = ["A","L","B","P","S","O","Am","C","T","D","E"];

function initDiagram(canvasId, wrapperId, imgSrc){
  const wrap = document.getElementById(wrapperId);
  wrap.style.position = "relative";

  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  const markers = [];

  const img = new Image();
  img.onload = ()=> redraw();
  img.src = "docs/" + imgSrc;         // ✅ points to /docs/front.png, /docs/back.png

  // Dropdown (created once, positioned per click)
  const picker = document.createElement("select");
  picker.className = "btn-outline";
  picker.style.position = "absolute";
  picker.style.display = "none";
  INJURY_CODES.forEach(code => {
    const opt = document.createElement("option");
    opt.value = code; opt.textContent = code; picker.appendChild(opt);
  });
  wrap.appendChild(picker);

  picker.addEventListener("change", ()=>{
    if(picker.style.display === "none") return;
    const x = parseFloat(picker.dataset.x), y = parseFloat(picker.dataset.y);
    const code = picker.value;
    markers.push({x,y,code});
    picker.style.display = "none";
    redraw();
    markDirty();
  });

  function clickHandler(e){
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    // Position dropdown at click (inside wrapper)
    picker.style.left = `${x - 16}px`;
    picker.style.top  = `${y - 10}px`;
    picker.dataset.x = x.toString();
    picker.dataset.y = y.toString();
    picker.value = INJURY_CODES[0];
    picker.style.display = "block";
    picker.focus();
  }
  canvas.addEventListener("click", clickHandler);

  function redraw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // draw background image scaled to canvas
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // draw markers
    ctx.fillStyle="black";
    ctx.font="14px Arial";
    markers.forEach(m => ctx.fillText(m.code, m.x, m.y));
  }

  return {
    get: ()=> markers.slice(),
    set: (arr=[])=>{ markers.splice(0,markers.length,...arr); redraw(); },
    undo: ()=>{ markers.pop(); redraw(); markDirty(); },
    redraw
  };
}

const frontDiagram = initDiagram("diagram-front", "front-wrap", "front.png");
const backDiagram  = initDiagram("diagram-back",  "back-wrap",  "back.png");

/***********************
 * SAVE / LOAD REPORT
 ***********************/
function saveReport(){
  const report = {
    id: currentEditId || undefined,
    // patient
    patientName: document.getElementById("patientName").value,
    dob: document.getElementById("dob").value,
    gender: document.getElementById("gender").value,
    // injury info
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
    // history
    history: document.getElementById("history").value,
    recurring: document.querySelector("input[name='recurring']:checked")?.value || "No",
    recurringDate: document.getElementById("recurringDate").value,
    // primary
    danger: document.getElementById("danger").checked,
    response: document.getElementById("response").value,
    airway: document.getElementById("airway").value,
    breathing: document.getElementById("breathing").value,
    signsOfLife: document.getElementById("signsOfLife").value,
    // observations
    observations: collectObservations(),
    // secondary
    diagramFront: frontDiagram.get(),
    diagramBack:  backDiagram.get(),
    fluidInjury: document.querySelector("input[name='fluidInjury']:checked")?.value || "",
    breathSounds: Array.from(document.querySelectorAll("input[name='breathSounds']:checked")).map(cb=>cb.value),
    // questions
    remember: document.querySelector("input[name='remember']:checked")?.value || "",
    hurtMost: document.getElementById("hurtMost").value,
    painRating: document.getElementById("painRating").value,
    deepBreath: document.querySelector("input[name='deepBreath']:checked")?.value || "",
    // allergies/illnesses/meds
    allergies: document.querySelector("input[name='allergies']:checked")?.value || "No",
    allergyDetails: document.getElementById("allergyDetails").value,
    illnesses: Array.from(document.querySelectorAll(".illness:checked")).map(x=>x.value),
    regularMeds: document.getElementById("regularMeds").value,
    todayMeds: document.getElementById("todayMeds").value,
    // vitals/treatment/signature
    heartRate: document.getElementById("heartRate").value,
    bloodPressure: document.getElementById("bloodPressure").value,
    treatment: document.getElementById("treatment").value,
    signature: sigCanvas.toDataURL(),
    signerName: document.getElementById("signerName").value,
    // metadata
    created: new Date().toISOString(),
    archived: false
  };

  const tx = db.transaction("reports","readwrite");
  const store = tx.objectStore("reports");
  (currentEditId ? store.put(report) : store.add(report));
  tx.oncomplete = ()=>{
    alert("Report saved!");
    form.reset();
    sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height);
    frontDiagram.set([]); backDiagram.set([]);
    currentEditId = null; isDirty = false; updateSaveStatus();
    loadRecords();
    showRecords();
  };
}

function editReport(id){
  const tx = db.transaction("reports","readonly");
  tx.objectStore("reports").get(id).onsuccess = (ev)=>{
    const r = ev.target.result; if(!r) return;
    currentEditId = r.id;

    // patient/injury
    ["patientName","dob","gender","injuryDate","injuryTime","homeAddress","town","state","postcode","employeeNo","contractor","occupation","shiftStart","injuryLocation"]
      .forEach(k=>{ const el=document.getElementById(k); if(el) el.value = r[k]||""; });

    // history
    document.getElementById("history").value = r.history||"";
    if(r.recurring==="Yes"){ document.querySelector("input[name='recurring'][value='Yes']").checked=true; toggleRecurring(true); document.getElementById("recurringDate").value=r.recurringDate||""; }
    else { document.querySelector("input[name='recurring'][value='No']").checked=true; toggleRecurring(false); }

    // primary
    document.getElementById("danger").checked = !!r.danger;
    ["response","airway","breathing","signsOfLife"].forEach(k=>{ const el=document.getElementById(k); if(el) el.value=r[k]||""; });

    // observations
    document.querySelector("#observations-table tbody").innerHTML="";
    (r.observations||[]).forEach(row=>addObservationRow(row));

    // diagrams
    frontDiagram.set(r.diagramFront||[]);
    backDiagram.set(r.diagramBack||[]);

    // secondary extra
    if(r.fluidInjury){ document.querySelector(`input[name='fluidInjury'][value='${r.fluidInjury}']`)?.click(); }
    document.querySelectorAll("input[name='breathSounds']").forEach(cb=> cb.checked = (r.breathSounds||[]).includes(cb.value));

    // questions
    if(r.remember) document.querySelector(`input[name='remember'][value='${r.remember}']`)?.click();
    document.getElementById("hurtMost").value = r.hurtMost||"";
    document.getElementById("painRating").value = r.painRating||"";
    if(r.deepBreath) document.querySelector(`input[name='deepBreath'][value='${r.deepBreath}']`)?.click();

    // allergies/illnesses
    if(r.allergies) document.querySelector(`input[name='allergies'][value='${r.allergies}']`)?.click();
    document.getElementById("allergyDetails").value = r.allergyDetails||"";
    document.querySelectorAll(".illness").forEach(chk=> chk.checked = (r.illnesses||[]).includes(chk.value) );

    // meds/vitals/treatment
    ["regularMeds","todayMeds","heartRate","bloodPressure","treatment","signerName"].forEach(k=>{ const el=document.getElementById(k); if(el) el.value = r[k]||""; });

    // signature
    if(r.signature){
      const img=new Image();
      img.onload=()=>{ sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height); sigCtx.drawImage(img,0,0,sigCanvas.width,sigCanvas.height); };
      img.src = r.signature;
    } else { sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height); }

    isDirty = false; updateSaveStatus(); showForm();
  };
}

/***********************
 * LISTS / ACTIONS
 ***********************/
function loadRecords(){
  const active = document.getElementById("records-list");
  const arch   = document.getElementById("archived-list");
  active.innerHTML = ""; arch.innerHTML = "";

  const tx = db.transaction("reports","readonly");
  tx.objectStore("reports").openCursor().onsuccess = (e)=>{
    const cursor = e.target.result;
    if(!cursor) return;
    const r = cursor.value;

    const li = document.createElement("li");
    li.textContent = `${r.patientName || "(no name)"} (Created: ${r.created})`;

    const btnPDF = document.createElement("button");
    btnPDF.className="btn-pdf"; btnPDF.textContent="Export PDF"; btnPDF.onclick=()=>exportPDF(r);

    const btnEdit = document.createElement("button");
    btnEdit.className="btn-edit"; btnEdit.textContent="Edit"; btnEdit.onclick=()=>editReport(r.id);

    const btnArch = document.createElement("button");
    btnArch.className="btn-archive"; btnArch.textContent = r.archived ? "Unarchive" : "Archive";
    btnArch.onclick=()=>toggleArchive(r.id,!r.archived);

    const btnDel = document.createElement("button");
    btnDel.className="btn-delete"; btnDel.textContent="Delete";
    btnDel.onclick=()=>{ if(confirm("Delete this report?")) deleteReport(r.id); };

    li.append(btnPDF, btnEdit, btnArch, btnDel);
    (r.archived ? arch : active).appendChild(li);

    cursor.continue();
  };
}

function toggleArchive(id, toArchive){
  const tx = db.transaction("reports","readwrite");
  const store = tx.objectStore("reports");
  store.get(id).onsuccess = (e)=>{
    const r = e.target.result; if(!r) return;
    r.archived = toArchive;
    store.put(r).onsuccess = loadRecords;
  };
}

function deleteReport(id){
  const tx = db.transaction("reports","readwrite");
  tx.objectStore("reports").delete(id).onsuccess = loadRecords;
}

/***********************
 * EXPORT (simple summary for now)
 ***********************/
function exportPDF(report){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Casualty Assessment Report", 10, 16);
  doc.setFontSize(11);

  const lines = [
    `Patient: ${report.patientName || ""}`,
    `DOB: ${report.dob || ""}   Gender: ${report.gender || ""}`,
    `Injury: ${report.injuryDate || ""} ${report.injuryTime || ""}`,
    `Location: ${report.injuryLocation || ""}`,
    `Heart Rate: ${report.heartRate || ""}   BP: ${report.bloodPressure || ""}`,
    `History: ${report.history || ""}`,
    `Recurring: ${report.recurring || ""}  Original: ${report.recurringDate || ""}`,
    `Fluid/Air Injection Injury: ${report.fluidInjury || ""}`,
    `Breath Sounds: ${(report.breathSounds||[]).join(", ")}`,
    `Pain rating: ${report.painRating || ""}  Deep breath: ${report.deepBreath || ""}`,
    `Allergies: ${report.allergies || ""}  ${report.allergyDetails || ""}`,
    `Illnesses: ${(report.illnesses||[]).join(", ")}`,
    `Regular meds: ${report.regularMeds || ""}`,
    `Meds today: ${report.todayMeds || ""}`
  ];
  let y = 26;
  lines.forEach(l=>{ doc.text(l, 10, y); y+=6; });

  if(report.signature){
    doc.text("Signature:", 10, y+6);
    doc.addImage(report.signature, "PNG", 30, y, 50, 25);
  }
  doc.save(`casualty_report_${(report.patientName||"").replace(/\s+/g,'_')}.pdf`);
}

/***********************
 * NAVIGATION
 ***********************/
function showForm(){ if(isDirty && !confirm("You have unsaved changes. Leave without saving?")) return;
  document.getElementById("form-section").style.display="block";
  document.getElementById("records-section").style.display="none";
  document.getElementById("archived-section").style.display="none";
  setActiveTab("btn-new"); updateSaveStatus();
}
function showRecords(){ if(isDirty && !confirm("You have unsaved changes. Leave without saving?")) return;
  document.getElementById("form-section").style.display="none";
  document.getElementById("records-section").style.display="block";
  document.getElementById("archived-section").style.display="none";
  setActiveTab("btn-saved"); updateSaveStatus();
}
function showArchived(){ if(isDirty && !confirm("You have unsaved changes. Leave without saving?")) return;
  document.getElementById("form-section").style.display="none";
  document.getElementById("records-section").style.display="none";
  document.getElementById("archived-section").style.display="block";
  setActiveTab("btn-archived"); updateSaveStatus();
}

// initial UI
setActiveTab("btn-saved");
updateSaveStatus();
