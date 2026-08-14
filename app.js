/* ===================== ARMAZENAMENTO ===================== */
const STORE_KEY = "bussola-saude-data-v1";

function loadData() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) return JSON.parse(raw);
  return { rdvs: [], meds: [], pin: "1234", takenLog: {} };
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

let state = loadData();

/* ===================== UTILITÁRIOS ===================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDatePT(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
}

function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add("hidden"), 2200);
}

/* ===================== NAVEGAÇÃO ===================== */
function showView(id) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $("#" + id).classList.remove("hidden");
}

$$("[data-open]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.open;
    if (target === "rdv") { renderRdvList(); showView("view-rdv-list"); }
    if (target === "docs") { renderDocsList(); showView("view-docs"); }
    if (target === "meds") { renderMedsList(); showView("view-meds"); }
  });
});

$$("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => {
    showView("view-pere");
    renderHome();
  });
});

$("#btn-open-aidant").addEventListener("click", () => {
  $("#pin-input").value = "";
  $("#pin-error").classList.add("hidden");
  showView("view-pin");
});

$("#pin-submit").addEventListener("click", checkPin);
$("#pin-input").addEventListener("keydown", (e) => { if (e.key === "Enter") checkPin(); });

function checkPin() {
  const val = $("#pin-input").value.trim();
  if (val === state.pin) {
    renderAidant();
    showView("view-aidant");
  } else {
    $("#pin-error").classList.remove("hidden");
  }
}

/* Separadores da área do cuidador */
$$(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab-btn").forEach((b) => b.classList.remove("active"));
    $$(".tab-panel").forEach((p) => p.classList.add("hidden"));
    btn.classList.add("active");
    $("#" + btn.dataset.tab).classList.remove("hidden");
  });
});

/* ===================== ECRÃ PRINCIPAL ===================== */
function renderHome() {
  renderNextTicket();
  renderTodayMeds();
}

function getUpcomingRdvs() {
  const now = new Date();
  return state.rdvs
    .filter((r) => new Date(r.date + "T" + (r.heure || "00:00")) >= now.setHours(0, 0, 0, 0) || r.date >= todayStr())
    .sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
}

function renderNextTicket() {
  const el = $("#next-ticket");
  const upcoming = getUpcomingRdvs();
  if (upcoming.length === 0) {
    el.innerHTML = `<div class="ticket-empty">Sem consultas marcadas 🎉</div>`;
    return;
  }
  const r = upcoming[0];
  el.innerHTML = `
    <div class="ticket-eyebrow">Próxima consulta</div>
    <div class="ticket-title">${escapeHTML(r.medecin || "Consulta")}</div>
    <div class="ticket-sub">${escapeHTML(r.motif || "")}</div>
    <div class="ticket-meta">
      <div><span>Data</span>${capitalize(formatDatePT(r.date))}</div>
      <div><span>Hora</span>${r.heure || "—"}</div>
    </div>
  `;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderTodayMeds() {
  const el = $("#today-meds");
  const today = todayStr();
  const slots = [];
  state.meds.forEach((m) => {
    (m.heures || []).forEach((h) => {
      slots.push({ medId: m.id, nom: m.nom, heure: h });
    });
  });
  slots.sort((a, b) => a.heure.localeCompare(b.heure));

  if (slots.length === 0) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = slots.map((s) => {
    const logKey = `${today}_${s.medId}_${s.heure}`;
    const taken = !!state.takenLog[logKey];
    return `
      <div class="med-chip ${taken ? "taken" : ""}">
        <div class="med-chip-info">
          <span class="med-chip-time">${s.heure}</span>
          <span>${escapeHTML(s.nom)}</span>
        </div>
        <button class="med-chip-taken-btn" data-logkey="${logKey}">${taken ? "Tomado ✓" : "Marcar tomado"}</button>
      </div>
    `;
  }).join("");

  el.querySelectorAll(".med-chip-taken-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.logkey;
      state.takenLog[key] = !state.takenLog[key];
      saveData();
      renderTodayMeds();
    });
  });
}

/* ===================== LISTA DE CONSULTAS (leitura) ===================== */
function renderRdvList() {
  const el = $("#rdv-list-content");
  const list = getUpcomingRdvs();
  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state">Ainda não há consultas registadas.</div>`;
    return;
  }
  el.innerHTML = list.map(rdvCardHTML).join("");
}

