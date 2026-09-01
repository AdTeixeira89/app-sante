/* ===================== FIREBASE ===================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, collection, setDoc, updateDoc, deleteDoc, getDoc,
  onSnapshot, enableIndexedDbPersistence, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCaHVpz3SOjLRwYxp8r-ov6EwLGxEV1dw4",
  authDomain: "app-sante-be356.firebaseapp.com",
  projectId: "app-sante-be356",
  storageBucket: "app-sante-be356.firebasestorage.app",
  messagingSenderId: "88324740983",
  appId: "1:88324740983:web:5f4c13387ac8702af5f372"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

try { enableIndexedDbPersistence(db); } catch (e) { /* multi-separador ou não suportado: seguro ignorar */ }

/* ===================== IDENTIDADE DO APARELHO E DA FAMÍLIA =====================
   A segurança real vem agora da conta (UID autenticado) que pertence à lista
   "members" do documento da família — já não basta conhecer um código.
   O código de convite serve apenas para pedir para entrar; um cuidador já
   ligado tem de aprovar. */
const DEVICE_ID_KEY = "bussola-device-id";
const DEVICE_LABEL_KEY = "bussola-device-label";
const CAREGIVER_FLAG_KEY = "bussola-is-caregiver";
const LOCAL_FAMILY_ID_KEY = "bussola-family-id";

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
const deviceId = getOrCreateDeviceId();

let familyId = localStorage.getItem(LOCAL_FAMILY_ID_KEY) || null;
let currentUser = null;
let pendingJoinRequests = [];

function familyRef(...segments) {
  return doc(db, "families", familyId, ...segments);
}
function familyCollection(name) {
  return collection(db, "families", familyId, name);
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem carateres ambíguos (sem 0/O, 1/I)
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/* ---------- Criar/entrar/juntar ---------- */
async function signUpCaregiver(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const newFamilyRef = doc(collection(db, "families"));
  const code = generateInviteCode();
  await setDoc(newFamilyRef, {
    members: [cred.user.uid],
    ownerUid: cred.user.uid,
    pin: "1234",
    inviteCode: code,
    createdAt: Date.now()
  });
  await setDoc(doc(db, "inviteCodes", code), { familyId: newFamilyRef.id, createdAt: Date.now() });
  await setDoc(doc(db, "userFamilies", cred.user.uid), { familyId: newFamilyRef.id });
  return newFamilyRef.id;
}

async function loginCaregiver(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

async function resolveInviteCode(code) {
  const snap = await getDoc(doc(db, "inviteCodes", code.trim().toUpperCase()));
  return snap.exists() ? snap.data().familyId : null;
}

async function requestJoinFamily(targetFamilyId, uid) {
  await setDoc(doc(db, "families", targetFamilyId, "joinRequests", uid), {
    requestedAt: Date.now(),
    label: localStorage.getItem(DEVICE_LABEL_KEY) || "Novo aparelho"
  });
}

async function approveJoinRequest(uid) {
  await updateDoc(familyRef(), { members: arrayUnion(uid) });
  await setDoc(doc(db, "userFamilies", uid), { familyId });
  await deleteDoc(familyRef("joinRequests", uid));
}

async function rejectJoinRequest(uid) {
  await deleteDoc(familyRef("joinRequests", uid));
}

function listenForOwnApproval(uid) {
  return onSnapshot(doc(db, "userFamilies", uid), (snap) => {
    if (snap.exists() && !familyId) {
      familyId = snap.data().familyId;
      localStorage.setItem(LOCAL_FAMILY_ID_KEY, familyId);
      onFamilyResolved();
    }
  });
}

/* ===================== ESTADO EM MEMÓRIA ===================== */
let state = { rdvs: [], meds: [], docs: [], medLog: {}, pin: "1234", perfil: {}, contatos: {} };
let familyPresence = [];
let unsubscribers = [];

function stopListening() {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
}

function handleFirestoreError(err) {
  console.error(err);
  showToast("Sem ligação — a app continua a funcionar, mas pode não estar atualizada.");
}

function onDataChanged() {
  state.rdvs.forEach((r) => { if (!r.exames) r.exames = []; if (r.perguntas === undefined) r.perguntas = ""; });
  renderHome();
  renderTodayMeds();
  renderRdvList();
  renderDocsList();
  renderAidantRdvs();
  renderAidantMeds();
  renderHistorico();
}

function startListening() {
  stopListening();

  unsubscribers.push(onSnapshot(familyCollection("rdvs"), (snap) => {
    state.rdvs = snap.docs.map((d) => d.data());
    onDataChanged();
  }, handleFirestoreError));

  unsubscribers.push(onSnapshot(familyCollection("meds"), (snap) => {
    state.meds = snap.docs.map((d) => d.data());
    onDataChanged();
  }, handleFirestoreError));

  unsubscribers.push(onSnapshot(familyCollection("docs"), (snap) => {
    state.docs = snap.docs.map((d) => d.data());
    onDataChanged();
  }, handleFirestoreError));

  unsubscribers.push(onSnapshot(familyCollection("medLog"), (snap) => {
    const log = {};
    snap.docs.forEach((d) => { log[d.id] = d.data(); });
    state.medLog = log;
    onDataChanged();
  }, handleFirestoreError));

  unsubscribers.push(onSnapshot(familyRef("meta", "settings"), (snap) => {
    if (snap.exists()) state.pin = snap.data().pin || "1234";
    onDataChanged();
  }, handleFirestoreError));

  unsubscribers.push(onSnapshot(familyRef("meta", "profile"), (snap) => {
    state.perfil = snap.exists() ? snap.data() : {};
    onDataChanged();
  }, handleFirestoreError));

  unsubscribers.push(onSnapshot(familyRef("meta", "contacts"), (snap) => {
    state.contatos = snap.exists() ? snap.data() : {};
  }, handleFirestoreError));

  unsubscribers.push(onSnapshot(familyCollection("presence"), (snap) => {
    familyPresence = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderFamilyPresence();
  }, handleFirestoreError));

  unsubscribers.push(onSnapshot(familyCollection("joinRequests"), (snap) => {
    pendingJoinRequests = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    renderJoinRequests();
  }, handleFirestoreError));

  unsubscribers.push(onSnapshot(familyRef(), (snap) => {
    if (snap.exists()) $("#family-code-value").textContent = snap.data().inviteCode || "------";
  }, handleFirestoreError));
}

function onFamilyResolved() {
  showView("view-pere");
  startListening();
  sendPresence();
}

/* ---------- Escrita no Firestore (com atualização local otimista já feita pelo chamador) ---------- */
async function fsSetItem(colName, id, data, merge = false) {
  try {
    await setDoc(familyRef(colName, id), data, { merge });
  } catch (e) {
    console.error(e);
    showToast("Guardado neste aparelho — falha a sincronizar (verifica a ligação).");
  }
}

async function fsDeleteItem(colName, id) {
  try {
    await deleteDoc(familyRef(colName, id));
  } catch (e) {
    console.error(e);
    showToast("Eliminado neste aparelho — falha a sincronizar (verifica a ligação).");
  }
}

/* ---------- Presença (última atividade de cada aparelho) ---------- */
async function sendPresence() {
  const label = localStorage.getItem(DEVICE_LABEL_KEY) || "Aparelho sem nome";
  try {
    await setDoc(familyRef("presence", deviceId), { label, lastSeen: Date.now() });
  } catch (e) { /* offline: sem problema, tenta na próxima */ }
}

function renderFamilyPresence() {
  const el = $("#family-presence-list");
  if (!el) return;
  if (familyPresence.length === 0) {
    el.innerHTML = `<div class="empty-state">Ainda sem outros aparelhos ligados a este código.</div>`;
    return;
  }
  const now = Date.now();
  el.innerHTML = familyPresence
    .slice()
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
    .map((p) => {
      const diffMin = Math.max(0, Math.round((now - (p.lastSeen || 0)) / 60000));
      let when;
      if (diffMin < 2) when = "agora mesmo";
      else if (diffMin < 60) when = `há ${diffMin} min`;
      else if (diffMin < 24 * 60) when = `há ${Math.round(diffMin / 60)} h`;
      else when = `há ${Math.round(diffMin / 1440)} dias`;
      const online = diffMin < 3;
      return `<div class="presence-item"><span class="presence-dot ${online ? "online" : ""}"></span>${escapeHTML(p.label || "Aparelho")} — ${when}</div>`;
    }).join("");
}

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
    if (target === "medshoje") { renderTodayMeds(); showView("view-meds-hoje"); }
    if (target === "rdv") {
      $$("[data-rdvtab]").forEach((b) => b.classList.remove("active"));
      $$('[data-rdvtab="proximas"]').forEach((b) => b.classList.add("active"));
      renderRdvList("proximas");
      showView("view-rdv-list");
    }
    if (target === "docs") { renderDocsList(); showView("view-docs"); }
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
    localStorage.setItem(CAREGIVER_FLAG_KEY, "1"); // este aparelho passa a receber os alertas de família
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
  renderGreeting();
  renderNextTicket();
  renderHomeMissedMeds();
}

function renderGreeting() {
  const el = $("#home-greeting");
  const nome = state.perfil && state.perfil.nome;
  const dateLabel = capitalize(new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" }));
  el.innerHTML = nome
    ? `Olá, ${escapeHTML(nome)} 👋<span class="greeting-date">${dateLabel}</span>`
    : `<span class="greeting-date">${dateLabel}</span>`;
}

function showNavChoice(address) {
  const enc = encodeURIComponent(address);
  const el = $("#nav-links");
  el.innerHTML = `
    <a class="emergencia-contact-btn" href="https://www.google.com/maps/search/?api=1&query=${enc}" target="_blank" rel="noopener">🗺️ Google Maps</a>
    <a class="emergencia-contact-btn" href="https://maps.apple.com/?q=${enc}" target="_blank" rel="noopener">📍 Plans (Apple Maps)</a>
    <a class="emergencia-contact-btn" href="https://waze.com/ul?q=${enc}&navigate=yes" target="_blank" rel="noopener">🚗 Waze</a>
  `;
  $("#modal-nav").classList.remove("hidden");
}

// Delegação de eventos: qualquer botão com data-nav abre a escolha de mapa
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-nav]");
  if (btn) showNavChoice(btn.dataset.nav);
});

