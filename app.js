// BlackjackGuide (Save / Restore / PauseTimer / History / AutoBetRate)

const STATE_KEY   = 'bjState';
const HISTORY_KEY = 'bjHistory';

class BlackjackGuide {
  constructor() {
    /* -------- 状態 -------- */
    this.initialCapital = 0;
    this.currentBalance = 0;
    this.betRate   = 0.02;   // 現在適用中の割合
    this.betAmount = 0;

    this.winStreak  = 0;
    this.lossStreak = 0;

    this.sessionActive = false;
    this.sessionStart  = null; // Date obj

    /* -------- オプション -------- */
    this.autoBetAdjust = true;

    /* -------- タイマー -------- */
    this.timerIntervalId = null;
    this.timerStartEpoch = null;
    this.timerOffsetMs   = 0;   // pause 分を累積
    this.timerRunning    = false;

    /* アラート制御 */
    this.breakAlerted = false;

    /* -------- 初期化 -------- */
    this.initializeApp();
    this.bindEvents();
    this.loadState();          // ← 保存状態を復元
    this.saveTicker();         // ← 定期保存
  }

  /* ---------- 初期化系 ---------- */
  initializeApp() {
    this.initializeTabs();
    this.decorateStrategyTable();
  }

  initializeTabs() {
    const buttons  = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const id = btn.getAttribute('data-tab');
        const target = document.getElementById(id);
        if (target) target.classList.add('active');
        if (id === 'history') this.renderHistory();
      });
    });
  }

  bindEvents() {
    const ic = document.getElementById('initialCapital');
    ic?.addEventListener('input', () => this.updateCapital());

    document.getElementById('startSession')
      ?.addEventListener('click', () => this.startSession());
    document.getElementById('endSession')
      ?.addEventListener('click', () => this.endSession());

    document.getElementById('winButton')
      ?.addEventListener('click', () => this.handleGameResult('win'));
    document.getElementById('pushButton')
      ?.addEventListener('click', () => this.handleGameResult('push'));
    document.getElementById('loseButton')
      ?.addEventListener('click', () => this.handleGameResult('lose'));

    /* Timer buttons */
    document.getElementById('timerPauseBtn')
      ?.addEventListener('click', () => {
        this.timerRunning ? this.pauseTimer() : this.resumeTimer();
      });
    document.getElementById('timerResetBtn')
      ?.addEventListener('click', () => this.resetTimer());

    /* Auto-adjust toggle */
    document.getElementById('autoAdjustToggle')
      ?.addEventListener('change', (e) => {
        this.autoBetAdjust = e.target.checked;
        this.updateDisplay();
      });
  }

  decorateStrategyTable() {
    const tbl = document.getElementById('strategyTable');
    if (!tbl) return;
    tbl.querySelectorAll('tbody tr').forEach(tr => {
      if (tr.classList.contains('group')) return;
      tr.querySelectorAll('td').forEach(td => {
        const t = td.textContent.trim().toUpperCase();
        td.classList.toggle('h', t === 'H');
        td.classList.toggle('s', t === 'S');
      });
    });
  }

  /* ---------- 資金関連 ---------- */
  updateCapital() {
    const val = Math.max(0, Math.floor(+document.getElementById('initialCapital').value || 0));
    this.initialCapital  = val;
    this.currentBalance  = val;
    this.betRate         = 0.02;
    this.showBalanceDisplay(val > 0);
    this.updateDisplay();
  }

  showBalanceDisplay(show) {
    const el = document.getElementById('balanceDisplay');
    if (el) el.style.display = show ? 'block' : 'none';
  }

  calcBetRate() {
    if (!this.autoBetAdjust) return this.betRate; // 固定

    let rate = 0.02;

    /* 連勝／連敗ベース */
    if (this.winStreak > 0)
      rate += Math.min(this.winStreak * 0.001, 0.01); // +1% 上限
    if (this.lossStreak > 0)
      rate -= Math.min(this.lossStreak * 0.002, 0.01); // -1% 下限

    /* 利益率ベース */
    if (this.initialCapital > 0) {
      const r = (this.currentBalance - this.initialCapital) / this.initialCapital;
      if (r >= 0.20) rate += 0.0025;
      if (r <= -0.20) rate -= 0.0025;
    }

    rate = Math.min(0.03, Math.max(0.01, rate));             // 1–3%
    rate = (this.betRate + rate) / 2;                        // 平滑化(50%)
    return rate;
  }

  updateBetAmount() {
    this.betRate   = this.calcBetRate();
    this.betAmount = Math.floor(this.currentBalance * this.betRate);
  }

  updateDisplay() {
    /* 残高・BET */
    document.getElementById('currentBalance').textContent =
      `${Math.floor(this.currentBalance).toLocaleString()}円`;

    this.updateBetAmount();
    document.getElementById('betAmount').textContent =
      `${this.betAmount.toLocaleString()}円`;
    document.getElementById('betRate').textContent =
      `${(this.betRate * 100).toFixed(1)}%`;

    /* 目標 */
    if (this.initialCapital > 0) {
      document.getElementById('winTarget').textContent =
        `${Math.floor(this.initialCapital * 1.25).toLocaleString()}円`;
      document.getElementById('lossTarget').textContent =
        `${Math.floor(this.initialCapital * 0.75).toLocaleString()}円`;
    }

    /* ストリーク */
    document.getElementById('winStreak').textContent  = this.winStreak;
    document.getElementById('lossStreak').textContent = this.lossStreak;
  }

  /* ---------- セッション ---------- */
  startSession() {
    if (this.initialCapital <= 0) { this.alert('元金を入力してください','warning'); return; }
    this.sessionActive = true;
    this.sessionStart  = new Date();
    this.winStreak = this.lossStreak = 0;
    this.breakAlerted = false;

    document.getElementById('startSession').style.display = 'none';
    document.getElementById('endSession').style.display   = 'block';
    document.getElementById('gameButtons').style.display  = 'grid';
    document.getElementById('counters').style.display     = 'grid';

    this.resetTimer();
    this.resumeTimer();

    this.updateDisplay();
    this.alert('セッションを開始しました','success');
  }

  endSession() {
    if (!this.sessionActive) return;
    this.sessionActive = false;

    document.getElementById('startSession').style.display = 'block';
    document.getElementById('endSession').style.display   = 'none';
    document.getElementById('gameButtons').style.display  = 'none';
    document.getElementById('counters').style.display     = 'none';

    this.pauseTimer(true);

    const profit = this.currentBalance - this.initialCapital;
    const rate   = this.initialCapital
                 ? (profit / this.initialCapital * 100).toFixed(1)
                 : '0.0';
    this.alert(`セッション終了：${profit>=0?'+':''}${Math.floor(profit).toLocaleString()}円 (${rate}%)`,
               profit >=0 ? 'success':'error');

    this.saveHistory({
      startAt : this.sessionStart?.toISOString() || '',
      endAt   : new Date().toISOString(),
      initCap : this.initialCapital,
      finalBal: this.currentBalance,
      profit  : profit,
      playSec : Math.floor(this.timerOffsetMs / 1000),
      maxWin  : this.winStreak,
      maxLose : this.lossStreak
    });

    this.renderHistory();          // 更新

    /* 状態クリア (残高そのまま残す) */
    this.timerOffsetMs = 0;
    this.timerRunning  = false;
  }

  handleGameResult(result) {
    if (!this.sessionActive) { this.alert('セッション未開始','warning'); return; }

    switch (result) {
      case 'win':
        this.currentBalance += this.betAmount * 2;
        this.winStreak++; this.lossStreak = 0;
        this.alert(`勝利 +${(this.betAmount*2).toLocaleString()}円`,'success');
        break;
      case 'lose':
        this.currentBalance -= this.betAmount;
        this.lossStreak++; this.winStreak = 0;
        this.alert(`敗北 -${this.betAmount.toLocaleString()}円`,'error');
        if (this.lossStreak>=5 && !this.breakAlerted) {
          this.breakAlerted = true;
          this.alert('5連敗！休憩を推奨','warning');
        }
        break;
      case 'push':
        this.alert('引き分け ±0円','info');
        this.winStreak = this.lossStreak = 0;
        break;
    }

    if (this.currentBalance < 0) this.currentBalance = 0;
    this.updateDisplay();

    /* ベット0円は強制終了 */
    if (this.betAmount <= 0) {
      this.alert('資金が尽きました','error'); this.endSession();
    }

    /* 利確／損切チェック */
    if (this.sessionActive) {
      if (this.currentBalance >= this.initialCapital * 1.25)
        this.alert('🎉 利確目標達成！','success');
      if (this.currentBalance <= this.initialCapital * 0.75)
        this.alert('⚠️ 損切り目標到達！','error');
    }
  }

  /* ---------- タイマー ---------- */
  resumeTimer() {
    if (this.timerRunning) return;
    this.timerStartEpoch = Date.now();
    this.timerRunning    = true;
    document.getElementById('floatingTimer').style.display = 'block';
    document.getElementById('timerPauseBtn').textContent   = '⏸︎';

    this.tickTimer(); // すぐ1回更新
    this.timerIntervalId = setInterval(() => this.tickTimer(), 1000);
  }

  pauseTimer(hide=false) {
    if (!this.timerRunning) return;
    clearInterval(this.timerIntervalId);
    this.timerIntervalId = null;
    this.timerOffsetMs  += Date.now() - this.timerStartEpoch;
    this.timerRunning    = false;
    document.getElementById('timerPauseBtn').textContent = '▶︎';
    if (hide) document.getElementById('floatingTimer').style.display = 'none';
  }

  resetTimer() {
    this.timerOffsetMs = 0;
    this.tickTimer(0);
  }

  tickTimer(forceMs) {
    const ms = forceMs !== undefined
      ? forceMs
      : (Date.now() - this.timerStartEpoch) + this.timerOffsetMs;
    document.getElementById('timerValue').textContent = this.formatHMS(ms);
  }

  formatHMS(ms) {
    const s = Math.floor(ms/1000);
    const h = String(Math.floor(s/3600)).padStart(2,'0');
    const m = String(Math.floor((s%3600)/60)).padStart(2,'0');
    const sec = String(s%60).padStart(2,'0');
    return `${h}:${m}:${sec}`;
  }

  /* ---------- 履歴 ---------- */
  saveHistory(rec) {
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
    arr.push(rec);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
  }

  renderHistory() {
    const tbody = document.getElementById('historyTable').querySelector('tbody');
    tbody.innerHTML = '';
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]').slice(-100).reverse();
    arr.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.startAt?.slice(0,16).replace('T',' ')}</td>
        <td>${r.endAt?.slice(0,16).replace('T',' ')}</td>
        <td>${r.initCap?.toLocaleString()}</td>
        <td>${r.finalBal?.toLocaleString()}</td>
        <td>${r.profit>=0?'+':''}${r.profit?.toLocaleString()}</td>
        <td>${this.formatHMS(r.playSec*1000)}</td>
        <td>${r.maxWin}</td>
        <td>${r.maxLose}</td>`;
      tbody.appendChild(tr);
    });
  }

  /* ---------- 保存 / 復元 ---------- */
  saveState() {
    const state = {
      initialCapital : this.initialCapital,
      currentBalance : this.currentBalance,
      betRate        : this.betRate,
      winStreak      : this.winStreak,
      lossStreak     : this.lossStreak,
      sessionActive  : this.sessionActive,
      sessionStart   : this.sessionStart?.toISOString() || null,
      timerOffsetMs  : this.timerOffsetMs + (this.timerRunning ? Date.now() - this.timerStartEpoch : 0),
      timerRunning   : this.timerRunning,
      autoBetAdjust  : this.autoBetAdjust
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  loadState() {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      Object.assign(this, {
        initialCapital : s.initialCapital,
        currentBalance : s.currentBalance,
        betRate        : s.betRate ?? 0.02,
        winStreak      : s.winStreak,
        lossStreak     : s.lossStreak,
        sessionActive  : s.sessionActive,
        autoBetAdjust  : s.autoBetAdjust ?? true
      });
      this.timerOffsetMs = s.timerOffsetMs ?? 0;

      /* UI調整 */
      document.getElementById('initialCapital').value = this.initialCapital;
      document.getElementById('autoAdjustToggle').checked = this.autoBetAdjust;
      this.showBalanceDisplay(this.initialCapital>0);
      this.updateDisplay();

      if (this.sessionActive) {
        this.sessionStart = s.sessionStart ? new Date(s.sessionStart) : new Date();
        this.resumeTimer();
      }
    } catch(e){ console.warn('state load err',e); }
  }

  saveTicker() { setInterval(() => this.saveState(), 5000); }

  /* ---------- ユーティリティ ---------- */
  alert(msg,type='info') {
    const old = document.querySelector('.alert');
    old?.remove();
    const el = document.createElement('div');
    el.className = `alert alert--${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), type==='error'?7000:5000);
  }
}

/* 起動 */
document.addEventListener('DOMContentLoaded', () => {
  window.blackjackGuide = new BlackjackGuide();
});
window.addEventListener('beforeunload', (e)=>{
  if (window.blackjackGuide?.sessionActive) {
    e.preventDefault(); e.returnValue='セッション中です。離脱しますか？';
  }
});
