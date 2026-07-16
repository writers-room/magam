
  let _statusCache = null;
  Object.defineProperty(window, '_statusCache', {
    get() { return _statusCache; },
    set(v) { _statusCache = v; },
    configurable: true
  });
  let _headerIntervalId = null;
  let _clearRef = null;
  let _lastClearedAt = 0;

  const ONLINE_ACTIVE_MS = 60 * 1000;
  const HEADER_TICK_MS = 60 * 1000;

  let _seenMsgKeys = new Set();

  let _msgLiveQuery = null;
  let _messagesListening = false;

  // ✅ pomodoro 이벤트 중복 방지 (클라별)
  let _lastHandledPomoSeq = 0;

  // ✅ 입장 직후 “현재 뽀모 상태”는 이벤트로 처리하지 않기(메시지 폭탄 방지)
  let _pomoBootstrapped = false;

  // =====================================================
  // UI helpers
  // =====================================================
  function clearChatUI() {
    const box = document.getElementById("chat-box");
    if (box) box.innerHTML = "";

    if (typeof lastRendered !== "undefined") {
      lastRendered = { user: null, ts: 0, ymd: null, msg: "" };
    }
    if (typeof unreadCount !== "undefined") unreadCount = 0;

    const floatBtn = document.getElementById("new-msg-float");
    if (floatBtn) floatBtn.classList.add("hidden");

    _seenMsgKeys = new Set();
  }
  window.clearChatUI = clearChatUI;

  function detachMessageListeners() {
    try { if (_msgLiveQuery) _msgLiveQuery.off(); } catch(e) {}
    try { if (_clearRef) _clearRef.off(); } catch(e) {}

    _msgLiveQuery = null;
    _clearRef = null;
    _messagesListening = false;
  }
  window.detachMessageListeners = detachMessageListeners;

  window._renderMessageLocal = function(key, data){
    try {
      if (!key || !data) return;
      if (_seenMsgKeys.has(key)) return;
      _seenMsgKeys.add(key);
      window.renderChatMessage?.(document.getElementById("chat-box"), data, key);
      window.scrollChatToBottom?.(true);
    } catch(e){}
  };

  function isPresenceSystemMsg(data) {
    return !!(data && data.type === "system" && (data.joinOf || data.leaveOf));
  }

  // ✅ [추가] 뽀모 시스템 메시지인지 판별 (입장 이전 렌더에서 제외할 용도)
  function isPomodoroSystemMsg(data) {
    return !!(data && data.type === "system" && data.pomoSeq !== undefined && data.pomoPhase !== undefined);
  }

  // =====================================================
  // Header online list
  // =====================================================
  function updateChatHeader() {
    const el = document.getElementById("my-info");
    if (!el || !myNick) return;

    if (_statusCache) {
      const online = [];
      const now = Date.now();
      for (let nick in _statusCache) {
        if (now - (_statusCache[nick].lastSeen || 0) < ONLINE_ACTIVE_MS) online.push(nick);
      }
      el.innerText = `👥 ${online.length}명 접속 중 (${online.join(", ")})`;
    }
  }

  function startHeaderTicker() {
    if (_headerIntervalId) clearInterval(_headerIntervalId);
    _headerIntervalId = setInterval(() => updateChatHeader(), HEADER_TICK_MS);
    window._headerIntervalId = _headerIntervalId;
    updateChatHeader();
  }

  // =====================================================
  // ✅ 업적 오버라이드(테스트 모드): 실제 업적과 병합
  // =====================================================
  function _effectiveAch(nick, base) {
    const ov = (window._achOverrides || {})[nick];
    const bStreak = Number(base.streak ?? base.streakDays ?? 0);
    const bWeekly = !!base.weeklyFull;
    if (ov && Number(ov.expiresAt || 0) > Date.now()) {
      return {
        streak: Math.max(bStreak, Number(ov.streakDays || 0)),
        weeklyFull: bWeekly || !!ov.weeklyFull
      };
    }
    return { streak: bStreak, weeklyFull: bWeekly };
  }

  // =====================================================
  // status realtime
  // =====================================================
  function listenStatus() {
    // 테스트 오버라이드 실시간 반영
    if (!window._achOvRef) {
      window._achOvRef = db.ref("achievementOverrides");
      window._achOvRef.on("value", s => {
        window._achOverrides = s.val() || {};
        // 내 채팅 배지 문자열도 갱신
        try {
          if (myNick) {
            const eff = _effectiveAch(myNick, window._myAch || {});
            window._myBadgeStr =
              (eff.streak >= 3 ? "🔥" : "") + (eff.weeklyFull ? "👑" : "");
          }
        } catch(e) {}
      });
    }

    _statusRef = db.ref("status");
    _statusRef.on("value", snap => {
      const list = document.getElementById("user-cards");
      const data = snap.val() || null;
      _statusCache = data;
      window._statusCache = data;   // ✅ 전역 노출

      updateChatHeader();
      if (!list) return;

      list.innerHTML = "";
      const now = Date.now();
      if (!data) return;

      for (let u in data) {
        const row = data[u] || {};
        if (now - (row.lastSeen || 0) < ONLINE_ACTIVE_MS) {
          const st = row.status || "idle";
          const cls = statusClass(st);
          const badge = st === "writing" ? `<span class="rec-dot"></span>` : "";

          const goalText = row.todayGoalText ? escapeHtml(row.todayGoalText) : "오늘의 한줄 목표 없음";

          // ✅ 업적 표시 (테스트 오버라이드 병합)
          const effAch = _effectiveAch(u, row);
          const streakN = effAch.streak;
          const streakBanner = streakN >= 3
            ? `<div class="streak-banner">🔥 연속 ${streakN}일 출석!</div>`
            : "";
          const weeklyBanner = effAch.weeklyFull
            ? `<div class="streak-banner weekly-banner">👑 지난주 매일 출석!</div>`
            : "";
          const banners = (streakBanner || weeklyBanner)
            ? `<div class="ach-banners">${streakBanner}${weeklyBanner}</div>`
            : "";
          const goldCls = effAch.weeklyFull ? " weekly-gold" : "";
          const nameBadges =
            (streakN >= 3 ? "🔥" : "") + (effAch.weeklyFull ? "👑" : "");

          list.insertAdjacentHTML("beforeend", `
            <div class="user-card ${cls}${goldCls}">
              <div class="card-top">
                <div class="card-left">
                  <div class="card-emoji">${row.emoji || ""}</div>
                  <div class="card-name">${escapeHtml(u)}${nameBadges ? " " + nameBadges : ""}</div>
                </div>
                ${badge}
              </div>
              <div class="card-status">🫧 ${escapeHtml(row.statusLabel || statusLabel(st))}</div>

              <div class="card-goal">
                <div class="goal-line">🎯 ${goalText}</div>
              </div>
              ${banners}
            </div>
          `);
        }
      }

      startHeaderTicker();
    });
  }

  function statusLabel(code) {
    return ({
      idle: "휴식 중",
      writing: "집필 중",
      focus: "집중 중",
      rest: "휴식 중",
      away: "자리 비움"
    })[code] || "휴식 중";
  }

  function statusClass(code) {
    return ({
      idle: "status-rest",
      writing: "status-writing",
      focus: "status-focus",
      rest: "status-rest",
      away: "status-away"
    })[code] || "status-rest";
  }

  function updateStatus(force = false) {
    if (!myNick) return;

    const goalText = document.getElementById("db-today-goal-text")?.value || "";
    const done = document.getElementById("db-today-done")?.value || "";
    const statusChoice = document.getElementById("db-status")?.value || "rest";

    if (force) {
      window.saveDailyLog?.();
      window.backupLocal?.();
    }

    db.ref("status/" + myNick).set({
      emoji: myEmoji,
      status: statusChoice,
      statusLabel: statusLabel(statusChoice),
      todayGoalText: goalText,
      todayDone: done,
      streakDays: Number(window._myAch?.streak || 0),
      weeklyFull: !!window._myAch?.weeklyFull,
      lastSeen: Date.now()
    });
  }

  // =====================================================
  // pomodoro realtime
  // =====================================================

  async function _writePomodoroSystemMessageOnce(seq, phaseOrKind) {
    if (!seq) return;
    const key = `sys_pomo_${seq}`;

    let msg = "";
    if (phaseOrKind === "stop") msg = "⏹️ 뽀모도로가 정지됐어요.";
    else if (phaseOrKind === "work") msg = "🍅 뽀모도로 작업 세션이 시작됐어요!";
    else msg = "☁️ 뽀모도로 휴식이 시작됐어요!";

    try {
      await db.ref(`messages/${key}`).set({
        type: "system",
        msg,
        time: firebase.database.ServerValue.TIMESTAMP,
        pomoSeq: seq,
        pomoPhase: phaseOrKind
      });
    } catch(e) {
      console.warn("[write pomodoro system msg failed]", e);
    }
  }

  function _remainingSecFrom(data) {
    const endAt = Number(data?.endAt || 0);
    if (!endAt) return 0;
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  }

  function listenPomodoro() {
    _pomodoroRef = db.ref("pomodoro");
    _pomodoroRef.on("value", snap => {
      const data = snap.val();
      const pill = document.getElementById("timer-pill");
      const text = document.getElementById("timer-text");
      if (!pill || !text) return;

      if (window.pomodoroTick) { clearInterval(window.pomodoroTick); window.pomodoroTick = null; }
      pill.classList.remove("timer-warn");

      // ✅ stopped/없음 처리
      if (!data || data.status === "stopped") {
        text.textContent = "뽀모도로 대기 중… 위에서 집중/휴식 시간을 정하고 시작해보세요 🍅";
        window.updatePomoHeaderStatus?.({ running:false });
        window.updatePomoSetupUI?.({ running:false });
        _lastHandledPomoSeq = 0;
        _pomoBootstrapped = false;

        window.updatePomoProgressBar?.(1, 1);
        return;
      }

      const seq = Number(data.seq || 0);
      const phase = data.phase || "work";

      // ✅ 진행 중인 세션의 집중/휴식 시간을 설정 UI에도 동기화(늦게 들어온 사람도 host가 정한 시간을 확인 가능)
      window.updatePomoSetupUI?.({
        running: true,
        workMin: Number(data.workMin || 25),
        restMin: Number(data.restMin || 5)
      });

      // ✅ [핵심] 첫 수신(입장 직후)에는 “현재 상태”를 이벤트로 처리하지 않음
      if (!_pomoBootstrapped) {
        _pomoBootstrapped = true;
        _lastHandledPomoSeq = seq || 0;
      } else {
        // ✅ seq 기반 이벤트 1회 처리
        if (seq && seq !== _lastHandledPomoSeq) {
          _lastHandledPomoSeq = seq;

          // ✅ 시스템 메시지는 updatedBy(버튼 누른 사람)만 작성
          const updatedBy = String(data.updatedBy || "");
          // ✅ [FIX] 최초 "시작" 클릭 시의 work 메시지는 startPomodoro().then()에서 이미 처리되지만,
          // 이후 rest→work 자동 전환(휴식이 끝나고 다시 작업 세션이 시작되는 경우)은
          // 여기서만 감지되므로 phase 종류와 무관하게 항상 기록해야 한다.
          // (같은 seq 키에 .set()으로 덮어쓰기 때문에 중복 기록돼도 안전함)
          if (updatedBy && myNick && updatedBy === myNick) {
            _writePomodoroSystemMessageOnce(seq, phase);
          }

          // 소리(개인)
          if (phase === "work") window.playPomodoroSound?.("work_start");
          else window.playPomodoroSound?.("rest_start");

          // work -> rest 전환이면 “오늘 집중 1회” 증가
          if (phase === "rest") {
            window.incrementTodayFocusSessions?.();
          }
        }
      }

      // 초기 즉시 1회 갱신
      window.updatePomoHeaderStatus?.({
        running: true,
        mode: phase,
        remainingSec: _remainingSecFrom(data)
      });

      window.pomodoroTick = setInterval(() => {
        const remainMs = (data.endAt || 0) - Date.now();
        const phaseNow = data.phase || "work";

        const workMin = Number(data.workMin || 25);
        const restMin = Number(data.restMin || 5);
        const totalSec = (phaseNow === "work" ? workMin : restMin) * 60;

        const remainingSec = Math.max(0, Math.ceil(remainMs / 1000));

        window.updatePomoProgressBar?.(totalSec, remainingSec);

        window.updatePomoHeaderStatus?.({
          running: true,
          mode: phaseNow,
          remainingSec
        });

        if (remainMs <= 0) {
          db.ref("pomodoro").transaction((cur) => {
            if (!cur || cur.status !== "running") return cur;

            const now = Date.now();
            if ((cur.endAt || 0) > now) return cur;

            const currentPhase = cur.phase || "work";
            const nextPhase = currentPhase === "work" ? "rest" : "work";
            const dur = nextPhase === "work" ? (cur.workMin || 25) : (cur.restMin || 5);

            const nextSeq = Number(cur.seq || 0) + 1;

            return {
              ...cur,
              phase: nextPhase,
              startedAt: now,
              endAt: now + dur * 60 * 1000,
              seq: nextSeq,
              updatedBy: myNick || cur.updatedBy || "unknown",
              updatedAt: now
            };
          });
          return;
        }

        const mm = Math.floor(remainMs / 60000);
        const ss = Math.floor((remainMs % 60000) / 1000);
        const label = phaseNow === "work" ? "🍅 작업" : "☁️ 휴식";
        text.textContent = `${label} · ${mm}분 ${ss}초`;

        const warnMin = parseInt(localStorage.getItem("warnMinutes") || "10", 10);
        if (remainMs <= warnMin * 60000) pill.classList.add("timer-warn");
        else pill.classList.remove("timer-warn");
      }, 1000);
    });
  }

  function startPomodoro() {
    // ✅ 호스트(=지금 "시작"을 누른 사람)가 입력한 집중/휴식 시간을 읽어서 세션에 반영
    const workInput = document.getElementById("pomo-work-min");
    const restInput = document.getElementById("pomo-rest-min");

    const workMinRaw = parseInt(workInput?.value, 10);
    const restMinRaw = parseInt(restInput?.value, 10);

    const workMin = Math.max(1, Math.min(180, Number.isFinite(workMinRaw) ? workMinRaw : 25));
    const restMin = Math.max(1, Math.min(60,  Number.isFinite(restMinRaw) ? restMinRaw : 5));

    // 클램프된 값으로 입력창도 정리
    if (workInput) workInput.value = workMin;
    if (restInput) restInput.value = restMin;

    db.ref("pomodoro").transaction((cur) => {
      const now     = Date.now();
      const prevSeq = Number(cur?.seq || 0);
      const nextSeq = prevSeq + 1;

      return {
        ...(cur || {}),
        phase:     "work",
        startedAt: now,
        endAt:     now + workMin * 60 * 1000,
        status:    "running",
        updatedBy: myNick || "unknown",
        seq:       nextSeq,
        workMin:   workMin,
        restMin:   restMin,
        updatedAt: now
      };
    }).then((res) => {
      // ✅ stopPomodoro와 동일한 패턴: transaction 커밋 후 직접 메시지 작성
      try {
        if (!myNick) return;
        if (!res || !res.committed) return;
        const v         = res.snapshot?.val?.();
        const seq       = Number(v?.seq || 0);
        const updatedBy = String(v?.updatedBy || "");
        if (seq && updatedBy === myNick) {
          _writePomodoroSystemMessageOnce(seq, "work");
        }
      } catch(e) {}
    });
  }

  function stopPomodoro() {
    db.ref("pomodoro").transaction((cur) => {
      const now = Date.now();
      const prevSeq = Number(cur?.seq || 0);
      const nextSeq = prevSeq + 1;

      return {
        ...(cur || {}),
        status: "stopped",
        updatedBy: myNick || cur?.updatedBy || "unknown",
        seq: nextSeq,
        updatedAt: now,
        stoppedAt: now,
        phase: cur?.phase || "work"
      };
    }).then((res) => {
      // ✅ stop 메시지는 "정확한 seq"로, 그리고 버튼 누른 사람만 작성
      try {
        if (!myNick) return;
        if (!res || !res.committed) return;
        const v = res.snapshot?.val?.();
        const seq = Number(v?.seq || 0);
        const updatedBy = String(v?.updatedBy || "");
        if (seq && updatedBy === myNick) {
          _writePomodoroSystemMessageOnce(seq, "stop");
        }
      } catch(e){}
    });
  }

  // =====================================================
  // messages realtime
  // =====================================================
  async function listenMessages() {
    detachMessageListeners();

    _messagesListening = true;
    clearChatUI();

    _msgRef = db.ref("messages");
    _clearRef = db.ref("chatMeta/clearedAt");

    _clearRef.on("value", snap => {
      const ts = snap.val() || 0;
      if (ts && ts !== _lastClearedAt) {
        _lastClearedAt = ts;
        clearChatUI();
      }
    });

    let joinTs = 0;
    if (typeof window._myJoinTimestamp === "function") {
      joinTs = window._myJoinTimestamp() || 0;
    }
    if (!joinTs) joinTs = Date.now() - 1200;

    // ✅ 입장 히스토리: mode(on/admin/off) + count(개수), 관리자가 설정 (기본: 전체 공개 100개)
    let showHist = true;
    let histCount = 100;
    try {
      const hs = await db.ref("chatMeta/showHistory").once("value");
      const conf = hs.val() || {};
      const mode = conf.mode || (conf.enabled === false ? "off" : "on");
      const isAdminNow = sessionStorage.getItem("adminPinOk") === "true";
      showHist = (mode === "on") || (mode === "admin" && isAdminNow);
      // ✅ 관리자가 '이전 채팅 불러오기'를 누른 경우: 모드와 무관하게 1회 표시
      if (window._forceHistOnce) {
        showHist = true;
        window._forceHistOnce = false;
      }
      histCount = Math.max(10, Math.min(300, parseInt(conf.count ?? 100, 10) || 100));
    } catch(e) {}

    // ✅ 시간순 최근 N개 로드, 실제 대화(일반/선언/운세)만 렌더 (시스템·이펙트 제외)
    const initSnap = await _msgRef.orderByChild("time").limitToLast(Math.max(histCount, 100)).once("value");
    const box = document.getElementById("chat-box");
    const histItems = [];
    initSnap.forEach(child => {
      const key = child.key;
      const data = child.val();
      if (!key) return;
      _seenMsgKeys.add(key);
      if (!data) return;
      const t = data.type;
      const isRealChat = !t || t === "declaration" || t === "fortune";
      if (isRealChat) histItems.push([key, data]);
    });
    if (showHist) {
      const toRender = histItems.slice(-histCount);
      window._lastHistRenderedCount = toRender.length;
      toRender.forEach(([key, data]) => {
        window.renderChatMessage?.(box, data, key);
      });
    } else {
      window._lastHistRenderedCount = 0;
    }

    // ✅ 관리자 토글 버튼 라벨 실시간 동기화
    try {
      if (!window._histLabelRef) {
        window._histLabelRef = db.ref("chatMeta/showHistory");
        window._histLabelRef.on("value", snap => {
          const conf = snap.val() || {};
          const mode = conf.mode || (conf.enabled === false ? "off" : "on");
          const count = Math.max(10, Math.min(300, parseInt(conf.count ?? 100, 10) || 100));
          window._historyConfCache = { mode, count };

          // 설정 패널 동기화 (열려 있으면)
          const radio = document.querySelector(`input[name="hist-mode"][value="${mode}"]`);
          if (radio) radio.checked = true;
          const cntInput = document.getElementById("hist-count-input");
          if (cntInput && document.activeElement !== cntInput) cntInput.value = String(count);
          const label = document.getElementById("hist-current-label");
          if (label) {
            const modeTxt =
              mode === "on"    ? "🕘 전체 공개" :
              mode === "admin" ? "🛡️ 관리자만" : "🙈 숨김";
            label.textContent = `현재 적용 중: ${modeTxt} · ${count}개`;
          }
        });
      }
    } catch(e) {}

    window.scrollChatToBottom?.(true);

    _msgLiveQuery = _msgRef.orderByChild("time").startAt(joinTs);

    _msgLiveQuery.on("child_added", (snap) => {
      const key = snap.key;
      const data = snap.val();
      if (!data || !key) return;

      if (_seenMsgKeys.has(key)) return;
      _seenMsgKeys.add(key);

      window.renderChatMessage?.(document.getElementById("chat-box"), data, key);

      const isSystemLike = (data.type === "system" || data.type === "fx");
      const isMine = (data.user && data.user === myNick);

      if (!isSystemLike && !isMine) {
        if (!autoScrollEnabled) {
          unreadCount += 1;
          const floatBtn = document.getElementById("new-msg-float");
          const countEl = document.getElementById("new-msg-count");
          if (countEl) countEl.textContent = String(unreadCount);
          if (floatBtn) floatBtn.classList.remove("hidden");
        } else {
          unreadCount = 0;
          const floatBtn = document.getElementById("new-msg-float");
          if (floatBtn) floatBtn.classList.add("hidden");
        }
      }

      window.scrollChatToBottom?.(false);
    });
  }

  // =====================================================
  // admin
  // =====================================================
  function requireAdminPin() {
    if (sessionStorage.getItem("adminPinOk") === "true") return true;
    const p = prompt("관리자 PIN을 입력해 주세요");
    if (p === "2580") {
      sessionStorage.setItem("adminPinOk", "true");
      window.refreshAdminUiVisibility?.();
      return true;
    }
    alert("PIN이 올바르지 않습니다.");
    return false;
  }

  // ✅ 히스토리 노출 설정: 라디오 + 개수 입력 → '설정 적용' 버튼으로만 반영
  async function applyHistoryConfig() {
    if (!requireAdminPin()) return;

    const sel = document.querySelector('input[name="hist-mode"]:checked');
    const mode = sel ? sel.value : "on";
    const n = parseInt(document.getElementById("hist-count-input")?.value, 10);

    if (!Number.isFinite(n) || n < 10 || n > 300) {
      alert("표시 개수는 10에서 300 사이의 숫자로 입력해 주세요!");
      return;
    }
    if (!["on", "admin", "off"].includes(mode)) return;

    const modeTxt =
      mode === "on"    ? "🕘 전체 공개 — 모든 입장자에게 이전 대화가 보여요" :
      mode === "admin" ? "🛡️ 관리자만 — 관리자로 로그인한 사람만 볼 수 있어요" :
                         "🙈 숨김 — 아무에게도 이전 대화가 보이지 않아요";
    if (!confirm(`이 설정을 적용할까요?\n\n${modeTxt}\n표시 개수: ${n}개`)) return;

    await db.ref("chatMeta/showHistory").set({
      mode,
      count: n,
      updatedBy: myNick || "admin",
      at: Date.now()
    });
    alert("✅ 히스토리 설정이 적용됐어요.");
  }

  // ✅ 이전 채팅 불러오기: 누른 관리자 본인 화면에만 과거 대화를 표시
  async function loadHistoryNow() {
    if (!requireAdminPin()) return;
    if (!myNick) { alert("먼저 작업실에 입장해 주세요!"); return; }
    window._forceHistOnce = true;
    try {
      await window.listenMessages?.();
      window.closeSettings?.();
      const n = window._lastHistRenderedCount || 0;
      if (n === 0) {
        alert("불러올 이전 대화가 아직 없어요.\n(뽀모도로·입장 알림 같은 시스템 메시지는 히스토리에 포함되지 않아요)");
      }
    } catch(e) {
      window._forceHistOnce = false;
      alert("이전 채팅을 불러오지 못했어요 😢");
    }
  }

  // =====================================================
  // ✅ 접속 기록 (최근 7일 보관, 첫 접속 시각 유지)
  // =====================================================
  async function recordAttendance() {
    if (!myNick) return;
    const day = ymd(Date.now());
    try {
      const aref = db.ref(`attendance/${day}/${myNick}`);
      const prevSnap = await aref.once("value");
      const prev = prevSnap.val();
      await aref.set({
        emoji: myEmoji || "",
        firstAt: prev?.firstAt || prev?.at || Date.now(),
        at: Date.now()
      });
      const snap = await db.ref("attendance").once("value");
      const cutoff = ymd(Date.now() - 6 * 86400000);
      const updates = {};
      snap.forEach(c => { if (c.key && c.key < cutoff) updates[c.key] = null; });
      if (Object.keys(updates).length) await db.ref("attendance").update(updates);

      // =====================================================
      // ✅ 업적 계산 (개인별 출석 데이터: users/{nick}/attend)
      // =====================================================
      const uref = db.ref(`users/${myNick}/attend`);

      // 날짜 맵 기록 (지난주 풀출석 판정용, 14일 보관)
      await uref.child(`days/${day}`).set(true);
      const dsnap = await uref.child("days").once("value");
      const dcut = ymd(Date.now() - 13 * 86400000);
      const dupd = {};
      dsnap.forEach(c => { if (c.key && c.key < dcut) dupd[c.key] = null; });
      if (Object.keys(dupd).length) await uref.child("days").update(dupd);

      // 연속 출석 카운터 (무제한, 끊기면 1부터 재시작)
      const yesterday = ymd(Date.now() - 86400000);
      const ssnap = await uref.child("streak").once("value");
      const st = ssnap.val() || {};
      let streak;
      if (st.lastDay === day) streak = Number(st.count || 1);
      else if (st.lastDay === yesterday) streak = Number(st.count || 0) + 1;
      else streak = 1;
      await uref.child("streak").set({ count: streak, lastDay: day });

      // 지난주(월~일) 풀출석 판정
      const daysObj = (await uref.child("days").once("value")).val() || {};
      const now = new Date();
      const dow = (now.getDay() + 6) % 7; // 0=월
      const thisMon = new Date(now); thisMon.setDate(now.getDate() - dow);
      let weeklyFull = true;
      for (let i = 7; i >= 1; i--) {
        const dd = new Date(thisMon); dd.setDate(thisMon.getDate() - i);
        if (!daysObj[ymd(dd.getTime())]) { weeklyFull = false; break; }
      }

      // 전역 캐시 + 배지 문자열 (중복 획득 가능: 이모지 중첩)
      window._myAch = { streak, weeklyFull };
      window._myBadgeStr = (streak >= 3 ? "🔥" : "") + (weeklyFull ? "👑" : "");

      // 상태 카드에 즉시 반영
      try { updateStatus(true); } catch(e) {}
    } catch(e) { console.warn("[recordAttendance failed]", e); }
  }

  function _closeAttendanceModal() {
    document.getElementById("attendance-modal")?.remove();
  }

  async function showAttendanceLog() {
    if (!requireAdminPin()) return;
    try {
      const snap = await db.ref("attendance").once("value");
      const v = snap.val() || {};
      const days = Object.keys(v).sort().reverse();

      let body;
      if (!days.length) {
        body = `<div class="hint" style="text-align:center;padding:20px 0;">아직 접속 기록이 없어요!</div>`;
      } else {
        body = days.map(d => {
          const rows = v[d] || {};
          const nicks = Object.keys(rows).sort((a, b) =>
            (rows[a]?.firstAt || 0) - (rows[b]?.firstAt || 0));
          const items = nicks.map(n => {
            const r = rows[n] || {};
            const first = r.firstAt || r.at;
            return `
              <div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px dashed var(--border);">
                <span style="font-size:17px;flex:0 0 auto;">${r.emoji || "✍️"}</span>
                <span style="flex:1;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n)}</span>
                <span style="flex:0 0 auto;font-size:12px;font-weight:800;color:var(--sub-muted);">첫 접속 ${first ? formatHHMM(first) : "-"}</span>
              </div>`;
          }).join("");
          return `
            <div class="set-block" style="margin-bottom:10px;">
              <div class="set-title" style="display:flex;justify-content:space-between;align-items:center;">
                <span>📅 ${escapeHtml(d)}</span>
                <span style="font-size:12px;color:var(--sub-muted);font-weight:900;">${nicks.length}명</span>
              </div>
              ${items}
            </div>`;
        }).join("");
      }

      _closeAttendanceModal();
      const overlay = document.createElement("div");
      overlay.id = "attendance-modal";
      overlay.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:7000;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);";
      overlay.innerHTML = `
        <div class="modal-content" style="max-height:calc(100vh - 60px);display:flex;flex-direction:column;width:min(440px, calc(100vw - 32px));">
          <div class="modal-title">📋 접속 기록</div>
          <div class="modal-sub">최근 7일 · 날짜별 접속한 작가님과 첫 접속 시각이에요.</div>
          <div style="flex:1;overflow:auto;min-height:0;">${body}</div>
          <div style="height:10px;"></div>
          <button class="ghost-btn" style="width:100%;" onclick="document.getElementById('attendance-modal').remove()">닫기</button>
        </div>`;
      overlay.addEventListener("click", (e) => { if (e.target === overlay) _closeAttendanceModal(); });
      document.body.appendChild(overlay);
    } catch(e) {
      console.warn("[showAttendanceLog failed]", e);
      alert("접속 기록을 불러오지 못했어요 😢");
    }
  }

  // =====================================================
  // ✅ 업적 테스트 모드 (관리자)
  // =====================================================
  async function applyAchievementOverride() {
    if (!requireAdminPin()) return;
    const nick = document.getElementById("ach-test-nick")?.value?.trim();
    if (!nick) { alert("필명을 입력해 주세요!"); return; }
    const streak = Math.max(0, parseInt(document.getElementById("ach-test-streak")?.value, 10) || 0);
    const weekly = !!document.getElementById("ach-test-weekly")?.checked;

    await db.ref(`achievementOverrides/${nick}`).set({
      streakDays: streak,
      weeklyFull: weekly,
      expiresAt: Date.now() + 24 * 3600 * 1000,
      by: myNick || "admin",
      at: Date.now()
    });
    alert(`🧪 ${nick} 님에게 테스트 업적을 적용했어요.\n연속 ${streak}일 / 지난주 풀출석 ${weekly ? "O" : "X"}\n(24시간 후 자동 만료 · 카드는 최대 15초 안에 갱신돼요)`);
  }

  async function clearAchievementOverride() {
    if (!requireAdminPin()) return;
    const nick = document.getElementById("ach-test-nick")?.value?.trim();
    if (nick) {
      await db.ref(`achievementOverrides/${nick}`).remove();
      alert(`🧪 ${nick} 님의 테스트 업적을 해제했어요.`);
    } else {
      if (!confirm("필명이 비어 있어요. 모든 테스트 업적을 해제할까요?")) return;
      await db.ref("achievementOverrides").remove();
      alert("🧪 모든 테스트 업적을 해제했어요.");
    }
  }

  async function clearAllChat() {
    if (!requireAdminPin()) return;
    if (!confirm("정말 채팅을 모두 삭제할까요? (되돌릴 수 없어요!)")) return;

    const now = Date.now();
    await db.ref("chatMeta/clearedAt").set(now);
    await db.ref("messages").remove();
    await db.ref("messages").push({ type: "system", msg: "🧹 관리자가 채팅을 전체 삭제했습니다.", time: now });

    clearChatUI();
  }

  window.listenStatus = listenStatus;
  window.listenPomodoro = listenPomodoro;
  window.listenMessages = listenMessages;
  window.updateStatus = updateStatus;
  window.startPomodoro = startPomodoro;
  window.stopPomodoro = stopPomodoro;
  window.requireAdminPin = requireAdminPin;
  window.clearAllChat = clearAllChat;
  window.applyHistoryConfig = applyHistoryConfig;
  window.loadHistoryNow = loadHistoryNow;
  window.recordAttendance = recordAttendance;
  window.showAttendanceLog = showAttendanceLog;
  window.applyAchievementOverride = applyAchievementOverride;
  window.clearAchievementOverride = clearAchievementOverride;
  window.updateChatHeader = updateChatHeader;
