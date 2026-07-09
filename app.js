/* MRS Client Management prototype - logic.
   The Progress Log is the single source of truth: hours delivered, percent
   complete, and billing readiness are all DERIVED from log entries, never
   typed twice. That is the automation that frees the team. */

const state = { role: null, user: null, view: null, clientId: null, revealed: {} };

/* ---------- derived values (the "heart") ---------- */
const hoursDelivered = c => c.progressLog.reduce((s, e) => s + Number(e.hours || 0), 0);
const pctComplete = c => c.authorizedHours ? Math.min(100, Math.round(hoursDelivered(c) / c.authorizedHours * 100)) : 0;
const billingReady = c => pctComplete(c) >= 100 || c.status === "Complete";
const daysLeft = c => Math.round((new Date(c.authEnd) - new Date()) / 86400000);
const placementCounts = x => {
  const L = x.placementLog || [];
  return {
    apps: L.filter(e => e.kind === "Application").length,
    interviews: L.filter(e => e.kind === "Interview").length,
    contacts: L.filter(e => e.kind === "Employer Contact").length
  };
};

/* ---------- helpers ---------- */
const el = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const maskSSN = ssn => "•••-••-" + ssn.slice(-4);
const statusClass = s => ({ "Active": "active", "At risk": "bad", "New": "new", "Complete": "active", "Closed": "new" }[s] || "new");
const isArchived = x => x.status === "Closed";
const isWorking = x => x.status !== "Complete" && x.status !== "Closed";

function audit(action, detail) {
  const d = new Date();
  AUDIT.unshift({
    user: state.user ? state.user.name : "-",
    role: state.role || "-",
    action, detail: detail || "",
    date: d.toLocaleDateString("en-US"),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  });
  renderAudit();
}

/* ---------- login ---------- */
const ROLE_DESC = {
  Administrator: "Full access. Master client tracker, billing, and all records.",
  Coach: "Assigned clients and progress logging only.",
  Supervisor: "Read-only oversight of clients and coaches."
};
function renderLogin() {
  el("roleButtons").innerHTML = Object.keys(USERS).map(r => `
    <button class="role-btn" data-role="${r}" type="button">
      <span class="r-ic">${r[0]}</span>
      <span><span class="r-name">${r}</span><br><span class="r-desc">${ROLE_DESC[r]}</span></span>
    </button>`).join("");
}
// Login is a two-step: pick a role, then enter the demo password. The password
// gate is prototype theater with a shared demo password; the real app gets real
// per-user credentials and MFA (build spec A4).
let pendingRole = null;
const DEMO_PASSWORD = "mrs2026";
function askPassword(role) {
  pendingRole = role;
  el("pwWho").textContent = role;
  el("pwErr").style.display = "none";
  el("pwInput").value = "";
  el("pwRow").style.display = "block";
  el("pwInput").focus();
}
function tryPassword() {
  if (!pendingRole) return;
  if (el("pwInput").value === DEMO_PASSWORD) {
    el("pwRow").style.display = "none";
    el("pwInput").value = "";
    login(pendingRole);
    pendingRole = null;
  } else {
    el("pwErr").style.display = "block";
    el("pwInput").select();
  }
}
// Bulletproof login: one delegated listener on the container (works no matter
// where inside the button the click lands, and never loses its binding).
el("roleButtons").addEventListener("click", ev => {
  const b = ev.target.closest(".role-btn");
  if (b) askPassword(b.dataset.role);
});
el("roleButtons").addEventListener("keydown", ev => {
  const b = ev.target.closest(".role-btn");
  if (b && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); askPassword(b.dataset.role); }
});
el("pwGo").addEventListener("click", tryPassword);
el("pwInput").addEventListener("keydown", ev => { if (ev.key === "Enter") tryPassword(); });
function login(role) {
  state.role = role;
  state.user = USERS[role];
  el("login").style.display = "none";
  el("app").classList.add("active");
  el("whoName").textContent = state.user.name;
  el("whoRole").textContent = "(" + role + ")";
  el("auditBtn").style.display = role === "Coach" ? "none" : "inline-block";
  audit("Signed in", role);
  buildNav();
  const first = NAV[role][0];
  go(first.view);
}
function logout() {
  audit("Signed out");
  state.role = null; state.clientId = null;
  el("app").classList.remove("active");
  el("login").style.display = "flex";
  closeDrawer();
}

