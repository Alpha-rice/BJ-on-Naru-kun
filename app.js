// BlackjackGuide - 完全版
const STATE_KEY = 'bjState';
const HISTORY_KEY = 'bjHistory';
const THEME_KEY = 'bjTheme';

// セッションチャートクラス
class SessionChart {
    constructor() {
        this.operations = [];
        this.canvas = null;
        this.ctx = null;
        this.initChart();
    }

    initChart() {
        const chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) return;
        
        this.canvas = document.getElementById('sessionChart');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        this.canvas.width = container.offsetWidth - 20;
        this.canvas.height = window.innerWidth < 768 ? 150 : 200;
        this.redraw();
    }

    addOperation(type, balance, betAmount = 0) {
        this.operations.push({
            index: this.operations.length,
            type: type,
            balance: balance,
            betAmount: betAmount,
            timestamp: new Date()
        });
        this.redraw();
    }

    redraw() {
        if (!this.ctx || this.operations.length === 0) return;

        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);

        const balances = this.operations.map(op => op.balance);
        const maxBalance = Math.max(...balances);
        const minBalance = Math.min(...balances);
        const range = Math.max(maxBalance - minBalance, 1000);

        this.drawGrid(width, height, minBalance, range);
        this.drawLine(width, height, balances, minBalance, range);
        this.drawPoints(width, height, balances, minBalance, range);
        this.drawLegend();
    }

    drawGrid(width, height, minBalance, range) {
        this.ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
        this.ctx.lineWidth = 1;

        // 水平グリッド
        for (let i = 0; i <= 4; i++) {
            const y = (height * i) / 4;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();

            // Y軸ラベル
            const value = minBalance + (range * (4 - i)) / 4;
            this.ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--txt-2').trim();
            this.ctx.font = '10px system-ui';
            this.ctx.fillText(`${Math.round(value).toLocaleString()}`, 5, y - 5);
        }

        // 垂直グリッド
        const operations = this.operations.length;
        const maxLines = Math.min(operations, 8);
        for (let i = 0; i <= maxLines; i++) {
            const x = (width * i) / maxLines;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
    }

    drawLine(width, height, balances, minBalance, range) {
        if (balances.length < 2) return;

        this.ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        balances.forEach((balance, index) => {
            const x = (width * index) / (balances.length - 1);
            const y = height - ((balance - minBalance) / range) * height;
            
            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });

        this.ctx.stroke();
    }

    drawPoints(width, height, balances, minBalance, range) {
        const colors = {
            win: getComputedStyle(document.documentElement).getPropertyValue('--good').trim(),
            lose: getComputedStyle(document.documentElement).getPropertyValue('--bad').trim(),
            push: getComputedStyle(document.documentElement).getPropertyValue('--warn').trim(),
            start: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
        };

        balances.forEach((balance, index) => {
            const x = (width * index) / (balances.length - 1);
            const y = height - ((balance - minBalance) / range) * height;
            const operation = this.operations[index];

            this.ctx.fillStyle = colors[operation.type] || colors.start;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
            this.ctx.fill();
        });
    }

    drawLegend() {
        const legends = [
            { color: getComputedStyle(document.documentElement).getPropertyValue('--good').trim(), text: '勝利' },
            { color: getComputedStyle(document.documentElement).getPropertyValue('--bad').trim(), text: '敗北' },
            { color: getComputedStyle(document.documentElement).getPropertyValue('--warn').trim(), text: 'プッシュ' }
        ];

        this.ctx.font = '11px system-ui';
        legends.forEach((legend, index) => {
            const x = 20 + (index * 60);
            const y = this.canvas.height - 15;

            this.ctx.fillStyle = legend.color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
            this.ctx.fill();

            this.ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--txt').trim();
            this.ctx.fillText(legend.text, x + 12, y + 3);
        });
    }

    clear() {
        this.operations = [];
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    show() {
        const container = document.getElementById('chartContainer');
        if (container) {
            container.style.display = 'block';
        }
    }

    hide() {
        const container = document.getElementById('chartContainer');
        if (container) {
            container.style.display = 'none';
        }
    }
}

// メインクラス
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
        this.sessionChart = new SessionChart();
        this.init();
    }

    init() {
        this.setupTheme();
        this.bindEvents();
        this.loadState();
        this.renderHistory();
        this.setupAutoSave();
        this.setupMouseEffects();
        console.log('✅ BlackjackGuide 完全版 起動完了');
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

    setupMouseEffects() {
        // CSS変数にマウス位置を設定
        document.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth) * 100;
            const y = (e.clientY / window.innerHeight) * 100;
            
            document.documentElement.style.setProperty('--mouse-x', `${x}%`);
            document.documentElement.style.setProperty('--mouse-y', `${y}%`);
        });

        // カーソル追従エフェクト（PC のみ）
        if (window.innerWidth > 768) {
            const follower = document.createElement('div');
            follower.className = 'cursor-follower';
            document.body.appendChild(follower);

            let mouseX = 0, mouseY = 0;
            let followerX = 0, followerY = 0;

            document.addEventListener('mousemove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
            });

            const updateFollower = () => {
                followerX += (mouseX - followerX) * 0.1;
                followerY += (mouseY - followerY) * 0.1;
                
                follower.style.transform = `translate(${followerX}px, ${followerY}px)`;
                requestAnimationFrame(updateFollower);
            };
            updateFollower();
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

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (!this.sessionActive) return;
            
            switch(e.key) {
                case '1': 
                    e.preventDefault();
                    this.handleGameResult('win'); 
                    break;
                case '2': 
                    e.preventDefault();
                    this.handleGameResult('push'); 
                    break;
                case '3': 
                    e.preventDefault();
                    this.handleGameResult('lose'); 
                    break;
                case ' ': 
                    e.preventDefault();
                    this.timerRunning ? this.pauseTimer() : this.resumeTimer(); 
                    break;
            }
        });
    }

    updateCapital() {
        const val = Math.max(0, Math.floor(+document.getElementById('initialCapital').value || 0));
        
        if (val > 0 && val < 100) {
            this.showNotification('最低100円以上を入力してください', 'warn');
            return;
        }
        
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

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            background: var(--${type === 'warn' ? 'warn' : 'accent'});
            color: white;
            border-radius: var(--r);
            box-shadow: var(--sh-m);
            z-index: 10000;
            font-size: 0.9rem;
            font-weight: 500;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
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
        if (this.initialCapital <= 0) { 
            this.showNotification('元金を入力してください', 'warn');
            return; 
        }
        
        this.sessionActive = true;
        this.sessionStart = new Date();
        this.winStreak = this.lossStreak = 0;
        this.breakAlerted = false;
        
        document.getElementById('startSession').style.display = 'none';
        document.getElementById('endSession').style.display = 'block';
        document.getElementById('gameButtons').style.display = 'grid';
        
        this.sessionChart.clear();
        this.sessionChart.show();
        this.sessionChart.addOperation('start', this.currentBalance);
        
        this.resetTimer();
        this.resumeTimer();
        this.updateDisplay();
        
        this.showNotification('セッション開始！', 'info');
        console.log('セッション開始');
    }

    endSession() {
        if (!this.sessionActive) return;
        
        this.sessionActive = false;
        document.getElementById('startSession').style.display = 'block';
        document.getElementById('endSession').style.display = 'none';
        document.getElementById('gameButtons').style.display = 'none';
        
        this.pauseTimer(true);
        this.sessionChart.hide();
        
        const profit = this.currentBalance - this.initialCapital;
        const rate = this.initialCapital ? (profit / this.initialCapital * 100).toFixed(1) : '0.0';
        
        this.showNotification(
            `セッション終了 損益: ${profit >= 0 ? '+' : ''}${Math.floor(profit).toLocaleString()}円 (${rate}%)`,
            profit >= 0 ? 'info' : 'warn'
        );
        
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
        if (!this.sessionActive) { 
            this.showNotification('セッション未開始です', 'warn');
            return; 
        }
        
        switch (result) {
            case 'win':
                this.currentBalance += this.betAmount * 2;
                this.winStreak++; 
                this.lossStreak = 0;
                this.showNotification(`勝利! +${this.betAmount.toLocaleString() * 2}円`, 'info');
                break;
            case 'lose':
                this.currentBalance -= this.betAmount;
                this.lossStreak++; 
                this.winStreak = 0;
                this.showNotification(`敗北 -${this.betAmount.toLocaleString()}円`, 'warn');
                if (this.lossStreak >= 5 && !this.breakAlerted) {
                    this.breakAlerted = true;
                    this.showNotification('5連敗です。休憩を推奨します。', 'warn');
                }
                break;
            case 'push':
                this.showNotification('プッシュ（引き分け）', 'info');
                this.winStreak = this.lossStreak = 0;
                break;
        }

        if (this.currentBalance < 0) this.currentBalance = 0;
        
        // チャートに追加
        this.sessionChart.addOperation(result, this.currentBalance, this.betAmount);
        
        this.updateDisplay();

        if (this.currentBalance <= 0) {
            this.showNotification('資金がなくなりました。', 'warn');
            this.endSession();
            return;
        }

        if (this.sessionActive) {
            if (this.currentBalance >= this.initialCapital * 1.25) {
                this.showNotification('🎉 利確目標達成！', 'info');
            } else if (this.currentBalance <= this.initialCapital * 0.75) {
                this.showNotification('⚠️ 損切り目標到達', 'warn');
            }
        }
    }

    // タイマー機能
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
        this.timerOffsetMs = 0; 
        this.tickTimer(0);
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

    // 履歴機能
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

    // 状態保存・読込
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
                // セッション復元時はチャートを表示
                this.sessionChart.show();
                this.sessionChart.addOperation('start', this.currentBalance);
                document.getElementById('startSession').style.display = 'none';
                document.getElementById('endSession').style.display = 'block';
                document.getElementById('gameButtons').style.display = 'grid';
            } else {
                this.showBalanceDisplay(this.initialCapital > 0);
            }
            this.updateDisplay();
        }
    }

    setupAutoSave() {
        setInterval(() => {
            if (this.sessionActive) this.saveState();
        }, 5000);
    }
}

// 起動
document.addEventListener('DOMContentLoaded', () => {
    new BlackjackGuide();
});
