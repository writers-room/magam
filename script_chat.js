
  // =====================================================
  // ✅ Chat render state
  // =====================================================
  let lastRendered = { user: null, ts: 0, ymd: null, msg: "" };
  let autoScrollEnabled = true;
  let unreadCount = 0;

  function scrollChatToBottom(force = false) {
    const box = document.getElementById("chat-box");
    if (!box) return;
    if (force || autoScrollEnabled) box.scrollTop = box.scrollHeight;
  }

  function bindChatScrollGuard() {
    const box = document.getElementById("chat-box");
    if (!box) return;
    box.addEventListener("scroll", () => {
      const near = (box.scrollHeight - box.scrollTop - box.clientHeight) <= 80;
      autoScrollEnabled = near;
      if (near) {
        unreadCount = 0;
        document.getElementById("new-msg-float")?.classList.add("hidden");
      }
    });
    const floatBtn = document.getElementById("new-msg-float");
    if (floatBtn) floatBtn.onclick = () => scrollChatToBottom(true);
  }

  // =====================================================
  // ✅ DND (방해 금지) 모드 — 현재 세션만, 재접속 시 리셋
  // =====================================================
  let _dndEnabled = false;

  function isDndEnabled() { return _dndEnabled; }

  function toggleDnd(force) {
    _dndEnabled = (typeof force === "boolean") ? force : !_dndEnabled;
    _renderDndButton();
    _renderDndBadge();
  }

  function _renderDndButton() {
    const btn = document.getElementById("dnd-toggle-btn");
    if (!btn) return;
    btn.textContent = _dndEnabled ? "🔕 방해 금지 ON" : "🔔 방해 금지 OFF";
    _dndEnabled ? btn.classList.add("danger") : btn.classList.remove("danger");
  }

  function _renderDndBadge() {
    const info = document.getElementById("my-info");
    if (!info) return;
    let badge = document.getElementById("dnd-badge");
    if (_dndEnabled) {
      if (!badge) {
        badge = document.createElement("span");
        badge.id = "dnd-badge";
        badge.style.cssText = "display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;background:rgba(255,59,48,.12);border:1px solid rgba(255,59,48,.22);font-size:11px;font-weight:950;color:#ff3b30;margin-left:6px;flex-shrink:0;";
        badge.textContent = "🔕 DND";
        info.appendChild(badge);
      }
    } else {
      badge?.remove();
    }
  }

  function _injectDndToggle() {
    const panel = document.getElementById("panel-chat");
    if (!panel || document.getElementById("dnd-block")) return;
    const block = document.createElement("div");
    block.className = "set-block";
    block.id = "dnd-block";
    block.innerHTML = `
      <div class="set-title">🔕 방해 금지 모드</div>
      <button id="dnd-toggle-btn" class="ghost-btn" type="button" style="width:100%;">🔔 방해 금지 OFF</button>
      <div class="hint">ON 상태에서는 멘션 알림음·이펙트 토스트가 모두 차단돼요.<br>재접속하면 자동으로 OFF로 돌아와요.</div>
    `;
    panel.insertBefore(block, panel.firstChild);
    document.getElementById("dnd-toggle-btn")?.addEventListener("click", () => toggleDnd());
    _renderDndButton();
  }

  // =====================================================
  // ✅ 멘션 알림음 — 세션마다 리셋 (기본 켜짐)
  // =====================================================
  let _mentionSoundEnabled = true; // 세션 변수, localStorage 저장 안 함

  function _injectMentionSoundToggle() {
    const panel = document.getElementById("panel-chat");
    if (!panel || document.getElementById("mention-sound-block")) return;
    const block = document.createElement("div");
    block.className = "set-block";
    block.id = "mention-sound-block";
    block.innerHTML = `
      <div class="set-title">멘션 알림음</div>
      <label style="display:flex;align-items:center;gap:10px;font-weight:950;cursor:pointer;">
        <input id="set-mention-sound" type="checkbox" checked>
        누군가 나를 @멘션하면 알림음 재생
      </label>
      <div class="hint">이 설정은 현재 세션에서만 유지돼요. 재접속하면 켜짐으로 돌아와요.</div>
    `;
    panel.insertBefore(block, panel.firstChild);
    document.getElementById("set-mention-sound")?.addEventListener("change", function() {
      _mentionSoundEnabled = this.checked;
    });
  }

  const _origOpenSettings = window.openSettings;
  window.openSettings = function(...args) {
    const ret = _origOpenSettings?.(...args);
    setTimeout(() => { _injectMentionSoundToggle(); _injectDndToggle(); }, 60);
    return ret;
  };

  const _origOpenTab = window.openTab;
  window.openTab = function(name, ...args) {
    const ret = _origOpenTab?.(name, ...args);
    if (name === "chat") setTimeout(() => { _injectMentionSoundToggle(); _injectDndToggle(); }, 60);
    return ret;
  };

  // =====================================================
  // ✅ 슬래시 명령어 정의
  // =====================================================
  const SLASH_COMMANDS = {

      "/운세": {
      label: "🔮 오늘의 운세 보기",
      systemMsg: (nick) => nick, // 실제 메시지는 _buildFortuneMsg에서 생성
      emojis: ["🔮","✨","🌟","💫","🍀","⭐","🌙","🌈","💎","🎴"],
      colors: ["#9B59B6","#3498DB","#E91E63","#FF9800","#4CAF50"],
      count: 40,
      isFortune: true
    },

    "/축하": {
      label: "🎉 작가님을 축하합니다!",
      systemMsg: (nick) => `🎉 ${nick} 작가님이 축하하셨습니다!`,
      emojis: ["🎉","🎊","✨","🥳","💖","🌟","🎈","🎆","🎇","💫"],
      colors: ["#FF6B9D","#FFD700","#FF4500","#00CED1","#9B59B6","#FF69B4"],
      count: 60
    },
    "/마감": {
      label: "🏁 마감에 성공!",
      systemMsg: (nick) => `🏁 ${nick} 작가님이 마감하셨습니다! 수고하셨어요 🔥`,
      emojis: ["🏁","🔥","💪","✅","⚡","🎯","📝","💥","🌈","🥇"],
      colors: ["#FF4500","#FF6347","#FFD700","#32CD32","#1E90FF"],
      count: 55
    },
    "/달성": {
      label: "🏆 목표 달성!",
      systemMsg: (nick) => `🏆 ${nick} 작가님이 오늘 목표를 달성했습니다!`,
      emojis: ["🏆","🥇","🎊","💎","👑","🌟","✨","💖","🎉","🔥"],
      colors: ["#DAA520","#FFD700","#FF6347","#4169E1","#9370DB"],
      count: 70
    },
    "/연재": {
      label: "📢 연재 시작!",
      systemMsg: (nick) => `📢 ${nick} 작가님이 연재를 시작하셨습니다!`,
      emojis: ["📢","🎉","✨","💖","🌸","⭐","🎈","🦋","🌺","💫"],
      colors: ["#FF69B4","#FF1493","#DB7093","#FFB6C1","#FFC0CB"],
      count: 50
    },
    "/휴식": {
      label: "☕ 휴식...",
      systemMsg: (nick) => `☕ ${nick} 작가님이 잠시 휴식하러 가셨어요~`,
      emojis: ["☕","🍵","🫖","💤","🌙","⭐","🌿","🍃","🌸"],
      colors: ["#8B7355","#D2B48C","#98FB98","#87CEEB","#DDA0DD"],
      count: 35
    },
    "/집필": {
      label: "✍️ 집필 시작!",
      systemMsg: (nick) => `✍️ ${nick} 작가님이 집필을 시작하셨습니다! 화이팅 💪`,
      emojis: ["✍️","📝","💡","⚡","🔥","✨","💪","🎯","📖","🌟"],
      colors: ["#4169E1","#1E90FF","#00BFFF","#87CEEB","#6495ED"],
      count: 45
    },
    "/만세": {
      label: "🙌 만세!!",
      systemMsg: (nick) => `🙌 ${nick} 작가님이 만세를 외치셨습니다!`,
      emojis: ["🙌","🎉","🥳","🎊","💥","✨","🌟","💖","🎈","🔥"],
      colors: ["#FF6347","#FFD700","#ADFF2F","#00CED1","#FF69B4"],
      count: 65
    },
    "/수고": {
      label: "💙 수고하셨습니다!",
      systemMsg: (nick) => `💙 작가님들, 오늘도 정말 수고하셨어요!`,
      emojis: ["💙","💜","💖","🌸","⭐","✨","🌙","🍀","🌈","💫"],
      colors: ["#6495ED","#9370DB","#FF69B4","#98FB98","#FFD700"],
      count: 40
    },
    "/고추": {
      label: "🌶️ 고추×고추",
      systemMsg: (nick) => `🌶️ ${nick} 작가님이 고추 농사 중이십니다 🌶️🌶️🌶️`,
      emojis: ["🌶️","🔥","🌿","🌱","🥵","💦","🌾","🍅","🌽","🥕"],
      colors: ["#FF2400","#FF4500","#FF6347","#228B22","#32CD32"],
      count: 55
    },
    "/외치기": {
      label: "📣 화면에 크게 외치기",
      systemMsg: (nick, text) => `📣 ${nick} 작가님: "${text}"`,
      emojis: ["📣","✨","💥","⚡","🔥","💫","🌟","🎯"],
      colors: ["#FF4500","#FFD700","#FF69B4","#00CED1","#9B59B6"],
      count: 30,
      hasText: true
    },
    "/선언": {
      label: "🎯 오늘의 목표 선언",
      systemMsg: (nick, text) => `🎯 ${nick} 작가님의 오늘 선언: "${text}"`,
      emojis: ["🎯","✨","💪","🔥","⭐","💡","🌟","🏆"],
      colors: ["#4169E1","#FFD700","#FF6347","#32CD32","#9B59B6"],
      count: 35,
      hasText: true
    }
  };

  function _detectSlashCommand(text) {
    const trimmed = text.trim();
    for (const cmd of Object.keys(SLASH_COMMANDS)) {
      if (trimmed === cmd) return { cmd, def: SLASH_COMMANDS[cmd], extraText: "" };
      if (trimmed.startsWith(cmd + " ")) {
        return { cmd, def: SLASH_COMMANDS[cmd], extraText: trimmed.slice(cmd.length + 1).trim() };
      }
    }
    return null;
  }

  // =====================================================
  // ✅ 운세 생성 — 닉+날짜 기준 고정 (0시 갱신)
  // =====================================================
  function _buildFortuneMsg(nick) {
    const fd = window.FORTUNE_DATA;
    if (!fd) return `${nick} 작가님의 오늘의 운세를 불러올 수 없어요. 😢`;

    // 닉 + 오늘 날짜를 seed로 사용 → 하루 고정
    const today = new Date();
    const dateStr = `${today.getFullYear()}${today.getMonth()}${today.getDate()}`;
    const seed = nick + dateStr;

    // 간단한 해시 함수
    function hashStr(s, offset) {
      let h = offset || 0;
      for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    }

    const fortune   = fd.fortunes[hashStr(seed, 1)   % fd.fortunes.length];
    const item      = fd.luckyItems[hashStr(seed, 2)  % fd.luckyItems.length];
    const color     = fd.luckyColors[hashStr(seed, 3) % fd.luckyColors.length];
    const number    = fd.luckyNumbers[hashStr(seed, 4) % fd.luckyNumbers.length];

    return `🔮 ${nick} 작가님의 오늘의 운세는 "${fortune}" 럭키 아이템은 ${item}, 행운의 색깔은 ${color}, 행운의 숫자는 ${number}입니다! ✨`;
  }

  // =====================================================
  // ✅ 단독 이모지 판별
  // =====================================================
  function _isSingleEmoji(text) {
    if (!text || text.trim() !== text) return false;
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      try {
        const seg      = new Intl.Segmenter("ko", { granularity: "grapheme" });
        const segments = [...seg.segment(text)];
        if (segments.length !== 1) return false;
        const s = segments[0].segment;
        return /\p{Emoji}/u.test(s) && !/^[0-9#*]$/.test(s);
      } catch(e) {}
    }
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})(\u200D(\p{Emoji_Presentation}|\p{Extended_Pictographic})|\uFE0F|\u20E3)*$/u;
    return emojiRegex.test(text);
  }

  // =====================================================
  // ✅ 파티클 이펙트 엔진
  // =====================================================
  let _effectCanvas    = null;
  let _effectCtx       = null;
  let _effectParticles = [];
  let _effectRafId     = null;

  function _ensureEffectCanvas() {
    if (_effectCanvas) return _effectCanvas;
    const canvas = document.createElement("canvas");
    canvas.id = "effect-canvas";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:8000;";
    document.body.appendChild(canvas);
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener("resize", () => {
      if (_effectCanvas) { _effectCanvas.width = window.innerWidth; _effectCanvas.height = window.innerHeight; }
    });
    _effectCanvas = canvas;
    _effectCtx    = canvas.getContext("2d");
    return canvas;
  }

  function _spawnParticles(emojis, colors, count) {
    _ensureEffectCanvas();
    const W  = _effectCanvas.width;
    const H  = _effectCanvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const diag     = Math.sqrt((W / 2) ** 2 + (H / 2) ** 2);
    const minSpeed = diag * 0.032;
    const maxSpeed = diag * 0.058;

    for (let i = 0; i < count; i++) {
      const useEmoji = Math.random() > 0.30;
      const angle    = Math.random() * Math.PI * 2;
      const speed    = minSpeed + Math.random() * (maxSpeed - minSpeed);
      _effectParticles.push({
        x:    cx,
        y:    cy,
        vx:   Math.cos(angle) * speed,
        vy:   Math.sin(angle) * speed,
        rot:  Math.random() * 360,
        vrot: (Math.random() - 0.5) * 12,
        size: useEmoji
          ? 16 + Math.random() * Math.random() * 48
          : 5  + Math.random() * 12,
        alpha: 1,
        decay: 0.012 + Math.random() * 0.022,
        isEmoji: useEmoji,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: ["circle", "rect", "triangle"][Math.floor(Math.random() * 3)]
      });
    }
  }

  function _drawParticle(ctx, p) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rot * Math.PI) / 180);
    if (p.isEmoji) {
      ctx.font = `${p.size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.emoji, 0, 0);
    } else {
      ctx.fillStyle = p.color;
      if (p.shape === "circle") {
        ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
      } else if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath(); ctx.moveTo(0, -p.size / 2);
        ctx.lineTo(p.size / 2, p.size / 2); ctx.lineTo(-p.size / 2, p.size / 2);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  function _runEffectLoop() {
    if (!_effectCtx || !_effectCanvas) return;
    _effectCtx.clearRect(0, 0, _effectCanvas.width, _effectCanvas.height);
    _effectParticles = _effectParticles.filter(p => p.alpha > 0.02);
    for (const p of _effectParticles) {
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.vrot;
      p.vx  *= 0.96;
      p.vy  *= 0.96;
      p.vy  += 0.35;
      p.alpha -= p.decay;
      _drawParticle(_effectCtx, p);
    }
    if (_effectParticles.length > 0) {
      _effectRafId = requestAnimationFrame(_runEffectLoop);
    } else {
      cancelAnimationFrame(_effectRafId);
      _effectRafId = null;
      _effectCtx.clearRect(0, 0, _effectCanvas.width, _effectCanvas.height);
    }
  }

  function runEffect(emojis, colors, count) {
    _effectParticles = [];
    if (_effectRafId) { cancelAnimationFrame(_effectRafId); _effectRafId = null; }
    _spawnParticles(emojis, colors, count);
    _effectRafId = requestAnimationFrame(_runEffectLoop);
  }

  // =====================================================
  // ✅ 외치기 오버레이
  // =====================================================
  let _shoutTimer = null;
  let _shoutExpiresAt = 0; // ✅ [FIX] 절대 만료 시각(백그라운드 탭 setTimeout 지연/스로틀 대응용)

  function _hideShoutOverlay() {
    const overlay = document.getElementById("shout-overlay");
    if (overlay) {
      overlay.style.opacity = "0";
      const inner = document.getElementById("shout-inner");
      if (inner) inner.style.transform = "scale(.92)";
    }
    _shoutExpiresAt = 0;
    if (_shoutTimer) { clearTimeout(_shoutTimer); _shoutTimer = null; }
  }

  function showShoutOverlay(nick, text, durationMs = 3000) {
    let overlay = document.getElementById("shout-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "shout-overlay";
      overlay.style.cssText = "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:8500;pointer-events:none;opacity:0;transition:opacity 0.25s ease;";
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div id="shout-inner" style="text-align:center;padding:32px 48px;border-radius:28px;background:rgba(0,0,0,.58);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.18);max-width:80vw;transform:scale(.92);transition:transform 0.3s cubic-bezier(.2,.8,.2,1);">
        <div style="font-size:13px;font-weight:900;color:rgba(255,255,255,.7);margin-bottom:12px;letter-spacing:.5px;">📣 ${escapeHtml(nick)} 작가님</div>
        <div style="font-size:clamp(22px,4vw,44px);font-weight:950;color:#ffffff;line-height:1.25;letter-spacing:-0.5px;word-break:keep-all;">${escapeHtml(text)}</div>
      </div>
    `;
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      const inner = document.getElementById("shout-inner");
      if (inner) inner.style.transform = "scale(1)";
    });

    if (_shoutTimer) clearTimeout(_shoutTimer);
    // ✅ [FIX] 절대 시각 기준으로 만료를 계산 → 탭이 백그라운드였다가 나중에
    // "발견"하며 돌아왔을 때도 이 시각을 기준으로 즉시/정확히 사라지게 함
    _shoutExpiresAt = Date.now() + durationMs;
    _shoutTimer = setTimeout(_hideShoutOverlay, durationMs);
  }

  // ✅ [FIX] 늦게 발견 버그: 브라우저는 탭이 백그라운드(비활성)일 때 setTimeout을
  // 지연시키거나 거의 멈춰버릴 수 있어서, 예정된 시각에 오버레이가 안 사라지고
  // 화면에 계속 남아있는 것처럼 보일 수 있었음.
  // → 탭이 다시 보이게 되는 순간(visibilitychange) 만료 시각을 재확인해서
  //   이미 지났으면 즉시 숨기고, 아직 남았으면 남은 시간만큼만 다시 예약한다.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (!_shoutExpiresAt) return;

    const remain = _shoutExpiresAt - Date.now();
    if (remain <= 0) {
      _hideShoutOverlay();
    } else {
      if (_shoutTimer) clearTimeout(_shoutTimer);
      _shoutTimer = setTimeout(_hideShoutOverlay, remain);
    }
  });

  // =====================================================
  // ✅ 핀 메시지
  // =====================================================
  let _pinRef = null;

  function listenPinnedMessage() {
    if (_pinRef) return;
    _pinRef = db.ref("chatMeta/pinned");
    _pinRef.on("value", snap => _renderPinBanner(snap.val()));
  }

  function _renderPinBanner(data) {
    const sidebar = document.querySelector(".chat-sidebar");
    if (!sidebar) return;
    let banner = document.getElementById("pin-banner");
    if (!data || !data.text) { banner?.remove(); return; }
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pin-banner";
      const pomoLine = document.getElementById("pomo-status-line");
      const header = sidebar.querySelector(".header");
      if (pomoLine) pomoLine.insertAdjacentElement("afterend", banner);
      else if (header) header.insertAdjacentElement("afterend", banner);
      else sidebar.prepend(banner);
    }
    const isAdmin = sessionStorage.getItem("adminPinOk") === "true";
    banner.className = "pin-banner";
    banner.innerHTML = `
      <span class="pin-icon">📌</span>
      <span class="pin-text">${escapeHtml(data.text)}</span>
      <span class="pin-by">— ${escapeHtml(data.by || "")}</span>
      ${isAdmin ? `<button class="pin-remove-btn" onclick="removePinnedMessage()" title="핀 제거">✕</button>` : ""}
    `;
  }

  async function setPinnedMessage(text, by) {
    if (!text || !by) return;
    await db.ref("chatMeta/pinned").set({ text, by, at: Date.now() });
  }

  async function removePinnedMessage() {
    if (sessionStorage.getItem("adminPinOk") !== "true") {
      if (!window.requireAdminPin?.()) return;
    }
    await db.ref("chatMeta/pinned").remove();
  }

  window.setPinnedMessage    = setPinnedMessage;
  window.removePinnedMessage = removePinnedMessage;
  window.listenPinnedMessage = listenPinnedMessage;

  // =====================================================
  // ✅ 명령어 토스트
  // =====================================================
  let _cmdToastTimer = null;

  function showCommandToast(text) {
    let toast = document.getElementById("command-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "command-toast";
      toast.style.cssText = `
        position:fixed;bottom:90px;left:50%;
        transform:translateX(-50%) translateY(30px);
        z-index:7500;display:flex;align-items:center;gap:10px;
        padding:14px 22px;border-radius:999px;
        border:1px solid rgba(10,132,255,.22);
        background:var(--panel,rgba(255,255,255,.96));
        box-shadow:0 8px 32px rgba(0,0,0,.14);
        font-weight:950;font-size:14px;color:var(--text,#141618);
        pointer-events:none;opacity:0;
        transition:transform 0.3s cubic-bezier(.2,.8,.2,1),opacity 0.3s ease;
        max-width:calc(100vw - 40px);white-space:normal;text-align:center;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
    if (_cmdToastTimer) clearTimeout(_cmdToastTimer);
    _cmdToastTimer = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
    }, 4000);
  }

  // =====================================================
  // ✅ 멘션 파싱 (줄바꿈 + @멘션)
  // =====================================================
  function parseMentions(text) {
    const escaped = escapeHtml(text);
    const withBr  = escaped.replace(/\n/g, "<br>");
    return withBr.replace(/@([^\s@<>]+)/g, (_, nick) =>
      `<span class="mention-tag">@${nick}</span>`
    );
  }

  function msgContainsMyMention(text) {
    if (!myNick || !text) return false;
    const pattern = new RegExp(
      `@${myNick.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s,!?.]|$)`, "i"
    );
    return pattern.test(text);
  }

  // =====================================================
  // ✅ 멘션 토스트
  // =====================================================
  let _toastTimer = null;

  function showMentionToast(fromUser, fromEmoji) {
    const toast = document.getElementById("mention-toast");
    const txt   = document.getElementById("mention-toast-text");
    if (!toast || !txt) return;
    txt.textContent = `${fromEmoji || "✍️"} ${fromUser || "누군가"}님이 나를 멘션했어요!`;
    toast.classList.add("show");
    toast.onclick = () => { toast.classList.remove("show"); scrollChatToBottom(true); };
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toast.classList.remove("show"), 4000);
    // DND이거나 멘션 알림음 꺼진 경우 소리 없음
    if (!_dndEnabled && _mentionSoundEnabled) {
      window.playPomodoroSound?.("work_start");
    }
  }

  // =====================================================
  // ✅ 날짜 구분선
  // =====================================================
  function _maybeRenderDateDivider(box, ts) {
    const msgYmd = ymd(ts);
    if (lastRendered.ymd === msgYmd) return;
    const d = new Date(Number.isFinite(Number(ts)) ? Number(ts) : Date.now());
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    box.insertAdjacentHTML("beforeend", `
      <div class="date-divider">
        <span class="date-divider-line"></span>
        <span class="date-divider-label">${label}</span>
        <span class="date-divider-line"></span>
      </div>
    `);
    lastRendered.ymd = msgYmd;
  }

  // =====================================================
  // ✅ renderChatMessage
  // =====================================================
  function renderChatMessage(box, data, key) {
    if (!box || !data) return;

    // system (줄바꿈 지원)
    if (data.type === "system") {
      _maybeRenderDateDivider(box, data.time || Date.now());
      const safeMsg = escapeHtml(data.msg).replace(/\n/g, "<br>");
      box.insertAdjacentHTML("beforeend",
        `<div class="system" style="text-align:left;line-height:1.7;max-width:92%;">${safeMsg}</div>`);
      lastRendered = { ...lastRendered, user: null, ts: Number(data.time || Date.now()), msg: String(data.msg || "") };
      return;
    }

    if (data.type === "fx") {
      const def = SLASH_COMMANDS[data.cmd];
      if (def) {
        runEffect(def.emojis, def.colors, def.count);

        const sysText = data.sysMsg || def.systemMsg(data.user || "", data.extraText || "");

        if (data.cmd === "/외치기" && data.extraText) {
          showShoutOverlay(data.user || "", data.extraText);

          // ✅ 외치기 내용을 채팅에 카드로 남김
          _maybeRenderDateDivider(box, data.time || Date.now());
          box.insertAdjacentHTML("beforeend", `
            <div class="declaration-msg" style="border-color:rgba(255,69,58,.20);background:rgba(255,69,58,.06);">
              <span class="declaration-icon">📣</span>
              <div class="declaration-body">
                <div class="declaration-nick">${escapeHtml(data.user || "")}</div>
                <div class="declaration-text">${escapeHtml(data.extraText)}</div>
              </div>
            </div>
          `);
        } else {
          // ✅ [NEW] 그 외 일반 명령어(예: /고추, /축하 등)도 토스트만 뜨고 사라지는 게 아니라
          // 채팅방에 시스템 메시지 형태로 계속 기록이 남도록 함
          _maybeRenderDateDivider(box, data.time || Date.now());
          const safeSys = escapeHtml(sysText).replace(/\n/g, "<br>");
          box.insertAdjacentHTML("beforeend",
            `<div class="system" style="text-align:left;line-height:1.7;max-width:92%;">${safeSys}</div>`);
        }

        if (!_dndEnabled) {
          showCommandToast(sysText);
        }
      }
      lastRendered = { ...lastRendered, user: null, ts: Number(data.time || Date.now()), msg: "" };
      return;
    }

    // 운세 메시지
    if (data.type === "fortune") {
      _maybeRenderDateDivider(box, data.time || Date.now());
      box.insertAdjacentHTML("beforeend", `
        <div class="declaration-msg" style="border-color:rgba(155,89,182,.22);background:rgba(155,89,182,.06);">
          <span class="declaration-icon">🔮</span>
          <div class="declaration-body">
            <div class="declaration-nick">${escapeHtml(data.user || "")}</div>
            <div class="declaration-text">${escapeHtml(data.msg || "")}</div>
          </div>
        </div>
      `);
      lastRendered = { ...lastRendered, user: null, ts: Number(data.time || Date.now()), msg: "" };
      return;
    }

    // 선언 메시지
    if (data.type === "declaration") {
      _maybeRenderDateDivider(box, data.time || Date.now());
      box.insertAdjacentHTML("beforeend", `
        <div class="declaration-msg">
          <span class="declaration-icon">🎯</span>
          <div class="declaration-body">
            <div class="declaration-nick">${escapeHtml(data.user || "")}</div>
            <div class="declaration-text">${escapeHtml(data.text || "")}</div>
          </div>
        </div>
      `);
      lastRendered = { ...lastRendered, user: null, ts: Number(data.time || Date.now()), msg: "" };
      return;
    }

    const isMe    = data.user === myNick;
    const time    = Number(data.time || Date.now());
    const grouped = (lastRendered.user === data.user)
                 && (time - (lastRendered.ts || 0) < 120000)
                 && (lastRendered.ymd === ymd(time));
    const rawMsg  = String(data.msg || "");

    _maybeRenderDateDivider(box, time);

    // 단독 이모지 → 크게
    const isBigEmoji = _isSingleEmoji(rawMsg);
    const msgHtml    = isBigEmoji ? escapeHtml(rawMsg) : parseMentions(rawMsg);
    const mentionedMe = !isMe && msgContainsMyMention(rawMsg);

    let bubbleClass = "msg-bubble";
    let bubbleStyle = "";
    if (isBigEmoji) {
      bubbleClass = "msg-bubble msg-bubble-emoji";
      bubbleStyle = `font-size:40px;line-height:1.1;padding:2px 6px;
                     background:transparent!important;box-shadow:none!important;border:none!important;`;
    } else if (mentionedMe) {
      bubbleClass = "msg-bubble mention-me";
    }

    // ✅ 답장(카카오톡 스타일) 인용 블록
    const replyHtml = data.replyTo ? `
      <div class="reply-quote" data-target-key="${escapeHtml(String(data.replyTo.key || ""))}" title="원문으로 이동">
        <div class="reply-quote-label">↪ ${escapeHtml(data.replyTo.user || "")} 님에게 답글</div>
        <div class="reply-quote-text">${escapeHtml(data.replyTo.msg || "")}</div>
      </div>
    ` : "";

    const html = `
      <div class="chat-item ${isMe ? "me" : "other"} ${grouped ? "grouped" : ""}"
           data-key="${escapeHtml(String(key || ""))}"
           data-user="${escapeHtml(String(data.user || ""))}"
           data-raw-msg="${escapeHtml(rawMsg)}">
        ${isMe ? "" : `<div class="profile-emoji">${escapeHtml(data.emoji || "✍️")}</div>`}
        <div class="msg-content">
          ${isMe || grouped ? "" : `<div class="user-name">${escapeHtml(data.user)}</div>`}
          ${replyHtml}
          <div class="bubble-row ${isMe ? "me" : ""}">
            <div class="${bubbleClass}" style="${bubbleStyle}">${msgHtml}</div>
            <div class="msg-time">${formatHHMM(time)}</div>
          </div>
        </div>
      </div>`;

    box.insertAdjacentHTML("beforeend", html);
    lastRendered = { user: data.user, ts: time, ymd: ymd(time), msg: rawMsg };

    if (mentionedMe) showMentionToast(data.user, data.emoji);
  }

  // =====================================================
  // ✅ 답장(reply) 기능
  //   - 타인의 메시지 말풍선을 3번 연속 클릭 → 답장 모드 시작
  //   - 답장 중인 메시지는 입력창 위에 발췌 미리보기로 표시
  //   - 답장 메시지의 인용 발췌를 클릭하면 원문으로 스크롤 + 하이라이트
  // =====================================================
  let _replyTarget = null; // { key, user, msg }
  const _replyClickTracker = new WeakMap(); // bubble el -> { count, timer }

  function _cancelReply() {
    _replyTarget = null;
    _renderReplyPreview();
  }

  function _startReply(key) {
    if (!key) return;
    const box = document.getElementById("chat-box");
    const item = box?.querySelector(`.chat-item[data-key="${CSS.escape(key)}"]`);
    if (!item) return; // ✅ 본인 메시지도 답장 가능(자기 메시지를 가리키고 싶을 때 대비)

    const user = item.dataset.user || "";
    const rawMsg = item.dataset.rawMsg || "";
    if (!user) return;

    _replyTarget = { key, user, msg: rawMsg };
    _renderReplyPreview();
    document.getElementById("message")?.focus();
  }

  function _renderReplyPreview() {
    const bar = document.getElementById("reply-preview-bar");
    if (!bar) return;

    if (!_replyTarget) {
      bar.classList.add("hidden");
      return;
    }

    const excerpt = _replyTarget.msg.length > 60
      ? _replyTarget.msg.slice(0, 60) + "…"
      : _replyTarget.msg;

    const labelEl = document.getElementById("reply-preview-label");
    const excerptEl = document.getElementById("reply-preview-excerpt");
    if (labelEl) labelEl.textContent = `${_replyTarget.user} 님에게 답글`;
    if (excerptEl) excerptEl.textContent = excerpt;

    bar.classList.remove("hidden");
  }

  function _scrollToOriginalMessage(targetKey) {
    if (!targetKey) return;
    const box = document.getElementById("chat-box");
    const targetEl = box?.querySelector(`.chat-item[data-key="${CSS.escape(targetKey)}"]`);
    if (!targetEl) {
      showCommandToast("원본 메시지를 찾을 수 없어요 (화면에서 지워졌을 수 있어요) 😢");
      return;
    }
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    targetEl.classList.remove("flash-highlight");
    // 리플로우를 강제해 애니메이션을 재시작
    void targetEl.offsetWidth;
    targetEl.classList.add("flash-highlight");
    setTimeout(() => targetEl.classList.remove("flash-highlight"), 1300);
  }

  function bindReplyInteractions() {
    const box = document.getElementById("chat-box");
    if (!box || box.dataset.replyBound === "true") return;
    box.dataset.replyBound = "true";

    box.addEventListener("click", (e) => {
      // 1) 인용 발췌 클릭 → 원문으로 스크롤
      const quote = e.target.closest(".reply-quote");
      if (quote) {
        _scrollToOriginalMessage(quote.dataset.targetKey);
        return;
      }

      // 2) 메시지 말풍선 3연속 클릭 → 답장 모드 (본인 메시지도 가능)
      const bubble = e.target.closest(".msg-bubble");
      if (!bubble) return;
      const item = bubble.closest(".chat-item");
      if (!item) return;

      const rec = _replyClickTracker.get(bubble) || { count: 0, timer: null };
      rec.count += 1;
      clearTimeout(rec.timer);
      rec.timer = setTimeout(() => _replyClickTracker.delete(bubble), 500);
      _replyClickTracker.set(bubble, rec);

      if (rec.count >= 3) {
        _replyClickTracker.delete(bubble);
        _startReply(item.dataset.key);
      }
    });

    document.getElementById("reply-preview-close")?.addEventListener("click", _cancelReply);
  }

  window.bindReplyInteractions = bindReplyInteractions;
  window.cancelReply = _cancelReply;

  // =====================================================
  // ✅ @멘션 자동완성 드롭다운
  // =====================================================
  let _mentionActive = false;
  let _mentionQuery  = "";
  let _mentionSelIdx = 0;
  let _mentionStart  = -1;

  function _getOnlineUsers() {
    const cache = window._statusCache;
    if (!cache || typeof cache !== "object") return [];
    const now = Date.now();
    return Object.entries(cache)
      .filter(([nick, row]) => row && typeof row === "object" &&
              nick !== myNick && (now - (row.lastSeen || 0)) < 90000)
      .map(([nick, row]) => ({ nick, emoji: row.emoji || "✍️" }));
  }

  function _openMentionDropdown(users, query) {
    const dd = document.getElementById("mention-dropdown");
    if (!dd) return;
    const filtered = users.filter(u =>
      !query || u.nick.toLowerCase().includes(query.toLowerCase())
    );
    if (!filtered.length) { _closeMentionDropdown(); return; }
    _mentionSelIdx = 0;
    dd.innerHTML = filtered.map((u, i) => `
      <div class="mention-item ${i === 0 ? "active" : ""}"
           data-nick="${escapeHtml(u.nick)}" data-emoji="${escapeHtml(u.emoji)}" role="option">
        <span class="m-emoji">${u.emoji}</span>
        <span class="m-nick">@${escapeHtml(u.nick)}</span>
      </div>`).join("");
    dd.querySelectorAll(".mention-item").forEach(el =>
      el.addEventListener("mousedown", e => { e.preventDefault(); _insertMention(el.dataset.nick); })
    );
    dd.classList.add("open");
    _mentionActive = true;
  }

  function _closeMentionDropdown() {
    document.getElementById("mention-dropdown")?.classList.remove("open");
    _mentionActive = false; _mentionQuery = ""; _mentionStart = -1; _mentionSelIdx = 0;
  }

  function _moveMentionSel(dir) {
    const dd    = document.getElementById("mention-dropdown");
    const items = dd?.querySelectorAll(".mention-item");
    if (!items?.length) return;
    items[_mentionSelIdx]?.classList.remove("active");
    _mentionSelIdx = (_mentionSelIdx + dir + items.length) % items.length;
    items[_mentionSelIdx]?.classList.add("active");
    items[_mentionSelIdx]?.scrollIntoView({ block: "nearest" });
  }

  function _insertMention(nick) {
    const el = document.getElementById("message");
    if (!el || _mentionStart < 0) return;
    const before = el.value.slice(0, _mentionStart);
    const after  = el.value.slice(_mentionStart + 1 + _mentionQuery.length);
    el.value = `${before}@${nick} ${after}`;
    const pos = before.length + nick.length + 2;
    el.setSelectionRange(pos, pos);
    _closeMentionDropdown();
    el.focus();
  }

  // =====================================================
  // ✅ 슬래시 드롭다운
  // =====================================================
  let _slashActive = false;
  let _slashQuery  = "";
  let _slashSelIdx = 0;

  const _allSlashSuggestions = () =>
    Object.entries(SLASH_COMMANDS).map(([cmd, def]) => ({
      cmd, emoji: def.emojis[0], label: def.label
    }));

  function _openSlashDropdown(query) {
    const dd = document.getElementById("mention-dropdown");
    if (!dd) return;
    const filtered = _allSlashSuggestions().filter(({ cmd }) =>
      !query || cmd.includes(query)
    );
    if (!filtered.length) { _closeSlashDropdown(); return; }
    _slashSelIdx = 0;
    dd.innerHTML = filtered.map(({ cmd, emoji, label }, i) => `
      <div class="mention-item ${i === 0 ? "active" : ""}"
           data-cmd="${escapeHtml(cmd)}" role="option">
        <span class="m-emoji">${emoji}</span>
        <span class="m-nick">${escapeHtml(cmd)}
          <span style="opacity:.6;font-weight:700;font-size:12px;">${escapeHtml(label)}</span>
        </span>
      </div>`).join("");
    dd.querySelectorAll(".mention-item").forEach(el =>
      el.addEventListener("mousedown", e => { e.preventDefault(); _insertSlash(el.dataset.cmd); })
    );
    dd.classList.add("open");
    _slashActive = true;
  }

  function _closeSlashDropdown() {
    if (!_slashActive) return;
    document.getElementById("mention-dropdown")?.classList.remove("open");
    _slashActive = false; _slashQuery = ""; _slashSelIdx = 0;
  }

  function _moveSlashSel(dir) {
    const dd    = document.getElementById("mention-dropdown");
    const items = dd?.querySelectorAll(".mention-item");
    if (!items?.length) return;
    items[_slashSelIdx]?.classList.remove("active");
    _slashSelIdx = (_slashSelIdx + dir + items.length) % items.length;
    items[_slashSelIdx]?.classList.add("active");
    items[_slashSelIdx]?.scrollIntoView({ block: "nearest" });
  }

  function _insertSlash(cmd) {
    const el = document.getElementById("message");
    if (!el) return;
    const def = SLASH_COMMANDS[cmd];
    // hasText인 명령어는 커서를 명령어 뒤로 (텍스트 입력 유도)
    el.value = def?.hasText ? cmd + " " : cmd;
    el.setSelectionRange(el.value.length, el.value.length);
    _closeSlashDropdown();
    el.focus();
  }

  // =====================================================
  // ✅ send
  // =====================================================
  async function checkAndTrimChat() {
    const chatRef   = db.ref("messages");
    const snapshot  = await chatRef.once("value");
    if (snapshot.numChildren() > 200) {
      const oldItems    = chatRef.orderByKey().limitToFirst(snapshot.numChildren() - 200);
      const oldSnapshot = await oldItems.once("value");
      const updates = {};
      oldSnapshot.forEach(child => updates[child.key] = null);
      await chatRef.update(updates);
    }
  }

  async function send() {
    const el = document.getElementById("message");
    if (!el || !myNick) return;
    const m = el.value.trim();
    if (!m) return;

    _closeMentionDropdown();
    _closeSlashDropdown();

    const slashResult = _detectSlashCommand(m);

    if (slashResult?.def) {
      // 슬래시 명령어는 답장 대상으로 삼지 않음(전송 시 답장 모드 취소)
      _cancelReply();

      const { cmd, def, extraText } = slashResult;

      // hasText 명령어인데 텍스트가 없으면 안내
      if (def.hasText && !extraText) {
        showCommandToast(`${cmd} 뒤에 내용을 입력해줘요! 예: ${cmd} 오늘 15화 끝낸다!`);
        return;
      }

      const sysMsg = def.systemMsg(myNick, extraText);

      // /선언: declaration 타입으로 저장
      if (cmd === "/선언") {
        runEffect(def.emojis, def.colors, def.count);
        if (!_dndEnabled) showCommandToast(sysMsg);
        try {
          await db.ref("messages").push({
            type: "declaration",
            user: myNick, emoji: myEmoji,
            text: extraText, time: Date.now()
          });
        } catch(e) { console.error("선언 전송 실패", e); }
        el.value = ""; el.style.height = "42px";
        return;
      }

      // /운세
      if (def.isFortune) {
        const fortuneMsg = _buildFortuneMsg(myNick);
        runEffect(def.emojis, def.colors, def.count);
        try {
          await db.ref("messages").push({
            type: "fortune",
            user: myNick,
            emoji: myEmoji,
            msg: fortuneMsg,
            time: Date.now()
          });
        } catch(e) { console.error("운세 전송 실패", e); }
        el.value = ""; el.style.height = "42px";
        return;
      }

      // /외치기
      if (cmd === "/외치기") {
        showShoutOverlay(myNick, extraText);
        runEffect(def.emojis, def.colors, def.count);
        if (!_dndEnabled) showCommandToast(sysMsg);
        try {
          await db.ref("messages").push({
            type: "fx", cmd, sysMsg, extraText,
            user: myNick, emoji: myEmoji, time: Date.now()
          });
        } catch(e) { console.error("외치기 전송 실패", e); }
        el.value = ""; el.style.height = "42px";
        // ✅ 카드가 채팅에 추가됐으므로 스크롤
        scrollChatToBottom(true);
        return;
      }

      // 일반 이펙트 명령어
      runEffect(def.emojis, def.colors, def.count);
      if (!_dndEnabled) showCommandToast(sysMsg);
      try {
        await db.ref("messages").push({
          type: "fx", cmd, sysMsg,
          user: myNick, emoji: myEmoji, time: Date.now()
        });
      } catch(e) { console.error("fx 전송 실패", e); }
      el.value = ""; el.style.height = "42px";
      return;
    }

    // 일반 메시지
    try {
      const payload = { user: myNick, emoji: myEmoji, msg: m, time: Date.now() };

      // ✅ 답장 중이었다면 원문 정보(짧은 발췌)를 함께 저장
      if (_replyTarget) {
        const excerpt = _replyTarget.msg.length > 60
          ? _replyTarget.msg.slice(0, 60) + "…"
          : _replyTarget.msg;
        payload.replyTo = { key: _replyTarget.key, user: _replyTarget.user, msg: excerpt };
      }

      await db.ref("messages").push(payload);
      el.value = ""; el.style.height = "42px";
      _cancelReply();
      scrollChatToBottom(true);
      checkAndTrimChat();
    } catch(e) {
      console.error("전송 실패", e);
    }
  }

  // =====================================================
  // ✅ bindSendHandlers
  // =====================================================
  function bindSendHandlers() {
    const el = document.getElementById("message");
    if (!el) { setTimeout(bindSendHandlers, 200); return; }

    // 기존 리스너 리셋
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);

    // auto-grow
    newEl.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 110) + "px";

      const val    = this.value;
      const caret  = this.selectionStart;
      const before = val.slice(0, caret);

      // 슬래시 드롭다운
      if (val.startsWith("/") && !val.includes(" ") && !val.includes("\n")) {
        _slashQuery = val.slice(1);
        _openSlashDropdown(_slashQuery);
        return;
      } else {
        _closeSlashDropdown();
      }

      // 멘션 드롭다운
      const mm = before.match(/@([^\s@]*)$/);
      if (mm) {
        _mentionStart = before.lastIndexOf("@");
        _mentionQuery = mm[1];
        _openMentionDropdown(_getOnlineUsers(), _mentionQuery);
      } else {
        _closeMentionDropdown();
      }
    });

    // IME 조합 상태
    let composing = false;
    newEl.addEventListener("compositionstart", () => composing = true);
    newEl.addEventListener("compositionend",   () => composing = false);

    // keydown: 드롭다운 키 조작 + Enter 전송 + Shift+Enter 줄바꿈
    newEl.addEventListener("keydown", function (e) {
      // 슬래시 드롭다운 키 조작
      if (_slashActive) {
        if (e.key === "ArrowDown") { e.preventDefault(); _moveSlashSel(1);  return; }
        if (e.key === "ArrowUp")   { e.preventDefault(); _moveSlashSel(-1); return; }
        if (e.key === "Escape")    { e.preventDefault(); _closeSlashDropdown(); return; }
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !composing) {
          e.preventDefault();
          const sel = document.getElementById("mention-dropdown")
            ?.querySelectorAll(".mention-item")?.[_slashSelIdx];
          if (sel) { _insertSlash(sel.dataset.cmd); return; }
        }
      }

      // 멘션 드롭다운 키 조작
      if (_mentionActive) {
        if (e.key === "ArrowDown") { e.preventDefault(); _moveMentionSel(1);  return; }
        if (e.key === "ArrowUp")   { e.preventDefault(); _moveMentionSel(-1); return; }
        if (e.key === "Escape")    { e.preventDefault(); _closeMentionDropdown(); return; }
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !composing) {
          e.preventDefault();
          const sel = document.getElementById("mention-dropdown")
            ?.querySelectorAll(".mention-item")?.[_mentionSelIdx];
          if (sel) { _insertMention(sel.dataset.nick); return; }
        }
      }

      // Shift+Enter → 줄바꿈 (기본 동작 허용)
      if (e.key === "Enter" && e.shiftKey) return;

      // Enter → 전송 (IME 조합 중 제외)
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !composing) {
        e.preventDefault();
        send();
      }
    });

    // beforeinput fallback (iOS/모바일 Safari)
    newEl.addEventListener("beforeinput", function (e) {
      if (e.inputType === "insertParagraph") {
        if (e.isComposing || composing) return;
        if (_slashActive || _mentionActive) return;
        e.preventDefault();
        send();
      }
    });

    // blur 시 드롭다운 닫기
    newEl.addEventListener("blur", () => {
      setTimeout(() => { _closeMentionDropdown(); _closeSlashDropdown(); }, 150);
    });

    // 핀 메시지 리스너 시작
    listenPinnedMessage();

    // ✅ 답장(3연속 클릭) 인터랙션 바인딩
    bindReplyInteractions();

    console.log("✅ 채팅 입력 이벤트 바인딩 완료 (멘션+슬래시+줄바꿈+DND+외치기+선언+답장)");
  }

  // =====================================================
  // exports
  // =====================================================
  window.send                = send;
  window.scrollChatToBottom  = scrollChatToBottom;
  window.bindChatScrollGuard = bindChatScrollGuard;
  window.bindSendHandlers    = bindSendHandlers;
  window.renderChatMessage   = renderChatMessage;
  window.runEffect           = runEffect;
  window.isDndEnabled        = isDndEnabled;
  window.toggleDnd           = toggleDnd;
  window.showShoutOverlay    = showShoutOverlay;
