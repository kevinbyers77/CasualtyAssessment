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
const INJURY_CODES = ["Select an injury...","A","L","B","P","S","O","Am","C","T","D","E"];

function initDiagram(canvasId, wrapperId, imgSrc){
  const wrap = document.getElementById(wrapperId);
  wrap.style.position = "relative";

  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  const markers = [];

  const img = new Image();
  img.onload = ()=> redraw();
  img.src = "docs/" + imgSrc;

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
    if(picker.style.display === "none" || picker.value === "Select an injury...") return;
    const x = parseFloat(picker.dataset.x), y = parseFloat(picker.dataset.y);
    markers.push({x,y,code: picker.value});
    picker.style.display = "none";
    redraw();
    markDirty();
  });

  function clickHandler(e){
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    picker.style.left = `${x - 16}px`;
    picker.style.top  = `${y - 10}px`;
    picker.dataset.x = x.toString();
    picker.dataset.y = y.toString();
    picker.value = "Select an injury...";
    picker.style.display = "block";
    picker.focus();
  }
  canvas.addEventListener("click", clickHandler);

  function redraw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
    airway: document.getElementById("airway").value,
    breathing: document.getElementById("breathing").value,
    signsOfLife: document.getElementById("signsOfLife").value,
    observations: collectObservations(),
    diagramFront: frontDiagram.get(),
    diagramBack:  backDiagram.get(),
    fluidInjury: document.querySelector("input[name='fluidInjury']:checked")?.value || "",
    breathSounds: Array.from(document.querySelectorAll("input[name='breathSounds']:checked")).map(cb=>cb.value),
    remember: document.querySelector("input[name='remember']:checked")?.value || "",
    hurtMost: document.getElementById("hurtMost").value,
    painRating: document.getElementById("painRating").value,
    deepBreath: document.querySelector("input[name='deepBreath']:checked")?.value || "",
    allergies: document.querySelector("input[name='allergies']:checked")?.value || "No",
    allergyDetails: document.getElementById("allergyDetails").value,
    illnesses: Array.from(document.querySelectorAll(".illness:checked")).map(x=>x.value),
    regularMeds: document.getElementById("regularMeds").value,
    todayMeds: document.getElementById("todayMeds").value,
    heartRate: document.getElementById("heartRate").value,
    bloodPressure: document.getElementById("bloodPressure").value,
    treatment: document.getElementById("treatment").value,
    signature: sigCanvas.toDataURL(),
    signerName: document.getElementById("signerName").value,

    // NEW FIELDS
    firstAidTreatment: document.getElementById("firstAidTreatment").value,
    penthrox: document.querySelector("input[name='penthrox']:checked")?.value || "No",
    penthrox3ml: document.getElementById("penthrox3ml")?.checked || false,
    penthrox6ml: document.getElementById("penthrox6ml")?.checked || false,
    dose1Time: document.getElementById("dose1Time").value,
    dose2Time: document.getElementById("dose2Time").value,
    oxygen: {
      yes: document.getElementById("oxygenYes")?.checked || false,
      eight: document.getElementById("oxygen8")?.checked || false,
      fifteen: document.getElementById("oxygen15")?.checked || false,
      resus: document.getElementById("oxygenResus")?.checked || false
    },
    ventolin: document.querySelector("input[name='ventolin']:checked")?.value || "No",
    ventolinTime: document.getElementById("ventolinTime").value,
    handUnitTime: document.getElementById("handUnitTime").value,
    aeroMedTime: document.getElementById("aeroMedTime").value,
    evacuation: Array.from(document.querySelectorAll(".evac:checked")).map(cb=>cb.value),

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

    ["patientName","dob","gender","injuryDate","injuryTime","homeAddress","town","state","postcode","employeeNo","contractor","occupation","shiftStart","injuryLocation"]
      .forEach(k=>{ const el=document.getElementById(k); if(el) el.value = r[k]||""; });

    document.getElementById("history").value = r.history||"";
    if(r.recurring==="Yes"){ document.querySelector("input[name='recurring'][value='Yes']").checked=true; toggleRecurring(true); document.getElementById("recurringDate").value=r.recurringDate||""; }
    else { document.querySelector("input[name='recurring'][value='No']").checked=true; toggleRecurring(false); }

    document.getElementById("danger").checked = !!r.danger;
    ["response","airway","breathing","signsOfLife"].forEach(k=>{ const el=document.getElementById(k); if(el) el.value=r[k]||""; });

    document.querySelector("#observations-table tbody").innerHTML="";
    (r.observations||[]).forEach(row=>addObservationRow(row));

    frontDiagram.set(r.diagramFront||[]);
    backDiagram.set(r.diagramBack||[]);

    if(r.fluidInjury){ document.querySelector(`input[name='fluidInjury'][value='${r.fluidInjury}']`)?.click(); }
    document.querySelectorAll("input[name='breathSounds']").forEach(cb=> cb.checked = (r.breathSounds||[]).includes(cb.value));

    if(r.remember) document.querySelector(`input[name='remember'][value='${r.remember}']`)?.click();
    document.getElementById("hurtMost").value = r.hurtMost||"";
    document.getElementById("painRating").value = r.painRating||"";
    if(r.deepBreath) document.querySelector(`input[name='deepBreath'][value='${r.deepBreath}']`)?.click();

    if(r.allergies) document.querySelector(`input[name='allergies'][value='${r.allergies}']`)?.click();
    document.getElementById("allergyDetails").value = r.allergyDetails||"";
    document.querySelectorAll(".illness").forEach(chk=> chk.checked = (r.illnesses||[]).includes(chk.value) );

    ["regularMeds","todayMeds","heartRate","bloodPressure","treatment","signerName"].forEach(k=>{ const el=document.getElementById(k); if(el) el.value = r[k]||""; });

    if(r.signature){
      const img=new Image();
      img.onload=()=>{ sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height); sigCtx.drawImage(img,0,0,sigCanvas.width,sigCanvas.height); };
      img.src = r.signature;
    } else { sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height); }

    // NEW FIELDS reload
    document.getElementById("firstAidTreatment").value = r.firstAidTreatment || "";
    if(r.penthrox) document.querySelector(`input[name='penthrox'][value='${r.penthrox}']`).checked = true;
    document.getElementById("penthrox3ml").checked = r.penthrox3ml || false;
    document.getElementById("penthrox6ml").checked = r.penthrox6ml || false;
    document.getElementById("dose1Time").value = r.dose1Time || "";
    document.getElementById("dose2Time").value = r.dose2Time || "";

    if(r.oxygen){
      document.getElementById("oxygenYes").checked = r.oxygen.yes || false;
      document.getElementById("oxygen8").checked = r.oxygen.eight || false;
      document.getElementById("oxygen15").checked = r.oxygen.fifteen || false;
      document.getElementById("oxygenResus").checked = r.oxygen.resus || false;
    }

    if(r.ventolin) document.querySelector(`input[name='ventolin'][value='${r.ventolin}']`).checked = true;
    document.getElementById("ventolinTime").value = r.ventolinTime || "";
    document.getElementById("handUnitTime").value = r.handUnitTime || "";
    document.getElementById("aeroMedTime").value = r.aeroMedTime || "";
    document.querySelectorAll(".evac").forEach(cb => cb.checked = (r.evacuation||[]).includes(cb.value));

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

    const li
