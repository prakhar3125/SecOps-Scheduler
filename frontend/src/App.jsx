import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS & DATA DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════

const COLORS = {
  navy: "#0D0F12",
  navyLight: "#13161B",
  navyMid: "#1A1E26",
  // Single unified accent for all teams
  accent: "#7A8FA6",
  accentDim: "#576878",
  // Shift-specific colors (A/B/C/F/Custom)
  shiftA: "#5B8A6E",    // muted green  — morning
  shiftB: "#7A6EA6",    // muted purple — afternoon
  shiftC: "#4A7A9B",    // muted steel blue — night
  shiftF: "#8A7055",    // muted amber-brown — fixed
  shiftCustom: "#6B7A8A", // slate — custom
  // Status colors
  statusWFH: "#5A7A9B",       // steel blue
  statusLeave: "#8A7A50",     // khaki gold
  statusOff: "#3A3F4A",       // dark slate
  statusWeekend: "#6A5A7A",   // muted plum
  // Utility
  white: "#E8EDF2",
  offWhite: "#C4CDD8",
  muted: "#505A68",
  mutedLight: "#68788A",
  border: "rgba(255,255,255,0.07)",
  borderBright: "rgba(255,255,255,0.13)",
  warning: "#8A7050",
  success: "#4A7A5A",
  danger: "#8A4A42",
};

// Shift color palette — keyed by team+shiftId so same letter in different teams gets different color
const SHIFT_COLORS = {
  // CSIRT shifts
  "CSIRT-A":        { bg: "#5B8A6E30", text: "#5B8A6E" },  // muted green   05:00–14:00
  "CSIRT-B":        { bg: "#7A6EA630", text: "#7A6EA6" },  // muted purple  13:00–22:00
  "CSIRT-C":        { bg: "#4A7A9B30", text: "#4A7A9B" },  // steel blue    21:00–06:00
  // ThreatMgmt shifts — different times, different hues
  "ThreatMgmt-A":   { bg: "#7A8A5830", text: "#7A8A58" },  // olive green   08:00–17:00
  "ThreatMgmt-B":   { bg: "#8A6A7A30", text: "#8A6A7A" },  // dusty rose    14:00–23:00
  // SecProjects
  "SecProjects-F":  { bg: "#8A705530", text: "#8A7055" },  // amber-brown   11:30–20:30
  // Fallbacks
  CUSTOM:           { bg: "#6B7A8A30", text: "#6B7A8A" },
};

// Helper to get the correct shift color key
function getShiftColorKey(teamKey, shiftId, isCustom) {
  if (isCustom) return "CUSTOM";
  const key = `${teamKey}-${shiftId}`;
  return SHIFT_COLORS[key] ? key : "CUSTOM";
}

// Status → color mapping
const STATUS_COLORS = {
  "On-Site":          { bg: "#5B8A6E20",             text: "#5B8A6E"   },
  "WFH":              { bg: COLORS.statusWFH+"30",   text: COLORS.statusWFH   },
  "Paid Leave":       { bg: COLORS.statusLeave+"30", text: COLORS.statusLeave },
  "Off":              { bg: COLORS.statusOff,         text: COLORS.muted       },
  "Weekend Scheduled":{ bg: COLORS.statusWeekend+"30", text: COLORS.statusWeekend },
};

const TEAM_CONFIG = {
  CSIRT: {
    label: "CSIRT",
    lead: "Harmanpreet Singh",
    color: COLORS.accent,
    colorDim: COLORS.accentDim,
    bgAlpha: "rgba(122,143,166,0.08)",
    members: [
      "Harmanpreet Singh",
      "Aditya Bharti","Arpan Thomas","Bhavit Gupta","Harshit Singh",
      "Kartikey Kishore","Mithun Chakraborty","Pranay Kumawat","Ritul Resuun",
      "Samridhi Thakral","Sanskar Tiwari","Sarthak Jain","Veeraj Kute"
    ],
    standardShifts: [
      { id:"A", label:"Shift A (5AM–2PM)",  start:"05:00", end:"14:00", startH:5,  endH:14 },
      { id:"B", label:"Shift B (1PM–10PM)", start:"13:00", end:"22:00", startH:13, endH:22 },
      { id:"C", label:"Shift C (9PM–6AM)",  start:"21:00", end:"06:00", startH:21, endH:30 },
    ],
    minCoverage: 2,
    handoverWindows: [
      { start: 5,  end: 6,  label:"C→A Handover" },
      { start: 13, end: 14, label:"A→B Handover" },
      { start: 21, end: 22, label:"B→C Handover" },
    ]
  },
  ThreatMgmt: {
    label: "Threat Management",
    lead: "Saurav Singh",
    color: COLORS.accent,
    colorDim: COLORS.accentDim,
    bgAlpha: "rgba(122,143,166,0.08)",
    members: [
      "Saurav Singh",
      "Manav Nathani","Sameer Chugh","Subham Agarwal"
    ],
    standardShifts: [
      { id:"A", label:"Shift A (8AM–5PM)",  start:"08:00", end:"17:00", startH:8,  endH:17 },
      { id:"B", label:"Shift B (2PM–11PM)", start:"14:00", end:"23:00", startH:14, endH:23 },
    ],
    minCoverage: 1,
    handoverWindows: [{ start: 14, end: 15, label:"A→B Handover" }]
  },
  SecProjects: {
    label: "Security Projects",
    lead: "Manveer Goura",
    color: COLORS.accent,
    colorDim: COLORS.accentDim,
    bgAlpha: "rgba(122,143,166,0.08)",
    members: [
      "Manveer Goura",
      "Anushka Bajpyee","Aditya Goyal","Prakhar Sinha"
    ],
    standardShifts: [
      { id:"F", label:"Fixed (11:30AM–8:30PM)", start:"11:30", end:"20:30", startH:11.5, endH:20.5 },
    ],
    minCoverage: 1,
    handoverWindows: []
  }
};

// Set of all lead names for quick lookup
const LEAD_NAMES = new Set(Object.values(TEAM_CONFIG).map(t => t.lead));

const MODIFIERS = ["On-Site","WFH","Paid Leave","Off","Weekend Scheduled"];
const MODIFIER_COLORS = {
  "On-Site":           COLORS.shiftA,
  "WFH":               COLORS.statusWFH,
  "Paid Leave":        COLORS.statusLeave,
  "Off":               COLORS.muted,
  "Weekend Scheduled": COLORS.statusWeekend,
};

const ROLES = { ADMIN: "ADMIN", LEAD: "LEAD", MEMBER: "MEMBER" };

const USERS = [
  { id:"admin", name:"Admin", role: ROLES.ADMIN, team: null, password:"admin123" },
  { id:"harman", name:"Harmanpreet Singh", role: ROLES.LEAD, team:"CSIRT", password:"lead123" },
  { id:"saurav", name:"Saurav Singh", role: ROLES.LEAD, team:"ThreatMgmt", password:"lead123" },
  { id:"manveer", name:"Manveer Goura", role: ROLES.LEAD, team:"SecProjects", password:"lead123" },
  { id:"member", name:"Aditya Bharti", role: ROLES.MEMBER, team:"CSIRT", password:"member123" },
];

// ════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function timeToHours(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h + m / 60;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getDayOfWeek(year, month, day) {
  return new Date(year, month, day).getDay();
}

function getMonthName(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getInitials(name) {
  return name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
}

function generateSchedule(year, month) {
  const schedule = {};
  const days = getDaysInMonth(year, month);
  Object.entries(TEAM_CONFIG).forEach(([teamKey, team]) => {
    team.members.forEach((member, mIdx) => {
      schedule[member] = {};
      for (let d = 1; d <= days; d++) {
        const dow = getDayOfWeek(year, month, d);
        const isWeekend = dow === 0 || dow === 6;
        const shiftIdx = (mIdx * 3 + Math.floor(d / 3)) % team.standardShifts.length;
        const shift = team.standardShifts[shiftIdx];
        let modifier = "On-Site";
        if (isWeekend) modifier = Math.random() > 0.55 ? "Off" : "Weekend Scheduled";
        else if (Math.random() > 0.93) modifier = "Paid Leave";
        else if (Math.random() > 0.88) modifier = "WFH";
        schedule[member][d] = {
          shift: modifier === "Off" || modifier === "Paid Leave" ? null : { ...shift },
          modifier,
          team: teamKey,
          note: ""
        };
      }
    });
  });
  return schedule;
}

function calcMemberHours(memberSchedule) {
  return Object.values(memberSchedule).reduce((sum, day) => {
    if (!day?.shift || day.modifier === "Off" || day.modifier === "Paid Leave") return sum;
    const s = day.shift;
    const start = timeToHours(s.start);
    let end = timeToHours(s.end);
    if (end < start) end += 24;
    return sum + (end - start);
  }, 0);
}

function calcNightShifts(memberSchedule) {
  return Object.values(memberSchedule).filter(d => d?.shift?.id === "C").length;
}

function calcWeekends(memberSchedule, year, month) {
  return Object.entries(memberSchedule).filter(([d, day]) => {
    const dow = getDayOfWeek(year, month, parseInt(d));
    return (dow === 0 || dow === 6) && day?.modifier === "Weekend Scheduled";
  }).length;
}

function calcLeaveDays(memberSchedule) {
  return Object.values(memberSchedule).filter(d => d?.modifier === "Paid Leave").length;
}

// ════════════════════════════════════════════════════════════════════════════
// CSS STYLES
// ════════════════════════════════════════════════════════════════════════════

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Exo+2:wght@300;400;600;800;900&display=swap');

*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}

:root{
  --navy:#0D0F12;
  --navy-l:#13161B;
  --navy-m:#1A1E26;
  --accent:#7A8FA6;
  --accent-d:#576878;
  --white:#E8EDF2;
  --off:#C4CDD8;
  --muted:#505A68;
  --muted-l:#68788A;
  --border:rgba(255,255,255,0.07);
  --border-b:rgba(255,255,255,0.13);
  --warn:#8A7050;
  --success:#4A7A5A;
  /* shift colors */
  --shift-a:#5B8A6E;
  --shift-b:#7A6EA6;
  --shift-c:#4A7A9B;
  --shift-f:#8A7055;
  --shift-x:#6B7A8A;
  /* status colors */
  --status-wfh:#5A7A9B;
  --status-pl:#8A7A50;
  --status-off:#3A3F4A;
  --status-wknd:#6A5A7A;
}

html,body,#root{height:100%;background:var(--navy);}

.app{
  min-height:100vh;
  background:var(--navy);
  font-family:'DM Mono',monospace;
  color:var(--white);
  display:flex;
  flex-direction:column;
  align-items:center;
}

/* ── LOGIN ── */
.login-wrap{
  min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:var(--navy);
}
.login-card{
  width:400px;padding:48px 40px;
  background:var(--navy-l);
  border:1px solid var(--border-b);
  border-radius:16px;
  box-shadow:0 24px 48px rgba(0,0,0,0.5);
}
.login-logo{
  width:52px;height:52px;border-radius:12px;margin:0 auto 24px;
  background:var(--navy-m);
  border:1px solid var(--border-b);
  display:flex;align-items:center;justify-content:center;
  font-size:24px;
}
.login-title{
  font-family:'Exo 2',sans-serif;font-size:20px;font-weight:800;
  text-align:center;color:var(--white);letter-spacing:0.04em;margin-bottom:6px;
}
.login-sub{text-align:center;font-size:11px;color:var(--muted);margin-bottom:32px;letter-spacing:0.1em;}
.login-field{margin-bottom:16px;}
.login-label{font-size:10px;color:var(--muted-l);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;display:block;}
.login-input{
  width:100%;padding:12px 14px;
  background:var(--navy);
  border:1px solid var(--border-b);border-radius:7px;
  color:var(--white);font-family:'DM Mono',monospace;font-size:13px;
  outline:none;transition:border-color 0.2s;
}
.login-input:focus{border-color:var(--accent);}
.login-btn{
  width:100%;padding:13px;margin-top:8px;
  background:var(--accent);
  border:none;border-radius:8px;
  font-family:'Exo 2',sans-serif;font-size:13px;font-weight:700;
  color:var(--navy);letter-spacing:0.06em;cursor:pointer;
  transition:background 0.2s;
}
.login-btn:hover{background:var(--accent-d);}
.login-demo{margin-top:20px;padding:14px;background:var(--navy);border:1px solid var(--border);border-radius:8px;}
.login-demo-title{font-size:10px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;}
.login-demo-row{display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;}
.login-demo-label{color:var(--muted-l);}
.login-demo-val{color:var(--accent);}
.login-error{background:rgba(191,90,80,0.12);border:1px solid rgba(122,143,166,0.3);border-radius:6px;padding:10px 12px;font-size:11px;color:#c87c74;margin-bottom:16px;}

/* ── HEADER ── */
.header{
  display:flex;align-items:stretch;
  width:100%;
  background:var(--navy-l);
  border-bottom:1px solid var(--border);
  position:sticky;top:0;z-index:100;
}
.header-inner{
  display:flex;align-items:center;justify-content:space-between;
  width:100%;max-width:1800px;margin:0 auto;
  padding:13px 28px;
}
.header-brand{display:flex;align-items:center;gap:14px;}
.brand-icon{
  width:36px;height:36px;border-radius:9px;
  background:var(--navy-m);
  border:1px solid var(--border-b);
  display:flex;align-items:center;justify-content:center;font-size:17px;
  flex-shrink:0;
}
.brand-name{font-family:'Exo 2',sans-serif;font-size:15px;font-weight:800;letter-spacing:0.05em;color:var(--white);}
.brand-sub{font-size:9px;color:var(--muted);letter-spacing:0.16em;text-transform:uppercase;margin-top:2px;}
.header-center{display:flex;align-items:center;gap:8px;}
.month-nav-btn{
  width:28px;height:28px;border-radius:6px;border:1px solid var(--border);
  background:transparent;color:var(--muted-l);cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:15px;
  transition:all 0.15s;
}
.month-nav-btn:hover{background:var(--navy-m);border-color:var(--border-b);color:var(--off);}
.month-label{
  font-family:'Exo 2',sans-serif;font-size:13px;font-weight:700;
  color:var(--white);min-width:160px;text-align:center;letter-spacing:0.04em;
}
.header-right{display:flex;align-items:center;gap:12px;}
.live-dot{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted-l);letter-spacing:0.08em;}
.pulse{width:6px;height:6px;border-radius:50%;background:var(--success);animation:pulse 3s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
.clock{font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;}
.user-chip{
  display:flex;align-items:center;gap:8px;
  padding:6px 12px;border-radius:7px;
  background:var(--navy-m);border:1px solid var(--border);
  cursor:pointer;transition:border-color 0.15s;
}
.user-chip:hover{border-color:var(--border-b);}
.user-avatar{
  width:26px;height:26px;border-radius:6px;
  background:var(--navy-l);border:1px solid var(--border-b);
  display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;color:var(--accent);
}
.user-name{font-size:11px;color:var(--off);}
.user-role{font-size:9px;color:var(--muted);letter-spacing:0.08em;}
.logout-btn{
  padding:6px 13px;border-radius:6px;border:1px solid var(--border);
  background:transparent;color:var(--muted-l);
  font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;
  transition:all 0.15s;
}
.logout-btn:hover{border-color:rgba(122,143,166,0.4);color:var(--accent);}

/* ── NAV ── */
.nav{
  display:flex;align-items:stretch;
  width:100%;
  background:var(--navy-l);
  border-bottom:1px solid var(--border);
}
.nav-inner{
  display:flex;gap:2px;
  width:100%;max-width:1800px;margin:0 auto;
  padding:8px 28px;
  overflow-x:auto;
}
.nav-btn{
  padding:7px 16px;border-radius:6px;border:none;
  font-family:'DM Mono',monospace;font-size:11px;font-weight:500;
  cursor:pointer;transition:all 0.15s;white-space:nowrap;
  background:transparent;color:var(--muted);letter-spacing:0.04em;
}
.nav-btn:hover{background:var(--navy-m);color:var(--off);}
.nav-btn.active{background:var(--navy-m);color:var(--accent);border:1px solid var(--border-b);}
.nav-badge{
  display:inline-block;background:var(--accent);color:var(--white);
  border-radius:10px;padding:1px 6px;font-size:9px;margin-left:6px;
}

/* ── MAIN ── */
.main{
  width:100%;max-width:1800px;
  padding:22px 28px;
  box-sizing:border-box;
}

/* ── STAT CARDS ── */
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:22px;}
.stat-card{
  background:var(--navy-l);
  border:1px solid var(--border);border-radius:10px;
  padding:16px;position:relative;overflow:hidden;
  transition:border-color 0.2s;
}
.stat-card:hover{border-color:var(--border-b);}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;opacity:0.7;}
.stat-card.c-cyan::before{background:var(--accent);}
.stat-card.c-coral::before{background:var(--accent);}
.stat-card.c-warn::before{background:var(--warn);}
.stat-card.c-green::before{background:var(--success);}
.stat-card.c-muted::before{background:var(--muted);}
.stat-label{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.14em;margin-bottom:10px;}
.stat-value{font-family:'Exo 2',sans-serif;font-size:28px;font-weight:900;line-height:1;}
.stat-sub{font-size:10px;color:var(--muted);margin-top:6px;}
.stat-glyph{position:absolute;right:14px;top:14px;font-size:20px;opacity:0.1;}