function getUpcomingRdvs() {
  const now = new Date();
  return state.rdvs
    .filter((r) => new Date(r.date + "T" + (r.heure || "00:00")) >= now.setHours(0, 0, 0, 0) || r.date >= todayStr())
    .sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
}

function getPastRdvs() {
  const today = todayStr();
  return state.rdvs
    .filter((r) => r.date < today)
    .sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));
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
    ${r.lieu ? `<button class="rdv-card-address" style="color:var(--amber);margin-top:14px;background:none;border:none;padding:0;font-family:inherit;cursor:pointer;" data-nav="${escapeHTML(r.lieu)}">🗺️ Ver itinerário — ${escapeHTML(r.lieu)}</button>` : ""}
    ${r.precisaLevarExames && r.levarExamesTexto ? `<div class="rdv-card-levar" style="margin-top:10px;">📎 <strong>Levar:</strong> ${escapeHTML(r.levarExamesTexto)}</div>` : ""}
  `;
}

function renderHomeMissedMeds() {
  const el = $("#home-missed-meds");
  const today = todayStr();
  const now = new Date();
  const missed = [];
  state.meds.forEach((m) => {
    (m.heures || []).forEach((h) => {
      const key = `${today}_${m.id}_${h}`;
      if (state.medLog[key]) return;
      if (isSlotLate(h, now)) missed.push({ nome: m.nom, heure: h });
    });
  });
  if (missed.length === 0) { el.innerHTML = ""; return; }
  el.innerHTML = missed.map((m) =>
    `<div class="missed-chip">🔴 ${escapeHTML(m.nome)} das ${m.heure} — ainda não confirmado</div>`
  ).join("");
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* ---------- Ficheiros (fotos e PDFs) ---------- */
function isPdfData(dataUrl) {
  return !!dataUrl && dataUrl.startsWith("data:application/pdf");
}

// Fotos são comprimidas antes de guardar (mais rápido a sincronizar, cabe nos limites gratuitos do Firestore)
function compressImage(file, maxDim = 1200, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToDataURL(file) {
  if (file.type && file.type.startsWith("image/")) return compressImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Pré-visualização grande (dentro dos formulários)
function filePreviewHTML(dataUrl) {
  if (!dataUrl) return "";
  if (isPdfData(dataUrl)) return `<div class="doc-file-icon">📄 Ficheiro PDF anexado</div>`;
  return `<img src="${dataUrl}" alt="Pré-visualização" />`;
}

// Miniatura em cartão (listas)
function fileThumbHTML(dataUrl, alt) {
  if (!dataUrl) return "";
  if (isPdfData(dataUrl)) {
    return `<div class="doc-file-icon">📄</div><a class="doc-file-link" href="${dataUrl}" target="_blank" rel="noopener">Abrir ficheiro PDF</a>`;
  }
  return `<img class="doc-thumb" src="${dataUrl}" alt="${alt || "Documento"}" />`;
}

function medStatusLabel(entry, heureSched) {
  if (!entry) return null;
  if (entry.status === "sauteado") return { text: "Saltado", cls: "status-skip" };
  if (entry.status === "a_horario") return { text: `Tomado às ${heureSched}`, cls: "status-ok" };
  if (entry.status === "agora") return { text: `Tomado às ${entry.horaReal}`, cls: "status-ok" };
  return null;
}

function isSlotLate(heureSched, now) {
  const [h, m] = heureSched.split(":").map(Number);
  const sched = new Date(now);
  sched.setHours(h, m, 0, 0);
  return now - sched > 30 * 60000; // 30 minutos de tolerância
}

function renderTodayMeds() {
  const el = $("#meds-hoje-content");
  const today = todayStr();
  const now = new Date();
  const slots = [];
  state.meds.forEach((m) => {
    (m.heures || []).forEach((h) => {
      slots.push({ medId: m.id, nom: m.nom, heure: h, foto: m.foto });
    });
  });
  slots.sort((a, b) => a.heure.localeCompare(b.heure));

  if (slots.length === 0) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = slots.map((s) => {
    const logKey = `${today}_${s.medId}_${s.heure}`;
    const entry = state.medLog[logKey];
    const label = medStatusLabel(entry, s.heure);
    const late = !entry && isSlotLate(s.heure, now);
    const cardClass = entry ? "status-done" : late ? "status-late" : "status-pending";

    const actionsHTML = entry
      ? `<div class="med-card-status ${label.cls}">
           <span>${label.text}</span>
           <button class="med-card-edit" data-editlog="${logKey}">Alterar</button>
         </div>`
      : `<div class="med-card-buttons">
           <button class="med-btn med-btn-skip" data-med-action="sauteado" data-key="${logKey}" data-heure="${s.heure}">Saltar</button>
           <button class="med-btn med-btn-ontime" data-med-action="a_horario" data-key="${logKey}" data-heure="${s.heure}">Às ${s.heure}</button>
           <button class="med-btn med-btn-now" data-med-action="agora" data-key="${logKey}" data-heure="${s.heure}">Agora</button>
         </div>`;

    return `
      <div class="med-card ${cardClass}">
        <div class="med-card-info">
          ${s.foto ? `<img class="med-thumb" src="${s.foto}" alt="Caixa de ${escapeHTML(s.nom)}" />` : ""}
          <div class="med-card-text">
            <div class="med-card-time">${s.heure}</div>
            <div class="med-card-name">${escapeHTML(s.nom)}</div>
          </div>
          <button class="med-info-btn" data-info-med="${s.medId}" aria-label="Mais informação">ℹ️</button>
        </div>
        ${actionsHTML}
      </div>
    `;
  }).join("");

  el.querySelectorAll("[data-info-med]").forEach((btn) => {
    btn.addEventListener("click", () => showMedInfo(btn.dataset.infoMed));
  });

  el.querySelectorAll("[data-med-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const action = btn.dataset.medAction;
      const heureSched = btn.dataset.heure;
      const nowTs = new Date();
      let entry;
      if (action === "sauteado") entry = { status: "sauteado", horaReal: null, timestamp: nowTs.toISOString() };
      else if (action === "a_horario") entry = { status: "a_horario", horaReal: heureSched, timestamp: nowTs.toISOString() };
      else entry = { status: "agora", horaReal: nowTs.toTimeString().slice(0, 5), timestamp: nowTs.toISOString() };
      state.medLog[key] = entry;
      renderTodayMeds();
      renderHomeMissedMeds();
      fsSetItem("medLog", key, entry);
    });
  });

  el.querySelectorAll("[data-editlog]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.editlog;
      delete state.medLog[key];
      renderTodayMeds();
      renderHomeMissedMeds();
      fsDeleteItem("medLog", key);
    });
  });
}

/* ===================== LISTA DE CONSULTAS (leitura) ===================== */
function renderRdvList(mode) {
  const el = $("#rdv-list-content");
  const activeTab = $('[data-rdvtab].active');
  const effectiveMode = mode || (activeTab ? activeTab.dataset.rdvtab : "proximas");
  const list = effectiveMode === "passadas" ? getPastRdvs() : getUpcomingRdvs();
  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state">${effectiveMode === "passadas" ? "Sem consultas passadas." : "Ainda não há consultas registadas."}</div>`;
    return;
  }
  el.innerHTML = list.map(rdvCardHTML).join("");
}