function rdvCardHTML(r) {
  return `
    <div class="rdv-card">
      <div class="rdv-card-date">${capitalize(formatDatePT(r.date))}${r.heure ? " · " + r.heure : ""}</div>
      <div class="rdv-card-medecin">${escapeHTML(r.medecin || "Consulta")}</div>
      ${r.motif ? `<div class="rdv-card-motif">${escapeHTML(r.motif)}</div>` : ""}
      ${r.lieu ? `<div class="rdv-card-lieu">📍 ${escapeHTML(r.lieu)}</div>` : ""}
      ${r.photo ? `<img class="doc-thumb" src="${r.photo}" alt="Documento da consulta" />` : ""}
    </div>
  `;
}

/* ===================== DOCUMENTOS (leitura) ===================== */
function renderDocsList() {
  const el = $("#docs-list-content");
  const withDocs = state.rdvs.filter((r) => r.photo).sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));
  if (withDocs.length === 0) {
    el.innerHTML = `<div class="empty-state">Ainda não há documentos. Adiciona uma foto a partir de uma consulta.</div>`;
    return;
  }
  el.innerHTML = withDocs.map((r) => `
    <div class="doc-card">
      <div class="rdv-card-date">${capitalize(formatDatePT(r.date))}</div>
      <div class="rdv-card-medecin">${escapeHTML(r.medecin || "Documento")}</div>
      ${r.motif ? `<div class="rdv-card-motif">${escapeHTML(r.motif)}</div>` : ""}
      <img class="doc-thumb" src="${r.photo}" alt="Documento" />
    </div>
  `).join("");
}

/* ===================== MEDICAMENTOS (leitura) ===================== */
function renderMedsList() {
  const el = $("#meds-list-content");
  if (state.meds.length === 0) {
    el.innerHTML = `<div class="empty-state">Ainda não há medicamentos registados.</div>`;
    return;
  }
  el.innerHTML = state.meds.map((m) => `
    <div class="rdv-card">
      <div class="rdv-card-medecin">${escapeHTML(m.nom)}</div>
      ${m.consigne ? `<div class="rdv-card-motif">${escapeHTML(m.consigne)}</div>` : ""}
      <div class="rdv-card-lieu">Horários: ${(m.heures || []).join(", ") || "—"}</div>
    </div>
  `).join("");
}

/* ===================== ÁREA DO CUIDADOR ===================== */
function renderAidant() {
  renderAidantRdvs();
  renderAidantMeds();
  $("#notif-status").textContent = notifStatusLabel();
}

function renderAidantRdvs() {
  const el = $("#aidant-rdv-list");
  const list = [...state.rdvs].sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state">Sem consultas. Adiciona uma acima.</div>`;
    return;
  }
  el.innerHTML = list.map((r) => `
    <div class="aidant-item">
      <div class="aidant-item-main">
        <strong>${escapeHTML(r.medecin || "Consulta")}</strong>
        <span>${capitalize(formatDatePT(r.date))} ${r.heure ? "· " + r.heure : ""}</span>
      </div>
      <button class="edit-link" data-edit-rdv="${r.id}">Editar</button>
    </div>
  `).join("");
  el.querySelectorAll("[data-edit-rdv]").forEach((btn) => {
    btn.addEventListener("click", () => openRdvModal(btn.dataset.editRdv));
  });
}

function renderAidantMeds() {
  const el = $("#aidant-meds-list");
  if (state.meds.length === 0) {
    el.innerHTML = `<div class="empty-state">Sem medicamentos. Adiciona um acima.</div>`;
    return;
  }
  el.innerHTML = state.meds.map((m) => `
    <div class="aidant-item">
      <div class="aidant-item-main">
        <strong>${escapeHTML(m.nom)}</strong>
        <span>${(m.heures || []).join(", ") || "Sem horário"}</span>
      </div>
      <button class="edit-link" data-edit-med="${m.id}">Editar</button>
    </div>
  `).join("");
  el.querySelectorAll("[data-edit-med]").forEach((btn) => {
    btn.addEventListener("click", () => openMedModal(btn.dataset.editMed));
  });
}

/* ---------- Modal Consulta ---------- */
let editingRdvId = null;

$("#btn-add-rdv").addEventListener("click", () => openRdvModal(null));
$("#f-rdv-cancel").addEventListener("click", closeRdvModal);