/* ── SECTION HEADER ── */
.sec-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;}
.sec-title{font-family:'Exo 2',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--off);}
.sec-badge{
  font-size:10px;color:var(--muted);
  background:var(--navy-m);
  border:1px solid var(--border);padding:3px 10px;border-radius:20px;
}

/* ── CONTROL BAR ── */
.control-bar{
  display:flex;gap:6px;align-items:center;flex-wrap:wrap;
  padding:10px 14px;margin-bottom:18px;
  background:var(--navy-l);border:1px solid var(--border);
  border-radius:9px;
}
.control-label{font-size:10px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;white-space:nowrap;}
.ctrl-btn{
  padding:5px 12px;border-radius:5px;border:1px solid var(--border);
  background:transparent;color:var(--muted);
  font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;
  transition:all 0.14s;white-space:nowrap;
}
.ctrl-btn:hover{border-color:var(--border-b);color:var(--off);background:var(--navy-m);}
.ctrl-btn.active-all{background:var(--navy-m);color:var(--off);border-color:var(--border-b);}
.ctrl-btn.active-cyan{background:rgba(122,143,166,0.15);color:var(--accent);border-color:rgba(122,143,166,0.3);}
.ctrl-btn.active-blue{background:rgba(122,143,166,0.15);color:var(--accent);border-color:rgba(122,143,166,0.3);}
.ctrl-btn.active-coral{background:rgba(122,143,166,0.15);color:var(--accent);border-color:rgba(122,143,166,0.3);}
.ctrl-btn.active-warn{background:rgba(184,134,11,0.15);color:var(--warn);border-color:rgba(184,134,11,0.3);}
.ctrl-btn.active-red{background:rgba(122,143,166,0.15);color:var(--accent);border-color:rgba(122,143,166,0.3);}
.ctrl-sep{width:1px;height:22px;background:var(--border);margin:0 2px;}
select.ctrl-select{
  background:var(--navy);border:1px solid var(--border);
  color:var(--off);padding:5px 10px;border-radius:5px;
  font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;
}

/* ── LIVE STATUS ── */
.live-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin-bottom:24px;}
.live-card{
  background:var(--navy-l);border:1px solid var(--border);border-radius:9px;
  padding:12px 14px;display:flex;align-items:center;gap:11px;
  transition:border-color 0.2s;cursor:default;
}
.live-card:hover{border-color:var(--border-b);}
.live-card.is-active{border-color:rgba(122,143,166,0.2);}
.live-card.is-lead{border-color:rgba(122,143,166,0.3);background:rgba(122,143,166,0.04);}
.avatar{
  width:34px;height:34px;border-radius:7px;display:flex;align-items:center;
  justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;
  font-family:'Exo 2',sans-serif;
}
.live-info{flex:1;min-width:0;}
.live-name{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--off);}
.live-sub{font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:0.05em;}
.live-badge{
  font-size:9px;padding:3px 7px;border-radius:4px;
  font-weight:600;letter-spacing:0.05em;white-space:nowrap;font-family:'Exo 2',sans-serif;
}

/* ── SCHEDULE TABLE ── */
.cal-wrap{
  background:var(--navy-l);border:1px solid var(--border);
  border-radius:12px;overflow:hidden;margin-bottom:24px;
}
.cal-top{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;background:var(--navy-m);
  border-bottom:1px solid var(--border);flex-wrap:wrap;gap:10px;
}
.cal-legend{display:flex;gap:12px;flex-wrap:wrap;}
.legend-item{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--muted);}
.legend-dot{width:7px;height:7px;border-radius:2px;flex-shrink:0;}
.tbl-wrap{overflow-x:auto;}
.sched-table{width:100%;border-collapse:collapse;min-width:1000px;}
.sched-table th{
  padding:7px 4px;text-align:center;font-weight:500;color:var(--muted);
  border-bottom:1px solid var(--border);white-space:nowrap;
  font-family:'DM Mono',monospace;font-size:10px;
  background:var(--navy-m);
}
.sched-table th.th-member{
  text-align:left;padding-left:14px;
  position:sticky;left:0;z-index:5;
  min-width:190px;background:var(--navy-m);
}
.sched-table th.today-th{color:var(--accent);}
.sched-table td{padding:2px 3px;border-bottom:1px solid rgba(255,255,255,0.03);}
.team-row-header td{
  padding:7px 14px;font-size:10px;font-weight:700;
  letter-spacing:0.1em;text-transform:uppercase;
}
.member-td{
  display:flex;align-items:center;gap:9px;padding:7px 14px;
  position:sticky;left:0;z-index:2;
  background:var(--navy-l);border-right:1px solid var(--border);
  min-width:190px;
}
.member-name-sm{font-size:11px;font-weight:500;color:var(--off);}
.member-team-sm{font-size:9px;margin-top:1px;}
.shift-td{text-align:center;cursor:pointer;}
.shift-chip{
  display:inline-flex;align-items:center;justify-content:center;
  width:30px;height:22px;border-radius:4px;font-size:9px;font-weight:700;
  transition:opacity 0.15s;font-family:'Exo 2',sans-serif;letter-spacing:0.03em;
}
.shift-chip:hover{opacity:0.75;}
.today-td{background:rgba(122,143,166,0.04);}
.weekend-td{background:rgba(255,255,255,0.01);}

/* ── EDIT MODAL ── */
.modal-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:300;
  display:flex;align-items:center;justify-content:center;
  animation:fadeIn 0.15s ease;
}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal{
  background:var(--navy-l);
  border:1px solid var(--border-b);border-radius:14px;
  padding:28px;width:420px;max-width:96vw;max-height:90vh;overflow-y:auto;
  box-shadow:0 32px 64px rgba(0,0,0,0.6);
  animation:slideUp 0.18s ease;
}
@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
.modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.modal-title{font-family:'Exo 2',sans-serif;font-size:16px;font-weight:800;color:var(--white);}
.modal-close-x{
  width:28px;height:28px;border-radius:6px;border:1px solid var(--border);
  background:transparent;color:var(--muted);cursor:pointer;font-size:17px;
  display:flex;align-items:center;justify-content:center;transition:all 0.15s;
}
.modal-close-x:hover{background:var(--navy-m);color:var(--off);border-color:var(--border-b);}
.modal-sub{font-size:11px;color:var(--muted);margin-bottom:18px;display:flex;gap:12px;flex-wrap:wrap;}
.modal-sub span{display:flex;align-items:center;gap:5px;}
.modal-section{margin-bottom:16px;}
.modal-label{font-size:10px;color:var(--muted-l);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:7px;display:block;}
.toggle-row{display:flex;border:1px solid var(--border);border-radius:7px;overflow:hidden;margin-bottom:14px;}
.toggle-opt{
  flex:1;padding:9px;text-align:center;cursor:pointer;
  font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);
  transition:all 0.14s;border:none;background:transparent;
}
.toggle-opt.sel{background:var(--navy-m);color:var(--accent);font-weight:500;}
.modal-select{
  width:100%;padding:10px 13px;
  background:var(--navy);border:1px solid var(--border-b);border-radius:7px;
  color:var(--white);font-family:'DM Mono',monospace;font-size:12px;
  outline:none;transition:border-color 0.2s;
}
.modal-select:focus{border-color:var(--accent);}
.time-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;}
.time-field label{font-size:10px;color:var(--muted);display:block;margin-bottom:5px;}
.time-input{
  width:100%;padding:10px 12px;
  background:var(--navy);border:1px solid var(--border-b);border-radius:6px;
  color:var(--white);font-family:'DM Mono',monospace;font-size:13px;
  outline:none;transition:border-color 0.2s;
}
.time-input:focus{border-color:var(--accent);}
.modifier-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:5px;}
.mod-btn{
  padding:8px 6px;border-radius:6px;border:1px solid var(--border);
  background:transparent;font-family:'DM Mono',monospace;font-size:10px;
  cursor:pointer;color:var(--muted);transition:all 0.14s;text-align:center;
}
.mod-btn:hover{border-color:var(--border-b);color:var(--off);background:var(--navy-m);}
.mod-btn.sel{border-color:var(--accent);color:var(--accent);background:rgba(122,143,166,0.1);}
.note-input{
  width:100%;padding:10px 12px;
  background:var(--navy);border:1px solid var(--border-b);border-radius:6px;
  color:var(--off);font-family:'DM Mono',monospace;font-size:11px;
  outline:none;resize:vertical;min-height:60px;
}
.modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:20px;}
.btn-save{
  padding:11px;border-radius:8px;border:none;
  background:var(--accent);
  font-family:'Exo 2',sans-serif;font-size:13px;font-weight:700;
  color:var(--navy);cursor:pointer;letter-spacing:0.05em;
  transition:background 0.18s;
}
.btn-save:hover{background:var(--accent-d);}
.btn-cancel{
  padding:11px;border-radius:8px;border:1px solid var(--border);
  background:transparent;color:var(--muted);
  font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;
  transition:all 0.14s;
}
.btn-cancel:hover{border-color:var(--border-b);color:var(--off);background:var(--navy-m);}
.btn-clear{
  padding:11px;border-radius:8px;border:1px solid rgba(122,143,166,0.25);
  background:transparent;color:var(--accent);
  font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;
  transition:all 0.14s;grid-column:span 2;
}
.btn-clear:hover{background:rgba(122,143,166,0.1);}

/* ── TIMELINE ── */
.tl-wrap{background:var(--navy-l);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:24px;}
.tl-hours{display:flex;padding-left:170px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;}
.tl-hour{flex:1;font-size:9px;color:var(--muted);text-align:center;}
.tl-row{display:flex;align-items:center;margin-bottom:6px;}
.tl-label{width:170px;font-size:10px;color:var(--muted-l);flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:12px;}
.tl-bar-wrap{flex:1;height:22px;background:var(--navy-m);border-radius:4px;position:relative;overflow:hidden;}
.tl-bar{position:absolute;top:3px;height:16px;border-radius:3px;display:flex;align-items:center;padding:0 7px;font-size:9px;font-weight:600;overflow:hidden;white-space:nowrap;border-left:2px solid;}
.tl-group-lbl{font-family:'Exo 2',sans-serif;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;padding:8px 0 4px;}
.tl-now{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.25);z-index:2;}

/* ── METRICS ── */
.metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px;}
.metric-card{background:var(--navy-l);border:1px solid var(--border);border-radius:10px;padding:18px;}
.metric-title{font-family:'Exo 2',sans-serif;font-size:12px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px;color:var(--off);}
.eq-row{display:flex;align-items:center;gap:10px;margin-bottom:7px;}
.eq-name{font-size:11px;width:130px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--off);}
.eq-bar-wrap{flex:1;height:6px;background:var(--navy-m);border-radius:3px;overflow:hidden;}
.eq-bar{height:100%;border-radius:3px;transition:width 0.5s;}
.eq-val{font-size:10px;color:var(--muted);width:42px;text-align:right;}
.table-mini{width:100%;border-collapse:collapse;font-size:11px;}
.table-mini th{padding:6px 10px;text-align:left;font-size:9px;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid var(--border);}
.table-mini td{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.03);}
.table-mini tr:last-child td{border-bottom:none;}
.table-mini tr:hover td{background:rgba(255,255,255,0.02);}
.sort-btn{cursor:pointer;user-select:none;}
.sort-btn:hover{color:var(--accent);}

/* ── AUDIT LOG ── */
.audit-wrap{background:var(--navy-l);border:1px solid var(--border);border-radius:12px;overflow:hidden;}
.audit-item{
  display:flex;gap:14px;padding:12px 16px;
  border-bottom:1px solid rgba(255,255,255,0.04);
  transition:background 0.14s;
}
.audit-item:hover{background:rgba(255,255,255,0.02);}
.audit-item:last-child{border-bottom:none;}
.audit-time{font-size:10px;color:var(--muted);white-space:nowrap;padding-top:1px;}
.audit-icon{font-size:13px;flex-shrink:0;}
.audit-content{flex:1;}
.audit-msg{font-size:11px;color:var(--off);}
.audit-detail{font-size:10px;color:var(--muted);margin-top:3px;}
.audit-reason{font-size:10px;color:var(--accent);margin-top:2px;}

/* ── SHARE ── */
.share-wrap{background:var(--navy-l);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:22px;}
.url-row{display:flex;gap:8px;margin-bottom:9px;align-items:center;}
.url-label{font-size:10px;color:var(--muted);width:100px;flex-shrink:0;letter-spacing:0.05em;}
.url-box{flex:1;background:var(--navy);border:1px solid var(--border);border-radius:5px;padding:8px 12px;font-size:11px;color:var(--accent);font-family:'DM Mono',monospace;}
.copy-btn{padding:7px 13px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all 0.14s;white-space:nowrap;}
.copy-btn:hover{background:var(--navy-m);color:var(--off);border-color:var(--border-b);}
.copy-btn.done{color:var(--success);border-color:rgba(74,140,106,0.35);}

/* ── MASS OVERRIDE MODAL ── */

