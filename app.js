// BlackjackGuide - 完全版
const STATE_KEY = 'bjState';
const HISTORY_KEY = 'bjHistory';
const THEME_KEY = 'bjTheme';

// ユーティリティ関数
const $ = (id) => document.getElementById(id);
const formatCurrency = (amount) => Math.floor(amount).toLocaleString() + '円';
const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
};

// セッションチャートクラス
class SessionChart {
    constructor() {
        this.operations = [];
        this.canvas = null;
        this.ctx = null;
        this.initChart();
    }

    initChart() {
        const chartContainer = $('chartContainer');
        if (!chartContainer) return;
        
        this.canvas = $('sessionChart');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width - 40;
        this.canvas.height = window.innerWidth < 768 ? 150 : 200;
        this.redraw();
    }

    addOperation(type, balance, betAmount = 0, initialCapital = 0) {
        this.operations.push({
            index: this.operations.length,
            type: type,
            balance: balance,
            betAmount: betAmount,
            initialCapital: initialCapital,
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
        
        // 利益/損失帯を描画
        this.drawProfitLossZones(width, height, minBalance, range);
        
        // グリッドを描画
        this.drawGrid(width, height, minBalance, range);
        
        // 線とポイントを描画
        this.drawLine(width, height, balances, minBalance, range);
        this.drawPoints(width, height, balances, minBalance, range);
        this.drawLegend();
    }

    drawProfitLossZones(width, height, minBalance, range) {
        if (this.operations.length === 0) return;
        
        const initialCapital = this.operations[0].initialCapital;
        if (initialCapital <= 0) return;
        
        const initialY = height - ((initialCapital - minBalance) / range) * height;
        
        this.ctx.save();
        
        // 利益帯（緑）
        this.ctx.fillStyle = 'rgba(76, 175, 80, 0.08)';
        this.ctx.fillRect(0, 0, width, Math.max(0, initialY));
        
        // 損失帯（赤）
        this.ctx.fillStyle = 'rgba(244, 67, 54, 0.08)';
        this.ctx.fillRect(0, initialY, width, height - initialY);
        
        // 初期資金ライン
        this.ctx.strokeStyle = 'rgba(96, 125, 139, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, initialY);
        this.ctx.lineTo(width, initialY);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        this.ctx.restore();
    }

    drawGrid(width, height, minBalance, range) {
        const style = getComputedStyle(document.documentElement);
        this.ctx.strokeStyle = style.getPropertyValue('--border').trim();
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
            this.ctx.fillStyle = style.getPropertyValue('--text-muted').trim();
            this.ctx.font = '10px system-ui';
            this.ctx.fillText(formatCurrency(value), 5, y - 5);
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

        const style = getComputedStyle(document.documentElement);
        this.ctx.strokeStyle = style.getPropertyValue('--primary').trim();
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
        const style = getComputedStyle(document.documentElement);
        const colors = {
            win: style.getPropertyValue('--success').trim(),
            lose: style.getPropertyValue('--danger').trim(),
            push: style.getPropertyValue('--warning').trim(),
            start: style.getPropertyValue('--primary').trim()
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
        const style = getComputedStyle(document.documentElement);
        const legends = [
            { color: style.getPropertyValue('--success').trim(), text: '勝利' },
            { color: style.getPropertyValue('--danger').trim(), text: '敗北' },
            { color: style.getPropertyValue('--warning').trim(), text: 'プッシュ' }
        ];

        this.ctx.font = '11px system-ui';
        legends.forEach((legend, index) => {
            const x = 20 + (index * 60);
            const y = this.canvas.height - 15;

            this.ctx.fillStyle = legend.color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
            this.ctx.fill();

            this.ctx.fillStyle = style.getPropertyValue('--text').trim();
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
        const container = $('chartContainer');
        if (container) {
            container.style.display = 'block';
        }
    }

    hide() {
        const container = $('chartContainer');
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
        this.lastSnapshot = null; // Undo用
        
        this.init();
    }

    init() {
        this.setupTheme();
        this.bindEvents();
        this.loadState();
        this.renderHistory();
        this.setupAutoSave();
        this.setupTouchGestures();
        this.makeTimerDraggable();
        this.registerServiceWorker();
        console.log('✅ BlackjackGuide 完全版 起動完了');
    }

    setupTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        this.setTheme(theme);

        const themeToggle = $('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.body.getAttribute('data-theme') || 'light';
                const themeOrder = ['light', 'dark', 'hc'];
                const currentIndex = themeOrder.indexOf(currentTheme);
                const newTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
                this.setTheme(newTheme);
            });
        }
    }

    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);

        const themeToggle = $('themeToggle');
        if (themeToggle) {
            const icon = $('themeIcon');
            const text = $('themeText');
            if (icon && text) {
                const themeConfig = {
                    light: { icon: '🌙', text: 'DARK' },
                    dark: { icon: '👁️', text: 'HC' },
                    hc: { icon: '☀️', text: 'LIGHT' }
                };
                const config = themeConfig[theme] || themeConfig.light;
                icon.textContent = config.icon;
                text.textContent = config.text;
            }
        }
    }

