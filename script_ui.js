
  // =====================================================
  // [0] Helpers
  // =====================================================
  function _nickKey(suffix) {
    // 닉 귀속 로컬키
    const n = (typeof myNick === "string" && myNick.trim()) ? myNick.trim() : "";
    return n ? `${suffix}_${n}` : suffix;
  }

  // =====================================================
  // ✅ Layout + Narrow Chat Focus (FIX)
  // =====================================================
  function setLayout(order) {
    const o = Number(order) === -1 ? -1 : 1;

    // 오른쪽: main(1), sidebar(2)
    // 왼쪽 : main(2), sidebar(1)
    const mainOrder = (o === 1) ? 1 : 2;
    const sideOrder = (o === 1) ? 2 : 1;

    document.documentElement.style.setProperty("--main-order", String(mainOrder));
    document.documentElement.style.setProperty("--sidebar-order", String(sideOrder));

    localStorage.setItem("sidebarOrder", String(o));
  }
  window.setLayout = setLayout;

  function applySavedLayout() {
    const saved = parseInt(localStorage.getItem("sidebarOrder") || "1", 10);
    setLayout(saved === -1 ? -1 : 1);
  }

  function applyNarrowChatFocus() {
    const w = window.innerWidth || document.documentElement.clientWidth;
    const on = w <= 980;
    document.body.classList.toggle("narrow-chat-focus", on);

    if (on && typeof window.scrollChatToBottom === "function") {
      setTimeout(() => window.scrollChatToBottom(true), 50);
    }
  }
  window.applyNarrowChatFocus = applyNarrowChatFocus;

  function applyChatOnlyModeIfMobile() {
    const isMobile =
      /Android|iPhone|iPod|iPad/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));

    window.isMobile = isMobile;

    if (isMobile) {
      document.body.classList.add("narrow-chat-focus");
      if (typeof window.scrollChatToBottom === "function") {
        setTimeout(() => window.scrollChatToBottom(true), 50);
      }
    }
  }
  window.applyChatOnlyModeIfMobile = applyChatOnlyModeIfMobile;

  window.addEventListener("resize", () => {
    // 모바일이면 고정, 데스크탑이면 폭 기반
    if (window.isMobile) return;
    applyNarrowChatFocus();
  });

  // =====================================================
  // [1] 전역 상태
  // =====================================================
  let currentTheme = localStorage.getItem("writerTheme") || "Light (iOS)"; // 로그인 전 기본값
  let _soundPrefs = { enabled: true, volume: 60, workSound: "soft_bell", restSound: "calm_chime" };
  let _pomoParticipating = true;

  const SOUND_PRESETS = [
    { id: "soft_bell",    name: "Soft Bell" },
    { id: "calm_chime",   name: "Calm Chime" },
    { id: "digital_beep", name: "Digital Beep" },
    { id: "retro_ping",   name: "Retro Ping" },
    { id: "tiny_pop",     name: "Tiny Pop" },
    { id: "deep_gong",    name: "Deep Gong" },
    { id: "sparkle",      name: "Sparkle" },
    { id: "focus_tick",   name: "Focus Tick" }
  ];

  // =====================================================
  // ✅ Method B: 시스템 메시지 dedupe wrapper
  // =====================================================
  function installChatRenderDedupeWrapper() {
    const fn = window.renderChatMessage;
    if (typeof fn !== "function") return false;
    if (fn.__dedupeInstalled) return true;

    const seenPomo = new Set(); // "seq|phase"
    let lastSys = { msg: "", time: 0 };

    function isDuplicateSystem(data) {
      if (!data || data.type !== "system") return false;

      const msg = String(data.msg || "");
      const t = Number(data.time || Date.now());

      const seq = data.pomoSeq;
      const phase = data.pomoPhase;
      if (seq !== undefined && phase !== undefined) {
        const k = `${seq}|${phase}`;
        if (seenPomo.has(k)) return true;
        seenPomo.add(k);
        return false;
      }

      if (msg && msg === lastSys.msg && Math.abs(t - lastSys.time) <= 90000) return true;
      lastSys = { msg, time: t };
      return false;
    }

    const wrapped = function(box, data, key) {
      try { if (isDuplicateSystem(data)) return; } catch(e) {}
      // ✅ [FIX] key(3번째 인자)까지 그대로 전달해야 답장 기능의 data-key가 채워짐
      return fn.call(this, box, data, key);
    };

    wrapped.__dedupeInstalled = true;
    window.renderChatMessage = wrapped;
    return true;
  }

  // =====================================================
  // 🎨 Themes
  // =====================================================
  const themes = {
    "Light (iOS)": { isDark:false, bg:"#F6F7F9", text:"#141618", me:"#0A84FF", other:"#E9EBEF", header:"#EEF0F3", meText:"#FFFFFF", otherText:"#141618" },
    "Dark (기본)": { isDark:true, bg:"#202225", text:"#D9DDE3", me:"#7A8A9A", other:"#2C2F34", header:"#26292E", meText:"#16181B", otherText:"#D9DDE3" },
    "카카오톡":   { isDark:false, bg:"#BACEe0", text:"#0F1115", me:"#FEE500", other:"#FFFFFF", header:"#ABC1D1", meText:"#111111", otherText:"#111111" },

  // =====================================================
  // ✅ 감성 컬러 테마 10종 (카카오톡식 대비)
  // =====================================================

  "🌸 벚꽃 + 버터": {
    isDark: false,
    bg: "#FFF0F5",
    text: "#3A1F2A",
    me: "#FFD966",
    other: "#FFDDE8",
    header: "#FFE4EF",
    meText: "#3A2800",
    otherText: "#3A1F2A"
  },

  "🩵 하늘 + 로즈": {
    isDark: false,
    bg: "#EEF7FF",
    text: "#1A2A3A",
    me: "#F4A7B9",
    other: "#D6EEFF",
    header: "#DCF0FF",
    meText: "#2A0A14",
    otherText: "#1A2A3A"
  },

  "🍋 레몬 + 라벤더": {
    isDark: false,
    bg: "#FFFBEC",
    text: "#2A2535",
    me: "#C9B8E8",
    other: "#FFF3BB",
    header: "#FFF8D6",
    meText: "#1A0E30",
    otherText: "#2A2535"
  },

  "🌿 민트 + 피치": {
    isDark: false,
    bg: "#F0FBF7",
    text: "#1A2E28",
    me: "#FFB499",
    other: "#C8F0E2",
    header: "#D8F5EC",
    meText: "#2A1000",
    otherText: "#1A2E28"
  },

  "🌙 라일락 + 크림": {
    isDark: false,
    bg: "#F7F2FF",
    text: "#28203A",
    me: "#FFE5B4",
    other: "#E8DEFF",
    header: "#EDE4FF",
    meText: "#2A1A00",
    otherText: "#28203A"
  },

  "🍓 딸기 + 스카이": {
    isDark: false,
    bg: "#FFF5F7",
    text: "#2A1A20",
    me: "#87CEEB",
    other: "#FFD6DC",
    header: "#FFE0E6",
    meText: "#0A2030",
    otherText: "#2A1A20"
  },

  "🧁 코튼캔디": {
    isDark: false,
    bg: "#FFF0FA",
    text: "#2E1A2E",
    me: "#A8DAFF",
    other: "#FFD6F5",
    header: "#FFE4FB",
    meText: "#0A1E30",
    otherText: "#2E1A2E"
  },

  "🍊 오렌지 + 아쿠아": {
    isDark: false,
    bg: "#FFFAF0",
    text: "#2A2010",
    me: "#7FD8D4",
    other: "#FFE0B8",
    header: "#FFEECF",
    meText: "#0A2020",
    otherText: "#2A2010"
  },

  "🫐 블루베리 + 샴페인": {
    isDark: false,
    bg: "#F3F0FF",
    text: "#1E1A30",
    me: "#F5E6C8",
    other: "#DDD6FF",
    header: "#E8E2FF",
    meText: "#2A1E00",
    otherText: "#1E1A30"
  },

  "🌺 산호 + 민트크림": {
    isDark: false,
    bg: "#FFF6F4",
    text: "#2A1A18",
    me: "#B8F0E0",
    other: "#FFD4CC",
    header: "#FFE2DC",
    meText: "#0A2418",
    otherText: "#2A1A18"
  },

    "🍵 말차 + 레몬": {
    isDark: false,
    bg: "#F4FAF0",
    text: "#1E2A1A",
    me: "#F9F07A",
    other: "#C8E6C0",
    header: "#D8F0D0",
    meText: "#2A2200",
    otherText: "#1E2A1A"
  },

  "🌱 새싹 + 복숭아": {
    isDark: false,
    bg: "#F2F9F0",
    text: "#1A2818",
    me: "#FFCBA4",
    other: "#C4E8BC",
    header: "#D2EEC8",
    meText: "#2A1400",
    otherText: "#1A2818"
  },

  "🫚 올리브 + 바닐라": {
    isDark: false,
    bg: "#F6F8EE",
    text: "#222818",
    me: "#FFF5CC",
    other: "#DDE8C0",
    header: "#E6EED0",
    meText: "#2A2200",
    otherText: "#222818"
  },

  "🌊 아쿠아 + 선셋": {
    isDark: false,
    bg: "#EEF9F8",
    text: "#182828",
    me: "#FFCF99",
    other: "#C0E8E4",
    header: "#CCEEE8",
    meText: "#2A1800",
    otherText: "#182828"
  },

  "🍃 그린티 + 라이트핑크": {
    isDark: false,
    bg: "#EEF7EE",
    text: "#1A281A",
    me: "#FFD6E0",
    other: "#C2DFC2",
    header: "#D0ECD0",
    meText: "#2A0A14",
    otherText: "#1A281A"
  },

  "🌤️ 안개꽃 + 하늘": {
    isDark: false,
    bg: "#F2F6FF",
    text: "#1A2030",
    me: "#B8E4FF",
    other: "#E2E8FF",
    header: "#EAF0FF",
    meText: "#0A1E2A",
    otherText: "#1A2030"
  },

  "🍈 유자 + 세이지": {
    isDark: false,
    bg: "#F8FAF0",
    text: "#20281A",
    me: "#FFF0A0",
    other: "#D4E8C8",
    header: "#E0EED4",
    meText: "#282000",
    otherText: "#20281A"
  },

  "🌷 튤립 + 버터밀크": {
    isDark: false,
    bg: "#FFF8F8",
    text: "#2E1A1A",
    me: "#FFF2C0",
    other: "#FFD8DC",
    header: "#FFE4E8",
    meText: "#2A2000",
    otherText: "#2E1A1A"
  },

  "🫧 소다 + 라임": {
    isDark: false,
    bg: "#F0FEF8",
    text: "#182820",
    me: "#D4F5A0",
    other: "#C0F0E8",
    header: "#CCEEE4",
    meText: "#182400",
    otherText: "#182820"
  },

  "🌻 해바라기 + 스카이": {
    isDark: false,
    bg: "#FFFCEE",
    text: "#28220A",
    me: "#ADE8F4",
    other: "#FFF0B0",
    header: "#FFF6CC",
    meText: "#082030",
    otherText: "#28220A"
  },

  "🌿 세이지 + 크림": {
    isDark: false,
    bg: "#DDE8DC",
    text: "#1E2A1E",
    me: "#EEE8D5",
    other: "#CBD8CA",
    header: "#D4E2D3",
    meText: "#2A2418",
    otherText: "#1E2A1E"
  },

  "🩶 스모크 블루 + 아이보리": {
    isDark: false,
    bg: "#D8DDE8",
    text: "#1A1E2A",
    me: "#EEE8D5",
    other: "#C8CDD8",
    header: "#CDD3E2",
    meText: "#1E1A10",
    otherText: "#1A1E2A"
  },

  "🌸 로즈 애쉬 + 밀크": {
    isDark: false,
    bg: "#E8D8D8",
    text: "#2A1E1E",
    me: "#F0EBE0",
    other: "#D8C8C8",
    header: "#E2CDCD",
    meText: "#2A2010",
    otherText: "#2A1E1E"
  },

  "🌾 샌드 + 오트밀": {
    isDark: false,
    bg: "#E2DDD0",
    text: "#28221A",
    me: "#EDE8DA",
    other: "#D4CFC2",
    header: "#DAD5C6",
    meText: "#28220E",
    otherText: "#28221A"
  },

  "💜 라벤더 애쉬 + 크림": {
    isDark: false,
    bg: "#E0DAE8",
    text: "#22182A",
    me: "#EEE8DC",
    other: "#D2CCDA",
    header: "#D8D0E2",
    meText: "#201A0E",
    otherText: "#22182A"
  },

    "밤샘 · 무채 차콜": { isDark:true, bg:"#2A2C2F", text:"#D6D8DC", me:"#7C7F83", other:"#34373B", header:"#303338", meText:"#1F2124", otherText:"#D6D8DC" },
    "밤샘 · 페이드 슬레이트": { isDark:true, bg:"#2C3136", text:"#D4D9DE", me:"#7A8289", other:"#383F46", header:"#333A42", meText:"#20252A", otherText:"#D4D9E0" },
    "밤샘 · 로우 콘트라스트": { isDark:true, bg:"#2F3134", text:"#D2D5D9", me:"#808387", other:"#3A3C40", header:"#35383C", meText:"#222427", otherText:"#D2D5D9" },
    "밤샘 · 스모크 애쉬": { isDark:true, bg:"#303336", text:"#D8DBDF", me:"#868A8E", other:"#3C4045", header:"#373B40", meText:"#23262A", otherText:"#D8DBDF" },
    "밤샘 · 페이퍼 차콜": { isDark:true, bg:"#2E3033", text:"#DADDE0", me:"#84888C", other:"#3A3D41", header:"#34373B", meText:"#212326", otherText:"#DADDE0" },
  };

  function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(10,132,255,${alpha})`;
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const r = parseInt(full.substring(0, 2), 16);
    const g = parseInt(full.substring(2, 4), 16);
    const b = parseInt(full.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function applyTheme(name) {
    const t = themes[name] || themes["Light (iOS)"];
    const r = document.documentElement.style;
    const root = document.documentElement;
    const isDark = !!t.isDark;

    root.setAttribute("data-theme-mode", "manual");
    root.setAttribute("data-is-dark", isDark ? "true" : "false");

    const bg = t.bg || "#E9EDF3";
    const panel  = t.panel  || (isDark ? "rgba(22,24,28,.96)" : hexToRgba(bg, 0.70));
    const panel2 = t.panel2 || (isDark ? "rgba(22,24,28,.90)" : hexToRgba(bg, 0.62));
    const surface= t.surface|| (isDark ? "rgba(22,24,28,.88)" : hexToRgba(bg, 0.56));

    r.setProperty("--panel", panel);
    r.setProperty("--panel2", panel2);
    r.setProperty("--surface", surface);

    r.setProperty("--border", isDark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.10)");
    r.setProperty("--glass", isDark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.55)");
    r.setProperty("--glass2", isDark ? "rgba(255,255,255,.06)" : "rgba(242,242,247,.70)");
    r.setProperty("--modal-bg", isDark ? "rgba(18,18,22,.92)" : "rgba(255,255,255,.92)");
    r.setProperty("--modal-border", isDark ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.65)");
    r.setProperty("--focus-bg", isDark ? "rgba(255,255,255,.08)" : "#fff");

    r.setProperty("--muted", isDark ? "rgba(235,235,245,.68)" : "rgba(60,60,67,.72)");
    r.setProperty("--muted-strong", isDark ? "rgba(235,235,245,.86)" : "rgba(60,60,67,.88)");
    r.setProperty("--sub-muted", isDark ? "rgba(235,235,245,.72)" : "rgba(60,60,67,.75)");
    r.setProperty("--name-muted", isDark ? "rgba(235,235,245,.75)" : "rgba(60,60,67,.60)");
    r.setProperty("--time-muted", isDark ? "rgba(235,235,245,.42)" : "rgba(60,60,67,.45)");

    r.setProperty("--input-bg", isDark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.92)");
    r.setProperty("--input-text", isDark ? (t.text || "#f2f3f5") : (t.text || "#111111"));

    r.setProperty("--bg", bg);
    r.setProperty("--text", t.text);
    r.setProperty("--me", t.me);
    r.setProperty("--other", t.other);
    r.setProperty("--header", t.header);
    r.setProperty("--me-text", t.meText);
    r.setProperty("--other-text", t.otherText || (isDark ? "#f2f3f5" : "#111111"));

    r.setProperty("--timer-a", hexToRgba(t.me || "#0A84FF", isDark ? 0.14 : 0.10));
    r.setProperty("--timer-b", hexToRgba("#30D158", isDark ? 0.14 : 0.10));
    r.setProperty("--timer-text", isDark ? "rgba(235,235,245,.92)" : "rgba(60,60,67,.95)");

    currentTheme = name;
    renderThemePalette();
  }

  function renderThemePalette() {
    const grid = document.querySelector(".theme-grid");
    if (!grid) return;

    const names = Object.keys(themes || {});
    if (!names.length) return;

    const existing = grid.querySelectorAll(".theme-chip");
    if (existing.length !== names.length) {
      grid.innerHTML = "";
      names.forEach((name) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "theme-chip";
        btn.setAttribute("data-theme", name);
        btn.title = name;

        const dot = document.createElement("span");
        dot.className = "chip-dot";
        btn.appendChild(dot);

        btn.addEventListener("click", async () => {
          applyTheme(name);
          await saveThemeForNick(name);
        });

        grid.appendChild(btn);
      });
    }

    grid.querySelectorAll(".theme-chip").forEach((btn) => {
      const name = btn.getAttribute("data-theme");
      const t = themes[name];
      if (!t) return;

      const bg = t.bg || "#E9EDF3";
      const me = t.me || "#0A84FF";

      btn.style.setProperty("--chip-bg", bg);
      btn.style.setProperty("--chip-me", me);
      btn.style.background = `linear-gradient(90deg, ${bg} 0 50%, ${me} 50% 100%)`;
      btn.style.borderColor = t.isDark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.10)";
      btn.classList.toggle("selected", name === currentTheme);
    });
  }

  async function saveThemeForNick(themeName) {
    try {
      localStorage.setItem(_nickKey("writerTheme"), themeName);
      localStorage.setItem("writerTheme", themeName);
    } catch(e) {}

    if (!myNick || !window.db) return;

    try {
      await db.ref(`users/${myNick}/theme`).set({
        name: themeName,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("[saveThemeForNick failed]", e);
    }
  }

  async function loadThemeForNick() {
    try {
      const localNick = localStorage.getItem(_nickKey("writerTheme"));
      if (localNick) return localNick;
    } catch(e) {}

    if (myNick && window.db) {
      try {
        const snap = await db.ref(`users/${myNick}/theme`).once("value");
        const v = snap.val();
        if (v && v.name) return String(v.name);
      } catch(e) {
        console.warn("[loadThemeForNick failed]", e);
      }
    }

    try {
      return localStorage.getItem("writerTheme") || "Light (iOS)";
    } catch(e) {
      return "Light (iOS)";
    }
  }

  // =====================================================
  // Settings modal
  // =====================================================
  let timerHidden = localStorage.getItem("timerHidden") === "true";
  let warnMinutes = parseInt(localStorage.getItem("warnMinutes") || "10", 10);

  function openSettings() {
    if (window.isMobile) return;

    const modal = document.getElementById("settings-modal");
    if (!modal) return;
    modal.style.display = "flex";

    const slider = document.getElementById("set-chat-width");
    const label = document.getElementById("chat-width-label");
    const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width")) || 360;

    if (slider && label) {
      slider.value = current;
      label.innerText = String(current);
      slider.oninput = () => {
        resizeChat(slider.value);
        label.innerText = String(slider.value);
        localStorage.setItem("chatWidth", String(slider.value));
      };
    }

    const chk = document.getElementById("set-timer-hide");
    if (chk) {
      chk.checked = timerHidden;
      chk.onchange = () => {
        timerHidden = chk.checked;
        localStorage.setItem("timerHidden", String(timerHidden));
        applyTimerVisibility();
      };
    }

    const warn = document.getElementById("set-warn-min");
    const warnLabel = document.getElementById("warn-min-label");
    if (warn && warnLabel) {
      warn.value = warnMinutes;
      warnLabel.innerText = String(warnMinutes);
      warn.oninput = () => {
        warnMinutes = parseInt(warn.value, 10);
        localStorage.setItem("warnMinutes", String(warnMinutes));
        warnLabel.innerText = String(warnMinutes);
      };
    }

    renderThemePalette();
    window.bindAdminEasterEgg?.();
    window.refreshAdminUiVisibility?.();
  }

  function closeSettings() {
    const m = document.getElementById("settings-modal");
    if (m) m.style.display = "none";
  }

  function openTab(name) {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
    if (name === "theme") renderThemePalette();
    if (name === "privacy") {
      window.bindAdminEasterEgg?.();
      window.refreshAdminUiVisibility?.();
    }
  }

  function resizeChat(val) {
    document.documentElement.style.setProperty("--sidebar-width", val + "px");
  }

  function applyTimerVisibility() {
    const wrap = document.getElementById("timer-wrap");
    if (!wrap) return;
    wrap.style.display = timerHidden ? "none" : "flex";

    const detail = document.getElementById("pomo-detail");
    if (detail) detail.style.display = timerHidden ? "none" : "block";
  }

  // =====================================================
  // 🔊 Pomodoro Sound Engine
  // =====================================================
  let _audioCtx = null;
  let _audioUnlocked = false;

  function _getAudioCtx() {
    if (_audioCtx) return _audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
    return _audioCtx;
  }

  async function _unlockAudio() {
    const ctx = _getAudioCtx();
    if (!ctx) return false;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.00001;
      o.connect(g).connect(ctx.destination);
      o.frequency.value = 440;
      o.start();
      o.stop(ctx.currentTime + 0.02);
      _audioUnlocked = true;
      return true;
    } catch (e) {
      console.warn("[audio unlock failed]", e);
      return false;
    }
  }

  function _playEnvelopeTone({ freq=440, type="sine", start=0, dur=0.18, vol=0.2 }) {
    const ctx = _getAudioCtx();
    if (!ctx) return;

    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = type;
    o.frequency.setValueAtTime(freq, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function _playPreset(presetId, volume01) {
    const v = Math.max(0, Math.min(1, volume01));
    const base = 0.30 * v;

    switch (presetId) {
      case "soft_bell":
        _playEnvelopeTone({ freq: 784, type:"sine",   start:0.00, dur:0.16, vol:base });
        _playEnvelopeTone({ freq: 1046, type:"sine",  start:0.05, dur:0.18, vol:base*0.9 });
        break;
      case "calm_chime":
        _playEnvelopeTone({ freq: 659, type:"triangle", start:0.00, dur:0.22, vol:base });
        _playEnvelopeTone({ freq: 880, type:"triangle", start:0.07, dur:0.24, vol:base*0.85 });
        break;
      case "digital_beep":
        _playEnvelopeTone({ freq: 880, type:"square", start:0.00, dur:0.10, vol:base*0.9 });
        _playEnvelopeTone({ freq: 988, type:"square", start:0.12, dur:0.10, vol:base*0.9 });
        break;
      case "retro_ping":
        _playEnvelopeTone({ freq: 523, type:"sine", start:0.00, dur:0.12, vol:base });
        _playEnvelopeTone({ freq: 784, type:"sine", start:0.10, dur:0.14, vol:base*0.85 });
        break;
      case "tiny_pop":
        _playEnvelopeTone({ freq: 1200, type:"triangle", start:0.00, dur:0.07, vol:base });
        _playEnvelopeTone({ freq: 800,  type:"triangle", start:0.06, dur:0.08, vol:base*0.7 });
        break;
      case "deep_gong":
        _playEnvelopeTone({ freq: 196, type:"sine", start:0.00, dur:0.28, vol:base });
        _playEnvelopeTone({ freq: 98,  type:"sine", start:0.00, dur:0.32, vol:base*0.55 });
        break;
      case "sparkle":
        _playEnvelopeTone({ freq: 1046, type:"sine", start:0.00, dur:0.10, vol:base*0.9 });
        _playEnvelopeTone({ freq: 1318, type:"sine", start:0.08, dur:0.10, vol:base*0.8 });
        _playEnvelopeTone({ freq: 1568, type:"sine", start:0.16, dur:0.10, vol:base*0.7 });
        break;
      case "focus_tick":
      default:
        _playEnvelopeTone({ freq: 740, type:"square", start:0.00, dur:0.06, vol:base*0.75 });
        _playEnvelopeTone({ freq: 740, type:"square", start:0.10, dur:0.06, vol:base*0.75 });
        break;
    }
  }

  async function playPomodoroSound(eventType) {
    if (!_pomoParticipating) return;
    if (!_soundPrefs?.enabled) return;
    if (!_audioUnlocked) await _unlockAudio();

    const vol01 = (Number(_soundPrefs.volume) || 0) / 100;
    if (vol01 <= 0) return;

    const preset = (eventType === "rest_start")
      ? (_soundPrefs.restSound || "calm_chime")
      : (_soundPrefs.workSound || "soft_bell");

    _playPreset(preset, vol01);
  }

  async function testPresetSound(presetId) {
    await _unlockAudio();
    const vol01 = (Number(_soundPrefs.volume) || 0) / 100;
    if (vol01 <= 0) return;
    _playPreset(String(presetId || "soft_bell"), vol01);
  }

  async function saveSoundPrefsToFirebase(prefs) {
    if (!myNick) return;
    try {
      await db.ref(`users/${myNick}/soundPrefs`).update({
        enabled: !!prefs.enabled,
        volume: Number(prefs.volume) || 0,
        workSound: String(prefs.workSound || "soft_bell"),
        restSound: String(prefs.restSound || "calm_chime"),
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("[saveSoundPrefsToFirebase failed]", e);
    }
  }

  async function loadSoundPrefsFromFirebase() {
    if (!myNick) return _soundPrefs;
    try {
      const snap = await db.ref(`users/${myNick}/soundPrefs`).once("value");
      const v = snap.val();
      if (v) {
        _soundPrefs = {
          enabled: (v.enabled !== undefined ? !!v.enabled : true),
          volume: Math.max(0, Math.min(100, parseInt(v.volume ?? 60, 10))),
          workSound: String(v.workSound || "soft_bell"),
          restSound: String(v.restSound || "calm_chime")
        };
      }
    } catch (e) {
      console.warn("[loadSoundPrefsFromFirebase failed]", e);
    }
    return _soundPrefs;
  }

  async function savePomoParticipationToFirebase(isOn) {
    if (!myNick) return;
    try {
      await db.ref(`users/${myNick}/pomoParticipation`).set({
        participating: !!isOn,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("[savePomoParticipationToFirebase failed]", e);
    }
  }

  async function loadPomoParticipationFromFirebase() {
    if (!myNick) return _pomoParticipating;
    try {
      const snap = await db.ref(`users/${myNick}/pomoParticipation`).once("value");
      const v = snap.val();
      if (v && typeof v.participating === "boolean") _pomoParticipating = v.participating;
    } catch (e) {
      console.warn("[loadPomoParticipationFromFirebase failed]", e);
    }
    return _pomoParticipating;
  }

  function _renderParticipationButton() {
    const btn = document.getElementById("pomo-opt-btn");
    if (!btn) return;
    if (_pomoParticipating) {
      btn.dataset.state = "on";
      btn.textContent = "🔔 참가 중";
      btn.classList.remove("danger");
      btn.classList.add("primary");
    } else {
      btn.dataset.state = "off";
      btn.textContent = "🔕 참가하기";
      btn.classList.remove("primary");
      btn.classList.add("danger");
    }
  }

  async function togglePomodoroParticipation() {
    _pomoParticipating = !_pomoParticipating;
    _renderParticipationButton();

    try { localStorage.setItem(_nickKey("pomoParticipating"), _pomoParticipating ? "true" : "false"); } catch(e) {}
    await savePomoParticipationToFirebase(_pomoParticipating);

    try { await _unlockAudio(); } catch(e) {}
  }
  window.togglePomodoroParticipation = togglePomodoroParticipation;

  function togglePomoDetail(forceState) {
    const detail = document.getElementById("pomo-detail");
    const btn = document.getElementById("pomo-detail-toggle");
    if (!detail || !btn) return;

    const collapsed = detail.classList.contains("collapsed");
    const nextCollapsed = (typeof forceState === "boolean") ? !forceState : !collapsed;

    detail.classList.toggle("collapsed", nextCollapsed);
    btn.textContent = nextCollapsed ? "▾" : "▴";

    try { localStorage.setItem(_nickKey("pomoDetailCollapsed"), nextCollapsed ? "true" : "false"); } catch(e) {}
  }
  window.togglePomoDetail = togglePomoDetail;

  function renderPomodoroSoundMini() {
    const host = document.getElementById("pomo-sound-mini");
    if (!host) return;

    const options = SOUND_PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

    host.innerHTML = `
      <div class="pomo-sound-card">
        <div class="pomo-sound-title">🔊 알림음(개인)</div>
        <div class="pomo-sound-row">
          <label class="pomo-sound-item">
            <span>사용</span>
            <input id="pomo-sound-enabled" type="checkbox">
          </label>
          <label class="pomo-sound-item" style="flex:1;">
            <span>볼륨</span>
            <input id="pomo-sound-vol" type="range" min="0" max="100" step="1" style="width:100%;">
          </label>
        </div>

        <div class="pomo-sound-row">
          <label class="pomo-sound-item" style="flex:1;">
            <span>작업</span>
            <select id="pomo-sound-work" style="width:100%;">${options}</select>
          </label>
          <label class="pomo-sound-item" style="flex:1;">
            <span>휴식</span>
            <select id="pomo-sound-rest" style="width:100%;">${options}</select>
          </label>
        </div>

        <div class="pomo-sound-row">
          <button id="pomo-sound-test-work" class="ghost-btn compact" type="button">작업음 테스트</button>
          <button id="pomo-sound-test-rest" class="ghost-btn compact" type="button">휴식음 테스트</button>
        </div>

        <div class="hint">참가를 끄면(🔕) 알림음이 나에게만 꺼져요.</div>
      </div>
    `;

    const chk = document.getElementById("pomo-sound-enabled");
    const vol = document.getElementById("pomo-sound-vol");
    const selW = document.getElementById("pomo-sound-work");
    const selR = document.getElementById("pomo-sound-rest");

    if (chk) chk.checked = !!_soundPrefs.enabled;
    if (vol) vol.value = String(Number(_soundPrefs.volume ?? 60));
    if (selW) selW.value = String(_soundPrefs.workSound || "soft_bell");
    if (selR) selR.value = String(_soundPrefs.restSound || "calm_chime");

    const syncAndSave = async () => {
      _soundPrefs = {
        enabled: !!(chk?.checked),
        volume: Math.max(0, Math.min(100, parseInt(vol?.value ?? "60", 10))),
        workSound: String(selW?.value || "soft_bell"),
        restSound: String(selR?.value || "calm_chime")
      };
      await saveSoundPrefsToFirebase(_soundPrefs);
    };

    chk?.addEventListener("change", syncAndSave);
    vol?.addEventListener("input", () => { syncAndSave(); });
    selW?.addEventListener("change", syncAndSave);
    selR?.addEventListener("change", syncAndSave);

    document.getElementById("pomo-sound-test-work")?.addEventListener("click", async () => {
      await _unlockAudio();
      await testPresetSound(selW?.value || "soft_bell");
    });
    document.getElementById("pomo-sound-test-rest")?.addEventListener("click", async () => {
      await _unlockAudio();
      await testPresetSound(selR?.value || "calm_chime");
    });
  }

  function updatePomoProgressBar(totalSec, remainingSec) {
    const bar = document.getElementById("pomo-bar");
    if (!bar) return;

    const total = Math.max(1, Number(totalSec || 1));
    const remain = Math.max(0, Number(remainingSec || 0));
    const done = Math.max(0, total - remain);
    const pct = Math.max(0, Math.min(100, (done / total) * 100));

    bar.style.width = pct.toFixed(2) + "%";
  }

  function _todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function _getTodaySessionCount() {
    const key = `pomoSessions_${_todayKey()}`;
    return Number(localStorage.getItem(key) || 0);
  }

  function _setTodaySessionCount(v) {
    const key = `pomoSessions_${_todayKey()}`;
    localStorage.setItem(key, String(Math.max(0, Number(v || 0))));
  }

  function renderTodaySessionCount() {
    const el = document.getElementById("today-session-count");
    if (!el) return;
    const n = _getTodaySessionCount();
    el.textContent = `오늘 집중 ${n}회`;
  }

  async function incrementTodayFocusSessions() {
    const next = _getTodaySessionCount() + 1;
    _setTodaySessionCount(next);
    renderTodaySessionCount();

    if (myNick) {
      try {
        await db.ref(`users/${myNick}/pomoSessions/${_todayKey()}`).set({
          count: next,
          updatedAt: Date.now()
        });
      } catch (e) {}
    }
  }

  async function loadTodayFocusSessions() {
    renderTodaySessionCount();
    if (!myNick) return;
    try {
      const snap = await db.ref(`users/${myNick}/pomoSessions/${_todayKey()}`).once("value");
      const v = snap.val();
      if (v && typeof v.count === "number") {
        _setTodaySessionCount(v.count);
        renderTodaySessionCount();
      }
    } catch (e) {}
  }

  function _ensurePomoStatusLine() {
    let el = document.getElementById("pomo-status-line");
    if (el) return el;

    const chatSidebar = document.querySelector(".chat-sidebar");
    const header = chatSidebar ? chatSidebar.querySelector(".header") : null;
    if (!chatSidebar || !header) return null;

    el = document.createElement("div");
    el.id = "pomo-status-line";
    el.className = "pomo-status-line hidden";
    // ✅ 채팅 상단 초대형 고정 타이머: 태그(모드 표시) + 큰 숫자
    el.innerHTML = `
      <span class="tag" id="pomo-mega-tag">🍅 집중 세션 중</span>
      <span class="pomo-mega-digits" id="pomo-mega-digits">00:00</span>
    `;
    header.insertAdjacentElement("afterend", el);
    return el;
  }

  function _fmtMMSS(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // ✅ 뽀모도로가 진행 중이면(집중/휴식 모두) 채팅 상단에 아주 크고 굵은 숫자로 고정 표시
  function updatePomoHeaderStatus(state) {
    const line = _ensurePomoStatusLine();
    if (!line) return;

    const tag    = document.getElementById("pomo-mega-tag");
    const digits = document.getElementById("pomo-mega-digits");

    const running = !!state?.running;
    const mode    = String(state?.mode || "");
    const remain  = Number(state?.remainingSec ?? state?.remaining ?? 0);

    if (!running) {
      line.classList.add("hidden");
      line.classList.remove("pomo-mega-warn");
      return;
    }

    line.classList.remove("hidden");
    line.dataset.mode = (mode === "rest") ? "rest" : "work";

    if (tag) tag.textContent = (mode === "rest") ? "☕ 휴식 중" : "🍅 집중 세션 중";
    if (digits) digits.textContent = _fmtMMSS(remain);

    const warnMin = parseInt(localStorage.getItem("warnMinutes") || "10", 10);
    line.classList.toggle("pomo-mega-warn", remain <= warnMin * 60);
  }

  // ✅ 뽀모도로 호스트 시간 설정 UI: 실행 중이면 잠그고, 진행 중인 세션의 실제 시간을 보여줌
  function updatePomoSetupUI(state) {
    const wrap        = document.getElementById("pomo-setup");
    const runningBadge = document.getElementById("pomo-setup-running");
    const workInput    = document.getElementById("pomo-work-min");
    const restInput    = document.getElementById("pomo-rest-min");
    if (!wrap) return;

    const running = !!state?.running;

    if (running) {
      wrap.classList.add("locked");
      if (workInput) workInput.disabled = true;
      if (restInput) restInput.disabled = true;

      const workMin = Number.isFinite(state.workMin) ? state.workMin : Number(workInput?.value || 25);
      const restMin = Number.isFinite(state.restMin) ? state.restMin : Number(restInput?.value || 5);
      if (workInput) workInput.value = workMin;
      if (restInput) restInput.value = restMin;

      if (runningBadge) {
        runningBadge.textContent = `⏳ 진행 중 (${workMin}분 / ${restMin}분)`;
        runningBadge.classList.remove("hidden");
      }
    } else {
      wrap.classList.remove("locked");
      if (workInput) workInput.disabled = false;
      if (restInput) restInput.disabled = false;
      if (runningBadge) runningBadge.classList.add("hidden");
    }
  }

  // =====================================================
  // ✅ Font size (유지)
  // =====================================================
  const FONT_MIN = 13;
  const FONT_MAX = 19;
  const FONT_STEP = 1;

  function getCurrentFontSize() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--font-size").trim().replace("px","");
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 15;
  }

  function setFontSize(px) {
    const next = Math.max(FONT_MIN, Math.min(FONT_MAX, px));
    document.documentElement.style.setProperty("--font-size", `${next}px`);
    localStorage.setItem("writerFontSize", String(next));
    updateFontPill(next);
  }

  let _fontPillTimer = null;
  function updateFontPill(size) {
    const pill = document.getElementById("font-size-pill");
    if (!pill) return;

    pill.textContent = `${size}px`;
    pill.style.transform = "scale(1.03)";
    pill.style.background = "rgba(10,132,255,.10)";

    if (_fontPillTimer) clearTimeout(_fontPillTimer);
    _fontPillTimer = setTimeout(() => {
      pill.style.transform = "scale(1)";
      pill.style.background = "rgba(255,255,255,.72)";
    }, 220);
  }

  function increaseFont() { setFontSize(getCurrentFontSize() + FONT_STEP); }
  function decreaseFont() { setFontSize(getCurrentFontSize() - FONT_STEP); }

  function applySavedFontSize() {
    const saved = parseInt(localStorage.getItem("writerFontSize") || "", 10);
    if (Number.isFinite(saved)) setFontSize(saved);
    else updateFontPill(getCurrentFontSize());
  }

  // =====================================================
  // ✅ join 이후 초기화 훅 (core가 호출)
  // =====================================================
  window.afterJoinInitSoundPrefs = async function() {
    try {
      const v = localStorage.getItem(_nickKey("pomoParticipating"));
      if (v === "true" || v === "false") _pomoParticipating = (v === "true");
    } catch(e) {}

    try {
      const c = localStorage.getItem(_nickKey("pomoDetailCollapsed"));
      if (c === "true" || c === "false") {
        const detail = document.getElementById("pomo-detail");
        const btn = document.getElementById("pomo-detail-toggle");
        if (detail && btn) {
          detail.classList.toggle("collapsed", c === "true");
          btn.textContent = (c === "true") ? "▾" : "▴";
        }
      }
    } catch(e) {}

    await loadSoundPrefsFromFirebase();
    await loadPomoParticipationFromFirebase();
    await loadTodayFocusSessions();

    _renderParticipationButton();
    renderPomodoroSoundMini();
  };

  window.afterJoinLoadNickTheme = async function() {
    const theme = await loadThemeForNick();
    applyTheme(theme);
    try { localStorage.setItem("writerTheme", theme); } catch(e) {}
  };

  // =====================================================
  // ✅ DOMContentLoaded (로그인 전 기본 세팅 + Layout/Narrow FIX)
  // =====================================================
  document.addEventListener("DOMContentLoaded", () => {
    // ✅ layout/narrow 먼저
    applySavedLayout();
    applyChatOnlyModeIfMobile();
    if (!window.isMobile) applyNarrowChatFocus();

    // renderChatMessage wrapper는 렌더 함수 생긴 뒤에 설치
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      const ok = installChatRenderDedupeWrapper();
      if (ok || tries >= 25) clearInterval(t);
    }, 80);

    applySavedFontSize();
    applyTheme(currentTheme);
    renderThemePalette();
    renderTodaySessionCount();

    _renderParticipationButton();

    // chat width 복원(있으면)
    const cw = parseInt(localStorage.getItem("chatWidth") || "", 10);
    if (Number.isFinite(cw)) resizeChat(cw);
  });

  // =====================================================
  // ✅ Admin Easter Egg (7번 클릭)
  // =====================================================
  let _adminClickCount = 0;
  let _adminClickTimer = null;
  let _adminLoggedIn = false;

  function bindAdminEasterEgg() {
    const titleEl = document.getElementById("reset-title");
    if (!titleEl || titleEl._adminBound) return;
    titleEl._adminBound = true;

    titleEl.style.cursor = "pointer";
    titleEl.title = "";

    titleEl.addEventListener("click", () => {
      _adminClickCount += 1;

      if (_adminClickTimer) clearTimeout(_adminClickTimer);
      _adminClickTimer = setTimeout(() => { _adminClickCount = 0; }, 2000);

      if (_adminClickCount >= 7) {
        _adminClickCount = 0;
        clearTimeout(_adminClickTimer);

        const egg = document.getElementById("admin-easter");
        if (egg) {
          egg.classList.remove("hidden");
          refreshAdminUiVisibility();
        }
      }
    });
  }

  function refreshAdminUiVisibility() {
    const egg = document.getElementById("admin-easter");
    const loginBtn = document.getElementById("admin-login-btn");
    const clearBtn = document.getElementById("admin-clear-btn");
    if (!egg) return;

    const isLoggedIn = sessionStorage.getItem("adminPinOk") === "true";
    _adminLoggedIn = isLoggedIn;

    if (loginBtn) loginBtn.classList.toggle("hidden", isLoggedIn);
    // ✅ admin-tools 전체 블록 토글 (핀 설정 + 채팅 삭제 포함)
    const adminTools = document.getElementById("admin-tools");
    if (adminTools) adminTools.classList.toggle("hidden", !isLoggedIn);

    // 버튼 이벤트 바인딩(중복 방지)
    if (loginBtn && !loginBtn._adminBound) {
      loginBtn._adminBound = true;
      loginBtn.addEventListener("click", () => {
        const ok = window.requireAdminPin?.();
        if (ok) refreshAdminUiVisibility();
      });
    }

    if (clearBtn && !clearBtn._adminBound) {
      clearBtn._adminBound = true;
      clearBtn.addEventListener("click", () => {
        window.clearAllChat?.();
      });
    }
  }

  window.bindAdminEasterEgg = bindAdminEasterEgg;
  window.refreshAdminUiVisibility = refreshAdminUiVisibility;

  // =====================================================
  // exports
  // =====================================================
  window.applyTheme = applyTheme;
  window.renderThemePalette = renderThemePalette;
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.openTab = openTab;
  window.resizeChat = resizeChat;
  window.applyTimerVisibility = applyTimerVisibility;

  window.increaseFont = increaseFont;
  window.decreaseFont = decreaseFont;
  window.applySavedFontSize = applySavedFontSize;

  window.playPomodoroSound = playPomodoroSound;
  window.testPresetSound = testPresetSound;

  window.updatePomoProgressBar = updatePomoProgressBar;
  window.incrementTodayFocusSessions = incrementTodayFocusSessions;
  window.renderTodaySessionCount = renderTodaySessionCount;

  window.updatePomoHeaderStatus = updatePomoHeaderStatus;
  window.updatePomoSetupUI = updatePomoSetupUI;

  window.loadSoundPrefsFromFirebase = loadSoundPrefsFromFirebase;
  window.loadPomoParticipationFromFirebase = loadPomoParticipationFromFirebase;

  window.saveThemeForNick = saveThemeForNick;
  window.loadThemeForNick = loadThemeForNick;