.btn-emergency{
  padding:11px 22px;border-radius:8px;border:1px solid rgba(191,90,80,0.35);
  background:rgba(122,143,166,0.1);color:var(--accent);
  font-family:'Exo 2',sans-serif;font-size:13px;font-weight:700;
  cursor:pointer;transition:all 0.18s;letter-spacing:0.05em;
}
.btn-emergency:hover{background:rgba(122,143,166,0.2);}
.btn-primary{
  padding:11px 22px;border-radius:8px;border:none;
  background:var(--accent);
  color:var(--navy);font-family:'Exo 2',sans-serif;font-size:13px;font-weight:700;
  cursor:pointer;transition:background 0.18s;letter-spacing:0.05em;
}
.btn-primary:hover{background:var(--accent-d);}

/* ── HANDOVER ALERT ── */
.handover-alerts{margin-bottom:18px;}
.handover-alert{
  display:flex;gap:12px;padding:11px 15px;border-radius:8px;
  margin-bottom:7px;align-items:flex-start;
}
.handover-alert.risk{background:rgba(122,143,166,0.08);border:1px solid rgba(122,143,166,0.25);}
.handover-alert.ok{background:rgba(74,140,106,0.07);border:1px solid rgba(74,140,106,0.2);}
.ha-icon{font-size:15px;flex-shrink:0;padding-top:1px;}
.ha-title{font-size:12px;font-weight:600;color:var(--off);margin-bottom:2px;}
.ha-sub{font-size:10px;color:var(--muted);}

/* ── SCROLLBAR ── */
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}

/* ── CONFLICT CHIP ── */
.conflict-banner{
  display:flex;align-items:center;gap:8px;padding:10px 13px;
  background:rgba(122,143,166,0.08);border:1px solid rgba(122,143,166,0.22);
  border-radius:7px;margin-bottom:14px;font-size:11px;color:#c87c74;
}

/* ── RBAC BANNER ── */
.rbac-banner{
  padding:10px 16px;background:rgba(184,134,11,0.07);
  border-bottom:1px solid rgba(184,134,11,0.18);
  font-size:11px;color:var(--warn);text-align:center;letter-spacing:0.06em;
}

/* ── NO DATA ── */
.no-data{padding:40px;text-align:center;color:var(--muted);font-size:12px;}

/* ── VIEW RANGE SELECTOR ── */
.range-bar{
  display:flex;align-items:center;gap:6px;
  padding:9px 14px;
  background:var(--navy-l);
  border:1px solid var(--border);
  border-radius:9px;
  margin-bottom:12px;
  flex-wrap:wrap;
}
.range-label{font-size:10px;color:var(--muted);letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap;margin-right:4px;}
.range-seg{
  display:flex;border:1px solid var(--border);border-radius:7px;overflow:hidden;flex-shrink:0;
}
.range-btn{
  padding:6px 15px;background:transparent;border:none;
  font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);
  cursor:pointer;transition:all 0.14s;white-space:nowrap;
  border-right:1px solid var(--border);
}
.range-btn:last-child{border-right:none;}
.range-btn:hover{background:var(--navy-m);color:var(--off);}
.range-btn.active{
  background:var(--navy-m);color:var(--accent);
  font-weight:500;
}
.week-nav{display:flex;align-items:center;gap:6px;margin-left:auto;}
.week-nav-btn{
  width:26px;height:26px;border-radius:5px;border:1px solid var(--border);
  background:transparent;color:var(--muted-l);cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  font-size:14px;transition:all 0.14s;flex-shrink:0;
}
.week-nav-btn:hover{background:var(--navy-m);border-color:var(--border-b);color:var(--off);}
.week-nav-btn:disabled{opacity:0.25;cursor:not-allowed;}
.week-range-label{
  font-size:11px;color:var(--off);white-space:nowrap;
  font-family:'DM Mono',monospace;min-width:130px;text-align:center;
}
.range-today-btn{
  padding:5px 11px;border-radius:5px;border:1px solid var(--border);
  background:transparent;color:var(--muted);
  font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;
  transition:all 0.14s;white-space:nowrap;
}
.range-today-btn:hover{background:var(--navy-m);color:var(--off);border-color:var(--border-b);}

/* ── BULK ASSIGN DRAWER ── */
.bulk-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:400;
  display:flex;justify-content:flex-end;
  animation:fadeIn 0.15s ease;
}
.bulk-drawer{
  width:min(620px,100vw);height:100vh;
  background:var(--navy-l);
  border-left:1px solid var(--border-b);
  display:flex;flex-direction:column;
  animation:slideRight 0.22s cubic-bezier(0.16,1,0.3,1);
  box-shadow:-24px 0 48px rgba(0,0,0,0.4);
}
@keyframes slideRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
.bulk-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 22px;border-bottom:1px solid var(--border);
  flex-shrink:0;
}
.bulk-title{font-family:'Exo 2',sans-serif;font-size:16px;font-weight:800;color:var(--white);}
.bulk-sub{font-size:11px;color:var(--muted);margin-top:2px;}
.bulk-body{flex:1;overflow-y:auto;padding:18px 22px;display:flex;flex-direction:column;gap:16px;}
.bulk-section{background:var(--navy-m);border:1px solid var(--border);border-radius:9px;padding:14px;}
.bulk-section-title{
  font-family:'Exo 2',sans-serif;font-size:11px;font-weight:700;
  color:var(--muted-l);letter-spacing:0.12em;text-transform:uppercase;
  margin-bottom:11px;display:flex;align-items:center;gap:6px;
}
.bulk-section-title span{font-size:13px;}
.member-list{display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto;}
.member-check-row{
  display:flex;align-items:center;gap:10px;padding:7px 10px;
  border-radius:6px;cursor:pointer;transition:background 0.12s;
  border:1px solid transparent;
}
.member-check-row:hover{background:rgba(255,255,255,0.04);border-color:var(--border);}
.member-check-row.checked{background:rgba(122,143,166,0.08);border-color:rgba(122,143,166,0.2);}
.member-check-row input[type=checkbox]{
  width:14px;height:14px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;
}
.member-check-name{font-size:12px;color:var(--off);flex:1;}
.member-check-team{font-size:10px;margin-left:auto;padding:1px 7px;border-radius:3px;font-weight:600;}
.select-all-row{
  display:flex;align-items:center;gap:10px;padding:7px 10px;
  border-radius:6px;cursor:pointer;
  border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:7px;
}
.select-all-row label{font-size:11px;color:var(--muted-l);cursor:pointer;letter-spacing:0.04em;}
.team-filter-pills{display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap;}
.team-pill{
  padding:4px 11px;border-radius:20px;border:1px solid var(--border);
  background:transparent;font-family:'DM Mono',monospace;font-size:10px;
  color:var(--muted);cursor:pointer;transition:all 0.12s;
}
.team-pill:hover{border-color:var(--border-b);color:var(--off);}
.team-pill.active{color:var(--navy);font-weight:600;}
.shift-selector-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}
.shift-option{
  padding:10px 12px;border-radius:7px;border:1px solid var(--border);
  background:transparent;cursor:pointer;transition:all 0.13s;text-align:left;
}
.shift-option:hover{border-color:var(--border-b);background:rgba(255,255,255,0.03);}
.shift-option.sel{border-color:var(--accent);background:rgba(122,143,166,0.1);}
.shift-option-id{font-family:'Exo 2',sans-serif;font-size:14px;font-weight:800;color:var(--accent);}
.shift-option-label{font-size:10px;color:var(--muted);margin-top:2px;}
.shift-option-time{font-size:11px;color:var(--off);margin-top:3px;font-family:'DM Mono',monospace;}
.modifier-chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;}
.mod-chip{
  padding:5px 13px;border-radius:20px;border:1px solid var(--border);
  background:transparent;font-family:'DM Mono',monospace;font-size:11px;
  color:var(--muted);cursor:pointer;transition:all 0.12s;
}
.mod-chip:hover{border-color:var(--border-b);color:var(--off);}
.mod-chip.sel{color:var(--navy);font-weight:600;}
.date-range-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px;}
.date-field label{font-size:10px;color:var(--muted);display:block;margin-bottom:5px;letter-spacing:0.08em;}
.date-input{
  width:100%;padding:9px 11px;
  background:var(--navy);border:1px solid var(--border-b);border-radius:6px;
  color:var(--off);font-family:'DM Mono',monospace;font-size:12px;outline:none;
  transition:border-color 0.14s;
}
.date-input:focus{border-color:var(--accent);}
.skip-weekends-row{
  display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;
}
.skip-weekends-row label{font-size:12px;color:var(--off);cursor:pointer;}
.toggle-switch{
  width:36px;height:19px;border-radius:10px;
  background:var(--navy-m);border:1px solid var(--border);
  position:relative;cursor:pointer;transition:background 0.15s;flex-shrink:0;
}
.toggle-switch.on{background:var(--accent);border-color:var(--accent);}
.toggle-knob{
  position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;
  background:var(--white);transition:transform 0.15s;
}
.toggle-switch.on .toggle-knob{transform:translateX(17px);}
.bulk-footer{
  flex-shrink:0;padding:14px 22px;border-top:1px solid var(--border);
  background:var(--navy-m);
}
.preflight-box{
  background:rgba(122,143,166,0.07);border:1px solid rgba(122,143,166,0.1);
  border-radius:7px;padding:11px 13px;margin-bottom:11px;
}
.preflight-count{
  font-family:'Exo 2',sans-serif;font-size:15px;font-weight:800;
  color:var(--accent);margin-bottom:4px;
}
.preflight-detail{font-size:11px;color:var(--muted-l);line-height:1.6;}
.clash-box{
  background:rgba(184,134,11,0.07);border:1px solid rgba(184,134,11,0.22);
  border-radius:7px;padding:9px 13px;margin-bottom:11px;
  max-height:90px;overflow-y:auto;
}
.clash-title{font-size:10px;color:var(--warn);font-weight:600;margin-bottom:5px;letter-spacing:0.08em;}
.clash-row{font-size:10px;color:var(--off);padding:2px 0;display:flex;gap:8px;}
.clash-row span{color:var(--warn);}
.bulk-apply-btn{
  width:100%;padding:13px;border-radius:9px;border:none;
  background:var(--accent);
  font-family:'Exo 2',sans-serif;font-size:13px;font-weight:800;
  color:var(--navy);cursor:pointer;letter-spacing:0.06em;
  transition:background 0.18s;
}
.bulk-apply-btn:hover{background:var(--accent-d);}
.bulk-apply-btn:disabled{opacity:0.35;cursor:not-allowed;}
.bulk-apply-btn.done{background:var(--success);color:var(--white);}
.bulk-nav-btn{
  display:flex;align-items:center;gap:7px;
  padding:6px 14px;border-radius:7px;border:1px solid var(--border-b);
  background:var(--navy-m);color:var(--accent);
  font-family:'Exo 2',sans-serif;font-size:12px;font-weight:700;
  cursor:pointer;transition:all 0.14s;letter-spacing:0.05em;white-space:nowrap;
}
.bulk-nav-btn:hover{background:rgba(122,143,166,0.1);}

/* ── GROUP BY SHIFT STYLES ── */
.shift-group-header{
  display:flex;align-items:center;gap:12px;
  padding:7px 13px;margin-bottom:7px;margin-top:14px;
  border-radius:7px;
}
.shift-group-title{font-family:'Exo 2',sans-serif;font-size:12px;font-weight:800;letter-spacing:0.06em;}
.shift-group-badge{
  font-size:10px;padding:2px 8px;border-radius:12px;
  font-weight:600;letter-spacing:0.05em;
}
.grouped-live-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:7px;margin-bottom:4px;}

