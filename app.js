// BlackjackGuide - 表生成修正版
const STATE_KEY = 'bjState';
const HISTORY_KEY = 'bjHistory';
const THEME_KEY = 'bjTheme';

// 基本戦略データ（2次元配列）
// 基本戦略データ（2025-08-20 最終版）
const STRATEGY_DATA = {
    // ディーラーアップカード
    dealerCards: ['2','3','4','5','6','7','8','9','10','A'],

    // ハードハンド
    hardHands: {
        /* 17 以上は常に Stand */
        '17+':  ['S','S','S','S','S','S','S','S','S','S'],

        /* 16-13 は 2-6 Stand ／ 7-A Hit（K＝10 に統合）*/
        '16':   ['S','S','S','S','S','H','H','H','H','H'],
        '15':   ['S','S','S','S','S','H','H','H','H','H'],
        '14':   ['S','S','S','S','S','H','H','H','H','H'],
        '13':   ['S','S','S','S','S','H','H','H','H','H'],

        /* 12 は 4-6 Stand ／ それ以外 Hit */
        '12':   ['H','H','S','S','S','H','H','H','H','H'],

        /* 11 以下はすべて Hit */
        '11-':  ['H','H','H','H','H','H','H','H','H','H']
    },

    // ソフトハンド
    softHands: {
        /* A,9(20)+ は常に Stand */
        'A,9+': ['S','S','S','S','S','S','S','S','S','S'],

        /* A,8(19): 2-8 Stand ／ 9-A Hit */
        'A,8':  ['S','S','S','S','S','S','S','H','H','H'],

        /* A,7(18): 2-7 Stand ／ 8-A Hit */
        'A,7':  ['S','S','S','S','S','S','H','H','H','H'],

        /* A,6 以下は常に Hit */
        'A,6-': ['H','H','H','H','H','H','H','H','H','H']
    }
};

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
        console.log('🚀 BlackjackGuide 初期化開始');
        
        try {
            this.setupTheme();
            console.log('✅ テーマ設定完了');
            
            // DOM読み込み完了後にテーブル生成
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.generateStrategyTable();
                });
            } else {
                this.generateStrategyTable();
            }
            
            this.bindEvents();
            console.log('✅ イベント設定完了');
            
            this.loadState();
            console.log('✅ 状態復元完了');
            
            this.setupAutoSave();
            console.log('✅ 自動保存設定完了');
            
            console.log('🎉 BlackjackGuide 初期化完了');
            
        } catch (error) {
            console.error('❌ 初期化エラー:', error);
            this.createFallbackTable(); // フォールバック
        }
    }
    
    // 戦略表を動的生成（エラーハンドリング強化）
    generateStrategyTable() {
        console.log('📊 戦略表生成開始');
        
        const table = document.getElementById('strategyTable');
        if (!table) {
            console.error('❌ strategyTable要素が見つかりません');
            return false;
        }
        
        try {
            // テーブルクリア
            table.innerHTML = '';
            console.log('🧹 テーブルクリア完了');
            
            // ヘッダー生成
            const thead = this.createTableHeader();
            table.appendChild(thead);
            console.log('📋 ヘッダー生成完了');
            
            // ボディ生成
            const tbody = this.createTableBody();
            table.appendChild(tbody);
            console.log('📝 ボディ生成完了');
            
            // アクセシビリティ設定
            setTimeout(() => this.decorateStrategyTable(), 100);
            
            console.log('✅ 戦略表生成成功');
            return true;
            
        } catch (error) {
            console.error('❌ 戦略表生成エラー:', error);
            this.createFallbackTable();
            return false;
        }
    }
    
    // テーブルヘッダー生成
    createTableHeader() {
        const thead = document.createElement('thead');
        thead.setAttribute('role', 'rowgroup');
        
        const headerRow = document.createElement('tr');
        headerRow.setAttribute('role', 'row');
        
        // コーナーセル
        const cornerHeader = document.createElement('th');
        cornerHeader.setAttribute('role', 'columnheader');
        cornerHeader.setAttribute('scope', 'col');
        cornerHeader.setAttribute('aria-label', 'プレイヤーハンド対ディーラーアップカード');
        cornerHeader.textContent = 'Player＼Dealer';
        headerRow.appendChild(cornerHeader);
        
        // ディーラーカードヘッダー
        STRATEGY_DATA.dealerCards.forEach(card => {
            const th = document.createElement('th');
            th.setAttribute('role', 'columnheader');
            th.setAttribute('scope', 'col');
            th.setAttribute('aria-label', `ディーラー${card}`);
            th.textContent = card;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        return thead;
    }
    
    // テーブルボディ生成
    createTableBody() {
        const tbody = document.createElement('tbody');
        tbody.setAttribute('role', 'rowgroup');
        
        // Hard Hands セクション
        this.addSectionHeader(tbody, 'Hard Hands', 'ハードハンド（Aを含まないハンド）');
        this.addStrategyRows(tbody, STRATEGY_DATA.hardHands);
        
        // Soft Hands セクション
        this.addSectionHeader(tbody, 'Soft Hands', 'ソフトハンド（Aを含むハンド）');
        this.addStrategyRows(tbody, STRATEGY_DATA.softHands);
        
        return tbody;
    }
    
    // セクションヘッダー追加
    addSectionHeader(tbody, title, ariaLabel) {
        const row = document.createElement('tr');
        row.className = 'section-header';
        row.setAttribute('role', 'row');
        
        const td = document.createElement('td');
        td.setAttribute('colspan', '11');
        td.setAttribute('role', 'columnheader');
        td.setAttribute('scope', 'colgroup');
        td.setAttribute('aria-label', ariaLabel);
        td.textContent = title;
        
        row.appendChild(td);
        tbody.appendChild(row);
    }
    
    // 戦略行追加
    addStrategyRows(tbody, handsData) {
        Object.entries(handsData).forEach(([hand, actions]) => {
            const row = document.createElement('tr');
            row.setAttribute('role', 'row');
            
            // プレイヤーハンドセル
            const playerCell = document.createElement('td');
            playerCell.className = 'player';
            playerCell.setAttribute('role', 'rowheader');
            playerCell.setAttribute('scope', 'row');
            playerCell.setAttribute('aria-label', `プレイヤー${hand}`);
            playerCell.textContent = hand;
            row.appendChild(playerCell);
            
            // アクションセル
            actions.forEach((action, index) => {
                const actionCell = document.createElement('td');
                actionCell.className = action.toLowerCase();
                actionCell.setAttribute('role', 'gridcell');
                actionCell.setAttribute('aria-label', action === 'H' ? 'ヒット' : 'スタンド');
                actionCell.textContent = action;
                row.appendChild(actionCell);
            });
            
            tbody.appendChild(row);
        });
    }
    
    // フォールバックテーブル（静的HTML）
    createFallbackTable() {
        console.log('🔄 フォールバックテーブル生成');
        
        const table = document.getElementById('strategyTable');
        if (!table) return;
        
        table.innerHTML = `
            <thead role="rowgroup">
                <tr role="row">
                    <th role="columnheader" scope="col">Player＼Dealer</th>
                    <th role="columnheader" scope="col">2</th>
                    <th role="columnheader" scope="col">3</th>
                    <th role="columnheader" scope="col">4</th>
                    <th role="columnheader" scope="col">5</th>
                    <th role="columnheader" scope="col">6</th>
                    <th role="columnheader" scope="col">7</th>
                    <th role="columnheader" scope="col">8</th>
                    <th role="columnheader" scope="col">9</th>
                    <th role="columnheader" scope="col">10</th>
                    <th role="columnheader" scope="col">A</th>
                </tr>
            </thead>
            <tbody role="rowgroup">
                <tr class="section-header">
                    <td colspan="11" role="columnheader" scope="colgroup">Hard Hands</td>
                </tr>
                <tr>
                    <td class="player">17+</td>
                    <td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td>
                    <td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td>
                </tr>
                <tr>
                    <td class="player">13-16</td>
                    <td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td>
                    <td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td>
                </tr>
                <tr>
                    <td class="player">12</td>
                    <td class="h">H</td><td class="h">H</td><td class="s">S</td><td class="s">S</td><td class="s">S</td>
                    <td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td>
                </tr>
                <tr>
                    <td class="player">11-</td>
                    <td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td>
                    <td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td>
                </tr>
                <tr class="section-header">
                    <td colspan="11" role="columnheader" scope="colgroup">Soft Hands</td>
                </tr>
                <tr>
                    <td class="player">A,8+</td>
                    <td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td>
                    <td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td>
                </tr>
                <tr>
                    <td class="player">A,7</td>
                    <td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td><td class="s">S</td>
                    <td class="s">S</td><td class="s">S</td><td class="h">H</td><td class="h">H</td><td class="h">H</td>
                </tr>
                <tr>
                    <td class="player">A,6-</td>
                    <td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td>
                    <td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td><td class="h">H</td>
                </tr>
            </tbody>
        `;
        
        console.log('✅ フォールバックテーブル生成完了');
    }
    
    // 戦略表のアクセシビリティ強化
    decorateStrategyTable() {
        const table = document.getElementById('strategyTable');
        if (!table) return;
        
        table.setAttribute('data-highlight-mode', 'active');
        console.log('✅ 戦略表アクセシビリティ設定完了');
    }
    
    // ダークモード設定
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
        // 資金管理
        const ic = document.getElementById('initialCapital');
        ic?.addEventListener('input', () => this.updateCapital());
        
        // セッション制御
        document.getElementById('startSession')?.addEventListener('click', () => this.startSession());
        document.getElementById('endSession')?.addEventListener('click', () => this.endSession());
        
        // ゲーム結果
        document.getElementById('winButton')?.addEventListener('click', () => this.handleGameResult('win'));
        document.getElementById('pushButton')?.addEventListener('click', () => this.handleGameResult('push'));
        document.getElementById('loseButton')?.addEventListener('click', () => this.handleGameResult('lose'));
        
        // タイマー
        document.getElementById('timerPauseBtn')?.addEventListener('click', () => {
            this.timerRunning ? this.pauseTimer() : this.resumeTimer();
        });
        document.getElementById('timerResetBtn')?.addEventListener('click', () => this.resetTimer());
        
        // 自動調整
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
        if (el) el.style.display = show ? 'block' : 'none';
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
        
        document.getElementById('winStreak').textContent = this.winStreak;
    }
    
    startSession() {
        if (this.initialCapital <= 0) {
            alert('元金を入力してください');
            return;
        }
        
        this.sessionActive = true;
        this.sessionStart = new Date();
        this.winStreak = this.lossStreak = 0;
        this.breakAlerted = false;
        
        document.getElementById('startSession').style.display = 'none';
        document.getElementById('endSession').style.display = 'block';
        document.getElementById('gameButtons').style.display = 'block';
        
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
            maxLose: this.lossStreak
        });
        
        this.renderHistory();
    }
    
    handleGameResult(result) {
        if (!this.sessionActive) {
            alert('セッション未開始です');
            return;
        }
        
        switch (result) {
            case 'win':
                this.currentBalance += this.betAmount * 2;
                this.winStreak++;
                this.lossStreak = 0;
                console.log(`勝利 +${(this.betAmount * 2).toLocaleString()}円`);
                break;
                
            case 'lose':
                this.currentBalance -= this.betAmount;
                this.lossStreak++;
                this.winStreak = 0;
                console.log(`敗北 -${this.betAmount.toLocaleString()}円`);
                
                if (this.lossStreak >= 5 && !this.breakAlerted) {
                    this.breakAlerted = true;
                    alert('5連敗です。休憩を推奨します。');
                }
                break;
                
            case 'push':
                console.log('引き分け');
                break;
        }
        
        if (this.currentBalance < 0) this.currentBalance = 0;
        this.updateDisplay();
        
        if (this.betAmount <= 0) {
            alert('資金が不足しています');
            this.endSession();
            return;
        }
        
        if (this.sessionActive) {
            if (this.currentBalance >= this.initialCapital * 1.25) {
                alert('🎉 利確目標達成！');
            }
            if (this.currentBalance <= this.initialCapital * 0.75) {
                alert('⚠️ 損切り目標到達');
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
        const tbody = document.getElementById('historyTable').querySelector('tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').reverse();
        
        history.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(r.startAt).toLocaleString()}</td>
                <td>${new Date(r.endAt).toLocaleString()}</td>
                <td>${r.initCap.toLocaleString()}円</td>
                <td>${r.finalBal.toLocaleString()}円</td>
                <td style="color:${r.profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">${r.profit >= 0 ? '+' : ''}${r.profit.toLocaleString()}円</td>
                <td>${Math.floor(r.playSec / 60)}:${String(r.playSec % 60).padStart(2, '0')}</td>
                <td>${r.maxWin}</td>
                <td>${r.maxLose}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    // 状態保存・復元
    saveState() {
        const state = {
            initialCapital: this.initialCapital,
            currentBalance: this.currentBalance,
            betRate: this.betRate,
            winStreak: this.winStreak,
            lossStreak: this.lossStreak,
            sessionActive: this.sessionActive,
            sessionStart: this.sessionStart?.toISOString(),
            timerOffsetMs: this.timerOffsetMs,
            autoBetAdjust: this.autoBetAdjust
        };
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }
    
    loadState() {
        const saved = localStorage.getItem(STATE_KEY);
        if (!saved) return;
        
        try {
            const state = JSON.parse(saved);
            this.initialCapital = state.initialCapital || 0;
            this.currentBalance = state.currentBalance || 0;
            this.betRate = state.betRate || 0.02;
            this.winStreak = state.winStreak || 0;
            this.lossStreak = state.lossStreak || 0;
            this.sessionActive = state.sessionActive || false;
            this.sessionStart = state.sessionStart ? new Date(state.sessionStart) : null;
            this.timerOffsetMs = state.timerOffsetMs || 0;
            this.autoBetAdjust = state.autoBetAdjust !== undefined ? state.autoBetAdjust : true;
            
            const ic = document.getElementById('initialCapital');
            const toggle = document.getElementById('autoAdjustToggle');
            if (ic) ic.value = this.initialCapital;
            if (toggle) toggle.checked = this.autoBetAdjust;
            
            if (this.sessionActive) {
                const start = document.getElementById('startSession');
                const end = document.getElementById('endSession');
                const buttons = document.getElementById('gameButtons');
                if (start) start.style.display = 'none';
                if (end) end.style.display = 'block';
                if (buttons) buttons.style.display = 'block';
            }
            
            this.showBalanceDisplay(this.initialCapital > 0);
            this.updateDisplay();
            this.renderHistory();
            
            if (this.sessionActive) {
                this.tickTimer();
            }
        } catch (e) {
            console.warn('状態復元に失敗:', e);
        }
    }
    
    setupAutoSave() {
        setInterval(() => this.saveState(), 5000);
    }
}

// アプリ起動（エラーハンドリング強化）
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new BlackjackGuide();
        console.log('🎉 アプリケーション起動成功');
    } catch (error) {
        console.error('❌ アプリケーション起動エラー:', error);
        
        // 緊急時フォールバック
        setTimeout(() => {
            const table = document.getElementById('strategyTable');
            if (table && table.innerHTML.trim() === '') {
                console.log('🆘 緊急フォールバック実行');
                new BlackjackGuide().createFallbackTable();
            }
        }, 1000);
    }
});

// デバッグ用グローバル関数
window.debugBlackjack = function() {
    console.log('🔍 デバッグ情報:');
    console.log('app:', window.app);
    console.log('strategyTable:', document.getElementById('strategyTable'));
    console.log('DOM ready:', document.readyState);
    
    if (window.app) {
        console.log('テーブル再生成試行...');
        window.app.generateStrategyTable();
    }
};