$$("[data-rdvtab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$("[data-rdvtab]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderRdvList(btn.dataset.rdvtab);
  });
});

function rdvCardHTML(r) {
  const exames = r.exames || [];
  return `
    <div class="rdv-card">
      <div class="rdv-card-date">${capitalize(formatDatePT(r.date))}${r.heure ? " · " + r.heure : ""}</div>
      <div class="rdv-card-medecin">${escapeHTML(r.medecin || "Consulta")}</div>
      ${r.motif ? `<div class="rdv-card-motif">${escapeHTML(r.motif)}</div>` : ""}
      ${r.lieu ? `<button class="rdv-card-address" style="background:none;border:none;padding:0;font-family:inherit;cursor:pointer;" data-nav="${escapeHTML(r.lieu)}">🗺️ ${escapeHTML(r.lieu)}</button>` : ""}
      ${r.perguntas ? `<div class="rdv-card-perguntas">📝 <strong>Perguntas ao médico:</strong> ${escapeHTML(r.perguntas)}</div>` : ""}
      ${r.precisaLevarExames && r.levarExamesTexto ? `<div class="rdv-card-levar">📎 <strong>Levar:</strong> ${escapeHTML(r.levarExamesTexto)}</div>` : ""}
      ${r.photo ? fileThumbHTML(r.photo, "Documento da consulta") : ""}
      ${exames.length ? `<div class="rdv-card-lieu">${exames.length} exame(s) anexado(s)</div>
        <div class="anexos-list">${exames.map((ex) => `<div class="anexo-chip">${isPdfData(ex.data) ? "📄" : `<img src="${ex.data}" alt="${escapeHTML(ex.nome || "Exame")}" />`}</div>`).join("")}</div>` : ""}
    </div>
  `;
}