/* ---------- navigation ---------- */
const NAV = {
  Administrator: [
    { view: "tracker", label: "Master Client Tracker" },
    { view: "matches", label: "Morning Job Matches" },
    { view: "placement", label: "Placement Board" },
    { view: "reminders", label: "Follow-up Reminders" },
    { view: "billing", label: "Billing" },
    { view: "archive", label: "Archive" },
    { view: "report", label: "Generate Report" }
  ],
  Coach: [
    { view: "myclients", label: "My Clients" },
    { view: "matches", label: "Morning Job Matches" },
    { view: "placement", label: "Placement Board" },
    { view: "reminders", label: "Follow-up Reminders" }
  ],
  Supervisor: [
    { view: "overview", label: "Client Overview" },
    { view: "matches", label: "Morning Job Matches" },
    { view: "placement", label: "Placement Board" },
    { view: "reminders", label: "Follow-up Reminders" },
    { view: "coaches", label: "Coach Monitoring" },
    { view: "report", label: "Generate Report" }
  ]
};
function buildNav() {
  el("nav").innerHTML = `<div class="nav-sec">${state.role}</div>` +
    NAV[state.role].map(n => `<button class="nav-item" data-view="${n.view}">${n.label}</button>`).join("");
  document.querySelectorAll("#nav .nav-item").forEach(b => b.onclick = () => go(b.dataset.view));
}
function go(view) {
  state.view = view; state.clientId = null;
  document.querySelectorAll("#nav .nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  // mobile dropdown: close it and show where you are
  document.querySelector(".sidebar").classList.remove("nav-open");
  const cur = (NAV[state.role] || []).find(n => n.view === view);
  el("navToggle").innerHTML = (cur ? cur.label : "Menu") + " &#9662;";
  el("a11yMenu").classList.remove("open");
  render();
}

/* ---------- render router ---------- */
function render() {
  const c = el("content");
  if (state.clientId) return renderClient(c);
  switch (state.view) {
    case "tracker": return renderTracker(c);
    case "billing": return renderBilling(c);
    case "myclients": return renderMyClients(c);
    case "overview": return renderOverview(c);
    case "coaches": return renderCoaches(c);
    case "placement": return renderPlacement(c);
    case "matches": return renderMatches(c);
    case "reminders": return renderReminders(c);
    case "archive": return renderArchive(c);
    case "report": return renderReport(c);
  }
}
function setTitle(t) { el("viewTitle").textContent = t; }

/* ---------- Admin: Master Client Tracker ---------- */
function renderTracker(c) {
  setTitle("Master Client Tracker");
  const pool = CLIENTS.filter(x => !isArchived(x));
  const total = pool.length;
  const active = pool.filter(x => x.status === "Active").length;
  const risk = pool.filter(x => x.status === "At risk").length;
  const ready = pool.filter(billingReady).length;
  c.innerHTML = `
    <div class="stat-row">
      ${stat("Active authorizations", active + " <small>/ " + total + "</small>")}
      ${stat("At risk", risk)}
      ${stat("Ready to bill", ready)}
      ${stat("Coaches", COACHES.length)}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>All clients</h3></div>
      <div class="panel-body"><table>
        <thead><tr>
          <th>Client</th><th>Auth #</th><th>SSN</th><th>Service</th><th>Coach</th>
          <th>Hours</th><th>Progress</th><th>Status</th>
        </tr></thead>
        <tbody>${pool.map(rowAdmin).join("")}</tbody>
      </table></div>
    </div>`;
  wireClientRows();
  document.querySelectorAll("[data-reveal]").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const id = b.dataset.reveal;
    const on = !state.revealed[id];
    state.revealed[id] = on;
    audit(on ? "Revealed SSN" : "Hid SSN", CLIENTS.find(x => x.id === id).name);
    render();
  });
}
function rowAdmin(x) {
  const shown = state.revealed[x.id];
  const ssnCell = shown
    ? `<span class="ssn">${x.ssn}</span><button class="link-btn" data-reveal="${x.id}">hide</button>`
    : `<span class="ssn">${maskSSN(x.ssn)}</span><button class="link-btn" data-reveal="${x.id}">reveal</button>`;
  return `<tr class="clickable" data-client="${x.id}">
    <td><b>${esc(x.name)}</b><br><span class="locked" style="font-style:normal">${esc(x.goal)}</span></td>
    <td class="mono">${x.authNumber}</td>
    <td>${ssnCell}</td>
    <td>${x.serviceType}</td>
    <td>${esc(x.coach)}</td>
    <td class="mono">${hoursDelivered(x)} / ${x.authorizedHours}</td>
    <td>${progressCell(x)}</td>
    <td><span class="badge ${statusClass(x.status)}">${x.status}</span></td>
  </tr>`;
}

/* ---------- Admin: Billing ---------- */
function renderBilling(c) {
  setTitle("Billing");
  const pool = CLIENTS.filter(x => !isArchived(x));
  const rows = pool.map(x => `
    <tr>
      <td class="clickable" data-client="${x.id}"><b>${esc(x.name)}</b></td>
      <td class="mono">${x.authNumber}</td>
      <td class="mono">${hoursDelivered(x)} / ${x.authorizedHours}</td>
      <td>${progressCell(x)}</td>
      <td>${billingReady(x)
        ? '<span class="badge active">Ready to bill</span>'
        : '<span class="badge warn">In progress</span>'}</td>
      <td>${billingReady(x)
        ? `<button class="btn sm primary" data-pay="${x.id}">Record payment</button>`
        : ""}</td>
    </tr>`).join("");
  c.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Billing readiness</h3></div>
      <div class="panel-body"><table>
        <thead><tr><th>Client</th><th>Auth #</th><th>Hours</th><th>Progress</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    <p class="locked">Billing readiness is calculated automatically from the Progress Log. When authorized hours are met, the client is flagged ready to invoice. Recording the payment closes the case and moves it to the Archive. In the real system this step follows the manager's review and the invoice to MRS.</p>`;
  wireClientRows();
  document.querySelectorAll("[data-pay]").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const x = CLIENTS.find(v => v.id === b.dataset.pay);
    if (!x) return;
    x.status = "Closed";
    x.paidDate = new Date().toISOString().slice(0, 10);
    audit("Recorded payment, case closed", x.name + " (" + x.authNumber + ")");
    render();
  });
}

/* ---------- Archive (closed, paid cases; kept, never deleted) ---------- */
function renderArchive(c) {
  setTitle("Archive");
  const closed = CLIENTS.filter(isArchived);
  const rows = closed.length ? closed.map(x => `
    <tr>
      <td class="clickable" data-client="${x.id}"><b>${esc(x.name)}</b><br><span class="locked" style="font-style:normal">${esc(x.goal)}</span></td>
      <td class="mono">${x.authNumber}</td>
      <td>${esc(x.coach)}</td>
      <td class="mono">${hoursDelivered(x)} / ${x.authorizedHours}</td>
      <td class="mono">${x.paidDate ? fmtDate(x.paidDate) : "-"}</td>
      <td><span class="badge new">Closed</span></td>
    </tr>`).join("")
    : `<tr><td colspan="6" class="locked" style="padding:22px 18px">No closed cases yet. When a completed client's payment is recorded in Billing, the case moves here.</td></tr>`;
  c.innerHTML = `
    <div class="stat-row">
      ${stat("Closed cases", closed.length)}
      ${stat("Hours delivered (closed)", closed.reduce((s, x) => s + hoursDelivered(x), 0))}
      ${stat("Records kept", "All")}
      ${stat("Deleted", "None")}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Closed and paid cases</h3><span class="locked" style="font-style:normal">archived, never deleted</span></div>
      <div class="panel-body"><table>
        <thead><tr><th>Client</th><th>Auth #</th><th>Coach</th><th>Hours</th><th>Payment recorded</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    <p class="locked">Closed cases leave the daily views but the full record stays: MRS audits require it, retention policy governs it, and a returning client with a new authorization reopens as a fresh cycle.</p>`;
  wireClientRows();
}

