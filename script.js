// ---- NAVIGATION ----

// Highlight the active navigation button
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

// Show New Report form
function showForm() {
  if (isDirty && !confirm("You have unsaved changes on this report. Do you want to leave without saving?")) return;
  document.getElementById("form-section").style.display = "block";
  document.getElementById("records-section").style.display = "none";
  document.getElementById("archived-section").style.display = "none";
  setActiveTab("form");
  updateSaveStatus();
}

// Show Saved Reports list
function showRecords() {
  if (isDirty && !confirm("You have unsaved changes on this report. Do you want to leave without saving?")) return;
  document.getElementById("form-section").style.display = "none";
  document.getElementById("records-section").style.display = "block";
  document.getElementById("archived-section").style.display = "none";
  setActiveTab("records");
  updateSaveStatus();
}

// Show Archived Reports list
function showArchived() {
  if (isDirty && !confirm("You have unsaved changes on this report. Do you want to leave without saving?")) return;
  document.getElementById("form-section").style.display = "none";
  document.getElementById("records-section").style.display = "none";
  document.getElementById("archived-section").style.display = "block";
  setActiveTab("archived");
  updateSaveStatus();
}
