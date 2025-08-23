// BlackjackGuide - シンプル版
const STATE_KEY = 'bjState';
const HISTORY_KEY = 'bjHistory';
const THEME_KEY = 'bjTheme';

class BlackjackGuide {
    constructor() {
        this.initialCapital = 0;
        this.currentBalance = 0;
        this.betRate = 0.02;
        this.betAmount = 0;
        this.winStreak = 0;
        this.lossStreak = 0;
        this.sessionActive = false;
        this.sessionStart = null;
        this.autoBetAdjust = true;
        this.timerIntervalId = null;
        this.timerStartEpoch = null;
        this.timerOffsetMs = 0;
        this.timerRunning = false;
        this.breakAlerted = false;
        this.init();
    }

    init() {
        this.setupTheme();
        this.bindEvents();
        this.loadState();
        this.renderHistory();
        this.setupAutoSave();
        console.log('✅ BlackjackGuide 起動完了');
    }

    setupTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        this.setTheme(theme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                this.setTheme(newTheme);
            });
        }
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = document.getElementById('themeIcon');
            const text = document.getElementById('themeText');
            if (icon && text) {
                icon.textContent = theme === 'light' ? '🌙' : '☀️';
                text.textContent = theme === 'light' ? 'Dark' : 'Light';
            }
        }
    }

    bindEvents() {
        document.getElementById('initialCapital')?.addEventListener('input', () => this.updateCapital());
        document.getElementById('startSession')?.addEventListener('click', () => this.startSession());
        document.getElementById('endSession')?.addEventListener('click', () => this.endSession());
        document.getElementById('winButton')?.addEventListener('click', () => this.handleGameResult('win'));
        document.getElementById('pushButton')?.addEventListener('click', () => this.handleGameResult('push'));
        document.getElementById('loseButton')?.addEventListener('click', () => this.handleGameResult('lose'));
        document.getElementById('timerPauseBtn')?.addEventListener('click', () => {
            this.timerRunning ? this.pauseTimer() : this.resumeTimer();
        });
        document.getElementById('timerResetBtn')?.addEventListener('click', () => this.resetTimer());
        document.getElementById('autoAdjustToggle')?.addEventListener('change', (e) => {
            this.autoBetAdjust = e.target.checked;
            this.updateDisplay();
        });
    }

    updateCapital() {
        const val = Math.max(0, Math.floor(+document.getElementById('initialCapital').value || 0));
        this.initialCapital = val;
        this.currentBalance = val;
        this.betRate = 0.02;
        this.showBalanceDisplay(val > 0);
        this.updateDisplay();
    }
    
    showBalanceDisplay(show) {
        const el = document.getElementById('balanceDisplay');
        if (el) el.style.display = show ? 'flex' : 'none';
    }

    calcBetRate() {
        if (!this.autoBetAdjust) return this.betRate;
        let rate = 0.02;
        if (this.winStreak > 0) rate += Math.min(this.winStreak * 0.001, 0.01);
        if (this.lossStreak > 0) rate -= Math.min(this.lossStreak * 0.002, 0.01);
        if (this.initialCapital > 0) {
            const profitRate = (this.currentBalance - this.initialCapital) / this.initialCapital;
            if (profitRate >= 0.20) rate += 0.0025;
            if (profitRate <= -0.20) rate -= 0.0025;
        }
        return Math.min(0.03, Math.max(0.01, rate));
    }

    updateBetAmount() {
        this.betRate = this.calcBetRate();
        this.betAmount = Math.floor(this.currentBalance * this.betRate);
    }
    
    updateDisplay() {
        this.updateBetAmount();
        document.getElementById('currentBalance').textContent = `${Math.floor(this.currentBalance).toLocaleString()}円`;
        document.getElementById('betAmount').textContent = `${this.betAmount.toLocaleString()}円`;
        document.getElementById('betRate').textContent = `${(this.betRate * 100).toFixed(1)}%`;
        if (this.initialCapital > 0) {
            document.getElementById('winTarget').textContent = `${Math.floor(this.initialCapital * 1.25).toLocaleString()}円`;
            document.getElementById('lossTarget').textContent = `${Math.floor(this.initialCapital * 0.75).toLocaleString()}円`;
        }
        document.getElementById('winStreak').textContent = `${this.winStreak}勝 / ${this.lossStreak}敗`;
    }

    startSession() {
        if (this.initialCapital <= 0) { alert('元金を入力してください'); return; }
        this.sessionActive = true;
        this.sessionStart = new Date();
        this.winStreak = this.lossStreak = 0;
        this.breakAlerted = false;
        document.getElementById('startSession').style.display = 'none';
        document.getElementById('endSession').style.display = 'block';
        document.getElementById('gameButtons').style.display = 'grid';
        this.resetTimer();
        this.resumeTimer();
        this.updateDisplay();
        console.log('セッション開始');
    }

    endSession() {
        if (!this.sessionActive) return;
        this.sessionActive = false;
        document.getElementById('startSession').style.display = 'block';
        document.getElementById('endSession').style.display = 'none';
        document.getElementById('gameButtons').style.display = 'none';
        this.pauseTimer(true);
        
        const profit = this.currentBalance - this.initialCapital;
        const rate = this.initialCapital ? (profit / this.initialCapital * 100).toFixed(1) : '0.0';
        alert(`セッション終了\n損益: ${profit >= 0 ? '+' : ''}${Math.floor(profit).toLocaleString()}円 (${rate}%)`);
        
        this.saveHistory({
            startAt: this.sessionStart?.toISOString() || '',
            endAt: new Date().toISOString(),
            initCap: this.initialCapital,
            finalBal: this.currentBalance,
            profit: profit,
            playSec: Math.floor(this.timerOffsetMs / 1000),
            maxWin: this.winStreak,
            maxLose: this.lossStreak,
        });
        this.renderHistory();
    }

    handleGameResult(result) {
        if (!this.sessionActive) { alert('セッション未開始です'); return; }
        switch (result) {
            case 'win':
                this.currentBalance += this.betAmount; // Win = bet amount
                this.winStreak++; this.lossStreak = 0;
                break;
            case 'lose':
                this.currentBalance -= this.betAmount;
                this.lossStreak++; this.winStreak = 0;
                if (this.lossStreak >= 5 && !this.breakAlerted) {
                    this.breakAlerted = true;
                    alert('5連敗です。休憩を推奨します。');
                }
                break;
            case 'push':
                break;
        }

        if (this.currentBalance < 0) this.currentBalance = 0;
        this.updateDisplay();

        if (this.currentBalance <= 0) {
            alert('資金がなくなりました。');
            this.endSession();
            return;
        }

        if (this.sessionActive) {
            if (this.currentBalance >= this.initialCapital * 1.25) {
                alert('🎉 利確目標達成！');
            } else if (this.currentBalance <= this.initialCapital * 0.75) {
                alert('⚠️ 損切り目標到達');
            }
        }
    }

    // Timer
    resumeTimer() {
        if (this.timerRunning) return;
        this.timerStartEpoch = Date.now();
        this.timerRunning = true;
        document.getElementById('floatingTimer').style.display = 'flex';
        document.getElementById('timerPauseBtn').textContent = '⏸︎';
        this.tickTimer();
        this.timerIntervalId = setInterval(() => this.tickTimer(), 1000);
    }
    pauseTimer(hide = false) {
        if (!this.timerRunning) return;
        clearInterval(this.timerIntervalId);
        this.timerIntervalId = null;
        this.timerOffsetMs += Date.now() - this.timerStartEpoch;
        this.timerRunning = false;
        document.getElementById('timerPauseBtn').textContent = '▶︎';
        if (hide) document.getElementById('floatingTimer').style.display = 'none';
    }
    resetTimer() {
        this.timerOffsetMs = 0; this.tickTimer(0);
    }
    tickTimer(forceMs) {
        const ms = forceMs !== undefined ? forceMs : (Date.now() - this.timerStartEpoch) + this.timerOffsetMs;
        document.getElementById('timerValue').textContent = this.formatHMS(ms);
    }
    formatHMS(ms) {
        const s = Math.floor(ms / 1000);
        const h = String(Math.floor(s / 3600)).padStart(2, '0');
        const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const sec = String(s % 60).padStart(2, '0');
        return `${h}:${m}:${sec}`;
    }

    // History
    saveHistory(record) {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        history.push(record);
        if (history.length > 100) history.shift();
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    renderHistory() {
        const tbody = document.getElementById('historyTable')?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').reverse();
        history.forEach(r => {
            const tr = document.createElement('tr');
            const profitStr = r.profit >= 0 ? `+${r.profit.toLocaleString()}` : r.profit.toLocaleString();
            tr.innerHTML = `
                <td>${new Date(r.startAt).toLocaleString('sv-SE').slice(5, 16)}</td>
                <td style="color: ${r.profit >= 0 ? 'var(--good)' : 'var(--bad)'}; font-weight: bold;">${profitStr}円</td>
                <td>${this.formatHMS(r.playSec * 1000)}</td>
                <td>${r.maxWin}</td>
                <td>${r.maxLose}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // State Persistence
    saveState() {
        const state = {
            initialCapital: this.initialCapital,
            currentBalance: this.currentBalance,
            sessionActive: this.sessionActive,
            sessionStart: this.sessionStart,
            winStreak: this.winStreak,
            lossStreak: this.lossStreak,
            autoBetAdjust: this.autoBetAdjust
        };
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }
    loadState() {
        const state = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
        if (Object.keys(state).length > 0) {
            Object.assign(this, state);
            document.getElementById('initialCapital').value = this.initialCapital;
            document.getElementById('autoAdjustToggle').checked = this.autoBetAdjust;

            if (this.sessionActive) {
                this.startSession();
            } else {
                this.showBalanceDisplay(this.initialCapital > 0);
                this.updateDisplay();
            }
        }
    }
    setupAutoSave() {
        setInterval(() => {
            if (this.sessionActive) this.saveState();
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BlackjackGuide();
});