/* ---------- Coach: My Clients ---------- */
function renderMyClients(c) {
  setTitle("My Clients");
  const mine = CLIENTS.filter(x => x.coach === state.user.name && !isArchived(x));
  const rows = mine.length ? mine.map(x => `
    <tr class="clickable" data-client="${x.id}">
      <td><b>${esc(x.name)}</b><br><span class="locked" style="font-style:normal">${esc(x.goal)}</span></td>
      <td>${x.serviceType}</td>
      <td class="mono">${hoursDelivered(x)} / ${x.authorizedHours}</td>
      <td>${progressCell(x)}</td>
      <td><span class="badge ${statusClass(x.status)}">${x.status}</span></td>
    </tr>`).join("")
    : `<tr><td colspan="5" class="locked" style="padding:22px 18px">No clients assigned to you yet.</td></tr>`;
  c.innerHTML = `
    <div class="stat-row">
      ${stat("Assigned clients", mine.length)}
      ${stat("Follow-ups due", mine.filter(x => daysLeft(x) <= 7 && x.status !== "Complete").length)}
      ${stat("Completed", mine.filter(x => x.status === "Complete").length)}
      ${stat("Hours this month", mine.reduce((s, x) => s + hoursDelivered(x), 0))}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Clients assigned to ${esc(state.user.name)}</h3></div>
      <div class="panel-body"><table>
        <thead><tr><th>Client</th><th>Service</th><th>Hours</th><th>Progress</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  wireClientRows();
}

/* ---------- Supervisor: Client Overview (read-only) ---------- */
function renderOverview(c) {
  setTitle("Client Overview");
  const rows = CLIENTS.filter(x => !isArchived(x)).map(x => `
    <tr class="clickable" data-client="${x.id}">
      <td><b>${esc(x.name)}</b></td>
      <td>${esc(x.coach)}</td>
      <td>${x.serviceType}</td>
      <td>${progressCell(x)}</td>
      <td>${x.status === "Complete" ? '<span class="locked" style="font-style:normal">Done</span>' : (daysLeft(x) < 0 ? '<span class="badge bad">Overdue</span>' : daysLeft(x) + " days")}</td>
      <td><span class="badge ${statusClass(x.status)}">${x.status}</span></td>
    </tr>`).join("");
  c.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>All clients (read-only)</h3></div>
      <div class="panel-body"><table>
        <thead><tr><th>Client</th><th>Coach</th><th>Service</th><th>Progress</th><th>Auth ends</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    <p class="locked">Supervisor view is read-only. Client files and SSNs are not shown at this level.</p>`;
  wireClientRows();
}

/* ---------- Supervisor: Coach Monitoring ---------- */
function renderCoaches(c) {
  setTitle("Coach Monitoring");
  const rows = COACHES.map(name => {
    const load = CLIENTS.filter(x => x.coach === name);
    const hrs = load.reduce((s, x) => s + hoursDelivered(x), 0);
    return `<tr>
      <td><b>${esc(name)}</b></td>
      <td class="mono">${load.length}</td>
      <td class="mono">${hrs}</td>
      <td class="mono">${load.filter(x => x.status === "At risk").length}</td>
    </tr>`;
  }).join("");
  c.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Coach workload</h3></div>
      <div class="panel-body"><table>
        <thead><tr><th>Coach</th><th>Clients</th><th>Hours delivered</th><th>At risk</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
}

/* ---------- Job Placement (combined module) ---------- */
function renderPlacement(c) {
  setTitle("Placement Board");
  // Coaches work their own caseload with full tools. Admin and Supervisor see
  // results only (oversight), no drafting actions.
  const isCoach = state.role === "Coach";
  const pool = isCoach ? CLIENTS.filter(x => x.coach === state.user.name) : CLIENTS;
  const activeClients = pool.filter(isWorking);
  const totalLeads = activeClients.reduce((s, x) => s + (x.leads ? x.leads.length : 0), 0);
  const followUps = activeClients.filter(x => daysLeft(x) <= 7);
  const rows = activeClients.map(x => {
    const pc = placementCounts(x);
    const fu = daysLeft(x) < 0
      ? '<span class="badge bad">follow up now</span>'
      : (daysLeft(x) <= 7 ? '<span class="badge warn">due soon</span>' : daysLeft(x) + " days");
    return `<tr>
      <td class="clickable" data-client="${x.id}"><b>${esc(x.name)}</b><br><span class="locked" style="font-style:normal">${esc(x.goal)}</span></td>
      ${isCoach ? "" : `<td>${esc(x.coach)}</td>`}
      <td class="mono">${pc.apps}</td><td class="mono">${pc.interviews}</td><td class="mono">${pc.contacts}</td>
      <td>${(x.leads && x.leads.length) ? `<span class="badge active">${x.leads.length} matches</span>` : '<span class="locked">none</span>'}</td>
      <td>${fu}</td>
      ${isCoach ? `<td><button class="btn sm" data-note="${x.id}">Draft MRS note</button></td>` : ""}
    </tr>`;
  }).join("");
  c.innerHTML = `
    <div class="stat-row">
      ${stat("Job leads sourced", totalLeads)}
      ${stat("Active placements", activeClients.length)}
      ${stat("Follow-ups due", followUps.length)}
      ${isCoach ? stat("Your clients", pool.length) : stat("Coaches", COACHES.length)}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>${isCoach ? "Your placement board" : "Placement results"}</h3>
        <span class="locked" style="font-style:normal">${isCoach ? "your caseload only" : "read-only overview across all coaches"}</span></div>
      <div class="panel-body"><table>
        <thead><tr><th>Client</th>${isCoach ? "" : "<th>Coach</th>"}<th>Apps</th><th>Interviews</th><th>Contacts</th><th>AI matches</th><th>Follow-up</th>${isCoach ? "<th></th>" : ""}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    <p class="locked">${isCoach
      ? "Open a client for their AI matches and full job progression. Notes are AI-drafted from logged activity; you review and send."
      : "Oversight view. Drafting and outreach tools live with the assigned coach."}</p>`;
  wireClientRows();
  wireDraftButtons();
}