function openRdvModal(id) {
  editingRdvId = id;
  const r = id ? state.rdvs.find((x) => x.id === id) : null;
  $("#rdv-modal-title").textContent = id ? "Editar consulta" : "Nova consulta";
  $("#f-rdv-medecin").value = r ? r.medecin : "";
  $("#f-rdv-motif").value = r ? r.motif : "";
  $("#f-rdv-date").value = r ? r.date : todayStr();
  $("#f-rdv-heure").value = r ? r.heure : "";
  $("#f-rdv-lieu").value = r ? r.lieu : "";
  $("#f-rdv-photo").value = "";
  const preview = $("#f-rdv-photo-preview");
  if (r && r.photo) {
    preview.innerHTML = `<img src="${r.photo}" alt="Documento" />`;
    preview.classList.remove("hidden");
  } else {
    preview.innerHTML = "";
    preview.classList.add("hidden");
  }
  $("#f-rdv-delete").classList.toggle("hidden", !id);
  $("#modal-rdv").classList.remove("hidden");
}

function closeRdvModal() {
  $("#modal-rdv").classList.add("hidden");
  editingRdvId = null;
}

$("#f-rdv-photo").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const preview = $("#f-rdv-photo-preview");
    preview.innerHTML = `<img src="${reader.result}" alt="Documento" />`;
    preview.classList.remove("hidden");
    preview.dataset.value = reader.result;
  };
  reader.readAsDataURL(file);
});

$("#f-rdv-save").addEventListener("click", () => {
  const medecin = $("#f-rdv-medecin").value.trim();
  const date = $("#f-rdv-date").value;
  if (!medecin || !date) {
    showToast("Indica pelo menos o médico e a data.");
    return;
  }
  const photoPreview = $("#f-rdv-photo-preview");
  const existing = editingRdvId ? state.rdvs.find((x) => x.id === editingRdvId) : null;
  const photoValue = photoPreview.dataset.value || (existing ? existing.photo : null);

  const record = {
    id: editingRdvId || uid(),
    medecin,
    motif: $("#f-rdv-motif").value.trim(),
    date,
    heure: $("#f-rdv-heure").value,
    lieu: $("#f-rdv-lieu").value.trim(),
    photo: photoValue || null
  };

  if (editingRdvId) {
    const idx = state.rdvs.findIndex((x) => x.id === editingRdvId);
    state.rdvs[idx] = record;
  } else {
    state.rdvs.push(record);
  }
  saveData();
  delete photoPreview.dataset.value;
  closeRdvModal();
  renderAidantRdvs();
  showToast("Consulta guardada.");
});

$("#f-rdv-delete").addEventListener("click", () => {
  if (!editingRdvId) return;
  state.rdvs = state.rdvs.filter((x) => x.id !== editingRdvId);
  saveData();
  closeRdvModal();
  renderAidantRdvs();
  showToast("Consulta eliminada.");
});

/* ---------- Modal Medicamento ---------- */
let editingMedId = null;

$("#btn-add-med").addEventListener("click", () => openMedModal(null));
$("#f-med-cancel").addEventListener("click", closeMedModal);
$("#f-med-add-heure").addEventListener("click", () => addHeureRow(""));

function openMedModal(id) {
  editingMedId = id;
  const m = id ? state.meds.find((x) => x.id === id) : null;
  $("#med-modal-title").textContent = id ? "Editar medicamento" : "Novo medicamento";
  $("#f-med-nom").value = m ? m.nom : "";
  $("#f-med-consigne").value = m ? m.consigne : "";
  $("#f-med-heures-list").innerHTML = "";
  const heures = m && m.heures && m.heures.length ? m.heures : [""];
  heures.forEach(addHeureRow);
  $("#f-med-delete").classList.toggle("hidden", !id);
  $("#modal-med").classList.remove("hidden");
}

function closeMedModal() {
  $("#modal-med").classList.add("hidden");
  editingMedId = null;
}

function addHeureRow(value) {
  const wrap = document.createElement("div");
  wrap.className = "heure-chip";
  wrap.innerHTML = `<input type="time" value="${value || ""}" /><button type="button" aria-label="Remover">✕</button>`;
  wrap.querySelector("button").addEventListener("click", () => wrap.remove());
  $("#f-med-heures-list").appendChild(wrap);
}

