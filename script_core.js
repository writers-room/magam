
  // =====================================================
  // ✅ Utils
  // =====================================================
  function escapeHtml(input) {
    const s = String(input ?? "");
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatHHMM(ts) {
    const n = Number(ts);
    const d = new Date(Number.isFinite(n) ? n : Date.now());
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function ymd(ts) {
    const n = Number(ts);
    const d = new Date(Number.isFinite(n) ? n : Date.now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  window.escapeHtml = escapeHtml;
  window.formatHHMM = formatHHMM;
  window.ymd = ymd;

  // =====================================================
  // Firebase config
  // =====================================================
  const firebaseConfig = {
    apiKey: "AIzaSyCzkYB9Q4E2B3mrF1tL55HtUhIV0BffXQM",
    authDomain: "writer-chat.firebaseapp.com",
    databaseURL: "https://writer-chat-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "writer-chat",
    storageBucket: "writer-chat.firebasestorage.app",
    messagingSenderId: "165593059767",
    appId: "1:165593059767:web:112c0aef5e47b1f6941832",
    measurementId: "G-BGBC8BJQLB"
  };

  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (e) {
    console.warn("[firebase init guarded]", e);
  }

  const db = firebase.database();
  window.db = db;

  // =====================================================
  // Global state
  // =====================================================
  let myNick = "";
  let myEmoji = "";
  let _msgRef = null, _statusRef = null, _pomodoroRef = null;
  let _statusIntervalId = null, _backupIntervalId = null;

  let _joining = false;
  let _sessionId = "";
  let _presenceDisconnectArmed = false;

  const PRESENCE_POLL_MS = 15000;
  let _myJoinTs = 0;

  window._myJoinTimestamp = function () {
    return _myJoinTs || 0;
  };

  function callIfFn(name, ...args) {
    try {
      const fn = window[name];
      if (typeof fn === "function") return fn(...args);
    } catch (e) {}
    return null;
  }

  function _ensureSessionId() {
    const k = "writerRoomSessionId";
    let sid = sessionStorage.getItem(k);
    if (!sid) {
      sid = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(k, sid);
    }
    _sessionId = sid;
    return sid;
  }

  function _clearSessionId() {
    try { sessionStorage.removeItem("writerRoomSessionId"); } catch (e) {}
    _sessionId = "";
  }

  function detachListeners() {
    try {
      window.detachMessageListeners?.();
      _msgRef?.off();
      _statusRef?.off();
      _pomodoroRef?.off();
    } catch (e) {}

    _msgRef = null;
    _statusRef = null;
    _pomodoroRef = null;

    if (_statusIntervalId) clearInterval(_statusIntervalId);
    if (_backupIntervalId) clearInterval(_backupIntervalId);
    if (window.pomodoroTick) clearInterval(window.pomodoroTick);
    if (window._headerIntervalId) clearInterval(window._headerIntervalId);

    _statusIntervalId = null;
    _backupIntervalId = null;
  }

  async function _writeJoinSystemMessageOnce() {
    const sid = _ensureSessionId();
    const key = `sys_join_${sid}`;

    const payload = {
      type: "system",
      msg: `📢 ${myEmoji} ${myNick} 작가님이 입장하셨습니다.`,
      time: firebase.database.ServerValue.TIMESTAMP,
      joinOf: myNick,
      sid
    };

    await db.ref(`messages/${key}`).set(payload);

    // ✅ [FIX] 방에 아무도 없어 이 연결이 사실상 "막 열린" 상태일 때는,
    // messages 쿼리 리스너가 서버와의 핸드셰이크를 채 마치기 전에
    // 방금 쓴 내 입장 메시지의 child_added 이벤트를 놓치는 경우가 있었음.
    // → 쓰기 직후 내 화면에는 즉시 로컬로 반영해서, 리스너 타이밍과 무관하게
    //   항상 보이도록 함. (같은 key로 나중에 진짜 이벤트가 와도 dedupe돼서 중복 렌더 안 됨)
    window._renderMessageLocal?.(key, { ...payload, time: Date.now() });
  }

  async function _writeLeaveSystemMessageOnce() {
    const sid = _ensureSessionId();
    const key = `sys_leave_${sid}`;

    await db.ref(`messages/${key}`).set({
      type: "system",
      msg: `👋 ${myEmoji} ${myNick} 작가님이 작업실을 나갔어요.`,
      time: firebase.database.ServerValue.TIMESTAMP,
      leaveOf: myNick,
      sid
    });
  }

  function armPresenceOnDisconnect() {
    if (!myNick || _presenceDisconnectArmed) return;

    const sid        = _ensureSessionId();
    const statusRef  = db.ref(`status/${myNick}`);

    // ✅ status만 onDisconnect 등록 (퇴장 메시지는 등록 안 함)
    // 퇴장 메시지는 beforeunload에서만 처리
    statusRef.onDisconnect().remove();

    _presenceDisconnectArmed = true;
  }

  async function cancelPresenceOnDisconnect() {
    if (!myNick || !_presenceDisconnectArmed) return;
    await db.ref(`status/${myNick}`).onDisconnect().cancel();
    _presenceDisconnectArmed = false;
  }

  function getDailyEmoji(nick) {
    const emojis = [
      // 🌸 꽃/식물 (컬러풀)
      "🌸","🌺","🌻","🌹","🌷","💐","🌼","🪷","🌿","🍀",
      "🍁","🍂","🍃","☘️","🌱","🌲","🌳","🌴","🌵","🎋",
      "🎍","🪴","🌾","🍄","🌰","🪸","🫧",
      // ⭐ 별/빛/우주
      "⭐","🌟","✨","💫","⚡","🌈","🌙","🌛","🌜","🌝",
      "🌞","☀️","🌤️","⛅","🌦️","🌈","🪐","🌍","🌏","🌌",
      "🔮","🪄","🎆","🎇","🧨","✴️","🌠","💥","🌀","❄️",
      // 💖 하트/감정 (핑크/컬러)
      "💖","💗","💓","💞","💕","💝","❤️","🧡","💛","💚",
      "💙","💜","🖤","🤍","🤎","❤️‍🔥","❤️‍🩹","💔","💟","☮️",
      "🫀","🫶","💌","💋","🥰","😍","🤩","😻","💯","🎀",
      // 🦋 동물/귀여운
      "🦋","🐝","🌸","🐞","🦄","🐉","🦊","🐼","🐨","🦁",
      "🐯","🐸","🐧","🦜","🦩","🦚","🦋","🐬","🦭","🦈",
      "🐙","🦑","🦀","🐡","🐠","🐟","🦓","🦒","🐘","🦘",
      "🦔","🐇","🐿️","🦫","🦦","🦥","🐾","🐉","🐲","🦕",
      // 🍭 음식/간식 (알록달록)
      "🍭","🍬","🍫","🍩","🍰","🎂","🧁","🍓","🍒","🍑",
      "🥭","🍍","🍋","🍊","🍎","🍇","🫐","🍈","🥝","🍅",
      "🌽","🥕","🫑","🌶️","🥑","🍆","🎃","🫒",
      // 💎 보석/마법/판타지
      "💎","💍","👑","🏆","🥇","🎖️","🎗️","🎫","🎟️","🎪",
      "🪅","🎠","🎡","🎢","🎨","🖼️","🎭","🎪","🪩","🎊",
      "🎉","🎈","🎁","🛍️","🧸","🪆","🎯","🎲","🎮","🕹️",
      // 🌊 자연/날씨
      "🌊","🏔️","🗻","🌋","🏝️","🏖️","🌅","🌄","🌠","🎑",
      "🍀","🌺","🏵️","💮","🪷","🌸","🌼","🌻","🌹","🥀",
      // 🪐 우주/신비
      "🪐","🌌","🔭","🛸","🚀","🛰️","☄️","🌑","🌒","🌓",
      "🌔","🌕","🌖","🌗","🌘","🌙","🌚","🌛","🌜","🌝",
      // ✏️ 작가/창작 (테마)
      "✏️","📝","🖊️","🖋️","📖","📚","📕","📗","📘","📙",
      "📓","📔","📒","📃","🗃️",
      "🎬","🎥","📷","📸","🎞️","📽️","🎞️","🎙️",
      // 🎵 음악/예술
      "🎵","🎶","🎼","🎹","🥁","🎷","🎺","🎸","🪕","🎻",
      "🪗","🎤","🎧","🎨","🖌️","🖍️","✒️","🖊️","🎭","🎪",
      // 🌈 무지개/컬러
      "🌈","🎨","🖌️","🎆","🎇","🧶","🧵","🪡","🎀","🪢",
      "🧿","🪬","🧲","💡","🕯️","🪔","🔦","🏮","🪩","🎱"
    ];

    // 중복 제거
    const unique = [...new Set(emojis)];

    let hash = 0;
    const seed = nick + new Date().toISOString().slice(0, 10);
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return unique[Math.abs(hash) % unique.length];
  }

  async function join() {
    if (_joining || myNick) return;

    const inputEl = document.getElementById("nick-input");
    const input = (inputEl?.value || "").trim();
    if (!input) return alert("필명을 입력해주세요!");

    _joining = true;

    try {
      detachListeners();

      myNick = input;
      myEmoji = getDailyEmoji(myNick);
      _ensureSessionId();

      // joinTs: 입장 직전 1.2초만 허용 (이전 로그 거의 안 보이게)
      _myJoinTs = Date.now() - 1200;

      document.getElementById("modal").style.display = "none";
      document.getElementById("exit-screen").classList.add("hidden");
      document.getElementById("my-info").innerText = `${myEmoji} ${myNick}`;

      // ✅ 1) 닉 귀속 테마 먼저 로드/적용 (UI 안정화)
      try { await window.afterJoinLoadNickTheme?.(); } catch(e){ console.warn("[afterJoinLoadNickTheme failed]", e); }

      // ✅ 2) 메시지 리슨
      await window.listenMessages?.();

      // ✅ 3) 사운드/참가/상세/세션카운트 등 닉귀속 UI 초기화
      try { await window.afterJoinInitSoundPrefs?.(); } catch(e){ console.warn("[afterJoinInitSoundPrefs failed]", e); }

      armPresenceOnDisconnect();

      // ✅ 실제 브라우저 종료/탭 닫기 시에만 퇴장 메시지
      // (beforeunload는 실제 닫힐 때만 발동, 네트워크 끊김엔 발동 안 함)
      window._beforeUnloadBound = true;
      window.addEventListener("beforeunload", _handleBeforeUnload, { once: true });
      await _writeJoinSystemMessageOnce();

      callIfFn("loadPersonalData");
      callIfFn("updateStatus", true);
      callIfFn("listenStatus");
      callIfFn("listenPomodoro");

      _statusIntervalId = setInterval(() => callIfFn("updateStatus", false), PRESENCE_POLL_MS);

    } catch (e) {
      console.error("[JOIN ERROR]", e);
      alert("입장 중 오류 발생 😵 새로고침 해줘!");

      try { document.getElementById("modal").style.display = "flex"; } catch (e2) {}
      myNick = "";
      myEmoji = "";
      _clearSessionId();
    } finally {
      _joining = false;
    }
  }

  async function leaveRoom() {
    if (!myNick) return;

    await cancelPresenceOnDisconnect();
    await db.ref("status/" + myNick).remove();
    await _writeLeaveSystemMessageOnce();

    window.resetPomoUserScopedUI?.();
    // ✅ 수동 퇴장 시 beforeunload 리스너 제거 (중복 방지)
    window.removeEventListener("beforeunload", _handleBeforeUnload);
    detachListeners();

    myNick = "";
    myEmoji = "";
    _presenceDisconnectArmed = false;
    _myJoinTs = 0;
    _clearSessionId();

    document.getElementById("my-info").innerText = "Chat";
    document.getElementById("exit-screen").classList.remove("hidden");
  }


  function _handleBeforeUnload() {
    if (!myNick) return;

    const sid = _ensureSessionId();

    // ✅ sendBeacon: 페이지 언로드 중에도 전송 보장
    // Firebase REST API로 퇴장 메시지 기록
    const url = `${firebaseConfig.databaseURL}/messages/sys_leave_${sid}.json?x-http-method-override=PUT`;
    const payload = JSON.stringify({
      type:    "system",
      msg:     `👋 ${myEmoji} ${myNick} 작가님이 작업실을 나갔어요.`,
      time:    Date.now(),
      leaveOf: myNick,
      sid,
      byUnload: true
    });

    try {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } catch(e) {}

    // status 즉시 제거도 시도 (best-effort)
    try {
      navigator.sendBeacon(
        `${firebaseConfig.databaseURL}/status/${myNick}.json?x-http-method-override=DELETE`,
        new Blob(["null"], { type: "application/json" })
      );
    } catch(e) {}
  }

  window._handleBeforeUnload = _handleBeforeUnload;

  function init() {
    window.resetPomoUserScopedUI?.();

    // ✅ init은 "로그인 전 프리뷰"만: 기본테마 + 폰트 + 타이머 표시
    // (닉 귀속 로딩은 join() 이후 afterJoinLoadNickTheme에서 처리)
    try {
      const previewTheme = localStorage.getItem("writerTheme") || "Light (iOS)";
      callIfFn("applyTheme", previewTheme);
    } catch(e) {}

    callIfFn("applySavedFontSize");
    callIfFn("applyTimerVisibility");

    document.getElementById("modal").style.display = "flex";
    document.getElementById("exit-screen").classList.add("hidden");

    const nickInput = document.getElementById("nick-input");
    nickInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        join();
      }
    });

    // ✅ core에서 바인딩 보장
    try { window.bindSendHandlers?.(); } catch (e) { console.warn("[bindSendHandlers failed]", e); }
    try { window.bindChatScrollGuard?.(); } catch (e) { console.warn("[bindChatScrollGuard failed]", e); }
    try { window.bindTodoInputEnter?.(); } catch (e) { console.warn("[bindTodoInputEnter failed]", e); }
  }

  window.join = join;
  window.leaveRoom = leaveRoom;
  window.init = init;