function generateNote(x) {
  const pc = placementCounts(x);
  const last = x.progressLog.slice(-1)[0];
  return [
    "MRS PROGRESS NOTE (DRAFT)",
    "Prototype - demo data. No real client information.",
    "",
    "Client: " + x.name,
    "Authorization: " + x.authNumber + "    MRS counselor: " + x.counselor,
    "Service: " + x.serviceType + "    Vocational goal: " + x.goal,
    "Reporting date: " + new Date().toLocaleDateString("en-US"),
    "",
    "SERVICE DELIVERY",
    "Hours delivered: " + hoursDelivered(x) + " of " + x.authorizedHours + " authorized (" + pctComplete(x) + "% complete).",
    "Current status: " + x.status + ".",
    "",
    "PLACEMENT ACTIVITY",
    "Applications: " + pc.apps + "    Interviews: " + pc.interviews + "    Employer contacts: " + pc.contacts + ".",
    (last
      ? "Most recent session (" + fmtDate(last.date) + ", " + last.type + ", " + last.hours + " hrs): " + last.report + " Next: " + last.next
      : "No service sessions logged yet."),
    "",
    "Prepared by: " + (state.user ? state.user.name : "-") + " (" + state.role + ")",
    "To be reviewed and approved by a supervisor before submission to MRS."
  ].join("\n");
}
// One-click AI drafting: the system writes the message from the client's data,
// the human edits and sends. Nothing goes out on its own.
function generateOutreach(x, l) {
  return [
    "Subject: Candidate for your " + l.title + " opening",
    "",
    "Hello " + l.employer + " team,",
    "",
    "My name is " + (state.user ? state.user.name : "-") + " and I am an employment coach with our MRS-partnered employment services program. I am reaching out about your " + l.title + " posting (" + l.source + ", " + l.location + ").",
    "",
    "I am working with a motivated candidate whose vocational goal is " + x.goal + ". " + l.why + " Our program supports each placement with onboarding help and ongoing follow-up, at no cost to your business.",
    "",
    "Would you have 15 minutes this week for a brief call about the role and interview availability?",
    "",
    "Thank you,",
    (state.user ? state.user.name : "-"),
    "Employment Coach"
  ].join("\n");
}
function generateFollowUpMsg(x) {
  const lastPl = (x.placementLog || []).slice(-1)[0];
  const emp = lastPl ? lastPl.employer : "(employer)";
  const ctx = lastPl
    ? (lastPl.kind === "Interview"
      ? "Thank you again for taking the time to speak with my candidate. I wanted to follow up on the interview and see if you need anything further from us to move forward."
      : lastPl.kind === "Application"
        ? "I wanted to follow up on the application we submitted for your open role and confirm it was received. My candidate remains very interested."
        : "I wanted to follow up on our recent conversation about placement opportunities for my candidate.")
    : "I wanted to follow up regarding placement opportunities for my candidate.";
  return [
    "Subject: Following up - candidate for " + emp,
    "",
    "Hello,",
    "",
    ctx,
    "",
    "The candidate is pursuing " + x.goal + " and is supported by our employment services program, including onboarding support and follow-up after hire.",
    "",
    "Is there a good time this week to connect?",
    "",
    "Thank you,",
    (state.user ? state.user.name : "-"),
    "Employment Coach"
  ].join("\n");
}
function showDraft(title, text, auditAction, auditDetail) {
  el("noteTitle").textContent = title;
  el("noteBody").value = text;
  el("noteModal").classList.add("open");
  el("noteBg").classList.add("open");
  audit(auditAction, auditDetail);
}
function showNote(x) {
  showDraft("MRS progress note (draft)", generateNote(x), "Drafted MRS note", x.name);
}
function hideNote() {
  el("noteModal").classList.remove("open");
  el("noteBg").classList.remove("open");
}
function wireDraftButtons() {
  document.querySelectorAll("[data-note]").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    showNote(CLIENTS.find(x => x.id === b.dataset.note));
  });
  document.querySelectorAll("[data-outreach]").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const [id, idx] = b.dataset.outreach.split(":");
    const x = CLIENTS.find(v => v.id === id);
    const l = (x.leads || [])[Number(idx)];
    if (x && l) showDraft("Employer outreach (draft)", generateOutreach(x, l), "Drafted outreach", x.name + " -> " + l.employer);
  });
  document.querySelectorAll("[data-fu]").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const x = CLIENTS.find(v => v.id === b.dataset.fu);
    if (x) showDraft("Follow-up message (draft)", generateFollowUpMsg(x), "Drafted follow-up", x.name);
  });
  // Add to tracker: one click files this lead as a REAL application record on the
  // client. Counts, board, and reports all recalculate from it. Not a toast.
  document.querySelectorAll("[data-track]").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const [id, idx] = b.dataset.track.split(":");
    const x = CLIENTS.find(v => v.id === id);
    const l = (x && x.leads || [])[Number(idx)];
    if (!x || !l || l.tracked) return;
    l.tracked = true;
    (x.placementLog = x.placementLog || []).push({
      date: new Date().toISOString().slice(0, 10),
      kind: "Application",
      employer: l.employer,
      note: "Applied to " + l.title + " (" + l.source + ", " + l.location + "). Added from morning job matches."
    });
    audit("Added lead to tracker", x.name + " -> " + l.title + " at " + l.employer);
    render(); // counts and boards recalculate from the new record
  });
}