$("#f-med-save").addEventListener("click", () => {
  const nom = $("#f-med-nom").value.trim();
  if (!nom) {
    showToast("Indica o nome do medicamento.");
    return;
  }
  const heures = [...$$("#f-med-heures-list input")]
    .map((i) => i.value)
    .filter(Boolean)
    .sort();

  const record = {
    id: editingMedId || uid(),
    nom,
    consigne: $("#f-med-consigne").value.trim(),
    heures
  };

  if (editingMedId) {
    const idx = state.meds.findIndex((x) => x.id === editingMedId);
    state.meds[idx] = record;
  } else {
    state.meds.push(record);
  }
  saveData();
  closeMedModal();
  renderAidantMeds();
  showToast("Medicamento guardado.");
});

$("#f-med-delete").addEventListener("click", () => {
  if (!editingMedId) return;
  state.meds = state.meds.filter((x) => x.id !== editingMedId);
  saveData();
  closeMedModal();
  renderAidantMeds();
  showToast("Medicamento eliminado.");
});

/* ===================== DEFINIÇÕES ===================== */
$("#save-pin").addEventListener("click", () => {
  const val = $("#new-pin").value.trim();
  if (!/^\d{4}$/.test(val)) {
    showToast("O código deve ter 4 dígitos.");
    return;
  }
  state.pin = val;
  saveData();
  $("#new-pin").value = "";
  showToast("Código atualizado.");
});

$("#btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bussola-saude-exportacao.json";
  a.click();
  URL.revokeObjectURL(url);
});

/* ===================== NOTIFICAÇÕES ===================== */
function notifStatusLabel() {
  if (!("Notification" in window)) return "Notificações não suportadas neste dispositivo.";
  if (Notification.permission === "granted") return "Notificações ativadas ✓";
  if (Notification.permission === "denied") return "Notificações bloqueadas — reative nas definições do telemóvel.";
  return "Notificações não ativadas.";
}

$("#btn-enable-notif").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showToast("Não suportado neste dispositivo.");
    return;
  }
  const perm = await Notification.requestPermission();
  $("#notif-status").textContent = notifStatusLabel();
  if (perm === "granted") showToast("Notificações ativadas.");
});

function fireNotification(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "SHOW_NOTIFICATION",
      payload: { title, body, tag }
    });
  } else {
    new Notification(title, { body });
  }
}

// Verificação local periódica (funciona enquanto a app foi aberta recentemente).
// Notificações garantidas com a app fechada há muito tempo exigem um servidor push — ver README, próxima etapa.
const firedTags = new Set();

function checkReminders() {
  const now = new Date();
  const today = todayStr();
  const hhmm = now.toTimeString().slice(0, 5);

  // Lembretes de medicamentos
  state.meds.forEach((m) => {
    (m.heures || []).forEach((h) => {
      const tag = `med_${m.id}_${today}_${h}`;
      const logKey = `${today}_${m.id}_${h}`;
      if (h === hhmm && !firedTags.has(tag) && !state.takenLog[logKey]) {
        firedTags.add(tag);
        fireNotification("💊 Medicamento", `${m.nom}${m.consigne ? " — " + m.consigne : ""}`, tag);
      }
    });
  });

  // Lembretes de consultas: véspera às 18h e 1h antes
  state.rdvs.forEach((r) => {
    if (!r.date || !r.heure) return;
    const rdvDateTime = new Date(r.date + "T" + r.heure);
    const diffMin = (rdvDateTime - now) / 60000;

    // 1h antes
    const tag1h = `rdv1h_${r.id}`;
    if (diffMin > 0 && diffMin <= 60 && !firedTags.has(tag1h)) {
      firedTags.add(tag1h);
      fireNotification("📅 Consulta daqui a 1 hora", `${r.medecin} — ${r.motif || ""}`, tag1h);
    }

    // véspera às 18h
    const vespera = new Date(rdvDateTime);
    vespera.setDate(vespera.getDate() - 1);
    vespera.setHours(18, 0, 0, 0);
    const tagVespera = `rdvvespera_${r.id}`;
    const diffVespera = Math.abs(now - vespera);
    if (diffVespera < 60000 && !firedTags.has(tagVespera)) {
      firedTags.add(tagVespera);
      fireNotification("📅 Consulta amanhã", `${r.medecin} — ${r.motif || ""} às ${r.heure}`, tagVespera);
    }
  });
}

setInterval(checkReminders, 30000);

/* ===================== INICIALIZAÇÃO ===================== */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

renderHome();
checkReminders();