    setupTouchGestures() {
        let startX = 0;
        let startY = 0;
        
        document.addEventListener('touchstart', (e) => {
            if (!this.sessionActive) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        document.addEventListener('touchend', (e) => {
            if (!this.sessionActive) return;
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const deltaX = endX - startX;
            const deltaY = endY - startY;

            // 縦スワイプは無視
            if (Math.abs(deltaY) > Math.abs(deltaX)) return;
            
            // 最小スワイプ距離
            if (Math.abs(deltaX) < 80) return;

            if (deltaX > 0) {
                this.handleGameResult('win');
            } else {
                this.handleGameResult('lose');
            }
        });
    }

    makeTimerDraggable() {
        const timer = $('floatingTimer');
        if (!timer) return;

        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        timer.addEventListener('pointerdown', (e) => {
            isDragging = true;
            timer.classList.add('dragging');
            const rect = timer.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            timer.setPointerCapture(e.pointerId);
        });

        timer.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            
            // 境界チェック
            const maxX = window.innerWidth - timer.offsetWidth;
            const maxY = window.innerHeight - timer.offsetHeight;
            
            timer.style.left = Math.max(0, Math.min(maxX, x)) + 'px';
            timer.style.top = Math.max(0, Math.min(maxY, y)) + 'px';
            timer.style.right = 'auto';
            timer.style.bottom = 'auto';
        });

        timer.addEventListener('pointerup', (e) => {
            isDragging = false;
            timer.classList.remove('dragging');
            timer.releasePointerCapture(e.pointerId);
        });
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(
                'data:application/javascript;base64,' + btoa(`
                    const CACHE_NAME = 'blackjack-guide-v1';
                    const URLS_TO_CACHE = ['/', '/index.html', '/style.css', '/app.js'];
                    
                    self.addEventListener('install', event => {
                        event.waitUntil(
                            caches.open(CACHE_NAME)
                                .then(cache => cache.addAll(URLS_TO_CACHE))
                        );
                    });
                    
                    self.addEventListener('fetch', event => {
                        event.respondWith(
                            caches.match(event.request)
                                .then(response => {
                                    if (response) return response;
                                    return fetch(event.request);
                                })
                        );
                    });
                `)
            ).catch(() => {
                // Service Worker registration failed - not critical
            });
        }
    }

    bindEvents() {
        // メイン操作
        $('initialCapital')?.addEventListener('input', () => this.updateCapital());
        $('startSession')?.addEventListener('click', () => this.startSession());
        $('endSession')?.addEventListener('click', () => this.endSession());
        $('winButton')?.addEventListener('click', () => this.handleGameResult('win'));
        $('pushButton')?.addEventListener('click', () => this.handleGameResult('push'));
        $('loseButton')?.addEventListener('click', () => this.handleGameResult('lose'));

        // タイマー
        $('timerPauseBtn')?.addEventListener('click', () => {
            this.timerRunning ? this.pauseTimer() : this.resumeTimer();
        });
        $('timerResetBtn')?.addEventListener('click', () => this.resetTimer());

        // 設定
        $('autoAdjustToggle')?.addEventListener('change', (e) => {
            this.autoBetAdjust = e.target.checked;
            this.updateDisplay();
        });

        // ツール
        $('exportCsvBtn')?.addEventListener('click', () => this.exportCsv());
        $('importCsvBtn')?.addEventListener('click', () => $('csvFilePicker').click());
        $('csvFilePicker')?.addEventListener('change', (e) => this.importCsv(e));
        $('shareLinkBtn')?.addEventListener('click', () => this.copyShareUrl());
        $('clearHistoryBtn')?.addEventListener('click', () => this.clearHistory());

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

        // Enter キーでの誤送信防止
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.matches('input[type=number]')) {
                e.preventDefault();
            }
        });
    }

    updateCapital() {
        const val = Math.max(0, Math.floor(+$('initialCapital').value || 0));
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
        const el = $('balanceSection');
        if (el) el.style.display = show ? 'block' : 'none';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'snackbar';
        notification.innerHTML = `<span>${message}</span>`;
        
        if (type === 'warn') {
            notification.style.background = 'var(--warning)';
            notification.style.color = 'white';
        }
        
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showUndoSnack() {
        if (!this.lastSnapshot) return;
        
        const snackbar = document.createElement('div');
        snackbar.className = 'snackbar';
        snackbar.innerHTML = `
            <span>操作を取り消しますか？</span>
            <button onclick="window.blackjack.undoLast(); this.parentElement.remove();">
                取り消す
            </button>
        `;
        
        document.body.appendChild(snackbar);
        setTimeout(() => snackbar.remove(), 3000);
    }

    undoLast() {
        if (!this.lastSnapshot) return;
        
        this.currentBalance = this.lastSnapshot.balance;
        this.winStreak = this.lastSnapshot.winStreak;
        this.lossStreak = this.lastSnapshot.lossStreak;
        this.sessionChart.operations = [...this.lastSnapshot.operations];
        this.sessionChart.redraw();
        this.updateDisplay();
    }

    calcBetRate() {
        if (!this.autoBetAdjust) return this.betRate;
        
        let rate = 0.02;
        
        // 連勝時は少し上げる
        if (this.winStreak > 0) {
            rate += Math.min(this.winStreak * 0.001, 0.01);
        }
        
        // 連敗時は少し下げる
        if (this.lossStreak > 0) {
            rate -= Math.min(this.lossStreak * 0.002, 0.01);
        }
        
        // 利益率による調整
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
        
        $('currentBalance').textContent = formatCurrency(this.currentBalance);
        $('betAmount').textContent = formatCurrency(this.betAmount);
        $('betRate').textContent = `${(this.betRate * 100).toFixed(1)}%`;
        
        if (this.initialCapital > 0) {
            $('winTarget').textContent = formatCurrency(this.initialCapital * 1.25);
            $('lossTarget').textContent = formatCurrency(this.initialCapital * 0.75);
        }
        
        $('winStreak').textContent = `${this.winStreak}勝 / ${this.lossStreak}敗`;
        
        // ゲームボタンの状態更新
        const gameButtons = ['winButton', 'pushButton', 'loseButton'];
        const canPlay = this.currentBalance > 0 && this.sessionActive;
        gameButtons.forEach(id => {
            const btn = $(id);
            if (btn) btn.disabled = !canPlay;
        });
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
        
        $('startSession').style.display = 'none';
        $('endSession').style.display = 'block';
        $('gameButtons').style.display = 'grid';
        
        this.sessionChart.clear();
        this.sessionChart.show();
        this.sessionChart.addOperation('start', this.currentBalance, 0, this.initialCapital);
        
        this.resetTimer();
        this.resumeTimer();
        this.updateDisplay();
        this.showNotification('セッション開始！', 'info');
        console.log('セッション開始');
    }

    endSession() {
        if (!this.sessionActive) return;
        
        this.sessionActive = false;
        $('startSession').style.display = 'block';
        $('endSession').style.display = 'none';
        $('gameButtons').style.display = 'none';
        
        this.pauseTimer(true);
        this.sessionChart.hide();
        
        const profit = this.currentBalance - this.initialCapital;
        const rate = this.initialCapital ? (profit / this.initialCapital * 100).toFixed(1) : '0.0';
        
        this.showNotification(
            `セッション終了 損益: ${profit >= 0 ? '+' : ''}${formatCurrency(profit)} (${rate}%)`,
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
        
        // Undo用のスナップショット保存
        this.lastSnapshot = {
            balance: this.currentBalance,
            winStreak: this.winStreak,
            lossStreak: this.lossStreak,
            operations: [...this.sessionChart.operations]
        };
        
        // ★ 報酬ロジック（変更禁止）★
        switch (result) {
            case 'win':
                this.currentBalance += this.betAmount * 2;
                this.winStreak++;
                this.lossStreak = 0;
                this.showNotification(`勝利! +${formatCurrency(this.betAmount * 2)}`, 'info');
                break;
            case 'lose':
                this.currentBalance -= this.betAmount;
                this.lossStreak++;
                this.winStreak = 0;
                this.showNotification(`敗北 -${formatCurrency(this.betAmount)}`, 'warn');
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
        this.sessionChart.addOperation(result, this.currentBalance, this.betAmount, this.initialCapital);
        this.updateDisplay();
        
        // 音声フィードバック
        this.speakResult(result);
        
        // Undo スナックバー表示
        this.showUndoSnack();
        
        // 資金チェック
        if (this.currentBalance <= 0) {
            this.showNotification('資金がなくなりました。', 'warn');
            this.endSession();
            return;
        }
        
        // 目標達成チェック
        if (this.sessionActive) {
            if (this.currentBalance >= this.initialCapital * 1.25) {
                this.showNotification('🎉 利確目標達成！', 'info');
            } else if (this.currentBalance <= this.initialCapital * 0.75) {
                this.showNotification('⚠️ 損切り目標到達', 'warn');
            }
        }
    }

    speakResult(result) {
        if (!('speechSynthesis' in window)) return;
        
        const messages = {
            win: '勝利',
            lose: '敗北',
            push: 'プッシュ'
        };
        
        const message = messages[result];
        if (message) {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.volume = 0.3;
            utterance.rate = 1.2;
            speechSynthesis.speak(utterance);
        }
    }

    // タイマー機能
    resumeTimer() {
        if (this.timerRunning) return;
        
        this.timerStartEpoch = Date.now();
        this.timerRunning = true;
        $('floatingTimer').style.display = 'flex';
        $('timerPauseBtn').textContent = '⏸';
        
        this.tickTimer();
        this.timerIntervalId = setInterval(() => this.tickTimer(), 1000);
    }

    pauseTimer(hide = false) {
        if (!this.timerRunning) return;
        
        clearInterval(this.timerIntervalId);
        this.timerIntervalId = null;
        this.timerOffsetMs += Date.now() - this.timerStartEpoch;
        this.timerRunning = false;
        $('timerPauseBtn').textContent = '▶';
        
        if (hide) $('floatingTimer').style.display = 'none';
    }

    resetTimer() {
        this.timerOffsetMs = 0;
        this.tickTimer(0);
    }

    tickTimer(forceMs) {
        const ms = forceMs !== undefined ? forceMs : 
                   (Date.now() - this.timerStartEpoch) + this.timerOffsetMs;
        $('timerValue').textContent = formatTime(ms);
    }

    // 履歴機能
    saveHistory(record) {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        history.push(record);
        if (history.length > 100) history.shift();
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    renderHistory() {
        const tbody = $('historyTable')?.querySelector('tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').reverse();
        
        history.forEach(record => {
            const tr = document.createElement('tr');
            const profitStr = record.profit >= 0 ? 
                `+${formatCurrency(record.profit)}` : formatCurrency(record.profit);
            
            const startTime = new Date(record.startAt).toLocaleString('ja-JP', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            tr.innerHTML = `
                <td>${startTime}</td>
                <td style="color: ${record.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${profitStr}</td>
                <td>${formatTime(record.playSec * 1000)}</td>
                <td>${record.maxWin}勝</td>
                <td>${record.maxLose}敗</td>
            `;
            
            tbody.appendChild(tr);
        });
    }

    clearHistory() {
        if (confirm('履歴をすべて削除しますか？')) {
            localStorage.removeItem(HISTORY_KEY);
            this.renderHistory();
            this.showNotification('履歴を削除しました', 'info');
        }
    }

    // CSV エクスポート
    exportCsv() {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        if (history.length === 0) {
            this.showNotification('エクスポートする履歴がありません', 'warn');
            return;
        }
        
        const headers = ['開始時刻', '終了時刻', '初期資金', '最終残高', '損益', 'プレイ時間', '最大連勝', '最大連敗'];
        const csvContent = [
            headers.join(','),
            ...history.map(record => [
                record.startAt,
                record.endAt,
                record.initCap,
                record.finalBal,
                record.profit,
                record.playSec,
                record.maxWin,
                record.maxLose
            ].join(','))
        ].join('\n');
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `blackjack-history-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        this.showNotification('CSV をダウンロードしました', 'info');
    }

    // CSV インポート
    importCsv(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const lines = e.target.result.split('\n').slice(1); // ヘッダーをスキップ
                const importedHistory = lines.filter(line => line.trim()).map(line => {
                    const [startAt, endAt, initCap, finalBal, profit, playSec, maxWin, maxLose] = line.split(',');
                    return {
                        startAt,
                        endAt,
                        initCap: Number(initCap),
                        finalBal: Number(finalBal),
                        profit: Number(profit),
                        playSec: Number(playSec),
                        maxWin: Number(maxWin),
                        maxLose: Number(maxLose)
                    };
                });
                
                const existingHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
                const combinedHistory = [...existingHistory, ...importedHistory];
                
                localStorage.setItem(HISTORY_KEY, JSON.stringify(combinedHistory));
                this.renderHistory();
                this.showNotification(`${importedHistory.length}件の履歴をインポートしました`, 'info');
            } catch (error) {
                this.showNotification('CSV ファイルの読み込みに失敗しました', 'warn');
            }
        };
        
        reader.readAsText(file);
        event.target.value = ''; // リセット
    }

    // URL 共有
    copyShareUrl() {
        const params = new URLSearchParams({
            capital: this.initialCapital,
            auto: this.autoBetAdjust,
            theme: document.body.getAttribute('data-theme')
        });
        
        const shareUrl = `${location.origin}${location.pathname}?${params}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                this.showNotification('設定付きURLをコピーしました', 'info');
            });
        } else {
            // フォールバック
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('設定付きURLをコピーしました', 'info');
        }
    }

    // 状態の保存・読み込み
    saveState() {
        const state = {
            initialCapital: this.initialCapital,
            currentBalance: this.currentBalance,
            betRate: this.betRate,
            winStreak: this.winStreak,
            lossStreak: this.lossStreak,
            autoBetAdjust: this.autoBetAdjust,
            sessionActive: this.sessionActive,
            sessionStart: this.sessionStart?.toISOString(),
            timerOffsetMs: this.timerOffsetMs
        };
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }

    loadState() {
        // URL パラメータから設定を読み込み
        const urlParams = new URLSearchParams(location.search);
        if (urlParams.has('capital')) {
            $('initialCapital').value = urlParams.get('capital');
            this.updateCapital();
        }
        if (urlParams.has('auto')) {
            const autoAdjust = urlParams.get('auto') === 'true';
            $('autoAdjustToggle').checked = autoAdjust;
            this.autoBetAdjust = autoAdjust;
        }
        if (urlParams.has('theme')) {
            this.setTheme(urlParams.get('theme'));
        }
        
        // 保存された状態を読み込み
        const saved = localStorage.getItem(STATE_KEY);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.initialCapital = state.initialCapital || 0;
                this.currentBalance = state.currentBalance || 0;
                this.betRate = state.betRate || 0.02;
                this.winStreak = state.winStreak || 0;
                this.lossStreak = state.lossStreak || 0;
                this.autoBetAdjust = state.autoBetAdjust !== false;
                this.timerOffsetMs = state.timerOffsetMs || 0;
                
                if (this.initialCapital > 0) {
                    $('initialCapital').value = this.initialCapital;
                    this.showBalanceDisplay(true);
                }
                
                $('autoAdjustToggle').checked = this.autoBetAdjust;
                this.updateDisplay();
            } catch (e) {
                console.warn('状態の読み込みに失敗:', e);
            }
        }
    }

    setupAutoSave() {
        // 定期的に状態を保存
        setInterval(() => {
            if (this.sessionActive) {
                this.saveState();
            }
        }, 5000);
        
        // ページ離脱時に保存
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
    }
}

// グローバルインスタンス
window.blackjack = new BlackjackGuide();