/* ---------- Morning Job Matches (per-client AI leads) ---------- */
function renderMatches(c) {
  setTitle("Morning Job Matches");
  const isCoach = state.role === "Coach";
  const mine = isCoach
    ? CLIENTS.filter(x => x.coach === state.user.name && isWorking(x))
    : CLIENTS.filter(isWorking);
  const isToday = l => !l.foundDaysAgo;
  const todayCount = mine.reduce((s, x) => s + (x.leads || []).filter(isToday).length, 0);
  const totalLeads = mine.reduce((s, x) => s + (x.leads ? x.leads.length : 0), 0);
  // Accumulated outreach results across the caseload (derived from the logs).
  const totals = mine.reduce((t, x) => {
    const pc = placementCounts(x);
    t.apps += pc.apps; t.interviews += pc.interviews; t.contacts += pc.contacts;
    return t;
  }, { apps: 0, interviews: 0, contacts: 0 });
  const leadCard = (x, l, i, isNew) => `
    <div class="log-entry"${isNew ? "" : ' style="opacity:.82"'}>
      <div class="meta">
        ${isNew ? '<span class="badge active">new today</span>' : `<span class="badge new">found ${l.foundDaysAgo} day${l.foundDaysAgo > 1 ? "s" : ""} ago</span>`}
        <span class="badge ${isNew ? "active" : "new"}">${l.score}% match</span> <b>${esc(l.title)}</b>
        ${l.tracked ? '<span class="badge active" style="margin-left:auto">In tracker</span>' : ""}
        ${isCoach ? `${l.tracked ? "" : `<button class="btn sm primary" data-track="${x.id}:${i}" style="margin-left:${l.tracked ? "10px" : "auto"}">Add to tracker</button>`}
          <button class="btn sm" data-outreach="${x.id}:${i}" style="margin-left:10px">Draft outreach</button>` : ""}</div>
      <div class="meta"><span>${esc(l.employer)}</span> <span>${esc(l.source)}</span> <span>${esc(l.location)}</span></div>
      <p>${esc(l.why)}</p>
    </div>`;
  const sections = mine.map(x => {
    const leads = x.leads || [];
    const todays = leads.map((l, i) => ({ l, i })).filter(v => isToday(v.l));
    const earlier = leads.map((l, i) => ({ l, i })).filter(v => !isToday(v.l));
    const todayHtml = todays.length
      ? `<div class="log-entry" style="padding:8px 18px;background:rgba(42,157,143,.06)"><b style="color:var(--teal-dark);font-size:12.5px;text-transform:uppercase;letter-spacing:.4px">Found this morning (${todays.length})</b></div>`
        + todays.map(v => leadCard(x, v.l, v.i, true)).join("")
      : `<div class="log-entry locked">The morning run found no new matches for this client today.</div>`;
    const earlierHtml = earlier.length
      ? `<div class="log-entry" style="padding:8px 18px;background:#f8fafc"><b style="color:var(--muted);font-size:12.5px;text-transform:uppercase;letter-spacing:.4px">Still open from earlier runs (${earlier.length})</b></div>`
        + earlier.map(v => leadCard(x, v.l, v.i, false)).join("")
      : "";
    const pc = placementCounts(x);
    const coachTools = isCoach
      ? `<button class="btn sm" data-note="${x.id}" style="margin-left:10px">Draft MRS note</button>` : "";
    return `<div class="panel">
      <div class="panel-head"><h3 class="clickable" data-client="${x.id}" style="cursor:pointer">${esc(x.name)}</h3>
        <span class="locked" style="font-style:normal">${todays.length} new today &middot; goal: ${esc(x.goal)}${isCoach ? "" : " &middot; coach: " + esc(x.coach)}
        &middot; to date: ${pc.apps} apps, ${pc.interviews} interviews, ${pc.contacts} contacts</span>${coachTools}</div>
      <div class="panel-body">${todayHtml}${earlierHtml}</div>
    </div>`;
  }).join("");
  c.innerHTML = `
    <div class="stat-row" style="grid-template-columns:repeat(5,1fr)">
      ${stat("New leads today", todayCount)}
      ${stat("Open leads on file", totalLeads)}
      ${stat("Applications to date", totals.apps)}
      ${stat("Interviews to date", totals.interviews)}
      ${stat("Employer contacts to date", totals.contacts)}
    </div>
    ${sections}
    <p class="locked">${isCoach
      ? "Fresh matches arrive each morning from the connected job boards, ranked against each client's profile. Draft outreach is written by the AI from the client's data; you edit and send it. Demo data shown here."
      : "Results view: today's matches plus accumulated outreach progress. Drafting and outreach are the assigned coach's tools. Demo data shown here."}</p>`;
  wireClientRows();
  wireDraftButtons();
}

/* ---------- Follow-up Reminders (derived task list) ---------- */
function renderReminders(c) {
  setTitle("Follow-up Reminders");
  const mine = state.role === "Coach"
    ? CLIENTS.filter(x => x.coach === state.user.name)
    : CLIENTS.slice();
  const items = [];
  mine.forEach(x => {
    if (isArchived(x)) return; // closed and paid: lives in the Archive, no tasks
    // Completed authorization: active placement work stops, but the client does
    // NOT silently vanish. Completion hands off to the billing step.
    if (x.status === "Complete" || pctComplete(x) >= 100) {
      items.push({ urg: 1, badge: '<span class="badge active">ready to bill</span>', client: x, text: "All " + x.authorizedHours + " authorized hours delivered. Review the Progress Log, prepare the Summary of Services, and invoice MRS. Request additional hours if the client still needs support." });
      return;
    }
    const dl = daysLeft(x);
    const lastPr = x.progressLog.slice(-1)[0];
    if (dl < 0) items.push({ urg: 0, badge: '<span class="badge bad">overdue</span>', client: x, text: "Authorization ended with " + (x.authorizedHours - hoursDelivered(x)) + " hours undelivered. Review with " + x.coach + " and contact the MRS counselor about next steps." });
    else if (dl <= 7) items.push({ urg: 1, badge: '<span class="badge warn">due in ' + dl + ' days</span>', client: x, text: "Authorization ends soon at " + pctComplete(x) + "% complete. Prioritize remaining sessions." });
    if (lastPr && lastPr.next && lastPr.next !== "(none)") items.push({ urg: 2, badge: '<span class="badge new">next step</span>', client: x, text: lastPr.next });
    // One reminder per EMPLOYER, from that employer's latest activity, so two
    // tracked jobs mean two follow-ups (not just the most recent one).
    const latestByEmployer = {};
    (x.placementLog || []).forEach(e => { latestByEmployer[e.employer] = e; });
    Object.values(latestByEmployer).forEach(e => {
      if (e.kind === "Interview") items.push({ urg: 1, badge: '<span class="badge warn">interview follow-up</span>', client: x, text: "Follow up with " + e.employer + " on the latest interview and log the outcome." });
      else if (e.kind === "Application") items.push({ urg: 1, badge: '<span class="badge warn">new application</span>', client: x, text: "Application filed with " + e.employer + ". Send the outreach if you have not yet, then chase a response and log it." });
    });
    if (!x.progressLog.length && !((x.placementLog || []).length)) items.push({ urg: 1, badge: '<span class="badge new">not started</span>', client: x, text: "No activity logged yet. Schedule the intake session." });
  });
  items.sort((a, b) => a.urg - b.urg);
  const isCoach = state.role === "Coach";
  const list = items.length ? items.map(i => `
    <div class="log-entry">
      <div class="meta">${i.badge} <b class="clickable" data-client="${i.client.id}" style="cursor:pointer">${esc(i.client.name)}</b> <span>coach: ${esc(i.client.coach)}</span>
        ${isCoach ? `<button class="btn sm" data-fu="${i.client.id}" style="margin-left:auto">Draft follow-up</button>` : ""}</div>
      <p>${esc(i.text)}</p>
    </div>`).join("") : `<div class="log-entry locked">Nothing due. All placements are moving.</div>`;
  c.innerHTML = `
    <div class="stat-row">
      ${stat("Open reminders", items.length)}
      ${stat("Urgent", items.filter(i => i.urg === 0).length)}
      ${stat("Due soon", items.filter(i => i.urg === 1).length)}
      ${stat("Next steps", items.filter(i => i.urg === 2).length)}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Task list</h3><span class="locked" style="font-style:normal">generated from logged activity and authorization dates</span></div>
      <div class="panel-body">${list}</div>
    </div>
    <p class="locked">These are derived automatically from the data already in the system: authorization deadlines, logged next steps, and recent placement activity. Nothing here is hand-kept.${isCoach ? " Draft follow-up writes the message for you; you edit and send it." : ""}</p>`;
  wireClientRows();
  wireDraftButtons();
}