/* ── DAY HEADER EXPANDED ── */
.day-header-full{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 2px;}
.day-header-dow{font-size:9px;letter-spacing:0.06em;opacity:0.5;text-transform:uppercase;}
.day-header-num{font-size:13px;font-weight:700;font-family:'Exo 2',sans-serif;}
.day-header-month{font-size:8px;opacity:0.4;}
.today-th-circle .day-header-num{
  width:22px;height:22px;border-radius:50%;
  background:var(--accent);color:var(--navy) !important;
  display:flex;align-items:center;justify-content:center;
  font-size:11px;
}
.shift-chip-wide{
  display:inline-flex;align-items:center;justify-content:center;
  width:44px;height:24px;border-radius:4px;
  font-size:10px;font-weight:700;
  transition:opacity 0.14s;font-family:'Exo 2',sans-serif;letter-spacing:0.03em;
}
.shift-chip-wide:hover{opacity:0.7;}
.shift-time-label{font-size:8px;opacity:0.6;margin-top:2px;display:block;text-align:center;font-family:'DM Mono',monospace;}
`;

// ════════════════════════════════════════════════════════════════════════════
// EDIT MODAL COMPONENT
// ════════════════════════════════════════════════════════════════════════════

function EditModal({ cell, schedule, onSave, onClose, currentUser }) {
  const { member, day, year, month, teamKey } = cell;
  const existingData = schedule[member]?.[day] || { shift: null, modifier: "Off", note: "" };
  const team = TEAM_CONFIG[teamKey];

  const [shiftMode, setShiftMode] = useState(existingData.shift?.isCustom ? "custom" : "standard");
  const [selectedShiftId, setSelectedShiftId] = useState(existingData.shift?.id || team.standardShifts[0]?.id || "");
  const [customStart, setCustomStart] = useState(existingData.shift?.start || "09:00");
  const [customEnd, setCustomEnd] = useState(existingData.shift?.end || "18:00");
  const [modifier, setModifier] = useState(existingData.modifier || "On-Site");

  const getCurrentShift = () => {
    if (modifier === "Off" || modifier === "Paid Leave") return null;
    if (shiftMode === "standard") {
      const s = team.standardShifts.find(sh => sh.id === selectedShiftId);
      return s ? { ...s } : null;
    } else {
      return {
        id: "CUSTOM", label: "Custom",
        start: customStart, end: customEnd,
        startH: timeToHours(customStart), endH: timeToHours(customEnd),
        isCustom: true
      };
    }
  };

  const handleSave = () => {
    const shift = getCurrentShift();
    const newData = { shift, modifier, team: teamKey, note: "" };
    onSave(member, day, newData, "Manual update");
    onClose();
  };

  const handleClear = () => {
    onSave(member, day, { shift: null, modifier: "Off", team: teamKey, note: "" }, "Cleared");
    onClose();
  };

  const daysInMonth = getDaysInMonth(year, month);
  const dow = getDayOfWeek(year, month, day);
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const canEdit = currentUser.role === ROLES.ADMIN ||
    (currentUser.role === ROLES.LEAD && currentUser.team === teamKey);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Schedule</div>
          <button className="modal-close-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-sub">
          <span>👤 <strong style={{color:COLORS.offWhite}}>{member}</strong></span>
          <span>📅 {dayNames[dow]}, {monthNames[month]} {day}</span>
          <span style={{color:COLORS.mutedLight}}>⬡ {teamKey}</span>
        </div>

        {!canEdit && (
          <div className="conflict-banner">🔒 Read-only: You can only edit your own team's schedule.</div>
        )}

        {canEdit && (
          <>
            <div className="modal-section">
              <label className="modal-label">Status / Modifier</label>
              <div className="modifier-grid">
                {MODIFIERS.map(m => (
                  <button key={m} className={`mod-btn ${modifier === m ? "sel" : ""}`}
                    onClick={() => setModifier(m)}>{m}</button>
                ))}
              </div>
            </div>

            {modifier !== "Off" && modifier !== "Paid Leave" && (
              <>
                <div className="modal-section">
                  <label className="modal-label">Shift Type</label>
                  <div className="toggle-row">
                    <button className={`toggle-opt ${shiftMode === "standard" ? "sel" : ""}`}
                      onClick={() => setShiftMode("standard")}>Standard Shift</button>
                    <button className={`toggle-opt ${shiftMode === "custom" ? "sel" : ""}`}
                      onClick={() => setShiftMode("custom")}>Custom Time</button>
                  </div>
                </div>

                {shiftMode === "standard" ? (
                  <div className="modal-section">
                    <label className="modal-label">Select Shift</label>
                    <select className="modal-select" value={selectedShiftId}
                      onChange={e => setSelectedShiftId(e.target.value)}>
                      {team.standardShifts.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="modal-section">
                    <label className="modal-label">Custom Hours</label>
                    <div className="time-row">
                      <div className="time-field">
                        <label>Start Time</label>
                        <input type="time" className="time-input" value={customStart}
                          onChange={e => setCustomStart(e.target.value)} />
                      </div>
                      <div className="time-field">
                        <label>End Time</label>
                        <input type="time" className="time-input" value={customEnd}
                          onChange={e => setCustomEnd(e.target.value)} />
                      </div>
                    </div>
                    {candidateShift && (
                      <div style={{fontSize:11,color:COLORS.accent,marginTop:8}}>
                        Duration: {(() => {
                          const s = timeToHours(customStart);
                          let e = timeToHours(customEnd);
                          if (e < s) e += 24;
                          return `${(e-s).toFixed(1)}h`;
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="modal-actions">
              <button className="btn-save" onClick={handleSave}>Save Changes</button>
              <button className="btn-cancel" onClick={onClose}>Cancel</button>
              <button className="btn-clear" onClick={handleClear}>Clear / Set Off</button>
            </div>
          </>
        )}

        {!canEdit && (
          <button className="btn-cancel" style={{width:"100%",marginTop:16}} onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// HANDOVER ANALYSIS
// ════════════════════════════════════════════════════════════════════════════

function HandoverAnalysis({ schedule, currentYear, currentMonth }) {
  const today = new Date().getDate();
  const alerts = [];

  Object.entries(TEAM_CONFIG).forEach(([teamKey, team]) => {
    team.handoverWindows.forEach(hw => {
      const activeMembers = team.members.filter(m => {
        const d = schedule[m]?.[today];
        if (!d?.shift || d.modifier === "Off" || d.modifier === "Paid Leave") return false;
        const s = d.shift.startH;
        const e = d.shift.endH;
        return s <= hw.start && e >= hw.end;
      });
      if (activeMembers.length < team.minCoverage) {
        alerts.push({
          risk: true, team: teamKey, window: hw.label,
          active: activeMembers.length, required: team.minCoverage,
          members: activeMembers,
        });
      } else {
        alerts.push({
          risk: false, team: teamKey, window: hw.label,
          active: activeMembers.length, required: team.minCoverage,
          members: activeMembers,
        });
      }
    });
  });

  if (alerts.length === 0) return null;

  return (
    <div className="handover-alerts">
      <div className="sec-header"><div className="sec-title">⚡ Handover Window Analysis — Today</div></div>
      {alerts.map((a, i) => (
        <div key={i} className={`handover-alert ${a.risk ? "risk" : "ok"}`}>
          <div className="ha-icon">{a.risk ? "🔴" : "🟢"}</div>
          <div>
            <div className="ha-title" style={{color: a.risk ? COLORS.danger : COLORS.accent}}>
              {a.risk ? "HIGH RISK" : "COVERED"} — {a.team}: {a.window}
            </div>
            <div className="ha-sub">
              {a.active}/{a.required} required staff present.
              {a.risk ? " Handover is BROKEN — coverage gap detected!" : " Handover is intact."}
              {a.members.length > 0 && ` Active: ${a.members.slice(0,3).join(", ")}.`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BULK ASSIGN DRAWER
// ════════════════════════════════════════════════════════════════════════════

function BulkAssignDrawer({ onClose, allSchedules, setAllSchedules, addAuditLog, currentUser }) {
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // A — Who
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [selected, setSelected] = useState(new Set());

  // B — What
  const [selectedShiftId, setSelectedShiftId] = useState("CSIRT-A");
  const [customMode, setCustomMode] = useState(false);
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("17:00");
  const [modifier, setModifier] = useState("On-Site");

  // C — When
  const todayStr = (() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [skipWeekends, setSkipWeekends] = useState(true);

  // Done flash
  const [done, setDone] = useState(false);

  // All members pool (filtered by RBAC)
  const allMembersPool = useMemo(() => {
    const pool = [];
    Object.entries(TEAM_CONFIG).forEach(([tk, team]) => {
      if (currentUser.role === ROLES.LEAD && currentUser.team !== tk) return;
      team.members.forEach(m => pool.push({ name: m, team: tk, teamColor: COLORS.accent }));
    });
    return pool;
  }, [currentUser]);

  const visibleMembers = teamFilter === "ALL"
    ? allMembersPool
    : allMembersPool.filter(m => m.team === teamFilter);

  const toggleMember = (name) => {
    setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };
  const selectAll = () => {
    const allVisible = visibleMembers.map(m => m.name);
    const allChecked = allVisible.every(n => selected.has(n));
    setSelected(prev => {
      const n = new Set(prev);
      if (allChecked) allVisible.forEach(nm => n.delete(nm));
      else allVisible.forEach(nm => n.add(nm));
      return n;
    });
  };

  // Resolve shift object from selectedShiftId (format: "CSIRT-A", "ThreatMgmt-B", etc.)
  const resolvedShift = useMemo(() => {
    if (customMode) {
      return { id:"CUSTOM", label:"Custom", start:customStart, end:customEnd,
               startH:timeToHours(customStart), endH:timeToHours(customEnd), isCustom:true };
    }
    // selectedShiftId is "teamKey-shiftId"
    const dashIdx = selectedShiftId.indexOf("-");
    if (dashIdx === -1) return null;
    const tk = selectedShiftId.slice(0, dashIdx);
    const sid = selectedShiftId.slice(dashIdx + 1);
    const team = TEAM_CONFIG[tk];
    if (!team) return null;
    const s = team.standardShifts.find(sh => sh.id === sid);
    return s ? { ...s } : null;
  }, [customMode, customStart, customEnd, selectedShiftId]);

  // Compute date range
  const dateRange = useMemo(() => {
    if (!startDate || !endDate) return [];
    const days = [];
    const cur = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    while (cur <= end) {
      const dow = cur.getDay();
      if (!skipWeekends || (dow !== 0 && dow !== 6)) {
        days.push(new Date(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [startDate, endDate, skipWeekends]);

  // Pre-flight: count + clashes
  const { totalShifts, clashes } = useMemo(() => {
    const members = [...selected];
    let total = 0;
    const cls = [];
    members.forEach(member => {
      dateRange.forEach(date => {
        const y = date.getFullYear(), mo = date.getMonth(), d = date.getDate();
        const key = `${y}-${mo}`;
        const existing = allSchedules[key]?.[member]?.[d];
        total++;
        if (existing && existing.modifier === "Paid Leave") {
          cls.push({ member: member.split(" ")[0], date: `${monthNames[mo]} ${d}`, was: existing.modifier });
        }
      });
    });
    return { totalShifts: total, clashes: cls };
  }, [selected, dateRange, allSchedules]);

  const canApply = selected.size > 0 && dateRange.length > 0 && resolvedShift;

  const handleApply = () => {
    if (!canApply) return;
    const members = [...selected];
    let newAllSchedules = { ...allSchedules };

    members.forEach(member => {
      // find which team this member belongs to
      let memberTeam = "CSIRT";
      Object.entries(TEAM_CONFIG).forEach(([tk, t]) => { if (t.members.includes(member)) memberTeam = tk; });

      dateRange.forEach(date => {
        const y = date.getFullYear(), mo = date.getMonth(), d = date.getDate();
        const key = `${y}-${mo}`;
        if (!newAllSchedules[key]) newAllSchedules[key] = generateSchedule(y, mo);
        if (!newAllSchedules[key][member]) newAllSchedules[key][member] = {};
        newAllSchedules[key] = {
          ...newAllSchedules[key],
          [member]: {
            ...newAllSchedules[key][member],
            [d]: { shift: resolvedShift, modifier, team: memberTeam, note: "" }
          }
        };
      });
    });

    setAllSchedules(newAllSchedules);
    try { localStorage.setItem("secops_schedule_v3", JSON.stringify(newAllSchedules)); } catch {}

    const shiftLabel = resolvedShift.isCustom ? `Custom (${customStart}–${customEnd})` : resolvedShift.label;
    addAuditLog({
      icon: "📋", type: "BULK_ASSIGN",
      msg: `Bulk Assignment: ${shiftLabel} → ${members.length} member${members.length !== 1 ? "s" : ""}`,
      detail: `Members: ${members.map(m=>m.split(" ")[0]).join(", ")} · Range: ${startDate} to ${endDate} · ${totalShifts} shifts total${skipWeekends ? " (weekdays only)" : ""}`,
      reason: `Status: ${modifier}`
    });

    setDone(true);
    setTimeout(() => { setDone(false); onClose(); }, 1200);
  };

  // All standard shifts from all teams deduplicated by id
  const allStandardShifts = useMemo(() => {
    const shifts = [];
    Object.entries(TEAM_CONFIG).forEach(([tk, team]) => {
      team.standardShifts.forEach(s => shifts.push({ ...s, teamKey: tk }));
    });
    return shifts;
  }, []);

  const allVisibleChecked = visibleMembers.length > 0 && visibleMembers.every(m => selected.has(m.name));

  return (
    <div className="bulk-overlay" onClick={onClose}>
      <div className="bulk-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bulk-header">
          <div>
            <div className="bulk-title">⚡ Bulk Assign Console</div>
            <div className="bulk-sub">Assign shifts to multiple members across a date range</div>
          </div>
          <button className="modal-close-x" onClick={onClose}>×</button>
        </div>

        <div className="bulk-body">
          {/* A — WHO */}
          <div className="bulk-section">
            <div className="bulk-section-title"><span>👥</span> A · Select Members</div>
            <div className="team-filter-pills">
              {[["ALL","All Teams",COLORS.muted],["CSIRT","CSIRT",COLORS.accent],["ThreatMgmt","Threat",COLORS.accent],["SecProjects","Projects",COLORS.accent]].map(([val,label,col]) => {
                if (currentUser.role === ROLES.LEAD && val !== "ALL" && val !== currentUser.team) return null;
                return (
                  <button key={val}
                    className={`team-pill ${teamFilter === val ? "active" : ""}`}
                    style={teamFilter === val ? {background:col, borderColor:col} : {}}
                    onClick={() => setTeamFilter(val)}>{label}
                  </button>
                );
              })}
              <div style={{marginLeft:"auto",fontSize:10,color:COLORS.muted,alignSelf:"center"}}>
                {selected.size} selected
              </div>
            </div>
            <div className="member-list">
              <div className="select-all-row" onClick={selectAll}>
                <input type="checkbox" readOnly checked={allVisibleChecked} style={{width:15,height:15,accentColor:COLORS.accent}} />
                <label style={{fontSize:11,color:COLORS.muted,cursor:"pointer"}}>
                  {allVisibleChecked ? "Deselect all visible" : "Select all visible"} ({visibleMembers.length})
                </label>
              </div>
              {visibleMembers.map(({ name, team: tk, teamColor }) => (
                <div key={name}
                  className={`member-check-row ${selected.has(name) ? "checked" : ""}`}
                  onClick={() => toggleMember(name)}>
                  <input type="checkbox" readOnly checked={selected.has(name)} style={{width:15,height:15,accentColor:COLORS.accent}} />
                  <div className="avatar" style={{width:26,height:26,fontSize:9,borderRadius:6,background:"rgba(122,143,166,0.12)",color:COLORS.accent,border:"1px solid rgba(122,143,166,0.25)",flexShrink:0}}>
                    {getInitials(name)}
                  </div>
                  <span className="member-check-name">{name}</span>
                  <span className="member-check-team" style={{background:"rgba(122,143,166,0.12)",color:COLORS.accent}}>{tk}</span>
                </div>
              ))}
            </div>
          </div>

          {/* B — WHAT */}
          <div className="bulk-section">
            <div className="bulk-section-title"><span>🕐</span> B · Shift & Status</div>

            {/* Custom toggle */}
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <button className={`toggle-opt ${!customMode ? "sel" : ""}`} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid var(--border)",background:!customMode?"rgba(122,143,166,0.15)":"transparent",color:!customMode?"var(--accent)":"var(--muted)",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}
                onClick={() => setCustomMode(false)}>Standard Shift</button>
              <button className={`toggle-opt ${customMode ? "sel" : ""}`} style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid var(--border)",background:customMode?"rgba(122,143,166,0.15)":"transparent",color:customMode?"var(--accent)":"var(--muted)",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}
                onClick={() => setCustomMode(true)}>Custom Time</button>
            </div>

            {!customMode ? (
              <div className="shift-selector-grid">
                {allStandardShifts.map(s => {
                  const selKey = `${s.teamKey}-${s.id}`;
                  const sc = SHIFT_COLORS[selKey] || SHIFT_COLORS.CUSTOM;
                  return (
                    <div key={selKey}
                      className={`shift-option ${selectedShiftId === selKey ? "sel" : ""}`}
                      style={selectedShiftId === selKey ? {borderColor: sc.text, background: sc.bg} : {}}
                      onClick={() => setSelectedShiftId(selKey)}>
                      <div className="shift-option-id" style={{color: sc.text}}>{s.id}</div>
                      <div className="shift-option-time">{s.start} – {s.end}</div>
                      <div className="shift-option-label">{TEAM_CONFIG[s.teamKey]?.label}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="time-row" style={{marginTop:0}}>
                <div className="time-field">
                  <label>Start Time</label>
                  <input type="time" className="time-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                </div>
                <div className="time-field">
                  <label>End Time</label>
                  <input type="time" className="time-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{marginTop:12,marginBottom:4,fontSize:10,color:COLORS.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Status</div>
            <div className="modifier-chips">
              {["On-Site","WFH","Weekend Scheduled"].map(m => (
                <button key={m}
                  className={`mod-chip ${modifier === m ? "sel" : ""}`}
                  style={modifier === m ? {background:MODIFIER_COLORS[m],borderColor:MODIFIER_COLORS[m],color:COLORS.navy} : {}}
                  onClick={() => setModifier(m)}>{m}
                </button>
              ))}
            </div>
          </div>

          {/* C — WHEN */}
          <div className="bulk-section">
            <div className="bulk-section-title"><span>📅</span> C · Date Range</div>
            <div className="date-range-row">
              <div className="date-field">
                <label>Start Date</label>
                <input type="date" className="date-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="date-field">
                <label>End Date</label>
                <input type="date" className="date-input" value={endDate} onChange={e => { if(e.target.value >= startDate) setEndDate(e.target.value); }} />
              </div>
            </div>
            <div className="skip-weekends-row" onClick={() => setSkipWeekends(v => !v)}>
              <div className={`toggle-switch ${skipWeekends ? "on" : ""}`}>
                <div className="toggle-knob"/>
              </div>
              <label>Skip Weekends (Mon–Fri only)</label>
            </div>
            {dateRange.length > 0 && (
              <div style={{fontSize:11,color:COLORS.accent,marginTop:4}}>
                → {dateRange.length} day{dateRange.length !== 1 ? "s" : ""} selected
              </div>
            )}
          </div>
        </div>

        {/* Footer: Pre-flight + Apply */}
        <div className="bulk-footer">
          {canApply && (
            <div className="preflight-box">
              <div className="preflight-count">
                {totalShifts} shift{totalShifts !== 1 ? "s" : ""} will be assigned
              </div>
              <div className="preflight-detail">
                {selected.size} member{selected.size !== 1 ? "s" : ""} ·{" "}
                {dateRange.length} day{dateRange.length !== 1 ? "s" : ""} ·{" "}
                {resolvedShift ? (resolvedShift.isCustom ? `${customStart}–${customEnd}` : `${resolvedShift.start}–${resolvedShift.end}`) : ""} ·{" "}
                {modifier}
              </div>
            </div>
          )}
          {clashes.length > 0 && (
            <div className="clash-box">
              <div className="clash-title">⚠ {clashes.length} EXISTING ENTRY{clashes.length !== 1 ? "S" : ""} WILL BE OVERWRITTEN</div>
              {clashes.slice(0, 8).map((c, i) => (
                <div key={i} className="clash-row">
                  <span>{c.member}</span> · {c.date} · <span>{c.was}</span>
                </div>
              ))}
              {clashes.length > 8 && <div style={{fontSize:10,color:COLORS.muted,marginTop:4}}>+{clashes.length - 8} more...</div>}
            </div>
          )}
          <button
            className={`bulk-apply-btn ${done ? "done" : ""}`}
            disabled={!canApply || done}
            onClick={handleApply}
          >
            {done ? "✓ Assignment Applied!" : canApply ? `⚡ Execute — ${totalShifts} Shifts` : "Select members and dates to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ════════════════════════════════════════════════════════════════════════════

function OverviewTab({ schedule, currentYear, currentMonth, currentUser }) {
  const today = new Date().getDate();
  let active=0, onLeave=0, wfh=0;

  const allMembers = [];
  Object.entries(TEAM_CONFIG).forEach(([tk, team]) => {
    team.members.forEach(m => {
      const d = schedule[m]?.[today];
      if (d?.modifier === "Paid Leave") onLeave++;
      else if (d?.modifier === "WFH") { wfh++; active++; }
      else if (d?.modifier === "On-Site" || d?.modifier === "Weekend Scheduled") active++;
      allMembers.push({ name: m, teamKey: tk, team, isLead: LEAD_NAMES.has(m) });
    });
  });

  const filtered = currentUser.role === ROLES.MEMBER
    ? allMembers.filter(m => m.teamKey === currentUser.team)
    : allMembers;

  // ── DYNAMIC SHIFT BUCKET SYSTEM ────────────────────────────────────────────
  // Fingerprint by exact start+end time (not shift ID) so cross-team members
  // with identical hours land in the same bucket. Sort chronologically by
  // start hour so Early Morning → Morning → Afternoon → Night.
  const nowH = new Date().getHours() + new Date().getMinutes() / 60;

  const groupedByShift = useMemo(() => {
    const buckets = {};   // keyed by "HH:MM-HH:MM" time fingerprint
    const offBuckets = {};

    filtered.forEach(item => {
      const dayData = schedule[item.name]?.[today];
      const mod = dayData?.modifier || "Off";
      const shift = dayData?.shift;

      // Off / Leave → separate dimmed section
      if (!shift || mod === "Off" || mod === "Paid Leave") {
        const key = mod === "Paid Leave" ? "__LEAVE__" : "__OFF__";
        if (!offBuckets[key]) offBuckets[key] = {
          label: mod === "Paid Leave" ? "On Leave" : "Off Today",
          color: mod === "Paid Leave" ? COLORS.statusLeave : COLORS.muted,
          members: []
        };
        offBuckets[key].members.push(item);
        return;
      }

      // Time fingerprint — unique bucket per exact window
      const fp = `${shift.start}-${shift.end}`;
      if (!buckets[fp]) {
        // Color: if only one team uses this window, use that team's shift color;
        // if cross-team, fall back to the WFH/Weekend status color or accent
        const startH = shift.startH ?? timeToHours(shift.start);
        const colorKey = getShiftColorKey(item.teamKey, shift.id, shift.isCustom);
        const sc = SHIFT_COLORS[colorKey];
        const statusCol = mod === "WFH" ? COLORS.statusWFH
                        : mod === "Weekend Scheduled" ? COLORS.statusWeekend
                        : sc.text;

        // Human-readable time label  e.g. "5:00 AM – 2:00 PM"
        const fmt = t => {
          const [h, m] = t.split(":").map(Number);
          const ampm = h < 12 ? "AM" : "PM";
          const hh = h % 12 || 12;
          return `${hh}:${String(m).padStart(2,"0")} ${ampm}`;
        };

        // Active-now: is current time within this shift window?
        const endH = shift.endH ?? timeToHours(shift.end);
        const adjustedEnd = endH < startH ? endH + 24 : endH;  // handle overnight
        const isNow = nowH >= startH && nowH < adjustedEnd;

        buckets[fp] = {
          fp,
          startH,
          label: shift.isCustom ? "Custom Shift" : (shift.id ? `Shift ${shift.id}` : "Shift"),
          timeLabel: `${fmt(shift.start)} – ${fmt(shift.end)}`,
          color: statusCol,
          modifier: mod,
          isNow,
          teamsInBucket: new Set([item.teamKey]),
          members: []
        };
      } else {
        buckets[fp].teamsInBucket.add(item.teamKey);
        // If cross-team bucket, and current member has different mod color, keep first
      }
      buckets[fp].members.push(item);
    });

    // Sort off/leave members: lead first, then alphabetical
    Object.values(offBuckets).forEach(bucket => {
      bucket.members.sort((a, b) => {
        const aIsLead = LEAD_NAMES.has(a.name) ? 0 : 1;
        const bIsLead = LEAD_NAMES.has(b.name) ? 0 : 1;
        if (aIsLead !== bIsLead) return aIsLead - bIsLead;
        return a.name.localeCompare(b.name);
      });
    });

    // ── WITHIN-BUCKET SORT ──────────────────────────────────────────────────
    // Rules (applied within each team inside a bucket):
    //   1. Lead always first
    //   2. Then sort by today's shift startH ascending
    //   3. Tie-break: alphabetical by full name
    // Off/Leave members are already in offBuckets so no need to handle here.
    Object.values(buckets).forEach(bucket => {
      bucket.members.sort((a, b) => {
        // 1. Lead pin — within the same team, lead always floats to top
        const aIsLead = LEAD_NAMES.has(a.name) ? 0 : 1;
        const bIsLead = LEAD_NAMES.has(b.name) ? 0 : 1;
        if (aIsLead !== bIsLead) return aIsLead - bIsLead;

        // 2. Sort by today's shift startH (earliest first)
        const aData = schedule[a.name]?.[today];
        const bData = schedule[b.name]?.[today];
        const aH = aData?.shift?.startH ?? aData?.shift ? timeToHours(aData.shift.start) : 99;
        const bH = bData?.shift?.startH ?? bData?.shift ? timeToHours(bData.shift.start) : 99;
        if (aH !== bH) return aH - bH;

        // 3. Tie-break: alphabetical
        return a.name.localeCompare(b.name);
      });
    });

    // Chronological sort: by start hour (overnight shifts like 21:00 sort last)
    const active = Object.values(buckets).sort((a, b) => {
      const aH = a.startH >= 20 ? a.startH - 24 : a.startH;
      const bH = b.startH >= 20 ? b.startH - 24 : b.startH;
      return aH - bH;
    });

    const off = Object.values(offBuckets);
    return { active, off };
  }, [filtered, schedule, today, nowH]);

  const MemberCard = ({ name, teamKey, team, isLead }) => {
    const dayData = schedule[name]?.[today];
    const mod = dayData?.modifier || "Off";
    const shift = dayData?.shift;
    const isActive = mod === "On-Site" || mod === "WFH" || mod === "Weekend Scheduled";
    let badgeStyle = {background:COLORS.statusOff, color:COLORS.muted};
    let badgeTxt = "OFF";
    if (mod === "Paid Leave") {
      badgeStyle = {background:COLORS.statusLeave+"30", color:COLORS.statusLeave};
      badgeTxt = "LEAVE";
    } else if (mod === "Weekend Scheduled") {
      badgeStyle = {background:COLORS.statusWeekend+"30", color:COLORS.statusWeekend};
      badgeTxt = "WKD";
    } else if (mod === "WFH" && shift) {
      badgeStyle = {background:COLORS.statusWFH+"25", color:COLORS.statusWFH};
      badgeTxt = `${shift.id}·WH`;
    } else if (isActive && shift) {
      const key = getShiftColorKey(teamKey, shift.id, shift.isCustom);
      const sc = SHIFT_COLORS[key];
      badgeStyle = {background:sc.bg, color:sc.text};
      badgeTxt = shift.id;
    }

    // Team badge color — uses team-shift color as accent for the pill
    const teamSc = shift ? SHIFT_COLORS[getShiftColorKey(teamKey, shift?.id, shift?.isCustom)] : null;
    const teamBadgeBg = teamSc ? teamSc.bg : "rgba(122,143,166,0.12)";
    const teamBadgeCol = teamSc ? teamSc.text : COLORS.muted;

    return (
      <div className={`live-card ${isActive?"is-active":""} ${isLead?"is-lead":""}`}>
        <div className="avatar" style={{background:"rgba(122,143,166,0.12)",color:COLORS.accent,border:"1px solid rgba(122,143,166,0.25)"}}>
          {getInitials(name)}
        </div>
        <div className="live-info">
          <div className="live-name">
            {name.split(" ")[0]}{" "}
            <span style={{color:COLORS.offWhite,fontWeight:400}}>{name.split(" ").slice(1).join(" ")}</span>
            {isLead && <span style={{fontSize:9,color:COLORS.accent,marginLeft:5,letterSpacing:"0.06em",opacity:0.8}}>★</span>}
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center",marginTop:3,flexWrap:"wrap"}}>
            {/* Team badge — always visible */}
            <span style={{
              fontSize:9,fontWeight:700,letterSpacing:"0.07em",
              padding:"1px 6px",borderRadius:3,
              background:teamBadgeBg, color:teamBadgeCol,
              fontFamily:"'DM Mono',monospace",
            }}>{teamKey === "ThreatMgmt" ? "THREAT" : teamKey === "SecProjects" ? "SECPROJ" : teamKey}</span>
            {shift && <span style={{fontSize:9,color:COLORS.muted}}>{shift.start}–{shift.end}</span>}
          </div>
        </div>
        <div className="live-badge" style={badgeStyle}>{badgeTxt}</div>
      </div>
    );
  };

  return (
    <>
      <div className="stats-row">
        <div className="stat-card c-cyan">
          <div className="stat-glyph">⬡</div>
          <div className="stat-label">Active Today</div>
          <div className="stat-value" style={{color:COLORS.shiftA}}>{active}</div>
          <div className="stat-sub">On-site + remote</div>
        </div>
        <div className="stat-card c-warn">
          <div className="stat-glyph">🏖</div>
          <div className="stat-label">On Leave</div>
          <div className="stat-value" style={{color:COLORS.statusLeave}}>{onLeave}</div>
          <div className="stat-sub">Paid leave today</div>
        </div>
        <div className="stat-card c-muted">
          <div className="stat-glyph">🏠</div>
          <div className="stat-label">WFH</div>
          <div className="stat-value" style={{color:COLORS.accent}}>{wfh}</div>
          <div className="stat-sub">Remote today</div>
        </div>
        <div className="stat-card c-green">
          <div className="stat-glyph">👥</div>
          <div className="stat-label">Total Staff</div>
          <div className="stat-value" style={{color:COLORS.accent}}>{Object.values(TEAM_CONFIG).reduce((s,t)=>s+t.members.length,0)+3}</div>
          <div className="stat-sub">Across 3 teams</div>
        </div>
      </div>

      <HandoverAnalysis schedule={schedule} currentYear={currentYear} currentMonth={currentMonth} />

      <div className="sec-header">
        <div className="sec-title">⬤ Live Status Board</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div className="sec-badge">{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
          <div style={{fontSize:10,color:COLORS.muted,letterSpacing:"0.06em"}}>sorted by shift start · today</div>
        </div>
      </div>

      {/* ── DYNAMIC SHIFT BUCKETS — chronological ── */}
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        {groupedByShift.active.map(bucket => (
          <div key={bucket.fp} style={{
            borderRadius:10,
            border:`1px solid ${bucket.isNow ? bucket.color+"55" : bucket.color+"22"}`,
            background: bucket.isNow ? `${bucket.color}07` : "transparent",
            overflow:"hidden",
            transition:"border-color 0.3s",
          }}>
            {/* Bucket header */}
            <div style={{
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",
              padding:"9px 14px",
              background: bucket.isNow ? `${bucket.color}12` : `${bucket.color}07`,
              borderBottom:`1px solid ${bucket.color}18`,
            }}>
              {/* Active-now pulse dot */}
              <div style={{
                width:8,height:8,borderRadius:"50%",flexShrink:0,
                background: bucket.isNow ? bucket.color : bucket.color+"55",
                boxShadow: bucket.isNow ? `0 0 0 3px ${bucket.color}30` : "none",
                animation: bucket.isNow ? "pulse 2s infinite" : "none",
              }}/>

              {/* Time window — primary identity */}
              <span style={{
                fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,
                color: bucket.isNow ? bucket.color : bucket.color+"cc",
                letterSpacing:"0.04em",
              }}>{bucket.timeLabel}</span>

              {/* Shift ID label */}
              <span style={{
                fontSize:10,color:COLORS.muted,
                padding:"1px 7px",borderRadius:3,
                background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.07)",
              }}>{bucket.label}</span>

              {/* Active-now chip */}
              {bucket.isNow && (
                <span style={{
                  fontSize:9,fontWeight:700,letterSpacing:"0.1em",
                  padding:"2px 8px",borderRadius:3,
                  background:bucket.color+"25",color:bucket.color,
                  border:`1px solid ${bucket.color}40`,
                }}>● ON NOW</span>
              )}

              {/* Team composition pills — shows which teams are in this bucket */}
              <div style={{marginLeft:"auto",display:"flex",gap:5,alignItems:"center"}}>
                {[...bucket.teamsInBucket].map(tk => {
                  const tkLabel = tk === "ThreatMgmt" ? "THREAT" : tk === "SecProjects" ? "SECPROJ" : tk;
                  return (
                    <span key={tk} style={{
                      fontSize:9,fontWeight:700,letterSpacing:"0.07em",
                      padding:"1px 6px",borderRadius:3,
                      background:"rgba(122,143,166,0.12)",color:COLORS.accent,
                      fontFamily:"'DM Mono',monospace",
                    }}>{tkLabel}</span>
                  );
                })}
                <span style={{
                  fontSize:11,fontWeight:600,color:bucket.color,
                  background:`${bucket.color}18`,
                  padding:"2px 9px",borderRadius:4,marginLeft:4,
                }}>{bucket.members.length}</span>
              </div>
            </div>

            {/* Member cards */}
            <div className="live-grid" style={{padding:"10px 10px 6px",gap:8}}>
              {bucket.members.map(m => <MemberCard key={m.name} {...m} />)}
            </div>
          </div>
        ))}

        {/* Off / Leave — collapsed at bottom */}
        {groupedByShift.off.length > 0 && (
          <div style={{marginTop:4}}>
            <div style={{
              fontSize:10,color:COLORS.muted,letterSpacing:"0.1em",textTransform:"uppercase",
              marginBottom:10,paddingBottom:6,borderBottom:"1px solid rgba(255,255,255,0.05)",
              display:"flex",justifyContent:"space-between",
            }}>
              <span>Not On Shift Today</span>
              <span>{groupedByShift.off.reduce((s,g)=>s+g.members.length,0)} people</span>
            </div>
            {groupedByShift.off.map((group, i) => (
              <div key={i} style={{marginBottom:12}}>
                <div style={{fontSize:10,color:group.color,fontWeight:600,marginBottom:6,opacity:0.7,letterSpacing:"0.06em"}}>
                  {group.label}
                </div>
                <div className="live-grid" style={{opacity:0.45}}>
                  {group.members.map(m => <MemberCard key={m.name} {...m} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CALENDAR TAB
// ════════════════════════════════════════════════════════════════════════════

function CalendarTab({ schedule, currentYear, currentMonth, onEditCell, currentUser, activeFilters, setActiveFilters }) {
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const todayActual = currentYear === new Date().getFullYear() && currentMonth === new Date().getMonth()
    ? new Date().getDate() : -1;
  const dayNames = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ── View Range State ──────────────────────────────────────────────────────
  const [viewRange, setViewRange] = useState(30); // 7 | 15 | 30
  // windowStart is 1-based day index of the first visible day
  const [windowStart, setWindowStart] = useState(() => {
    // Default: start at today if current month, else day 1
    const t = todayActual > 0 ? Math.max(1, todayActual - 2) : 1;
    return Math.min(t, Math.max(1, totalDays - viewRange + 1));
  });

  // Clamp windowStart whenever viewRange or totalDays changes
  useEffect(() => {
    setWindowStart(ws => Math.max(1, Math.min(ws, Math.max(1, totalDays - viewRange + 1))));
  }, [viewRange, totalDays]);

  // Jump to today
  const jumpToToday = () => {
    if (todayActual < 0) { setWindowStart(1); return; }
    const ideal = Math.max(1, todayActual - Math.floor(viewRange / 2));
    setWindowStart(Math.min(ideal, Math.max(1, totalDays - viewRange + 1)));
  };

  const windowEnd = Math.min(windowStart + viewRange - 1, totalDays);
  const canPrev = windowStart > 1;
  const canNext = windowEnd < totalDays;

  const shiftWindow = (dir) => {
    const step = Math.max(1, Math.floor(viewRange / 2));
    setWindowStart(ws => {
      const next = ws + dir * step;
      return Math.max(1, Math.min(next, Math.max(1, totalDays - viewRange + 1)));
    });
  };

  // ── Filter State ──────────────────────────────────────────────────────────
  const [teamFilter, setTeamFilter] = useState("all");
  const [modFilter, setModFilter] = useState("all");
  const [showLowCoverage, setShowLowCoverage] = useState(false);

  // Build the visible day headers for the current window
  const dayHeaders = useMemo(() => {
    return Array.from({length: windowEnd - windowStart + 1}, (_, i) => {
      const d = windowStart + i;
      const dow = getDayOfWeek(currentYear, currentMonth, d);
      return { d, dow, label: dayNames[dow], isWeekend: dow === 0 || dow === 6 };
    });
  }, [windowStart, windowEnd, currentYear, currentMonth]);

  // Wider chips for fewer days
  const isExpanded = viewRange <= 7;
  const isMedium = viewRange === 15;

  function getChipStyle(dayData, teamKey) {
    if (!dayData || dayData.modifier === "Off" || !dayData.shift) return { bg: COLORS.statusOff, color: COLORS.muted };
    if (dayData.modifier === "Paid Leave") return { bg: COLORS.statusLeave+"30", color: COLORS.statusLeave };
    if (dayData.modifier === "WFH") return { bg: COLORS.statusWFH+"25", color: COLORS.statusWFH };
    if (dayData.modifier === "Weekend Scheduled") return { bg: COLORS.statusWeekend+"30", color: COLORS.statusWeekend };
    const key = getShiftColorKey(teamKey, dayData.shift?.id, dayData.shift?.isCustom);
    const sc = SHIFT_COLORS[key];
    return { bg: sc.bg, color: sc.text };
  }

  function getChipLabel(dayData, expanded) {
    if (!dayData) return "·";
    if (dayData.modifier === "Paid Leave") return expanded ? "LEAVE" : "PL";
    if (dayData.modifier === "Off") return "·";
    if (dayData.modifier === "WFH") return expanded ? "WFH" : "WH";
    if (dayData.modifier === "Weekend Scheduled") return expanded ? "WKD" : "WK";
    if (dayData.shift?.isCustom) return expanded ? "CUST" : "CX";
    if (expanded && dayData.shift) return `${dayData.shift.start}`;
    return dayData.shift?.id || "·";
  }

  // Low coverage day detection
  const lowCoverageDays = useMemo(() => {
    const low = new Set();
    for (let d = windowStart; d <= windowEnd; d++) {
      Object.entries(TEAM_CONFIG).forEach(([tk, team]) => {
        const active = team.members.filter(m => {
          const dd = schedule[m]?.[d];
          return dd && dd.modifier !== "Off" && dd.modifier !== "Paid Leave" && dd.shift;
        }).length;
        if (active / team.members.length < 0.3) low.add(d);
      });
    }
    return low;
  }, [schedule, windowStart, windowEnd]);

  const filteredTeams = teamFilter === "all" ? Object.entries(TEAM_CONFIG)
    : Object.entries(TEAM_CONFIG).filter(([k]) => k === teamFilter);

  function shouldShowMember(member, teamKey) {
    if (currentUser.role === ROLES.MEMBER && member !== currentUser.name) return false;
    if (currentUser.role === ROLES.LEAD && currentUser.team !== teamKey) return false;
    if (modFilter !== "all") {
      const hasModifier = Object.values(schedule[member] || {}).some(d => d?.modifier === modFilter);
      if (!hasModifier) return false;
    }
    return true;
  }

  const canEdit = (teamKey) =>
    currentUser.role === ROLES.ADMIN ||
    (currentUser.role === ROLES.LEAD && currentUser.team === teamKey);

  // Window label string
  const windowLabel = (() => {
    const s = `${monthNames[currentMonth]} ${windowStart}`;
    const e = `${monthNames[currentMonth]} ${windowEnd}`;
    return `${s} – ${e}`;
  })();

  return (
    <>
      {/* ── CONTROL BAR ── */}
      <div className="control-bar">
        <span className="control-label">Team:</span>
        {[["all","All"],["CSIRT","CSIRT"],["ThreatMgmt","Threat"],["SecProjects","Projects"]].map(([val,label]) => (
          <button key={val}
            className={`ctrl-btn ${teamFilter === val ? (val==="all"?"active-all":val==="CSIRT"?"active-cyan":val==="ThreatMgmt"?"active-blue":"active-coral") : ""}`}
            onClick={() => setTeamFilter(val)}>{label}</button>
        ))}
        <div className="ctrl-sep"/>
        <span className="control-label">Status:</span>
        {["all","On-Site","WFH","Paid Leave","Weekend Scheduled"].map(m => (
          <button key={m} className={`ctrl-btn ${modFilter === m ? "active-cyan" : ""}`}
            onClick={() => setModFilter(m)}>{m === "all" ? "All" : m}</button>
        ))}
        <div className="ctrl-sep"/>
        <button className={`ctrl-btn ${showLowCoverage ? "active-warn" : ""}`} onClick={() => setShowLowCoverage(v=>!v)}>📉 Low Coverage</button>
      </div>

      {/* ── VIEW RANGE BAR ── */}
      <div className="range-bar">
        <span className="range-label">View:</span>
        <div className="range-seg">
          {[[7,"7 Days"],[15,"15 Days"],[30,"30 Days"]].map(([v, label]) => (
            <button
              key={v}
              className={`range-btn ${viewRange === v ? "active" : ""}`}
              onClick={() => { setViewRange(v); jumpToToday(); }}
            >{label}</button>
          ))}
        </div>

        <div className="week-nav">
          <button className="week-nav-btn" onClick={() => shiftWindow(-1)} disabled={!canPrev} title="Previous">‹</button>
          <span className="week-range-label">
            {viewRange === 7
              ? (() => {
                  const dow = getDayOfWeek(currentYear, currentMonth, windowStart);
                  return `Week of ${monthNames[currentMonth]} ${windowStart}`;
                })()
              : windowLabel
            }
          </span>
          <button className="week-nav-btn" onClick={() => shiftWindow(1)} disabled={!canNext} title="Next">›</button>
        </div>

        {todayActual > 0 && (
          <button className="range-today-btn" onClick={jumpToToday}>↩ Today</button>
        )}

        <div style={{marginLeft:"auto",fontSize:10,color:COLORS.muted,flexShrink:0}}>
          {dayHeaders.length} day{dayHeaders.length !== 1 ? "s" : ""} shown · Day {windowStart}–{windowEnd} of {totalDays}
        </div>
      </div>

      {/* ── CALENDAR TABLE ── */}
      <div className="cal-wrap">
        <div className="cal-top">
          <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:14}}>
              {getMonthName(currentYear, currentMonth)} — Shift Calendar
            </span>
            <span style={{
              fontSize:11,color:COLORS.accent,
              background:"rgba(122,143,166,0.1)",
              border:"1px solid rgba(122,143,166,0.25)",
              padding:"2px 10px",borderRadius:5,
            }}>
              {viewRange === 7 ? "Week View" : viewRange === 15 ? "Fortnight View" : "Month View"}
            </span>
            {showLowCoverage && <span style={{fontSize:10,color:COLORS.mutedLight}}>⚠ Highlighted = Low Coverage days</span>}
          </div>
          <div className="cal-legend">
            {[
              ["CSIRT A (5–14)",    SHIFT_COLORS["CSIRT-A"].text],
              ["CSIRT B (13–22)",   SHIFT_COLORS["CSIRT-B"].text],
              ["CSIRT C (21–06)",   SHIFT_COLORS["CSIRT-C"].text],
              ["Threat A (8–17)",   SHIFT_COLORS["ThreatMgmt-A"].text],
              ["Threat B (14–23)",  SHIFT_COLORS["ThreatMgmt-B"].text],
              ["Fixed (11:30–20:30)", SHIFT_COLORS["SecProjects-F"].text],
              ["WFH",               COLORS.statusWFH],
              ["Leave",             COLORS.statusLeave],
              ["Weekend",           COLORS.statusWeekend],
            ].map(([name,col],i) => (
              <div key={i} className="legend-item">
                <div className="legend-dot" style={{background:col}}/>{name}
              </div>
            ))}
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="sched-table">
            <thead>
              <tr>
                <th className="th-member">Member</th>
                {dayHeaders.map(({d, label, isWeekend, dow}) => {
                  const isToday = d === todayActual;
                  return (
                    <th key={d}
                      className={isToday ? "today-th" : ""}
                      style={{
                        background: showLowCoverage && lowCoverageDays.has(d)
                          ? "rgba(122,143,166,0.07)"
                          : isWeekend ? "rgba(255,255,255,0.01)" : undefined,
                        minWidth: isExpanded ? 72 : isMedium ? 48 : 32,
                        transition: "min-width 0.2s",
                      }}>
                      {isExpanded ? (
                        <div className={`day-header-full ${isToday ? "today-th-circle" : ""}`}>
                          <span className="day-header-dow">{dayNames[dow]}</span>
                          <span className="day-header-num"
                            style={isToday ? {
                              width:22,height:22,borderRadius:"50%",
                              background:COLORS.accent,color:COLORS.navy,
                              display:"inline-flex",alignItems:"center",justifyContent:"center",
                              fontSize:11,fontFamily:"'Exo 2',sans-serif",fontWeight:700
                            } : {}}
                          >{d}</span>
                          <span className="day-header-month">{monthNames[currentMonth]}</span>
                        </div>
                      ) : isMedium ? (
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"3px 0"}}>
                          <div style={{fontSize:8,opacity:0.55,letterSpacing:"0.05em"}}>{label}</div>
                          <div style={{
                            fontSize:13,fontWeight:700,fontFamily:"'Exo 2',sans-serif",
                            color: isToday ? COLORS.accent : undefined
                          }}>{d}</div>
                        </div>
                      ) : (
                        <>
                          <div style={{fontSize:8,opacity:0.6}}>{label}</div>
                          <div style={{color: isWeekend ? COLORS.muted+"80" : undefined}}>{d}</div>
                        </>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map(([teamKey, team]) => {
                const visibleMembers = team.members.filter(m => shouldShowMember(m, teamKey));
                if (visibleMembers.length === 0) return null;
                return (
                  <>
                    <tr key={`hdr-${teamKey}`} className="team-row-header">
                      <td colSpan={dayHeaders.length + 1} style={{
                        background:"rgba(122,143,166,0.06)",
                        borderLeft:"3px solid rgba(122,143,166,0.4)",
                        color: COLORS.accent,
                      }}>
                        ◈ {team.label} &nbsp;·&nbsp; Lead: {team.lead}
                        &nbsp;·&nbsp; {visibleMembers.length} member{visibleMembers.length !== 1 ? "s" : ""}
                      </td>
                    </tr>
                    {visibleMembers.map((member) => (
                      <tr key={member}>
                        <td>
                          <div className="member-td">
                            <div className="avatar" style={{
                              background:"rgba(122,143,166,0.1)",color:COLORS.accent,
                              width:26,height:26,fontSize:9,borderRadius:6,
                              border:"1px solid rgba(122,143,166,0.2)",flexShrink:0
                            }}>{getInitials(member)}</div>
                            <div>
                              <div className="member-name-sm">{member}</div>
                              <div className="member-team-sm" style={{color:COLORS.muted}}>{teamKey}</div>
                            </div>
                          </div>
                        </td>
                        {dayHeaders.map(({d, isWeekend}) => {
                          const dayData = schedule[member]?.[d];
                          const {bg, color} = getChipStyle(dayData, teamKey);
                          const lbl = getChipLabel(dayData, isExpanded);
                          const isToday = d === todayActual;

                          return (
                            <td key={d}
                              className={`shift-td ${isToday ? "today-td" : ""} ${isWeekend ? "weekend-td" : ""}`}
                              style={{
                                background: showLowCoverage && lowCoverageDays.has(d) ? "rgba(122,143,166,0.04)" : undefined,
                                cursor: canEdit(teamKey) ? "pointer" : "default",
                              }}
                              onClick={() => canEdit(teamKey) && onEditCell({ member, day: d, year: currentYear, month: currentMonth, teamKey })}
                            >
                              {isExpanded ? (
                                /* Wide card cell for 7-day view */
                                <div style={{
                                  display:"flex",flexDirection:"column",alignItems:"center",
                                  padding:"4px 2px",gap:2
                                }}>
                                  <span
                                    className="shift-chip-wide"
                                    style={{background:bg, color}}
                                    title={`${member}: ${dayData?.shift?.label || dayData?.modifier || "Off"}`}
                                  >
                                    {lbl}
                                  </span>
                                  {dayData?.shift && dayData.modifier !== "Off" && dayData.modifier !== "Paid Leave" && (
                                    <span className="shift-time-label" style={{color}}>
                                      {dayData.shift.start}–{dayData.shift.end}
                                    </span>
                                  )}
                                  {dayData?.modifier && dayData.modifier !== "On-Site" && dayData.modifier !== "Off" && dayData.modifier !== "Weekend Scheduled" && (
                                    <span style={{
                                      fontSize:8,padding:"1px 5px",borderRadius:3,
                                      background: MODIFIER_COLORS[dayData.modifier]+"22",
                                      color: MODIFIER_COLORS[dayData.modifier],
                                      fontFamily:"'DM Mono',monospace",
                                    }}>{dayData.modifier === "Paid Leave" ? "PL" : dayData.modifier === "WFH" ? "WFH" : dayData.modifier}</span>
                                  )}
                                </div>
                              ) : (
                                /* Compact chip for 15/30-day view */
                                <span
                                  className="shift-chip"
                                  style={{background:bg, color}}
                                  title={`${member}: ${dayData?.shift?.label || dayData?.modifier || "Off"}`}
                                >
                                  {lbl}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TIMELINE TAB
// ════════════════════════════════════════════════════════════════════════════

function TimelineTab({ schedule, currentYear, currentMonth, allSchedules }) {
  // Use state to track the currently viewed day in the timeline
  const todayActual = currentYear === new Date().getFullYear() && currentMonth === new Date().getMonth()
    ? new Date().getDate() : 1;
  const [timelineDay, setTimelineDay] = useState(todayActual);

  // Reset to the valid 'today' or the 1st if the month changes from the main header
  useEffect(() => {
    const defaultDay = currentYear === new Date().getFullYear() && currentMonth === new Date().getMonth()
      ? new Date().getDate() : 1;
    setTimelineDay(defaultDay);
  }, [currentYear, currentMonth]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);

  // Navigation handlers
  const canPrev = timelineDay > 1;
  const canNext = timelineDay < daysInMonth;

  const handlePrevDay = () => setTimelineDay(d => Math.max(1, d - 1));
  const handleNextDay = () => setTimelineDay(d => Math.min(daysInMonth, d + 1));
  const jumpToToday = () => setTimelineDay(todayActual);

  // Determine "yesterday" logic, including month boundary logic for carry-overs
  let yesterday = null;
  let prevMonthSchedule = null;

  if (timelineDay > 1) {
    yesterday = timelineDay - 1;
    prevMonthSchedule = schedule; // Yesterday is in the same month
  } else {
    // If we are on day 1, "yesterday" is the last day of the previous month
    let prevM = currentMonth - 1;
    let prevY = currentYear;
    if (prevM < 0) {
      prevM = 11;
      prevY -= 1;
    }
    const prevKey = `${prevY}-${prevM}`;
    if (allSchedules && allSchedules[prevKey]) {
      yesterday = getDaysInMonth(prevY, prevM);
      prevMonthSchedule = allSchedules[prevKey];
    }
  }

  const nowH = new Date().getHours() + new Date().getMinutes() / 60;
  const hours = Array.from({ length: 25 }, (_, i) => i);

  function barStyle(startH, endH) {
    const left = (startH / 24) * 100;
    const width = ((endH - startH) / 24) * 100;
    return { left: `${left}%`, width: `${width}%` };
  }

  function isOvernight(shift) {
    const s = timeToHours(shift.start);
    const e = timeToHours(shift.end);
    return e < s;
  }

  const isViewingToday = timelineDay === new Date().getDate() && 
                         currentMonth === new Date().getMonth() && 
                         currentYear === new Date().getFullYear();

  return (
    <div className="tl-wrap">
      {/* View Range / Navigation Header */}
      <div className="range-bar" style={{ marginBottom: 20, border: 'none', background: 'transparent', padding: 0 }}>
        <div style={{ fontFamily: "'Exo 2',sans-serif", fontWeight: 700, fontSize: 16 }}>
          24h Coverage Timeline
        </div>
        
        <div className="week-nav" style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button className="week-nav-btn" onClick={handlePrevDay} disabled={!canPrev} title="Previous Day">‹</button>
          <span className="week-range-label" style={{ minWidth: 140, fontWeight: 600 }}>
             {new Date(currentYear, currentMonth, timelineDay).toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric", year:"numeric" })}
          </span>
          <button className="week-nav-btn" onClick={handleNextDay} disabled={!canNext} title="Next Day">›</button>
          
          {todayActual > 0 && !isViewingToday && (
            <button className="range-today-btn" style={{ marginLeft: 8 }} onClick={jumpToToday}>↩ Today</button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 14 }}>
        Overnight shifts from the previous day are shown faded (00:00 → end time) for handover context.
      </div>
      
      <div className="tl-hours">
        {hours.map(h => (
          <div key={h} className="tl-hour">
            {h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
          </div>
        ))}
      </div>
      
      {Object.entries(TEAM_CONFIG).map(([teamKey, team]) => {
        const active = team.members.filter(m => {
          const d = schedule[m]?.[timelineDay];
          return d && d.modifier !== "Off" && d.modifier !== "Paid Leave" && d.shift;
        });

        const sortedMembers = [...team.members].sort((a, b) => {
          const getStartScore = (member) => {
            const td = schedule[member]?.[timelineDay];
            const yd = yesterday && prevMonthSchedule ? prevMonthSchedule[member]?.[yesterday] : null;
            const isActive = td?.shift && !["Off", "Paid Leave"].includes(td.modifier);
            const hasCarry = yd?.shift && !["Off", "Paid Leave"].includes(yd.modifier) && isOvernight(yd.shift);

            if (isActive) return timeToHours(td.shift.start);
            if (hasCarry) return 0;
            return 999;
          };

          const scoreA = getStartScore(a);
          const scoreB = getStartScore(b);
          if (scoreA !== scoreB) return scoreA - scoreB;
          return a.localeCompare(b);
        });

        return (
          <div key={teamKey}>
            <div className="tl-group-lbl" style={{ color: COLORS.accent }}>
              {team.label} — {active.length}/{team.members.length} active
            </div>

            {team.handoverWindows.map((hw, hi) => (
              <div key={hi} style={{ fontSize: 10, color: COLORS.mutedLight, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 170, flexShrink: 0 }} />
                <div style={{ flex: 1, position: "relative", height: 12 }}>
                  <div style={{
                    position: "absolute",
                    left: `${(hw.start / 24) * 100}%`,
                    width: `${((hw.end - hw.start) / 24) * 100}%`,
                    top: 0, bottom: 0,
                    background: "rgba(122,143,166,0.07)",
                    borderLeft: "1px dashed rgba(122,143,166,0.4)",
                    display: "flex", alignItems: "center", paddingLeft: 4,
                    fontSize: 9, color: COLORS.muted,
                  }}>{hw.label}</div>
                </div>
              </div>
            ))}

            {sortedMembers.map(member => {
              const todayData = schedule[member]?.[timelineDay];
              const yestData = yesterday && prevMonthSchedule ? prevMonthSchedule[member]?.[yesterday] : null;

              const rows = [];

              if (yestData?.shift && !["Off", "Paid Leave"].includes(yestData.modifier) && isOvernight(yestData.shift)) {
                const shift = yestData.shift;
                const endH = timeToHours(shift.end);
                const colorKey = getShiftColorKey(teamKey, shift.id, shift.isCustom);
                const sc = SHIFT_COLORS[colorKey];
                const barCol = yestData.modifier === "WFH" ? COLORS.statusWFH
                  : yestData.modifier === "Weekend Scheduled" ? COLORS.statusWeekend
                    : sc.text;
                rows.push(
                  <div key={`${member}-yest`} className="tl-row">
                    <div className="tl-label" title={`${member} (from prev day)`} style={{ opacity: 0.55 }}>
                      {member.split(" ")[0]} {member.split(" ")[1]?.[0]}. <span style={{ fontSize: 8 }}>↩</span>
                    </div>
                    <div className="tl-bar-wrap">
                      <div className="tl-bar" style={{
                        ...barStyle(0, endH),
                        background: barCol + "18",
                        borderLeftColor: barCol + "60",
                        color: barCol + "99",
                        borderStyle: "dashed",
                        fontStyle: "italic",
                      }}>
                        {shift.id} carry-over → {shift.end}
                      </div>
                      {isViewingToday && <div className="tl-now" style={{ left: `${(nowH / 24) * 100}%` }} />}
                    </div>
                  </div>
                );
              }

              if (todayData?.shift && !["Off", "Paid Leave"].includes(todayData.modifier)) {
                const shift = todayData.shift;
                const startH = timeToHours(shift.start);
                const endH = timeToHours(shift.end);

                const overnight = isOvernight(shift);
                const displayEnd = overnight ? 24 : endH;
                const colorKey = getShiftColorKey(teamKey, shift.id, shift.isCustom);
                const sc = SHIFT_COLORS[colorKey];
                const barCol = todayData.modifier === "WFH" ? COLORS.statusWFH
                  : todayData.modifier === "Weekend Scheduled" ? COLORS.statusWeekend
                    : sc.text;
                rows.push(
                  <div key={`${member}-today`} className="tl-row">
                    <div className="tl-label" title={member}>
                      {member.split(" ")[0]} {member.split(" ")[1]?.[0]}.
                    </div>
                    <div className="tl-bar-wrap">
                      <div className="tl-bar" style={{
                        ...barStyle(startH, displayEnd),
                        background: barCol + "28",
                        borderLeftColor: barCol,
                        color: barCol,
                      }}>
                        {shift.label || shift.id}
                        {overnight ? " →" : ""}
                        {todayData.modifier === "WFH" ? " (WFH)" : ""}
                      </div>
                      {isViewingToday && <div className="tl-now" style={{ left: `${(nowH / 24) * 100}%` }} />}
                    </div>
                  </div>
                );
              }

              return rows.length > 0 ? <>{rows}</> : null;
            })}
          </div>
        );
      })}
      <div style={{ marginTop: 16, fontSize: 10, color: COLORS.muted, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {isViewingToday && <span style={{ color: COLORS.accent }}>│ Current time</span>}
        <span style={{ color: COLORS.muted }}>⋯ Handover windows</span>
        <span style={{ color: COLORS.muted, fontStyle: "italic" }}>↩ dashed = overnight carry-over from prev day</span>
      </div>
    </div>
  );
}
// ════════════════════════════════════════════════════════════════════════════
// METRICS TAB
// ════════════════════════════════════════════════════════════════════════════

function MetricsTab({ schedule, currentYear, currentMonth }) {
  const days = getDaysInMonth(currentYear, currentMonth);
  const [sortField, setSortField] = useState("hours");
  const [sortDir, setSortDir] = useState("desc");

  const memberStats = useMemo(() => {
    return Object.entries(TEAM_CONFIG).flatMap(([tk, team]) =>
      team.members.map(member => {
        const ms = schedule[member] || {};
        const hours = calcMemberHours(ms);
        const nights = calcNightShifts(ms);
        const weekends = calcWeekends(ms, currentYear, currentMonth);
        const leaves = calcLeaveDays(ms);
        return { name: member, team: tk, hours: Math.round(hours*10)/10, nights, weekends, leaves };
      })
    );
  }, [schedule, currentYear, currentMonth, days]);

  const sorted = [...memberStats].sort((a,b) => {
    const v = a[sortField] < b[sortField] ? -1 : a[sortField] > b[sortField] ? 1 : 0;
    return sortDir === "desc" ? -v : v;
  });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const sortIcon = (field) => sortField === field ? (sortDir === "desc" ? "↓" : "↑") : "↕";

  // Coverage gap analysis
  const coverageGaps = useMemo(() => {
    let gaps = 0;
    for (let d = 1; d <= days; d++) {
      Object.entries(TEAM_CONFIG).forEach(([tk, team]) => {
        const active = team.members.filter(m => {
          const dd = schedule[m]?.[d];
          return dd && dd.modifier !== "Off" && dd.modifier !== "Paid Leave" && dd.shift;
        }).length;
        if (active < team.minCoverage) gaps++;
      });
    }
    return gaps;
  }, [schedule, days]);

  const wfhRatio = useMemo(() => {
    let total=0, wfh=0;
    Object.values(schedule).forEach(ms => Object.values(ms).forEach(d => { total++; if(d?.modifier==="WFH") wfh++; }));
    return total > 0 ? Math.round((wfh/total)*100) : 0;
  }, [schedule]);

  return (
    <>
      <div className="stats-row" style={{marginBottom:24}}>
        <div className="stat-card c-coral">
          <div className="stat-label">Coverage Gaps</div>
          <div className="stat-value" style={{color:coverageGaps>10?COLORS.danger:COLORS.accent}}>{coverageGaps}</div>
          <div className="stat-sub">Days below min staffing</div>
        </div>
        <div className="stat-card c-cyan">
          <div className="stat-label">WFH Ratio</div>
          <div className="stat-value" style={{color:COLORS.accent}}>{wfhRatio}%</div>
          <div className="stat-sub">Remote this month</div>
        </div>
      </div>

      <div className="metrics-grid">
        {/* Member Stats Table */}
        <div className="metric-card" style={{gridColumn:"1 / -1"}}>
          <div className="metric-title">📊 Member Utilization — {getMonthName(currentYear, currentMonth)}</div>
          <div style={{overflowX:"auto"}}>
            <table className="table-mini" style={{width:"100%"}}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Team</th>
                  <th className="sort-btn" onClick={()=>toggleSort("hours")}>Hours MTD {sortIcon("hours")}</th>
                  <th className="sort-btn" onClick={()=>toggleSort("nights")}>Night Shifts {sortIcon("nights")}</th>
                  <th className="sort-btn" onClick={()=>toggleSort("weekends")}>Weekends {sortIcon("weekends")}</th>
                  <th className="sort-btn" onClick={()=>toggleSort("leaves")}>Leaves {sortIcon("leaves")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(m => {
                  const team = TEAM_CONFIG[m.team];
                  return (
                    <tr key={m.name}>
                      <td style={{color:COLORS.offWhite}}>{m.name}</td>
                      <td style={{color:team?.color,fontSize:10}}>{m.team}</td>
                      <td style={{color: m.hours > 180 ? COLORS.danger : COLORS.offWhite}}>{m.hours}h</td>
                      <td style={{color: m.nights > 8 ? COLORS.shiftC : COLORS.offWhite}}>{m.nights}</td>
                      <td style={{color: m.weekends > 2 ? COLORS.statusWeekend : COLORS.offWhite}}>{m.weekends}</td>
                      <td style={{color: m.leaves > 0 ? COLORS.statusLeave : COLORS.muted}}>{m.leaves}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekend Distribution */}
        <div className="metric-card">
          <div className="metric-title"><div style={{width:8,height:8,borderRadius:"50%",background:COLORS.statusWeekend}}/>Weekend Frequency</div>
          {memberStats.sort((a,b)=>b.weekends-a.weekends).slice(0,10).map(m => {
            const max = Math.max(...memberStats.map(x=>x.weekends), 1);
            const team = TEAM_CONFIG[m.team];
            return (
              <div key={m.name} className="eq-row">
                <div className="eq-name" title={m.name} style={{color:team?.color}}>{m.name.split(" ")[0]}</div>
                <div className="eq-bar-wrap">
                  <div className="eq-bar" style={{width:`${(m.weekends/max)*100}%`, background: m.weekends > 2 ? COLORS.statusWeekend : COLORS.accent}} />
                </div>
                <div className="eq-val" style={{color: m.weekends > 2 ? COLORS.statusWeekend : COLORS.muted}}>{m.weekends}</div>
              </div>
            );
          })}
        </div>

        {/* Lead Coverage */}
        <div className="metric-card">
          <div className="metric-title"><div style={{width:8,height:8,borderRadius:"50%",background:COLORS.accent}}/>Lead Coverage Overview</div>
          {Object.entries(TEAM_CONFIG).map(([teamKey, team]) => {
            const leadName = team.lead;
            const today = new Date().getDate();
            const leadData = schedule[leadName]?.[today];
            const leadShift = leadData?.shift;
            const leadMod = leadData?.modifier || "Off";
            const teamActive = team.members.filter(m => {
              const d = schedule[m]?.[today];
              return d && d.modifier !== "Off" && d.modifier !== "Paid Leave" && d.shift;
            }).length;
            const coverage = Math.round((teamActive / team.members.length) * 100);
            return (
              <div key={teamKey} className="eq-row" style={{marginBottom:14}}>
                <div style={{width:140,flexShrink:0}}>
                  <div style={{fontSize:11,color:COLORS.accent,fontWeight:600}}>{leadName.split(" ")[0]} <span style={{fontSize:9,color:COLORS.muted}}>★ Lead</span></div>
                  <div style={{fontSize:9,color:COLORS.muted,marginTop:2}}>{team.label} · {leadMod === "Off" || leadMod === "Paid Leave" ? leadMod : leadShift ? `${leadShift.id}: ${leadShift.start}–${leadShift.end}` : "Off"}</div>
                </div>
                <div style={{flex:1}}>
                  <div className="eq-bar-wrap" style={{marginBottom:3}}>
                    <div className="eq-bar" style={{width:`${coverage}%`, background:COLORS.accent}} />
                  </div>
                  <div style={{fontSize:9,color:COLORS.muted}}>{teamActive}/{team.members.length} active today ({coverage}%)</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// AUDIT LOG TAB
// ════════════════════════════════════════════════════════════════════════════

function AuditTab({ auditLogs }) {
  if (!auditLogs.length) {
    return <div className="no-data">No audit log entries yet. Changes made via the calendar will appear here.</div>;
  }
  return (
    <div className="audit-wrap">
      {[...auditLogs].reverse().map((log, i) => (
        <div key={i} className="audit-item">
          <div className="audit-time">{log.timestamp}</div>
          <div className="audit-icon">{log.icon || "📝"}</div>
          <div className="audit-content">
            <div className="audit-msg">{log.msg}</div>
            {log.detail && <div className="audit-detail">{log.detail}</div>}
            {log.reason && <div className="audit-reason">Reason: {log.reason}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ADMIN TAB
// ════════════════════════════════════════════════════════════════════════════

function AdminTab({ schedule, currentYear, currentMonth, addAuditLog, currentUser }) {
  const [copied, setCopied] = useState(null);
  const base = "https://secops.yourdomain.com/schedule";
  const links = [
    { label: "Global View", url: `${base}?view=all` },
    { label: "CSIRT Team", url: `${base}?team=CSIRT` },
    { label: "Threat Management", url: `${base}?team=ThreatMgmt` },
    { label: "Security Projects", url: `${base}?team=SecProjects` },
    { label: "Harmanpreet", url: `${base}?user=harmanpreet_singh` },
    { label: "This Month", url: `${base}?month=${currentMonth+1}&year=${currentYear}` },
  ];
  const copyLink = (url, i) => { navigator.clipboard?.writeText(url); setCopied(i); setTimeout(()=>setCopied(null),1800); };

  return (
    <>
      {currentUser.role !== ROLES.ADMIN && (
        <div className="rbac-banner">⚠ Some Admin features are restricted. You are viewing as {currentUser.role}.</div>
      )}
      <div className="share-wrap">
        <div className="sec-header">
          <div className="sec-title">🔗 Shareable Schedule Links</div>
          <div className="sec-badge">Dynamic Filtering via URL Parameters</div>
        </div>
        {links.map((l, i) => (
          <div key={i} className="url-row">
            <div className="url-label">{l.label}</div>
            <div className="url-box">{l.url}</div>
            <button className={`copy-btn ${copied === i ? "done" : ""}`} onClick={() => copyLink(l.url, i)}>
              {copied === i ? "✓ Copied" : "Copy"}
            </button>
          </div>
        ))}
        <div style={{fontSize:11,color:COLORS.muted,marginTop:12}}>
          All links are read-only for non-admin users. Individual format: ?user=firstname_lastname
        </div>
      </div>

      <div className="metric-card" style={{marginBottom:20}}>
        <div className="metric-title">🗃 Data Management</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <button className="btn-primary" onClick={() => {
            const data = JSON.stringify({schedule, year: currentYear, month: currentMonth}, null, 2);
            const blob = new Blob([data], {type:"application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `schedule_${currentYear}_${currentMonth+1}.json`; a.click();
          }}>⬇ Export Schedule JSON</button>
          <button className="btn-primary" style={{background:"var(--success)"}} onClick={() => {
            const rows = [["Member","Team","Day","Shift","Status","Note"]];
            Object.entries(TEAM_CONFIG).forEach(([tk, team]) => {
              team.members.forEach(m => {
                Object.entries(schedule[m] || {}).forEach(([d, dd]) => {
                  rows.push([m, tk, d, dd?.shift?.id || "", dd?.modifier || "", dd?.note || ""]);
                });
              });
            });
            const csv = rows.map(r => r.join(",")).join("\n");
            const blob = new Blob([csv], {type:"text/csv"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href=url; a.download=`schedule_${currentYear}_${currentMonth+1}.csv`; a.click();
          }}>⬇ Export CSV</button>
          <div style={{fontSize:11,color:COLORS.muted,alignSelf:"center"}}>
            Schedule is auto-saved to localStorage. Data persists between sessions.
          </div>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-title">🔐 Role-Based Access Control</div>
        <table className="table-mini" style={{width:"100%"}}>
          <thead><tr><th>Role</th><th>Credentials</th><th>Access Level</th></tr></thead>
          <tbody>
            <tr><td style={{color:COLORS.accent}}>ADMIN</td><td style={{color:COLORS.muted}}>admin / admin123</td><td style={{color:COLORS.offWhite}}>Full access — edit all teams, mass override, audit logs, export</td></tr>
            <tr><td style={{color:COLORS.accent}}>LEAD</td><td style={{color:COLORS.muted}}>harman / lead123</td><td style={{color:COLORS.offWhite}}>Edit own team only — Harmanpreet→CSIRT, Saurav→Threat, Manveer→Projects</td></tr>
            <tr><td style={{color:COLORS.accent}}>LEAD</td><td style={{color:COLORS.muted}}>saurav / lead123</td><td style={{color:COLORS.offWhite}}>Edit Threat Management only</td></tr>
            <tr><td style={{color:COLORS.accent}}>LEAD</td><td style={{color:COLORS.muted}}>manveer / lead123</td><td style={{color:COLORS.offWhite}}>Edit Security Projects only</td></tr>
            <tr><td style={{color:COLORS.muted}}>MEMBER</td><td style={{color:COLORS.muted}}>member / member123</td><td style={{color:COLORS.offWhite}}>Read-only — own schedule and team overview only</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LOGIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const user = USERS.find(u => u.id === username && u.password === password);
    if (user) { setError(""); onLogin(user); }
    else setError("Invalid credentials. Check the demo accounts below.");
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">🛡</div>
        <div className="login-title">SecOps Scheduler</div>
        <div className="login-sub">OPERATIONS CENTER · SHIFT MANAGEMENT PORTAL</div>
        {error && <div className="login-error">⚠ {error}</div>}
        <div className="login-field">
          <label className="login-label">Username</label>
          <input className="login-input" value={username} onChange={e=>setUsername(e.target.value)}
            placeholder="admin / harman / saurav / manveer / member"
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        </div>
        <div className="login-field">
          <label className="login-label">Password</label>
          <input type="password" className="login-input" value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="admin123 / lead123 / member123"
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        </div>
        <button className="login-btn" onClick={handleSubmit}>SIGN IN →</button>
        <div className="login-demo">
          <div className="login-demo-title">Demo Credentials</div>
          {[["admin","admin123","Full Admin"],["harman","lead123","CSIRT Lead"],["saurav","lead123","Threat Lead"],["manveer","lead123","Projects Lead"],["member","member123","Read-Only Member"]].map(([u,p,role])=>(
            <div key={u} className="login-demo-row">
              <span className="login-demo-label">{u} / {p}</span>
              <span className="login-demo-val">{role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "secops_schedule_v3";
const AUDIT_KEY = "secops_audit_v3";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [tab, setTab] = useState("overview");
  const [editCell, setEditCell] = useState(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [time, setTime] = useState(now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));
  const [auditLogs, setAuditLogs] = useState(() => {
    try { const s = localStorage.getItem(AUDIT_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // Schedule keyed by "YYYY-M"
  const [allSchedules, setAllSchedules] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) return JSON.parse(s);
    } catch {}
    return {};
  });

  const scheduleKey = `${currentYear}-${currentMonth}`;

  const schedule = useMemo(() => {
    if (allSchedules[scheduleKey]) return allSchedules[scheduleKey];
    return generateSchedule(currentYear, currentMonth);
  }, [allSchedules, scheduleKey, currentYear, currentMonth]);

  const ensureScheduleExists = useCallback(() => {
    if (!allSchedules[scheduleKey]) {
      const gen = generateSchedule(currentYear, currentMonth);
      setAllSchedules(prev => {
        const next = {...prev, [scheduleKey]: gen};
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, [allSchedules, scheduleKey, currentYear, currentMonth]);

  useEffect(() => { ensureScheduleExists(); }, [currentYear, currentMonth]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})), 1000);
    return () => clearInterval(t);
  }, []);

  const addAuditLog = useCallback((entry) => {
    const log = { ...entry, timestamp: new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) };
    setAuditLogs(prev => {
      const next = [...prev, log];
      try { localStorage.setItem(AUDIT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const handleSaveCell = useCallback((member, day, newData, reason) => {
    setAllSchedules(prev => {
      const existing = prev[scheduleKey] || generateSchedule(currentYear, currentMonth);
      const next = {
        ...prev,
        [scheduleKey]: {
          ...existing,
          [member]: { ...(existing[member] || {}), [day]: newData }
        }
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    addAuditLog({
      icon: "✏️", type: "EDIT",
      msg: `${currentUser?.name || "Admin"} updated ${member} — Day ${day}`,
      detail: `Shift: ${newData.shift?.label || "Off"} (${newData.shift?.start || ""}–${newData.shift?.end || ""}) | Status: ${newData.modifier}${newData.note ? " | "+newData.note : ""}`,
      reason: reason
    });
  }, [scheduleKey, currentYear, currentMonth, addAuditLog, currentUser]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear(y=>y-1); setCurrentMonth(11); }
    else setCurrentMonth(m=>m-1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear(y=>y+1); setCurrentMonth(0); }
    else setCurrentMonth(m=>m+1);
  };

  if (!currentUser) return (
    <>
      <style>{CSS}</style>
      <LoginScreen onLogin={setCurrentUser} />
    </>
  );

  const tabs = [
    { id:"overview", label:"Overview" },
    { id:"calendar", label:"Calendar" },
    { id:"timeline", label:"Timeline" },
    { id:"metrics", label:"Metrics" },
    ...(currentUser.role !== ROLES.MEMBER ? [{ id:"admin", label:"Admin" }] : []),
    { id:"audit", label:"Audit Log", badge: auditLogs.length },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="header">
          <div className="header-inner">
          <div className="header-brand">
            <div className="brand-icon">🛡</div>
            <div>
              <div className="brand-name">SecOps Scheduler</div>
              <div className="brand-sub">Operations Center · Shift Management Portal</div>
            </div>
          </div>
          <div className="header-center">
            <button className="month-nav-btn" onClick={prevMonth}>‹</button>
            <div className="month-label">{getMonthName(currentYear, currentMonth)}</div>
            <button className="month-nav-btn" onClick={nextMonth}>›</button>
          </div>
          <div className="header-right">
            <div className="live-dot"><div className="pulse"/>LIVE</div>
            <div className="clock">{time}</div>
            <div className="user-chip">
              <div className="user-avatar">{getInitials(currentUser.name)}</div>
              <div>
                <div className="user-name">{currentUser.name}</div>
                <div className="user-role">{currentUser.role}</div>
              </div>
            </div>
            <button className="logout-btn" onClick={() => setCurrentUser(null)}>Sign Out</button>
          </div>
          </div>
        </header>

        <nav className="nav">
          <div className="nav-inner">
          {tabs.map(t => (
            <button key={t.id} className={`nav-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
              {t.badge ? <span className="nav-badge">{t.badge}</span> : null}
            </button>
          ))}
          {currentUser.role !== ROLES.MEMBER && (
            <button
              className="bulk-nav-btn"
              style={{marginLeft:"auto"}}
              onClick={() => setShowBulkAssign(true)}
            >
              ⚡ Bulk Assign
            </button>
          )}
          </div>
        </nav>

        <main className="main">
          {tab === "overview" && <OverviewTab schedule={schedule} currentYear={currentYear} currentMonth={currentMonth} currentUser={currentUser} />}
          {tab === "calendar" && <CalendarTab schedule={schedule} currentYear={currentYear} currentMonth={currentMonth} onEditCell={setEditCell} currentUser={currentUser} />}
{tab === "timeline" && <TimelineTab schedule={schedule} currentYear={currentYear} currentMonth={currentMonth} allSchedules={allSchedules} />}          {tab === "metrics" && <MetricsTab schedule={schedule} currentYear={currentYear} currentMonth={currentMonth} />}
          {tab === "admin" && currentUser.role !== ROLES.MEMBER && <AdminTab schedule={schedule} currentYear={currentYear} currentMonth={currentMonth} addAuditLog={addAuditLog} currentUser={currentUser} />}
          {tab === "audit" && <AuditTab auditLogs={auditLogs} />}
        </main>

        {editCell && (
          <EditModal
            cell={editCell}
            schedule={schedule}
            onSave={handleSaveCell}
            onClose={() => setEditCell(null)}
            currentUser={currentUser}
          />
        )}

        {showBulkAssign && (
          <BulkAssignDrawer
            onClose={() => setShowBulkAssign(false)}
            allSchedules={allSchedules}
            setAllSchedules={setAllSchedules}
            addAuditLog={addAuditLog}
            currentUser={currentUser}
          />
        )}
      </div>
    </>
  );
}