const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Store active game rooms
const games = new Map();

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createGame', () => {
        const gameId = generateGameId();
        games.set(gameId, {
            players: [socket.id],
            board: ['', '', '', '', '', '', '', '', ''],
            currentPlayer: 'X',
            playerX: socket.id,
            playerO: null
        });
        socket.join(gameId);
        socket.emit('gameCreated', { gameId, player: 'X' });
        console.log('Game created:', gameId);
    });

    socket.on('joinGame', (gameId) => {
        const game = games.get(gameId);
        
        if (!game) {
            socket.emit('error', 'Game not found');
            return;
        }
        
        if (game.players.length >= 2) {
            socket.emit('error', 'Game is full');
            return;
        }
        
        game.players.push(socket.id);
        game.playerO = socket.id;
        socket.join(gameId);
        
        socket.emit('gameJoined', { gameId, player: 'O' });
        io.to(gameId).emit('gameStart', {
            playerX: game.playerX,
            playerO: game.playerO
        });
        
        console.log('Player joined game:', gameId);
    });

    socket.on('makeMove', ({ gameId, index }) => {
        const game = games.get(gameId);
        
        if (!game) {
            socket.emit('error', 'Game not found');
            return;
        }
        
        const currentPlayerSymbol = game.currentPlayer;
        const expectedPlayer = currentPlayerSymbol === 'X' ? game.playerX : game.playerO;
        
        if (socket.id !== expectedPlayer) {
            socket.emit('error', 'Not your turn');
            return;
        }
        
        if (game.board[index] !== '') {
            socket.emit('error', 'Invalid move');
            return;
        }
        
        game.board[index] = currentPlayerSymbol;
        game.currentPlayer = currentPlayerSymbol === 'X' ? 'O' : 'X';
        
        io.to(gameId).emit('moveMade', {
            index,
            player: currentPlayerSymbol,
            board: game.board,
            nextPlayer: game.currentPlayer
        });
    });

    socket.on('resetGame', (gameId) => {
        const game = games.get(gameId);
        
        if (!game) {
            return;
        }
        
        game.board = ['', '', '', '', '', '', '', '', ''];
        game.currentPlayer = 'X';
        
        io.to(gameId).emit('gameReset');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Find and clean up games with disconnected player
        for (const [gameId, game] of games.entries()) {
            if (game.players.includes(socket.id)) {
                io.to(gameId).emit('playerDisconnected');
                games.delete(gameId);
            }
        }
    });
});

function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