/* ---------- client detail + progress log ---------- */
function openClient(id) {
  state.clientId = id;
  const c = CLIENTS.find(x => x.id === id);
  audit("Viewed client", c.name);
  render();
}
function renderClient(c) {
  const x = CLIENTS.find(v => v.id === state.clientId);
  setTitle(x.name);
  const canLog = state.role === "Coach" && x.coach === state.user.name;
  const showSensitive = state.role !== "Supervisor";
  const entries = x.progressLog.length
    ? x.progressLog.slice().reverse().map(e => `
      <div class="log-entry">
        <div class="meta"><b>${fmtDate(e.date)}</b> <span>${e.type}</span> <span>${e.hours} hrs</span></div>
        <p>${esc(e.report)}</p>
        <p class="locked" style="font-style:normal"><b>Next:</b> ${esc(e.next)}</p>
      </div>`).join("")
    : `<div class="log-entry locked">No progress entries yet.</div>`;

  const plLog = x.placementLog || [];
  const pc = placementCounts(x);
  const kindClass = k => ({ "Application": "new", "Interview": "active", "Employer Contact": "warn" }[k] || "new");
  const plEntries = plLog.length
    ? plLog.slice().reverse().map(e => `
      <div class="log-entry">
        <div class="meta"><span class="badge ${kindClass(e.kind)}">${e.kind}</span> <b>${esc(e.employer)}</b> <span>${fmtDate(e.date)}</span></div>
        <p>${esc(e.note)}</p>
      </div>`).join("")
    : `<div class="log-entry locked">No job-search activity logged yet.</div>`;

  const leads = x.leads || [];
  const leadsHtml = leads.length
    ? leads.map(l => `
      <div class="log-entry">
        <div class="meta"><span class="badge active">${l.score}% match</span> <b>${esc(l.title)}</b></div>
        <div class="meta"><span>${esc(l.employer)}</span> <span>${esc(l.source)}</span> <span>${esc(l.location)}</span></div>
        <p>${esc(l.why)}</p>
      </div>`).join("")
    : `<div class="log-entry locked">No live matches yet.</div>`;

  c.innerHTML = `
    <div class="matches-head">
      <button class="back-link" id="backBtn" style="margin:0;">&larr; Back</button>
      ${canLog ? '<button class="btn sm" id="genNoteBtn">Draft MRS note</button>' : ""}
    </div>
    <div class="stat-row">
      ${stat("Hours delivered", hoursDelivered(x) + ' <small>/ ' + x.authorizedHours + '</small>')}
      ${stat("Percent complete", pctComplete(x) + "%")}
      ${stat("Auth ends", x.status === "Complete" ? "Done" : (daysLeft(x) < 0 ? "Overdue" : daysLeft(x) + " days"))}
      ${stat("Billing", billingReady(x) ? "Ready" : "In progress")}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Authorization</h3><span class="badge ${statusClass(x.status)}">${x.status}</span></div>
      <div class="panel-body"><table>
        <tr><td class="locked" style="font-style:normal">Authorization #</td><td class="mono">${x.authNumber}</td>
            <td class="locked" style="font-style:normal">MRS counselor</td><td>${esc(x.counselor)}</td></tr>
        <tr><td class="locked" style="font-style:normal">Service type</td><td>${x.serviceType}</td>
            <td class="locked" style="font-style:normal">Authorized hours</td><td class="mono">${x.authorizedHours}</td></tr>
        <tr><td class="locked" style="font-style:normal">Goal</td><td>${esc(x.goal)}</td>
            <td class="locked" style="font-style:normal">SSN</td>
            <td>${showSensitive ? `<span class="ssn">${maskSSN(x.ssn)}</span>` : '<span class="locked">restricted</span>'}</td></tr>
        <tr><td class="locked" style="font-style:normal">Primary disability</td>
            <td>${showSensitive ? esc(x.disability) : '<span class="locked">restricted</span>'}</td>
            <td class="locked" style="font-style:normal">Coach</td><td>${esc(x.coach)}</td></tr>
      </table></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Progress Log</h3></div>
      <div class="panel-body">${entries}</div>
      ${canLog ? logForm() : (state.role === "Supervisor"
        ? '<div class="log-form locked" style="font-style:normal">Read-only. Supervisors monitor progress but do not edit records.</div>' : "")}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Job Progression</h3><span class="locked" style="font-style:normal">${pc.apps} applications &middot; ${pc.interviews} interviews &middot; ${pc.contacts} employer contacts</span></div>
      <div class="panel-body">${plEntries}</div>
      ${canLog ? placementForm() : ""}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>AI Job Matches</h3><span class="locked" style="font-style:normal">sourced and ranked to ${esc(x.goal)}</span></div>
      <div class="panel-body">${leadsHtml}</div>
    </div>`;
  el("backBtn").onclick = () => { state.clientId = null; render(); };
  if (canLog) { el("genNoteBtn").onclick = () => showNote(x); wireLogForm(x); wirePlacementForm(x); }
}
function placementForm() {
  const kinds = ["Application", "Interview", "Employer Contact"];
  const today = new Date().toISOString().slice(0, 10);
  return `<div class="log-form">
    <div><b style="color:var(--navy)">Log job-search activity</b></div>
    <div class="grid2">
      <div><label>Date</label><input type="date" id="p_date" value="${today}"></div>
      <div><label>Type</label><select id="p_kind">${kinds.map(k => `<option>${k}</option>`).join("")}</select></div>
    </div>
    <div><label>Employer</label><input type="text" id="p_emp" placeholder="Company name"></div>
    <div><label>Notes</label><textarea id="p_note" rows="2" placeholder="What happened (applied to X, interview scheduled, called hiring manager)"></textarea></div>
    <div><button class="btn primary" id="p_save">Log activity</button></div>
  </div>`;
}
function wirePlacementForm(x) {
  el("p_save").onclick = () => {
    const entry = {
      date: el("p_date").value,
      kind: el("p_kind").value,
      employer: el("p_emp").value.trim() || "(employer)",
      note: el("p_note").value.trim() || "(no notes)"
    };
    if (!entry.date) return;
    (x.placementLog = x.placementLog || []).push(entry);
    audit("Logged " + entry.kind.toLowerCase(), x.name + " - " + entry.employer);
    render(); // counts recalculate from the records automatically
  };
}
function logForm() {
  const opts = SERVICE_TYPES.map(t => `<option>${t}</option>`).join("");
  const today = new Date().toISOString().slice(0, 10);
  return `<div class="log-form">
    <div><b style="color:var(--navy)">Add progress entry</b></div>
    <div class="grid2">
      <div><label>Session date</label><input type="date" id="f_date" value="${today}"></div>
      <div><label>Service type</label><select id="f_type">${opts}</select></div>
    </div>
    <div class="grid2">
      <div><label>Hours delivered</label><input type="number" id="f_hours" min="0" step="0.5" value="2"></div>
      <div></div>
    </div>
    <div><label>Progress report</label><textarea id="f_report" rows="2" placeholder="What was accomplished this session"></textarea></div>
    <div><label>Next steps</label><textarea id="f_next" rows="2" placeholder="Planned actions before the next session"></textarea></div>
    <div><button class="btn primary" id="f_save">Save entry</button></div>
  </div>`;
}
function wireLogForm(x) {
  el("f_save").onclick = () => {
    const entry = {
      date: el("f_date").value,
      type: el("f_type").value,
      hours: Number(el("f_hours").value || 0),
      report: el("f_report").value.trim() || "(no report)",
      next: el("f_next").value.trim() || "(none)"
    };
    if (!entry.date) return;
    x.progressLog.push(entry);
    if (pctComplete(x) >= 100 && x.status !== "Complete") x.status = "Complete";
    audit("Added progress entry", x.name + " (" + entry.hours + " hrs)");
    render(); // recalculates hours, percent, billing automatically
  };
}

