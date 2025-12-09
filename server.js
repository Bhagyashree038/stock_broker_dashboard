const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Serve React app (if you add it later)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// In-memory data store
let users = new Map();
let activeConnections = new Map();
let stockPrices = new Map();

// Initialize stock prices
['GOOG', 'TSLA', 'AMZN', 'META', 'NVDA'].forEach(ticker => {
    stockPrices.set(ticker, {
        ticker,
        price: 100 + Math.random() * 1000,
        timestamp: Date.now()
    });
});

// Login endpoint
app.post('/login', (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    // Create or get user
    let userId = `user_${Date.now()}`;
    if (!users.has(email)) {
        users.set(email, {
            id: userId,
            email,
            subscriptions: []
        });
    } else {
        userId = users.get(email).id;
    }

    res.json(users.get(email));
});

// Subscribe endpoint
app.post('/subscribe', (req, res) => {
    const { userId, ticker } = req.body;
    
    const user = Array.from(users.values()).find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (!user.subscriptions.includes(ticker)) {
        user.subscriptions.push(ticker);
    }

    res.json({ success: true });
});

// Unsubscribe endpoint
app.post('/unsubscribe', (req, res) => {
    const { userId, ticker } = req.body;
    
    const user = Array.from(users.values()).find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    user.subscriptions = user.subscriptions.filter(s => s !== ticker);
    res.json({ success: true });
});

// Health check endpoint (required for Render)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Stock Broker Dashboard'
    });
});

// Start HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Dashboard URL: http://localhost:${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    
    // Get client IP
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`Client connected from: ${clientIp}`);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Handle ping/pong for connection keep-alive
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({ 
        type: 'connection', 
        status: 'connected',
        message: 'Stock dashboard WebSocket connected'
    }));
});

// Function to update stock prices
function updateStockPrices() {
    stockPrices.forEach((stock, ticker) => {
        const change = (Math.random() - 0.5) * 10;
        const newPrice = Math.max(1, stock.price + change);
        const changePercent = (change / stock.price) * 100;
        
        stockPrices.set(ticker, {
            ticker,
            price: newPrice,
            change,
            changePercent,
            timestamp: Date.now()
        });
    });

    // Broadcast updates to all connected clients
    const stockUpdates = Array.from(stockPrices.values());
    const activeUsers = {};
    
    users.forEach(user => {
        activeUsers[user.id] = {
            email: user.email,
            subscriptions: user.subscriptions
        };
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify({
                    type: 'stockUpdate',
                    stocks: stockUpdates
                }));
                
                client.send(JSON.stringify({
                    type: 'userUpdate',
                    users: activeUsers
                }));
            } catch (error) {
                console.error('Error sending WebSocket update:', error);
            }
        }
    });
}

// Update stock prices every second
const updateInterval = setInterval(updateStockPrices, 1000);

// Initial update
updateStockPrices();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    clearInterval(updateInterval);
    
    // Close all WebSocket connections
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close();
        }
    });
    
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
