
  function num(v) {
    const n = parseInt(String(v || "0"), 10);
    return Number.isFinite(n) ? n : 0;
  }

  // =====================================================
  // ✅ Theme per nick (Firebase + local fallback)
  // =====================================================
  function _themeLocalKey() {
    return myNick ? `writerTheme_${myNick}` : "writerTheme";
  }

  async function loadThemeForNick() {
    // 1) Firebase 우선
    if (myNick) {
      try {
        const snap = await db.ref(`users/${myNick}/prefs/themeName`).once("value");
        const themeName = snap.val();
        if (themeName) {
          localStorage.setItem(_themeLocalKey(), String(themeName));
          window.applyTheme?.(String(themeName));
          return;
        }
      } catch (e) {}
    }

    // 2) localStorage fallback
    const local = localStorage.getItem(_themeLocalKey()) || localStorage.getItem("writerTheme");
    if (local) window.applyTheme?.(local);
  }

  async function saveThemeForNick(themeName) {
    const name = String(themeName || "").trim();
    if (!name) return;

    localStorage.setItem(_themeLocalKey(), name);

    if (myNick) {
      try {
        await db.ref(`users/${myNick}/prefs/themeName`).set(name);
      } catch (e) {}
    }
  }

  // 외부(테마 선택 UI)에서 바로 쓰게 export
  window.loadThemeForNick = loadThemeForNick;
  window.saveThemeForNick = saveThemeForNick;

  // =====================================================
  // ✅ Todo state in UI memory
  // =====================================================
  function getTodoItemsFromUI() {
    return window._todoItems || [];
  }

  function _normalizeRoutineTodos(items) {
    const today = ymd(Date.now());
    return (Array.isArray(items) ? items : []).map(x =>
      (x && x.routine && x.done && x.doneDay !== today)
        ? ({ ...x, done: false, doneDay: "" })
        : x
    );
  }

  function setTodoItemsToUI(items) {
    window._todoItems = _normalizeRoutineTodos(items);
    renderTodoList();
  }

  // =====================================================
  // ✅ Todo render: “... 버튼 → 메뉴(수정/삭제)” + 한 줄 1개
  // =====================================================
  function _closeAllTodoMenus(except) {
    document.querySelectorAll(".todo-menu").forEach(m => {
      if (except && m === except) return;
      m.classList.remove("open");
    });
  }

  function _openTodoMenuSmart(li, menu, moreBtn) {
    if (!li || !menu || !moreBtn) return;

    menu.classList.add("open");
    menu.classList.remove("open-up");

    requestAnimationFrame(() => {
      const menuRect = menu.getBoundingClientRect();
      const btnRect = moreBtn.getBoundingClientRect();

      const spaceBelow = window.innerHeight - btnRect.bottom;
      const spaceAbove = btnRect.top;

      if (spaceBelow < menuRect.height + 12 && spaceAbove > menuRect.height + 12) {
        menu.classList.add("open-up");
      } else {
        menu.classList.remove("open-up");
      }
    });
  }

  function renderTodoList() {
    const ul = document.getElementById("todo-list");
    if (!ul) return;

    const items = getTodoItemsFromUI();
    ul.innerHTML = "";

    items.forEach(item => {
      const li = document.createElement("li");
      li.className = "todo-item" + (item.done ? " done" : "");
      li.dataset.id = item.id;

      li.innerHTML = `
        <label class="todo-left">
          <input class="todo-check" type="checkbox" ${item.done ? "checked" : ""} />
          <span class="todo-text"></span>
        </label>

        <button class="todo-more" type="button" aria-label="todo menu">⋯</button>

        <div class="todo-menu" role="menu">
          <button type="button" class="edit" role="menuitem">✏️ 수정</button>
          <button type="button" class="routine" role="menuitem">${item.routine ? "🔁 반복 해제" : "🔁 매일 반복"}</button>
          <button type="button" class="danger delete" role="menuitem">🗑 삭제</button>
        </div>
      `;

      li.querySelector(".todo-text").textContent = item.text || "";

      if (item.routine) {
        const badge = document.createElement("span");
        badge.className = "todo-routine-badge";
        badge.textContent = "🔁";
        badge.title = "매일 반복되는 투두예요 (자정에 체크가 풀려요)";
        li.querySelector(".todo-left")?.appendChild(badge);
      }

      li.querySelector(".todo-check").addEventListener("change", (e) => {
        toggleTodo(item.id, e.target.checked);
      });

      const moreBtn = li.querySelector(".todo-more");
      const menu = li.querySelector(".todo-menu");

      moreBtn.addEventListener("click", (e) => {
        e.stopPropagation();

        const willOpen = !menu.classList.contains("open");
        _closeAllTodoMenus(menu);

        if (!willOpen) {
          menu.classList.remove("open", "open-up");
          return;
        }

        _openTodoMenuSmart(li, menu, moreBtn);
      });

      li.querySelector(".todo-menu .edit").addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        editTodo(item.id);
      });

      li.querySelector(".todo-menu .routine").addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        toggleRoutineTodo(item.id);
      });

      li.querySelector(".todo-menu .delete").addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        deleteTodo(item.id);
      });

      // 바깥 클릭 시 닫기
      li.addEventListener("click", () => _closeAllTodoMenus());
      ul.appendChild(li);
    });
  }

  // 문서 어디든 클릭하면 메뉴 닫기
  document.addEventListener("click", () => _closeAllTodoMenus());

  function bindTodoInputEnter() {
    const inp = document.getElementById("todo-input");
    if (!inp) return;

    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTodoFromUI();
      }
    });
  }

  function addTodoFromUI() {
    const inp = document.getElementById("todo-input");
    if (!inp) return;

    const text = (inp.value || "").trim();
    if (!text) return;

    const items = getTodoItemsFromUI();
    items.unshift({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      text,
      done: false,
      createdAt: Date.now()
    });

    inp.value = "";
    setTodoItemsToUI(items);
    savePersonalData();
  }

  function toggleTodo(id, done) {
    const items = getTodoItemsFromUI().map(x =>
      x.id === id ? ({...x, done: !!done, doneDay: done ? ymd(Date.now()) : ""}) : x
    );
    setTodoItemsToUI(items);
    savePersonalDataDebounced();
  }

  function toggleRoutineTodo(id) {
    const items = getTodoItemsFromUI().map(x =>
      x.id === id ? ({...x, routine: !x.routine}) : x
    );
    setTodoItemsToUI(items);
    savePersonalData();
  }

  function clearCompletedTodos() {
    const items = getTodoItemsFromUI();
    const doneCount = items.filter(x => x.done).length;
    if (!doneCount) { alert("완료된 투두가 없어요!"); return; }
    if (!confirm(`완료된 투두 ${doneCount}개를 정리할까요?\n(🔁 반복 투두는 삭제되지 않고 체크만 풀려요)`)) return;

    const next = items
      .filter(x => !(x.done && !x.routine))
      .map(x => x.done ? ({...x, done: false, doneDay: ""}) : x);

    setTodoItemsToUI(next);
    savePersonalData();
  }

  function editTodo(id) {
    const items = getTodoItemsFromUI();
    const target = items.find(x => x.id === id);
    if (!target) return;

    const next = prompt("투두 수정", target.text || "");
    if (next === null) return;

    const text = String(next).trim();
    if (!text) return;

    const updated = items.map(x => x.id === id ? ({...x, text}) : x);
    setTodoItemsToUI(updated);
    savePersonalData();
  }

  function deleteTodo(id) {
    if (!confirm("이 투두를 삭제할까요?")) return;
    const items = getTodoItemsFromUI().filter(x => x.id !== id);
    setTodoItemsToUI(items);
    savePersonalData();
  }

  window.bindTodoInputEnter = bindTodoInputEnter;
  window.addTodoFromUI = addTodoFromUI;
  window.toggleRoutineTodo = toggleRoutineTodo;
  window.clearCompletedTodos = clearCompletedTodos;

  // =====================================================
  // ✅ Personal data (Firebase)
  // =====================================================
  function savePersonalData() {
    if (!myNick) return;

    const data = {
      todoItems: getTodoItemsFromUI(),
      todayGoalText: document.getElementById("db-today-goal-text")?.value || "",
      todayDone: document.getElementById("db-today-done")?.value || "",
      statusChoice: document.getElementById("db-status")?.value || "rest"
    };

    db.ref("users/" + myNick).set(data);

    backupLocal();
    saveDailyLog();

    if (typeof updateStatus === "function") updateStatus(true);
  }

  let saveTimeout;
  function savePersonalDataDebounced() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => savePersonalData(), 700);
  }

  async function loadPersonalData() {
    if (!myNick) return;

    // ✅ 로컬 복구 먼저
    restoreLocal();

    // ✅ 테마도 닉 귀속으로 즉시 적용(가능하면 Firebase 우선)
    try { await loadThemeForNick(); } catch (e) {}

    db.ref("users/" + myNick).once("value", async (snap) => {
      const data = snap.val();
      if (data) {
        setTodoItemsToUI(data.todoItems || []);

        if (document.getElementById("db-today-goal-text")) {
          document.getElementById("db-today-goal-text").value = data.todayGoalText || "";
        }
        if (document.getElementById("db-today-done")) {
          document.getElementById("db-today-done").value = data.todayDone || "";
        }
        if (document.getElementById("db-status")) {
          const st = (data.statusChoice && data.statusChoice !== "idle") ? data.statusChoice : "rest";
          document.getElementById("db-status").value = st;
        }
      } else {
        setTodoItemsToUI([]);
      }

      updatePersonalProgressUI();
      renderQuickStatusBtn();
      setTimeout(fetchWeeklyStats, 300);

      // ✅ NEW: 참가/사운드 설정 로드(닉 귀속)
      try { await window.loadPomodoroParticipationFromFirebase?.(); } catch(e){}
      try { await window.loadSoundPrefsFromFirebase?.(); } catch(e){}
    });
  }

  function updatePersonalProgressUI() {
    const done = num(document.getElementById("db-today-done")?.value);
    const txt = document.getElementById("today-progress-text");
    if (txt) txt.textContent = `오늘 누적: ${done}자`;
  }

  function backupLocal() {
    if (!myNick) return;
    const payload = {
      at: Date.now(),
      todoItems: getTodoItemsFromUI(),
      todayGoalText: document.getElementById("db-today-goal-text")?.value || "",
      todayDone: document.getElementById("db-today-done")?.value || "",
      status: document.getElementById("db-status")?.value || "writing",
      themeName: localStorage.getItem(_themeLocalKey()) || ""
    };
    localStorage.setItem(`backup_${myNick}`, JSON.stringify(payload));
  }

  function restoreLocal() {
    if (!myNick) return;
    const raw = localStorage.getItem(`backup_${myNick}`);
    if (!raw) return;

    try {
      const payload = JSON.parse(raw);
      if (!payload) return;

      setTodoItemsToUI(payload.todoItems || []);
      if (document.getElementById("db-today-goal-text")) document.getElementById("db-today-goal-text").value = payload.todayGoalText || "";
      if (document.getElementById("db-today-done")) document.getElementById("db-today-done").value = payload.todayDone || "";
      if (document.getElementById("db-status")) {
        const st = (payload.status && payload.status !== "idle") ? payload.status : "rest";
        document.getElementById("db-status").value = st;
      }
      renderQuickStatusBtn();

      // ✅ 로컬 테마도 복구
      if (payload.themeName) {
        localStorage.setItem(_themeLocalKey(), payload.themeName);
        window.applyTheme?.(payload.themeName);
      }

      updatePersonalProgressUI();
    } catch (e) {}
  }

  function saveDailyLog() {
    if (!myNick) return;
    const done = num(document.getElementById("db-today-done")?.value);
    const day = ymd(Date.now());
    db.ref(`users/${myNick}/dailyLogs/${day}`).set(done);
  }

  function fetchWeeklyStats() {
    if (!myNick) return;
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(ymd(d.getTime()));
    }

    db.ref(`users/${myNick}/dailyLogs`).once("value", snap => {
      const data = snap.val() || {};
      let sum = 0;
      let max = 0;
      let maxDay = "";
      days.forEach(k => {
        const v = num(data[k]);
        sum += v;
        if (v > max) { max = v; maxDay = k; }
      });

      const txt = document.getElementById("today-progress-text");
      if (txt) {
        const extra = ` · 최근7일 합계 ${sum}자 · 최고 ${max}자(${maxDay ? maxDay.slice(5) : "-"})`;
        if (!txt.textContent.includes("최근7일")) txt.textContent += extra;
      }
    });
  }

  function saveNow() {
    savePersonalData();
    if (typeof updateStatus === "function") updateStatus(true);
  }

  // ✅ 원터치 집필/휴식 전환
  function toggleWritingStatus() {
    const sel = document.getElementById("db-status");
    if (!sel) return;
    sel.value = (sel.value === "writing") ? "rest" : "writing";
    renderQuickStatusBtn();
    saveNow();
  }

  function renderQuickStatusBtn() {
    const btn = document.getElementById("status-quick-btn");
    const sel = document.getElementById("db-status");
    if (!btn || !sel) return;
    if (sel.value === "writing") {
      btn.textContent = "☕ 휴식으로 전환";
      btn.classList.remove("primary");
    } else {
      btn.textContent = "✍️ 집필 시작!";
      btn.classList.add("primary");
    }
  }

  window.toggleWritingStatus = toggleWritingStatus;
  window.renderQuickStatusBtn = renderQuickStatusBtn;
  window.savePersonalData = savePersonalData;
  window.savePersonalDataDebounced = savePersonalDataDebounced;
  window.saveNow = saveNow;
  window.loadPersonalData = loadPersonalData;
  window.updatePersonalProgressUI = updatePersonalProgressUI;
  window.saveDailyLog = saveDailyLog;
  window.backupLocal = backupLocal;
  window.restoreLocal = restoreLocal;