/* ---------- shared bits ---------- */
/* ---------- Admin + Supervisor: Generate Report ----------
   Simple, filterable point-in-time report over current (non-archived) cases.
   Everything shown is DERIVED from the Progress Log, never typed twice. The
   exact filters Terri wants are an open question for the requirements session. */
function reportPool() { return CLIENTS.filter(x => !isArchived(x)); }
function renderReport(c) {
  setTitle("Generate Report");
  const tab = state.reportTab || "client";
  c.innerHTML = `
    <div class="report-tabs">
      <button class="rtab${tab === "client" ? " active" : ""}" data-rtab="client">Client Report</button>
      <button class="rtab${tab === "coach" ? " active" : ""}" data-rtab="coach">Coach Report</button>
    </div>
    <div id="reportPane"></div>`;
  document.querySelectorAll(".rtab").forEach(b => b.onclick = () => { state.reportTab = b.dataset.rtab; renderReport(c); });
  (tab === "coach" ? renderCoachPane : renderClientPane)();
}
function renderClientPane() {
  const coaches = [...new Set(reportPool().map(x => x.coach))].sort();
  const statuses = ["New", "Active", "At risk", "Complete"];
  const opt = (v, label) => `<option value="${esc(v)}">${esc(label || v)}</option>`;
  el("reportPane").innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Client report filters</h3><span class="locked" style="font-style:normal">pick what to include, then generate</span></div>
      <div class="panel-body">
        <div class="report-filters">
          <label>Coach
            <select id="fCoach"><option value="">All coaches</option>${coaches.map(x => opt(x)).join("")}</select></label>
          <label>Status
            <select id="fStatus"><option value="">All statuses</option>${statuses.map(x => opt(x)).join("")}</select></label>
          <label>Service type
            <select id="fService"><option value="">All services</option>${SERVICE_TYPES.map(x => opt(x)).join("")}</select></label>
          <label>Billing
            <select id="fBilling"><option value="">All</option>${opt("ready", "Ready to bill")}${opt("progress", "In progress")}</select></label>
        </div>
        <div class="report-actions">
          <button class="btn primary" id="genReport">Generate report</button>
          <button class="btn sm" id="printReport" style="display:none">Print / Save PDF</button>
        </div>
      </div>
    </div>
    <div id="reportOut"><p class="locked" style="padding:6px 2px">Choose your filters above and click Generate report. You will get a summary and a client-by-client breakdown you can print or save as a PDF.</p></div>`;
  el("genReport").onclick = generateReport;
}
function renderCoachPane() {
  el("reportPane").innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Coach report</h3><span class="locked" style="font-style:normal">caseload and billing readiness per coach</span></div>
      <div class="panel-body">
        <div class="report-actions">
          <button class="btn primary" id="genCoach">Generate coach report</button>
          <button class="btn sm" id="printCoach" style="display:none">Print / Save PDF</button>
        </div>
      </div>
    </div>
    <div id="reportOut"><p class="locked" style="padding:6px 2px">Click Generate coach report for a per-coach summary: caseload, hours delivered, and how many cases are ready to bill.</p></div>`;
  el("genCoach").onclick = generateCoachReport;
}
function generateCoachReport() {
  const pool = reportPool();
  const coaches = [...new Set(pool.map(x => x.coach))].sort();
  const data = coaches.map(name => {
    const cs = pool.filter(x => x.coach === name);
    return { name, count: cs.length,
      hours: cs.reduce((s, x) => s + hoursDelivered(x), 0),
      auth: cs.reduce((s, x) => s + Number(x.authorizedHours || 0), 0),
      ready: cs.filter(billingReady).length,
      risk: cs.filter(x => x.status === "At risk").length };
  });
  const now = new Date();
  const stamp = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) +
    " at " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const body = data.length ? data.map(r => `
    <tr>
      <td><b>${esc(r.name)}</b></td>
      <td class="mono">${r.count}</td>
      <td class="mono">${r.hours} / ${r.auth}</td>
      <td class="mono">${r.risk}</td>
      <td>${r.ready ? '<span class="badge active">' + r.ready + ' ready</span>' : '<span class="badge warn">0 ready</span>'}</td>
    </tr>`).join("")
    : `<tr><td colspan="5" class="locked" style="padding:22px 18px">No coaches with active cases.</td></tr>`;
  el("reportOut").innerHTML = `
    <div class="report-doc">
      <div class="report-title">
        <h3>MRS Coach Report</h3>
        <span class="locked" style="font-style:normal">all coaches  •  generated ${stamp}  •  by ${state.user ? esc(state.user.name) : "-"} (${state.role})</span>
      </div>
      <div class="stat-row">
        ${stat("Coaches", data.length)}
        ${stat("Total active cases", data.reduce((s, r) => s + r.count, 0))}
        ${stat("Hours delivered", data.reduce((s, r) => s + r.hours, 0))}
        ${stat("Cases ready to bill", data.reduce((s, r) => s + r.ready, 0))}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Per-coach breakdown</h3></div>
        <div class="panel-body"><table>
          <thead><tr><th>Coach</th><th>Active cases</th><th>Hours</th><th>At risk</th><th>Billing</th></tr></thead>
          <tbody>${body}</tbody>
        </table></div>
      </div>
      <p class="locked">Point-in-time snapshot per coach, generated from the Progress Log. Prototype demo data.</p>
    </div>`;
  el("printCoach").style.display = "inline-block";
  el("printCoach").onclick = () => window.print();
  audit("Generated coach report", data.length + " coaches");
}
function generateReport() {
  const fCoach = el("fCoach").value, fStatus = el("fStatus").value,
        fService = el("fService").value, fBilling = el("fBilling").value;
  let rows = reportPool();
  if (fCoach) rows = rows.filter(x => x.coach === fCoach);
  if (fStatus) rows = rows.filter(x => x.status === fStatus);
  if (fService) rows = rows.filter(x => x.serviceType === fService);
  if (fBilling === "ready") rows = rows.filter(billingReady);
  if (fBilling === "progress") rows = rows.filter(x => !billingReady(x));

  const totHours = rows.reduce((s, x) => s + hoursDelivered(x), 0);
  const totAuth = rows.reduce((s, x) => s + Number(x.authorizedHours || 0), 0);
  const readyCt = rows.filter(billingReady).length;

  const parts = [];
  if (fCoach) parts.push("coach: " + fCoach);
  if (fStatus) parts.push("status: " + fStatus);
  if (fService) parts.push("service: " + fService);
  if (fBilling) parts.push("billing: " + (fBilling === "ready" ? "ready to bill" : "in progress"));
  const filterText = parts.length ? parts.join("  •  ") : "all current cases";
  const now = new Date();
  const stamp = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) +
    " at " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const body = rows.length ? rows.map(x => `
    <tr>
      <td><b>${esc(x.name)}</b><br><span class="locked" style="font-style:normal">${esc(x.goal)}</span></td>
      <td>${esc(x.coach)}</td>
      <td>${x.serviceType}</td>
      <td><span class="badge ${statusClass(x.status)}">${x.status}</span></td>
      <td class="mono">${hoursDelivered(x)} / ${x.authorizedHours}</td>
      <td class="mono">${pctComplete(x)}%</td>
      <td>${billingReady(x) ? '<span class="badge active">Ready to bill</span>' : '<span class="badge warn">In progress</span>'}</td>
    </tr>`).join("")
    : `<tr><td colspan="7" class="locked" style="padding:22px 18px">No clients match these filters. Try widening them.</td></tr>`;

  el("reportOut").innerHTML = `
    <div class="report-doc">
      <div class="report-title">
        <h3>MRS Client Report</h3>
        <span class="locked" style="font-style:normal">${esc(filterText)}  •  generated ${stamp}  •  by ${state.user ? esc(state.user.name) : "-"} (${state.role})</span>
      </div>
      <div class="stat-row">
        ${stat("Clients in report", rows.length)}
        ${stat("Hours delivered", totHours)}
        ${stat("Hours authorized", totAuth)}
        ${stat("Ready to bill", readyCt)}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Client breakdown</h3></div>
        <div class="panel-body"><table>
          <thead><tr><th>Client</th><th>Coach</th><th>Service</th><th>Status</th><th>Hours</th><th>Progress</th><th>Billing</th></tr></thead>
          <tbody>${body}</tbody>
        </table></div>
      </div>
      <p class="locked">Point-in-time snapshot of current cases, generated from the Progress Log. Hours, progress, and billing readiness are calculated automatically. Prototype demo data.</p>
    </div>`;
  el("printReport").style.display = "inline-block";
  el("printReport").onclick = () => window.print();
  audit("Generated report", filterText);
}