/* ===================== DOCUMENTOS (leitura + adicionar) ===================== */
function getAllDocEntries() {
  const avulsos = state.docs.map((d) => ({
    kind: "doc", id: d.id, data: d.data, titulo: d.titulo, subtitulo: d.tipo, categoria: d.tipo || "Outro", file: d.file
  }));

  const rdvPrincipais = state.rdvs
    .filter((r) => r.photo)
    .map((r) => ({
      kind: "rdv", id: r.id, data: r.date, titulo: r.medecin || "Documento da consulta",
      subtitulo: r.motif || "", categoria: "Convocatória", file: r.photo
    }));

  const rdvExames = [];
  state.rdvs.forEach((r) => {
    (r.exames || []).forEach((ex) => {
      rdvExames.push({
        kind: "rdv", id: r.id, data: r.date, titulo: ex.nome || "Exame anexado",
        subtitulo: r.medecin ? `Consulta: ${r.medecin}` : "", categoria: "Resultado", file: ex.data
      });
    });
  });

  return [...avulsos, ...rdvPrincipais, ...rdvExames].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
}

let lastDocEntries = [];
let currentDocTab = "todos";

$$("[data-doctab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$("[data-doctab]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentDocTab = btn.dataset.doctab;
    renderDocsList();
  });
});

function renderDocsList() {
  const el = $("#docs-list-content");
  const all = getAllDocEntries();
  const filtered = currentDocTab === "todos" ? all : all.filter((d) => d.categoria === currentDocTab);
  lastDocEntries = filtered;
  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state">${currentDocTab === "todos" ? 'Ainda não há documentos. Toca em "Adicionar documento" ou junta uma foto a uma consulta.' : "Nenhum documento nesta categoria."}</div>`;
    return;
  }
  el.innerHTML = filtered.map((d, i) => `
    <div class="doc-card">
      ${d.data ? `<div class="rdv-card-date">${capitalize(formatDatePT(d.data))}</div>` : ""}
      <div class="rdv-card-medecin">${escapeHTML(d.titulo)}</div>
      ${d.subtitulo ? `<div class="rdv-card-motif">${escapeHTML(d.subtitulo)}</div>` : ""}
      ${fileThumbHTML(d.file, d.titulo)}
      <div class="doc-actions">
        <button class="doc-action-btn" data-doc-share="${i}">📤 Partilhar</button>
        <button class="doc-action-btn" data-doc-print="${i}">🖨️ Imprimir</button>
      </div>
    </div>
  `).join("");

  el.querySelectorAll("[data-doc-share]").forEach((btn) => {
    btn.addEventListener("click", () => shareFile(lastDocEntries[Number(btn.dataset.docShare)]));
  });
  el.querySelectorAll("[data-doc-print]").forEach((btn) => {
    btn.addEventListener("click", () => printFile(lastDocEntries[Number(btn.dataset.docPrint)]));
  });
}

async function shareFile(entry) {
  if (!entry || !entry.file) { showToast("Sem ficheiro para partilhar."); return; }
  try {
    const blob = await (await fetch(entry.file)).blob();
    const ext = isPdfData(entry.file) ? "pdf" : "jpg";
    const file = new File([blob], `${(entry.titulo || "documento").replace(/[^\w\-]/g, "_")}.${ext}`, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: entry.titulo || "Documento" });
    } else if (navigator.share) {
      await navigator.share({ title: entry.titulo || "Documento" });
    } else {
      showToast("Partilha não disponível neste aparelho. Usa Imprimir.");
    }
  } catch (err) {
    if (err.name !== "AbortError") showToast("Não foi possível partilhar o documento.");
  }
}

function printFile(entry) {
  if (!entry || !entry.file) { showToast("Sem ficheiro para imprimir."); return; }
  const w = window.open("", "_blank");
  if (!w) { showToast("Autoriza janelas pop-up para poder imprimir."); return; }
  if (isPdfData(entry.file)) {
    w.location.href = entry.file;
  } else {
    w.document.write(`
      <html><head><title>${escapeHTML(entry.titulo || "Documento")}</title>
      <style>body{margin:0;display:flex;justify-content:center;align-items:flex-start;background:#fff;}
      img{max-width:100%;}</style>
      </head><body><img src="${entry.file}" onload="window.print()" /></body></html>
    `);
    w.document.close();
  }
}

/* ---------- Modal Documento avulso ---------- */
let editingDocId = null;

$("#btn-add-doc").addEventListener("click", () => openDocModal(null));
$("#f-doc-cancel").addEventListener("click", closeDocModal);

function openDocModal(id) {
  editingDocId = id;
  const d = id ? state.docs.find((x) => x.id === id) : null;
  $("#doc-modal-title").textContent = id ? "Editar documento" : "Novo documento";
  $("#f-doc-titulo").value = d ? d.titulo : "";
  $("#f-doc-tipo").value = d ? d.tipo : "Receita";
  $("#f-doc-file").value = "";
  const preview = $("#f-doc-file-preview");
  if (d && d.file) {
    preview.innerHTML = filePreviewHTML(d.file);
    preview.classList.remove("hidden");
    preview.dataset.value = d.file;
  } else {
    preview.innerHTML = "";
    preview.classList.add("hidden");
    delete preview.dataset.value;
  }
  $("#f-doc-delete").classList.toggle("hidden", !id);
  $("#modal-doc").classList.remove("hidden");
}

function closeDocModal() {
  $("#modal-doc").classList.add("hidden");
  editingDocId = null;
}

$("#f-doc-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const dataUrl = await fileToDataURL(file);
  const preview = $("#f-doc-file-preview");
  preview.innerHTML = filePreviewHTML(dataUrl);
  preview.classList.remove("hidden");
  preview.dataset.value = dataUrl;
});

$("#f-doc-save").addEventListener("click", () => {
  const titulo = $("#f-doc-titulo").value.trim();
  if (!titulo) { showToast("Indica um título para o documento."); return; }
  const preview = $("#f-doc-file-preview");
  const existing = editingDocId ? state.docs.find((x) => x.id === editingDocId) : null;
  const fileValue = preview.dataset.value || (existing ? existing.file : null);

  const record = {
    id: editingDocId || uid(),
    titulo,
    tipo: $("#f-doc-tipo").value,
    data: existing ? existing.data : todayStr(),
    file: fileValue || null
  };

  if (editingDocId) {
    const idx = state.docs.findIndex((x) => x.id === editingDocId);
    state.docs[idx] = record;
  } else {
    state.docs.push(record);
  }
  renderDocsList();
  fsSetItem("docs", record.id, record);
  delete preview.dataset.value;
  closeDocModal();
  showToast("Documento guardado.");
});

