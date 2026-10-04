/* ===================== LIGAÇÃO AO ANDROID (Capacitor) =====================
   No telemóvel (app instalada), os lembretes passam a ser alarmes nativos agendados no sistema:
   funcionam com a app fechada e com o ecrã bloqueado. No navegador, esta ligação fica inativa
   e a app continua a usar o verificador por temporizador do app.js. */

export function isNative() {
  const c = window.Capacitor;
  return !!(c && typeof c.isNativePlatform === "function" && c.isNativePlatform());
}

function plugin() {
  const c = window.Capacitor;
  return isNative() && c.Plugins ? c.Plugins.LocalNotifications : null;
}

// Identificador numérico estável (inteiro de 32 bits) a partir de um texto
function numId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647 || 1;
}

export async function nativePermissionState() {
  const LN = plugin();
  if (!LN) return null;
  try { return (await LN.checkPermissions()).display; } catch (e) { return null; }
}

export async function requestNativePermission() {
  const LN = plugin();
  if (!LN) return null;
  try { return (await LN.requestPermissions()).display; } catch (e) { return null; }
}

// Alarmes exatos (Android 12+): se estiverem desativados, os lembretes podem atrasar-se alguns minutos
export async function exactAlarmsAllowed() {
  const LN = plugin();
  if (!LN || !LN.checkExactNotificationSetting) return true;
  try { return (await LN.checkExactNotificationSetting()).exact_alarm !== "denied"; } catch (e) { return true; }
}

export async function openExactAlarmSettings() {
  const LN = plugin();
  if (LN && LN.changeExactNotificationSetting) { try { await LN.changeExactNotificationSetting(); } catch (e) { /* ignorar */ } }
}

// Notificação imediata (usada nos alertas de "toma não confirmada")
export async function nativeNotifyNow(title, body, tag) {
  const LN = plugin();
  if (!LN) return false;
  try {
    await LN.schedule({ notifications: [{ id: numId("now_" + tag), title, body, schedule: { at: new Date(Date.now() + 700) } }] });
    return true;
  } catch (e) { return false; }
}

/* Reagenda TODOS os lembretes a partir do estado atual (medicamentos diários + consultas).
   `texts` traz os textos já traduzidos para a língua ativa. */
export async function syncNativeReminders(state, texts) {
  const LN = plugin();
  if (!LN) return;
  try {
    if ((await LN.checkPermissions()).display !== "granted") return;

    const pending = await LN.getPending();
    if (pending.notifications && pending.notifications.length) {
      await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }

    const notifications = [];
    const now = new Date();

    (state.meds || []).forEach((m) => {
      (m.heures || []).forEach((h) => {
        const [hh, mm] = String(h).split(":").map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) return;
        notifications.push({
          id: numId(`med_${m.id}_${h}`),
          title: texts.medTitle,
          body: m.nom + (m.consigne ? " — " + m.consigne : ""),
          schedule: { on: { hour: hh, minute: mm }, allowWhileIdle: true } // repete todos os dias
        });
      });
    });

    (state.rdvs || []).forEach((r) => {
      if (!r.date || !r.heure) return;
      const when = new Date(r.date + "T" + r.heure);
      if (Number.isNaN(when.getTime())) return;
      const extra = r.precisaLevarExames && r.levarExamesTexto ? " " + texts.bring(r.levarExamesTexto) : "";

      const oneHour = new Date(when.getTime() - 60 * 60000);
      if (oneHour > now) {
        notifications.push({
          id: numId(`rdv1h_${r.id}`), title: texts.rdvInOneHour,
          body: `${r.medecin} — ${r.motif || ""}.${extra}`,
          schedule: { at: oneHour, allowWhileIdle: true }
        });
      }
      const eve = new Date(when); eve.setDate(eve.getDate() - 1); eve.setHours(18, 0, 0, 0);
      if (eve > now) {
        notifications.push({
          id: numId(`rdveve_${r.id}`), title: texts.rdvTomorrow,
          body: texts.rdvTomorrowBody(r),
          schedule: { at: eve, allowWhileIdle: true }
        });
      }
    });

    if (notifications.length) await LN.schedule({ notifications });
  } catch (e) {
    console.error("Falha a agendar lembretes nativos", e);
  }
}