function stat(lbl, val) { return `<div class="stat"><div class="lbl">${lbl}</div><div class="val">${val}</div></div>`; }
function progressCell(x) {
  const p = pctComplete(x);
  return `<div class="bar-wrap"><div class="bar"><i style="width:${p}%"></i></div><span>${p}%</span></div>`;
}
function wireClientRows() {
  document.querySelectorAll("[data-client]").forEach(r =>
    r.onclick = () => openClient(r.dataset.client));
}

/* ---------- audit drawer ---------- */
function renderAudit() {
  el("auditList").innerHTML = AUDIT.length ? AUDIT.map(a => `
    <div class="audit-item">
      <div class="a-act">${a.action}${a.detail ? " - " + esc(a.detail) : ""}</div>
      <div class="a-meta"><span>${esc(a.user)}</span><span>${a.role}</span><span>${a.date}</span><span>${a.time}</span></div>
    </div>`).join("") : '<div class="audit-item locked">No activity yet.</div>';
}
function openDrawer() { el("drawer").classList.add("open"); el("drawerBg").classList.add("open"); }
function closeDrawer() { el("drawer").classList.remove("open"); el("drawerBg").classList.remove("open"); }

/* ---------- boot ---------- */
el("auditBtn").onclick = openDrawer;
el("drawerClose").onclick = closeDrawer;
el("drawerBg").onclick = closeDrawer;
el("logoutBtn").onclick = logout;
el("noteClose").onclick = hideNote;
el("noteBg").onclick = hideNote;
el("noteCopy").onclick = () => { if (navigator.clipboard) navigator.clipboard.writeText(el("noteBody").value); };
// Reset demo: reload the page. All demo data is seeded in memory, so a reload
// restores the clean starting state instantly.
el("resetBtn").onclick = () => location.reload();
el("resetBtnLogin").onclick = () => location.reload();
// Accessibility menu: simple modes anyone can flip on. Fitting for a disability
// services organization; the real build targets WCAG 2.1 AA throughout.
function toggleA11yMenu() { el("a11yMenu").classList.toggle("open"); }
el("a11yBtn").onclick = toggleA11yMenu;
el("a11yBtnLogin").onclick = toggleA11yMenu;
document.querySelectorAll("[data-a11y]").forEach(cb => cb.onchange = () => {
  document.body.classList.toggle(cb.dataset.a11y, cb.checked);
  if (state.role) audit("Changed accessibility setting", cb.parentElement.textContent.trim() + (cb.checked ? " on" : " off"));
});
// mobile nav dropdown
el("navToggle").onclick = () => document.querySelector(".sidebar").classList.toggle("nav-open");
renderLogin();
renderAudit();