$("#f-doc-delete").addEventListener("click", () => {
  if (!editingDocId) return;
  const id = editingDocId;
  state.docs = state.docs.filter((x) => x.id !== id);
  renderDocsList();
  fsDeleteItem("docs", id);
  closeDocModal();
  showToast("Documento eliminado.");
});

/* ===================== MEDICAMENTOS (leitura) ===================== */
function showMedInfo(medId) {
  const m = state.meds.find((x) => x.id === medId);
  if (!m) return;
  $("#info-modal-title").textContent = m.nom;
  let html = "";
  html += `<div class="info-block"><strong>Para que serve</strong>${m.trata ? escapeHTML(m.trata) : "Não indicado — pergunta ao médico ou farmacêutico."}</div>`;
  if (m.consigne) html += `<div class="info-block"><strong>Como tomar</strong>${escapeHTML(m.consigne)}</div>`;
  $("#info-modal-body").innerHTML = html;
  $("#modal-info").classList.remove("hidden");
}

$("#info-modal-close").addEventListener("click", () => $("#modal-info").classList.add("hidden"));

/* ===================== ÁREA DO CUIDADOR ===================== */
function computeMissedEntries(daysBack) {
  const missed = [];
  const now = new Date();
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    state.meds.forEach((m) => {
      (m.heures || []).forEach((h) => {
        const key = `${dateStr}_${m.id}_${h}`;
        if (state.medLog[key]) return;
        const schedDateTime = new Date(dateStr + "T" + h);
        const graceEnd = new Date(schedDateTime.getTime() + 30 * 60000);
        if (now > graceEnd) missed.push({ date: dateStr, heure: h, nome: m.nom, status: "esquecido" });
      });
    });
  }
  return missed;
}

function renderHistorico() {
  const el = $("#historico-list");
  if (!el) return;
  const recorded = Object.entries(state.medLog).map(([key, val]) => {
    const parts = key.split("_");
    const date = parts[0];
    const medId = parts[1];
    const heure = parts[2];
    const med = state.meds.find((m) => m.id === medId);
    return { date, heure, nome: med ? med.nom : "Medicamento removido", ...val };
  });
  const missed = computeMissedEntries(7);
  const all = [...recorded, ...missed].sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));

  if (all.length === 0) {
    el.innerHTML = `<div class="empty-state">Ainda sem registos de tomas.</div>`;
    return;
  }

  el.innerHTML = all.map((e) => {
    let label, cls;
    if (e.status === "sauteado") { label = "Saltado"; cls = "hist-skip"; }
    else if (e.status === "a_horario") { label = `Tomado às ${e.heure}`; cls = "hist-ok"; }
    else if (e.status === "agora") { label = `Tomado às ${e.horaReal} (previsto ${e.heure})`; cls = "hist-ok"; }
    else { label = "Esquecido"; cls = "hist-missed"; }
    return `
      <div class="hist-item ${cls}">
        <div class="hist-item-date">${capitalize(formatDatePT(e.date))} · ${e.heure}</div>
        <div class="hist-item-main"><strong>${escapeHTML(e.nome)}</strong><span>${label}</span></div>
      </div>
    `;
  }).join("");
}

function renderAidant() {
  renderAidantRdvs();
  renderAidantMeds();
  renderHistorico();
  fillPerfilForm();
  fillContatosForm();
  renderJoinRequests();
  $("#notif-status").textContent = notifStatusLabel();
}

