const SUPPORTED_STOCKS = ['GOOG', 'TSLA', 'AMZN', 'META', 'NVDA'];
const SERVER_URL = window.location.origin;

class StockDashboard {
    constructor() {
        this.currentUser = null;
        this.stockData = new Map();
        this.activeUsers = new Map();
        this.init();
    }

    async init() {
        // Set up event listeners
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        document.getElementById('subscribeBtn').addEventListener('click', () => this.subscribeToStock());
        document.getElementById('stockTicker').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.subscribeToStock();
        });

        // Auto-fill demo emails on click
        document.querySelectorAll('.demo-card').forEach(card => {
            card.addEventListener('click', () => {
                const email = card.querySelector('.demo-email').textContent;
                document.getElementById('email').value = email;
            });
        });

        // Initialize WebSocket connection
        await this.initWebSocket();
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        
        if (!email) {
            this.showNotification('Please enter your email', 'error');
            return;
        }

        try {
            const response = await fetch(`${SERVER_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                const userData = await response.json();
                this.currentUser = userData;
                this.showDashboard();
                this.loadUserData();
                this.showNotification(`Welcome back, ${email.split('@')[0]}!`, 'success');
            } else {
                throw new Error('Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Login failed. Please try again.', 'error');
        }
    }

    handleLogout() {
        this.currentUser = null;
        this.showLogin();
        this.showNotification('Successfully logged out', 'info');
    }

    showDashboard() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboardScreen').classList.remove('hidden');
        document.getElementById('userEmail').textContent = this.currentUser.email;
    }

    showLogin() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('dashboardScreen').classList.add('hidden');
        document.getElementById('email').value = '';
    }

    async subscribeToStock() {
        const tickerInput = document.getElementById('stockTicker');
        const ticker = tickerInput.value.trim().toUpperCase();
        
        if (!ticker) {
            this.showNotification('Please enter a stock ticker', 'error');
            return;
        }

        if (!SUPPORTED_STOCKS.includes(ticker)) {
            this.showNotification(
                `Unsupported stock. Supported stocks: ${SUPPORTED_STOCKS.join(', ')}`,
                'error'
            );
            return;
        }

        if (this.currentUser.subscriptions.includes(ticker)) {
            this.showNotification('You are already subscribed to this stock', 'warning');
            return;
        }

        try {
            const response = await fetch(`${SERVER_URL}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    ticker: ticker
                })
            });

            if (response.ok) {
                this.currentUser.subscriptions.push(ticker);
                this.updateSubscriptionsList();
                this.updateMarketStats();
                tickerInput.value = '';
                this.showNotification(`Subscribed to ${ticker} successfully`, 'success');
            }
        } catch (error) {
            console.error('Subscription error:', error);
            this.showNotification('Failed to subscribe. Please try again.', 'error');
        }
    }

    updateSubscriptionsList() {
        const container = document.getElementById('subscriptionsList');
        
        if (this.currentUser.subscriptions.length === 0) {
            container.innerHTML = `
                <div class="empty-subscriptions">
                    <i class="fas fa-chart-line"></i>
                    <p>No subscriptions yet</p>
                    <small>Add stocks to monitor real-time prices</small>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        this.currentUser.subscriptions.forEach(ticker => {
            const stock = this.stockData.get(ticker);
            const change = stock ? (stock.change || 0) : 0;
            const changeClass = change >= 0 ? 'positive' : 'negative';
            
            const item = document.createElement('div');
            item.className = 'subscription-item';
            item.innerHTML = `
                <div class="subscription-info">
                    <div class="stock-icon">${ticker.charAt(0)}</div>
                    <div class="stock-details">
                        <span class="stock-symbol">${ticker}</span>
                        <span class="stock-name">${this.getStockName(ticker)}</span>
                    </div>
                </div>
                ${stock ? `
                    <div class="price-change small">
                        <span class="change-value ${changeClass}">
                            $${stock.price.toFixed(2)}
                        </span>
                    </div>
                ` : ''}
                <button class="btn-unsubscribe" onclick="dashboard.unsubscribe('${ticker}')">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(item);
        });
    }

    async unsubscribe(ticker) {
        try {
            const response = await fetch(`${SERVER_URL}/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    ticker: ticker
                })
            });

            if (response.ok) {
                this.currentUser.subscriptions = this.currentUser.subscriptions.filter(s => s !== ticker);
                this.updateSubscriptionsList();
                this.updateStockCards();
                this.updateMarketStats();
                this.showNotification(`Unsubscribed from ${ticker}`, 'info');
            }
        } catch (error) {
            console.error('Unsubscribe error:', error);
            this.showNotification('Failed to unsubscribe', 'error');
        }
    }

    async initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
        console.log('WebSocket connected to:', wsUrl);
    };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'stockUpdate') {
                this.handleStockUpdate(data.stocks);
            } else if (data.type === 'userUpdate') {
                this.handleUserUpdate(data.users);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected. Reconnecting...');
            setTimeout(() => this.initWebSocket(), 3000);
        };
    }

    handleStockUpdate(stockUpdates) {
        // Update stock data
        stockUpdates.forEach(update => {
            this.stockData.set(update.ticker, update);
        });

        // Update display
        this.updateStockCards();
        this.updateSubscriptionsList();
        this.updateLastUpdateTime();
        this.updateMarketStats();
    }

    handleUserUpdate(users) {
        this.activeUsers = new Map(Object.entries(users));
        this.updateActiveUsersList();
    }

    updateStockCards() {
        const container = document.getElementById('stocksGrid');
        
        // Filter stocks for current user's subscriptions
        const userStocks = this.currentUser.subscriptions
            .map(ticker => this.stockData.get(ticker))
            .filter(stock => stock !== undefined);

        if (userStocks.length === 0) {
            container.innerHTML = `
                <div class="empty-dashboard">
                    <div class="empty-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <h3>Welcome to Your Dashboard</h3>
                    <p>Subscribe to stocks to begin monitoring real-time market data</p>
                    <button class="btn-primary" onclick="document.getElementById('stockTicker').focus()">
                        <i class="fas fa-plus"></i>
                        Add Your First Stock
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        userStocks.forEach(stock => {
            const change = stock.change || 0;
            const changePercent = stock.changePercent || 0;
            const changeClass = change >= 0 ? 'positive' : 'negative';
            const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
            const percentSign = changePercent >= 0 ? '+' : '';
            
            const card = document.createElement('div');
            card.className = 'stock-card';
            card.innerHTML = `
                <div class="stock-header">
                    <div class="stock-icon-lg">${stock.ticker.charAt(0)}</div>
                    <div class="stock-info">
                        <span class="stock-symbol-lg">${stock.ticker}</span>
                        <span class="stock-name-lg">${this.getStockName(stock.ticker)}</span>
                    </div>
                    <div class="price-change">
                        <span class="change-value ${changeClass}">
                            <i class="fas ${changeIcon}"></i>
                            ${change >= 0 ? '+' : ''}$${Math.abs(change).toFixed(2)}
                        </span>
                        <span class="change-percent ${changeClass}">
                            ${percentSign}${changePercent.toFixed(2)}%
                        </span>
                    </div>
                </div>
                <div class="stock-price">$${stock.price.toFixed(2)}</div>
                <div class="last-updated">
                    Updated: ${new Date(stock.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
            `;
            container.appendChild(card);
        });
    }

    updateActiveUsersList() {
        const container = document.getElementById('activeUsersList');
        
        if (this.activeUsers.size === 0) {
            container.innerHTML = '<div class="user-item">No active users</div>';
            return;
        }

        container.innerHTML = '';
        
        this.activeUsers.forEach((user, userId) => {
            const isCurrentUser = userId === this.currentUser.id;
            const userItem = document.createElement('div');
            userItem.className = `user-item ${isCurrentUser ? 'active' : ''}`;
            userItem.innerHTML = `
                <div class="user-avatar">${user.email.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <span class="user-email">${user.email}</span>
                    <span class="user-subscriptions">
                        ${user.subscriptions.length} subscription${user.subscriptions.length !== 1 ? 's' : ''}
                    </span>
                </div>
            `;
            container.appendChild(userItem);
        });
    }

    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        document.getElementById('lastUpdateTime').textContent = timeString;
    }

    updateMarketStats() {
        document.getElementById('totalSubscriptions').textContent = this.currentUser.subscriptions.length;
    }

    getStockName(ticker) {
        const names = {
            'GOOG': 'Alphabet Inc.',
            'TSLA': 'Tesla Inc.',
            'AMZN': 'Amazon.com Inc.',
            'META': 'Meta Platforms Inc.',
            'NVDA': 'NVIDIA Corporation'
        };
        return names[ticker] || ticker;
    }

    showNotification(message, type = 'info') {
        // Remove existing notification
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add styles for notification
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 1000;
                animation: slideIn 0.3s ease-out;
                max-width: 400px;
                border-left: 4px solid var(--primary);
            }
            
            .notification-success {
                border-left-color: var(--success);
            }
            
            .notification-error {
                border-left-color: var(--danger);
            }
            
            .notification-warning {
                border-left-color: var(--warning);
            }
            
            .notification-info {
                border-left-color: var(--primary);
            }
            
            .notification i:first-child {
                font-size: 20px;
            }
            
            .notification-success i:first-child {
                color: var(--success);
            }
            
            .notification-error i:first-child {
                color: var(--danger);
            }
            
            .notification-warning i:first-child {
                color: var(--warning);
            }
            
            .notification-info i:first-child {
                color: var(--primary);
            }
            
            .notification span {
                flex: 1;
                font-weight: 500;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: var(--gray-400);
                cursor: pointer;
                padding: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .notification-close:hover {
                color: var(--gray-600);
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    loadUserData() {
        this.updateSubscriptionsList();
        this.updateActiveUsersList();
        this.updateMarketStats();
        this.updateLastUpdateTime();
    }
}

// Initialize dashboard when page loads

const dashboard = new StockDashboard();
