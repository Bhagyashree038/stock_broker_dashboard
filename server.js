const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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

// Start HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
        // Handle incoming messages if needed
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
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
            client.send(JSON.stringify({
                type: 'stockUpdate',
                stocks: stockUpdates
            }));
            
            client.send(JSON.stringify({
                type: 'userUpdate',
                users: activeUsers
            }));
        }
    });
}

// Update stock prices every second
setInterval(updateStockPrices, 1000);

// Initial update
updateStockPrices();