function renderAidantRdvs() {
  const el = $("#aidant-rdv-list");
  if (!el) return;
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
  if (!el) return;
  if (state.meds.length === 0) {
    el.innerHTML = `<div class="empty-state">Sem medicamentos. Adiciona um acima.</div>`;
    return;
  }
  el.innerHTML = state.meds.map((m) => `
    <div class="aidant-item">
      ${m.foto ? `<img class="med-thumb" src="${m.foto}" alt="Caixa de ${escapeHTML(m.nom)}" />` : ""}
      <div class="aidant-item-main">
        <strong>${escapeHTML(m.nom)}</strong>
        <span>${m.trata ? escapeHTML(m.trata) + " · " : ""}${(m.heures || []).join(", ") || "Sem horário"}</span>
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
let currentExames = [];

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
  $("#f-rdv-perguntas").value = r ? (r.perguntas || "") : "";
  $("#f-rdv-levar-exames").checked = r ? !!r.precisaLevarExames : false;
  $("#f-rdv-levar-exames-texto").value = r ? (r.levarExamesTexto || "") : "";
  $("#f-rdv-levar-exames-detail").classList.toggle("hidden", !($("#f-rdv-levar-exames").checked));
  $("#f-rdv-photo").value = "";
  const preview = $("#f-rdv-photo-preview");
  if (r && r.photo) {
    preview.innerHTML = filePreviewHTML(r.photo);
    preview.classList.remove("hidden");
    preview.dataset.value = r.photo;
  } else {
    preview.innerHTML = "";
    preview.classList.add("hidden");
    delete preview.dataset.value;
  }
  currentExames = r && r.exames ? JSON.parse(JSON.stringify(r.exames)) : [];
  renderExamesEditor();
  $("#f-rdv-delete").classList.toggle("hidden", !id);
  $("#modal-rdv").classList.remove("hidden");
}

function closeRdvModal() {
  $("#modal-rdv").classList.add("hidden");
  editingRdvId = null;
  currentExames = [];
}

$("#f-rdv-levar-exames").addEventListener("change", (e) => {
  $("#f-rdv-levar-exames-detail").classList.toggle("hidden", !e.target.checked);
});

$("#f-rdv-photo").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const dataUrl = await fileToDataURL(file);
  const preview = $("#f-rdv-photo-preview");
  preview.innerHTML = filePreviewHTML(dataUrl);
  preview.classList.remove("hidden");
  preview.dataset.value = dataUrl;
});

function renderExamesEditor() {
  const el = $("#f-rdv-exames-list");
  if (currentExames.length === 0) { el.innerHTML = ""; return; }
  el.innerHTML = currentExames.map((ex, i) => `
    <div class="anexo-chip" data-idx="${i}">
      ${isPdfData(ex.data) ? "📄" : `<img src="${ex.data}" alt="${escapeHTML(ex.nome || "Exame")}" />`}
      <button type="button" data-remove-exame="${i}" aria-label="Remover">✕</button>
    </div>
  `).join("");
  el.querySelectorAll("[data-remove-exame]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentExames.splice(Number(btn.dataset.removeExame), 1);
      renderExamesEditor();
    });
  });
}

$("#f-rdv-add-exame").addEventListener("click", () => $("#f-rdv-exame-input").click());

$("#f-rdv-exame-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const dataUrl = await fileToDataURL(file);
  currentExames.push({ nome: file.name, data: dataUrl });
  renderExamesEditor();
  e.target.value = "";
});

$("#f-rdv-save").addEventListener("click", () => {
  const medecin = $("#f-rdv-medecin").value.trim();
  const date = $("#f-rdv-date").value;
  if (!medecin || !date) { showToast("Indica pelo menos o médico e a data."); return; }
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
    perguntas: $("#f-rdv-perguntas").value.trim(),
    precisaLevarExames: $("#f-rdv-levar-exames").checked,
    levarExamesTexto: $("#f-rdv-levar-exames-texto").value.trim(),
    photo: photoValue || null,
    exames: currentExames
  };

  if (editingRdvId) {
    const idx = state.rdvs.findIndex((x) => x.id === editingRdvId);
    state.rdvs[idx] = record;
  } else {
    state.rdvs.push(record);
  }
  renderAidantRdvs();
  fsSetItem("rdvs", record.id, record);
  delete photoPreview.dataset.value;
  closeRdvModal();
  showToast("Consulta guardada.");
});

$("#f-rdv-delete").addEventListener("click", () => {
  if (!editingRdvId) return;
  const id = editingRdvId;
  state.rdvs = state.rdvs.filter((x) => x.id !== id);
  renderAidantRdvs();
  fsDeleteItem("rdvs", id);
  closeRdvModal();
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
  $("#f-med-trata").value = m ? (m.trata || "") : "";
  $("#f-med-consigne").value = m ? m.consigne : "";
  $("#f-med-photo").value = "";
  const medPreview = $("#f-med-photo-preview");
  if (m && m.foto) {
    medPreview.innerHTML = filePreviewHTML(m.foto);
    medPreview.classList.remove("hidden");
    medPreview.dataset.value = m.foto;
  } else {
    medPreview.innerHTML = "";
    medPreview.classList.add("hidden");
    delete medPreview.dataset.value;
  }
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

$("#f-med-photo").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const dataUrl = await fileToDataURL(file);
  const preview = $("#f-med-photo-preview");
  preview.innerHTML = filePreviewHTML(dataUrl);
  preview.classList.remove("hidden");
  preview.dataset.value = dataUrl;
});

function addHeureRow(value) {
  const wrap = document.createElement("div");
  wrap.className = "heure-chip";
  wrap.innerHTML = `<input type="time" value="${value || ""}" /><button type="button" aria-label="Remover">✕</button>`;
  wrap.querySelector("button").addEventListener("click", () => wrap.remove());
  $("#f-med-heures-list").appendChild(wrap);
}

$("#f-med-save").addEventListener("click", () => {
  const nom = $("#f-med-nom").value.trim();
  if (!nom) { showToast("Indica o nome do medicamento."); return; }
  const heures = [...$$("#f-med-heures-list input")].map((i) => i.value).filter(Boolean).sort();

  const medPhotoPreview = $("#f-med-photo-preview");
  const existingMed = editingMedId ? state.meds.find((x) => x.id === editingMedId) : null;
  const fotoValue = medPhotoPreview.dataset.value || (existingMed ? existingMed.foto : null);

  const record = {
    id: editingMedId || uid(),
    nom,
    trata: $("#f-med-trata").value.trim(),
    consigne: $("#f-med-consigne").value.trim(),
    foto: fotoValue || null,
    heures
  };

  if (editingMedId) {
    const idx = state.meds.findIndex((x) => x.id === editingMedId);
    state.meds[idx] = record;
  } else {
    state.meds.push(record);
  }
  renderAidantMeds();
  fsSetItem("meds", record.id, record);
  delete medPhotoPreview.dataset.value;
  closeMedModal();
  showToast("Medicamento guardado.");
});

$("#f-med-delete").addEventListener("click", () => {
  if (!editingMedId) return;
  const id = editingMedId;
  state.meds = state.meds.filter((x) => x.id !== id);
  renderAidantMeds();
  fsDeleteItem("meds", id);
  closeMedModal();
  showToast("Medicamento eliminado.");
});

/* ===================== DEFINIÇÕES ===================== */
$("#save-pin").addEventListener("click", () => {
  const val = $("#new-pin").value.trim();
  if (!/^\d{4}$/.test(val)) { showToast("O código deve ter 4 dígitos."); return; }
  state.pin = val;
  $("#new-pin").value = "";
  fsSetItem("meta", "settings", { pin: val }, true);
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

/* ---------- Perfil do paciente ---------- */
function fillPerfilForm() {
  const p = state.perfil || {};
  $("#f-perfil-nome").value = p.nome || "";
  $("#f-perfil-sexo").value = p.sexo || "";
  $("#f-perfil-idade").value = p.idade || "";
  $("#f-perfil-peso").value = p.peso || "";
}

$("#save-perfil").addEventListener("click", () => {
  const record = {
    nome: $("#f-perfil-nome").value.trim(),
    sexo: $("#f-perfil-sexo").value,
    idade: $("#f-perfil-idade").value ? Number($("#f-perfil-idade").value) : null,
    peso: $("#f-perfil-peso").value ? Number($("#f-perfil-peso").value) : null
  };
  state.perfil = record;
  renderGreeting();
  fsSetItem("meta", "profile", record, true);
  showToast("Perfil guardado.");
});

/* ---------- Contactos de emergência ---------- */
function fillContatosForm() {
  const c = state.contatos || {};
  $("#f-contato1-nome").value = (c.contato1 && c.contato1.nome) || "";
  $("#f-contato1-tel").value = (c.contato1 && c.contato1.tel) || "";
  $("#f-contato2-nome").value = (c.contato2 && c.contato2.nome) || "";
  $("#f-contato2-tel").value = (c.contato2 && c.contato2.tel) || "";
}

$("#save-contatos").addEventListener("click", () => {
  const record = {
    contato1: { nome: $("#f-contato1-nome").value.trim(), tel: $("#f-contato1-tel").value.trim() },
    contato2: { nome: $("#f-contato2-nome").value.trim(), tel: $("#f-contato2-tel").value.trim() }
  };
  state.contatos = record;
  fsSetItem("meta", "contacts", record, true);
  showToast("Contactos guardados.");
});

function renderEmergencyModal() {
  const el = $("#emergencia-contacts");
  const c = state.contatos || {};
  const list = [c.contato1, c.contato2].filter((x) => x && x.tel);
  if (list.length === 0) {
    el.innerHTML = `<p class="muted">Nenhum contacto configurado ainda. Pede a um familiar para o adicionar em Definições → Contactos de emergência.</p>`;
    return;
  }
  el.innerHTML = list.map((c) =>
    `<a class="emergencia-contact-btn" href="tel:${c.tel.replace(/\s/g, "")}">📞 Ligar a ${escapeHTML(c.nome || "familiar")}</a>`
  ).join("");
}

$("#btn-emergencia").addEventListener("click", () => {
  renderEmergencyModal();
  $("#modal-emergencia").classList.remove("hidden");
});

$("#emergencia-cancel").addEventListener("click", () => $("#modal-emergencia").classList.add("hidden"));
$("#nav-cancel").addEventListener("click", () => $("#modal-nav").classList.add("hidden"));

/* ---------- Zoom de texto ---------- */
const ZOOM_KEY = "bussola-zoom";
const ZOOM_LEVELS = [1, 1.2, 1.4];

function applyZoom() {
  let level = Number(localStorage.getItem(ZOOM_KEY)) || 1;
  if (!ZOOM_LEVELS.includes(level)) level = 1;
  document.documentElement.style.setProperty("--zoom", level);
  return level;
}
applyZoom();

$("#btn-zoom-text").addEventListener("click", () => {
  const current = applyZoom();
  const idx = ZOOM_LEVELS.indexOf(current);
  const next = ZOOM_LEVELS[(idx + 1) % ZOOM_LEVELS.length];
  localStorage.setItem(ZOOM_KEY, next);
  applyZoom();
  const labels = { 1: "normal", 1.2: "grande", 1.4: "muito grande" };
  showToast(`Tamanho do texto: ${labels[next]}`);
});

/* ---------- Família (convite + aprovação) ---------- */
$("#btn-copy-code").addEventListener("click", async () => {
  const code = $("#family-code-value").textContent.trim();
  try {
    await navigator.clipboard.writeText(code);
    showToast("Código copiado.");
  } catch (e) {
    showToast("Não foi possível copiar automaticamente — copia manualmente: " + code);
  }
});

function renderJoinRequests() {
  const el = $("#join-requests-list");
  if (!el) return;
  if (pendingJoinRequests.length === 0) {
    el.innerHTML = `<p class="muted">Nenhum pedido de acesso pendente.</p>`;
    return;
  }
  el.innerHTML = pendingJoinRequests.map((r) => `
    <div class="aidant-item">
      <div class="aidant-item-main">
        <strong>${escapeHTML(r.label || "Novo aparelho")}</strong>
        <span>Pediu para entrar</span>
      </div>
      <button class="secondary-btn small" data-approve="${r.uid}">Aprovar</button>
      <button class="edit-link" data-reject="${r.uid}">Recusar</button>
    </div>
  `).join("");
  el.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await approveJoinRequest(btn.dataset.approve);
      showToast("Acesso aprovado.");
    });
  });
  el.querySelectorAll("[data-reject]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await rejectJoinRequest(btn.dataset.reject);
      showToast("Pedido recusado.");
    });
  });
}

const deviceLabelInput = $("#device-label");
deviceLabelInput.value = localStorage.getItem(DEVICE_LABEL_KEY) || "";
deviceLabelInput.addEventListener("change", () => {
  localStorage.setItem(DEVICE_LABEL_KEY, deviceLabelInput.value.trim());
  sendPresence();
});

$("#btn-logout").addEventListener("click", async () => {
  await signOut(auth);
  localStorage.removeItem(LOCAL_FAMILY_ID_KEY);
  location.reload();
});

/* ===================== NOTIFICAÇÕES ===================== */
function notifStatusLabel() {
  if (!("Notification" in window)) return "Notificações não suportadas neste dispositivo.";
  if (Notification.permission === "granted") return "Notificações ativadas ✓";
  if (Notification.permission === "denied") return "Notificações bloqueadas — reative nas definições do telemóvel.";
  return "Notificações não ativadas.";
}

$("#btn-enable-notif").addEventListener("click", async () => {
  if (!("Notification" in window)) { showToast("Não suportado neste dispositivo."); return; }
  const perm = await Notification.requestPermission();
  $("#notif-status").textContent = notifStatusLabel();
  if (perm === "granted") showToast("Notificações ativadas.");
});

function fireNotification(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SHOW_NOTIFICATION", payload: { title, body, tag } });
  } else {
    new Notification(title, { body });
  }
}

const firedTags = new Set();

function checkReminders() {
  const now = new Date();
  const today = todayStr();
  const hhmm = now.toTimeString().slice(0, 5);

  state.meds.forEach((m) => {
    (m.heures || []).forEach((h) => {
      const tag = `med_${m.id}_${today}_${h}`;
      const logKey = `${today}_${m.id}_${h}`;
      if (h === hhmm && !firedTags.has(tag) && !state.medLog[logKey]) {
        firedTags.add(tag);
        fireNotification("💊 Medicamento", `${m.nom}${m.consigne ? " — " + m.consigne : ""}`, tag);
      }
    });
  });

  state.rdvs.forEach((r) => {
    if (!r.date || !r.heure) return;
    const rdvDateTime = new Date(r.date + "T" + r.heure);
    const diffMin = (rdvDateTime - now) / 60000;
    const levarSuffix = r.precisaLevarExames && r.levarExamesTexto ? ` Não esqueças de levar: ${r.levarExamesTexto}.` : "";

    const tag1h = `rdv1h_${r.id}`;
    if (diffMin > 0 && diffMin <= 60 && !firedTags.has(tag1h)) {
      firedTags.add(tag1h);
      fireNotification("📅 Consulta daqui a 1 hora", `${r.medecin} — ${r.motif || ""}.${levarSuffix}`, tag1h);
    }

    const vespera = new Date(rdvDateTime);
    vespera.setDate(vespera.getDate() - 1);
    vespera.setHours(18, 0, 0, 0);
    const tagVespera = `rdvvespera_${r.id}`;
    if (Math.abs(now - vespera) < 60000 && !firedTags.has(tagVespera)) {
      firedTags.add(tagVespera);
      fireNotification("📅 Consulta amanhã", `${r.medecin} — ${r.motif || ""} às ${r.heure}.${levarSuffix}`, tagVespera);
    }
  });

  // Alerta discreto para os cuidadores: dose não confirmada 30 min após a hora prevista
  if (localStorage.getItem(CAREGIVER_FLAG_KEY) === "1") {
    state.meds.forEach((m) => {
      (m.heures || []).forEach((h) => {
        const logKey = `${today}_${m.id}_${h}`;
        if (state.medLog[logKey]) return;
        const tagAlert = `caregiveralert_${logKey}`;
        if (isSlotLate(h, now) && !firedTags.has(tagAlert)) {
          firedTags.add(tagAlert);
          fireNotification("Ainda não confirmado", `${m.nom} das ${h} — o Papa ainda não confirmou.`, tagAlert);
        }
      });
    });
  }
}

setInterval(() => { checkReminders(); renderTodayMeds(); renderHomeMissedMeds(); }, 30000);
setInterval(sendPresence, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) sendPresence(); });

/* ===================== INICIALIZAÇÃO ===================== */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

checkReminders();

// Mostra o ecrã de configuração até sabermos a que família este aparelho pertence
showView("view-setup");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUser = user;

  if (familyId) {
    // já tínhamos uma família guardada neste aparelho — confirma que ainda somos membros
    onFamilyResolved();
    return;
  }

  try {
    const idxSnap = await getDoc(doc(db, "userFamilies", user.uid));
    if (idxSnap.exists()) {
      familyId = idxSnap.data().familyId;
      localStorage.setItem(LOCAL_FAMILY_ID_KEY, familyId);
      onFamilyResolved();
    }
    // se não existir, o utilizador ainda tem de escolher "paciente" ou "cuidador" no ecrã de configuração
  } catch (e) {
    console.error(e);
    showToast("Sem ligação à internet.");
  }
});

/* ---------- Ecrã de configuração inicial ---------- */
$("#setup-btn-patient").addEventListener("click", () => {
  $("#setup-choice").classList.add("hidden");
  $("#setup-patient").classList.remove("hidden");
  if (!auth.currentUser) signInAnonymously(auth).catch(() => showToast("Sem ligação à internet."));
});

$("#setup-btn-caregiver").addEventListener("click", () => {
  $("#setup-choice").classList.add("hidden");
  $("#setup-caregiver").classList.remove("hidden");
});

$("#setup-patient-submit").addEventListener("click", async () => {
  const code = $("#setup-patient-code").value.trim();
  if (!code) { $("#setup-patient-status").textContent = "Introduz o código."; return; }
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    const targetFamilyId = await resolveInviteCode(code);
    if (!targetFamilyId) { $("#setup-patient-status").textContent = "Código inválido."; return; }
    await requestJoinFamily(targetFamilyId, auth.currentUser.uid);
    listenForOwnApproval(auth.currentUser.uid);
    $("#setup-patient-status").textContent = "✓ Pedido enviado. A aguardar aprovação de um cuidador...";
  } catch (e) {
    console.error(e);
    $("#setup-patient-status").textContent = "Não foi possível enviar o pedido. Verifica a ligação.";
  }
});

const AUTH_TAB_COPY = {
  login: { title: "Entrar", subtitle: "Acede à tua conta de cuidador." },
  signup: { title: "Criar conta", subtitle: "Isto cria também uma nova família." },
  joincode: { title: "Juntar-me com código", subtitle: "Usa o código de outro cuidador da família." }
};

$$("[data-authtab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$("[data-authtab]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ["login", "signup", "joincode"].forEach((t) => $("#authtab-" + t).classList.add("hidden"));
    $("#authtab-" + btn.dataset.authtab).classList.remove("hidden");
    $("#auth-status").textContent = "";
    const copy = AUTH_TAB_COPY[btn.dataset.authtab];
    $("#auth-title").textContent = copy.title;
    $("#auth-subtitle").textContent = copy.subtitle;
  });
});

$$("[data-back-to-choice]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $("#setup-patient").classList.add("hidden");
    $("#setup-caregiver").classList.add("hidden");
    $("#setup-choice").classList.remove("hidden");
  });
});

$$("[data-toggle-pw]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = $("#" + btn.dataset.togglePw);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    btn.textContent = showing ? "👁" : "🙈";
    btn.setAttribute("aria-label", showing ? "Mostrar palavra-passe" : "Ocultar palavra-passe");
  });
});

$("#btn-login").addEventListener("click", async () => {
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  if (!email || !password) { $("#auth-status").textContent = "Preenche o email e a palavra-passe."; return; }
  try {
    await loginCaregiver(email, password);
    $("#auth-status").textContent = "A entrar...";
  } catch (e) {
    $("#auth-status").textContent = "Não foi possível entrar. Verifica o email e a palavra-passe.";
  }
});

$("#btn-forgot-password").addEventListener("click", async () => {
  const email = $("#login-email").value.trim();
  if (!email) { $("#auth-status").textContent = "Escreve o teu email para receberes o link."; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    $("#auth-status").textContent = "Email enviado — verifica a tua caixa de entrada.";
  } catch (e) {
    $("#auth-status").textContent = "Não foi possível enviar o email.";
  }
});

$("#btn-signup").addEventListener("click", async () => {
  const email = $("#signup-email").value.trim();
  const password = $("#signup-password").value;
  if (!email || password.length < 6) { $("#auth-status").textContent = "Email válido e palavra-passe com 6+ caracteres."; return; }
  try {
    const newFamilyId = await signUpCaregiver(email, password);
    familyId = newFamilyId;
    localStorage.setItem(LOCAL_FAMILY_ID_KEY, familyId);
    localStorage.setItem(CAREGIVER_FLAG_KEY, "1");
    onFamilyResolved();
  } catch (e) {
    console.error(e);
    $("#auth-status").textContent = e.code === "auth/email-already-in-use" ? "Este email já tem conta — usa Entrar." : "Não foi possível criar a conta.";
  }
});

$("#btn-caregiver-join").addEventListener("click", async () => {
  const email = $("#login-email").value.trim() || $("#signup-email").value.trim();
  const code = $("#caregiver-join-code").value.trim();
  if (!code) { $("#auth-status").textContent = "Introduz o código de convite."; return; }
  try {
    if (!auth.currentUser) {
      $("#auth-status").textContent = "Cria a tua conta ou entra primeiro (separador Entrar/Criar conta) antes de usares um código.";
      return;
    }
    const targetFamilyId = await resolveInviteCode(code);
    if (!targetFamilyId) { $("#auth-status").textContent = "Código inválido."; return; }
    await requestJoinFamily(targetFamilyId, auth.currentUser.uid);
    localStorage.setItem(CAREGIVER_FLAG_KEY, "1");
    listenForOwnApproval(auth.currentUser.uid);
    $("#auth-status").textContent = "✓ Pedido enviado. A aguardar aprovação de outro cuidador...";
  } catch (e) {
    console.error(e);
    $("#auth-status").textContent = "Não foi possível enviar o pedido.";
  }
});
