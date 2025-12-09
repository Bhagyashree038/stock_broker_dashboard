# Stock Broker Client Web Dashboard

A real-time stock monitoring dashboard with WebSocket integration for live price updates.

## Features

- User authentication with email
- Real-time stock price updates (simulated)
- Multi-user support with asynchronous updates
- Subscribe/unsubscribe to supported stocks
- Live WebSocket connection
- Clean, modern UI with responsive design

## Supported Stocks

- GOOG - Alphabet Inc.
- TSLA - Tesla Inc.
- AMZN - Amazon.com Inc.
- META - Meta Platforms Inc.
- NVDA - NVIDIA Corporation

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript 
- **Backend**: Node.js, Express.js
- **Real-time**: WebSocket
- **Styling**: Custom CSS with CSS Variables

## Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/stock-broker-dashboard.git
cd stock-broker-dashboard
```
2. Install dependencies:
```bash
npm install
```
3. Start the server:
```bash
npm start
```
4. Open your browser and navigate to:
```bash
http://localhost:3000
```
Usage
1. Login with any email (demo accounts available)
2. Subscribe to supported stocks using their ticker codes
3. Watch real-time price updates
4. Multiple users can login simultaneously to see different stocks

```bash
stock-dashboard/
├── index.html          # Main HTML file
├── style.css           # All styles
├── script.js           # Frontend JavaScript
├── server.js           # Backend server with WebSocket
├── README.md           # This file
└── package.json        # Dependencies
```

Demo Users
trader@stockflow.com
analyst@stockflow.com

Create .gitignore file
```bash
touch .gitignore
```
Add this content to .gitignore:
```bash
node_modules/
npm-debug.log
.DS_Store
.env
```
Stage all your files
```bash
git add .
git add index.html style.css script.js server.js package.json README.md .gitignore
```
Commit your changes
```bash
git commit -m "Initial commit: Stock broker dashboard with real-time updates"
```
Connect your local repository to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/stock-broker-dashboard.git
git remote -v
```
Push your code to GitHub
```bash
git branch -M main
git push -u origin main
```
