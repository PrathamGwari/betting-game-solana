import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors'


const app = express();
const port = 3000;
const wss = new WebSocketServer({ noServer: true });
app.use(cors()); 
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Origin', 'http://97.74.86.184');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});



let transactionResult = false;

app.post('/api/transaction', (req, res) => {
    const { signature } = req.body;

    if (signature === 'failed') {
        transactionResult = false;
        res.json({ success: false });
    } else {
        transactionResult = true;
        res.json({ success: true });
    }
});

app.get('/api/transactionResult', (req, res) => {
    console.log('transaction result', transactionResult)
    return res.status(200).json({ transactionResult });
});





app.get('/bid', async (req, res) => {
    const { amount } = req.query;
    console.log("Amount:", amount);

    const parsedAmount = parseFloat(amount);
    
    // Check if the parsed amount is a valid number
    if (isNaN(parsedAmount)) {
        res.status(400).json({ message: 'Invalid amount' });
        return;
    }

    // Broadcast the amount to all connected WebSocket clients
    wss.clients.forEach((client) => {
        client.send(JSON.stringify({ amount: parsedAmount }));
    });

    res.status(200).json({ message: 'Amount broadcasted', amount: parsedAmount });
});



app.get('/winner', async (req, res) => {
    const { winner } = req.query;
    console.log("Winner:", winner);

    // Check if winner is true
    if (winner === 'true') {
        // Broadcast the winner to all connected WebSocket clients
        wss.clients.forEach((client) => {
            client.send(JSON.stringify({ winner: 'Some Winner' }));
        });

        res.status(200).json({ winner: 'Some Winner' });
    } else {
        res.status(200).json({ winner: 'No Winner' });
    }
});


const server = app.listen(port,  () => {
    console.log(`Server listening on port ${port}`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});