// ==========================================
// GUNAL CHESS AI ENGINE (Minimax + Alpha-Beta)
// ==========================================

const PIECE_VALUES = { 'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000 };

// Piece-Square Tables (Encourages center control and pawn advancement)
const PST = {
    'P': [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [ 5,  5, 10, 25, 25, 10,  5,  5],
        [ 0,  0,  0, 20, 20,  0,  0,  0],
        [ 5, -5,-10,  0,  0,-10, -5,  5],
        [ 5, 10, 10,-20,-20, 10, 10,  5],
        [0,  0,  0,  0,  0,  0,  0,  0]
    ],
    'N': [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,  0,  0,  0,  0,-20,-40],
        [-30,  0, 10, 15, 15, 10,  0,-30],
        [-30,  5, 15, 20, 20, 15,  5,-30],
        [-30,  0, 15, 20, 20, 15,  0,-30],
        [-30,  5, 10, 15, 15, 10,  5,-30],
        [-40,-20,  0,  5,  5,  0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    'B': [
        [-20,-10,-10,-10,-10,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5, 10, 10,  5,  0,-10],
        [-10,  5,  5, 10, 10,  5,  5,-10],
        [-10,  0, 10, 10, 10, 10,  0,-10],
        [-10, 10, 10, 10, 10, 10, 10,-10],
        [-10,  5,  0,  0,  0,  0,  5,-10],
        [-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    'R': [
        [  0,  0,  0,  0,  0,  0,  0,  0],
        [  5, 10, 10, 10, 10, 10, 10,  5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [  0,  0,  0,  5,  5,  0,  0,  0]
    ],
    'Q': [
        [-20,-10,-10, -5, -5,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5,  5,  5,  5,  0,-10],
        [ -5,  0,  5,  5,  5,  5,  0, -5],
        [  0,  0,  5,  5,  5,  5,  0, -5],
        [-10,  5,  5,  5,  5,  5,  0,-10],
        [-10,  0,  5,  0,  0,  0,  0,-10],
        [-20,-10,-10, -5, -5,-10,-10,-20]
    ],
    'K': [
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],
        [-10,-20,-20,-20,-20,-20,-20,-10],
        [ 20, 20,  0,  0,  0,  0, 20, 20],
        [ 20, 30, 10,  0,  0, 10, 30, 20]
    ]
};

// Evaluates board state (Positive = Good for White, Negative = Good for Black)
function evaluateBoard(boardState) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece) {
                let val = PIECE_VALUES[piece.type];
                // PST is written from White's perspective. If Black, flip the row.
                let pstVal = PST[piece.type][piece.color === 'w' ? r : 7 - r][c];
                
                if (piece.color === 'w') {
                    score += (val + pstVal);
                } else {
                    score -= (val + pstVal);
                }
            }
        }
    }
    return score;
}

// Get all legal moves for a specific color
function getAllLegalMoves(color, currentBoard) {
    let allMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (currentBoard[r][c] && currentBoard[r][c].color === color) {
                const moves = getLegalMoves(r, c, currentBoard); 
                moves.forEach(m => allMoves.push({ fromR: r, fromC: c, toR: m.r, toC: m.c, moveObj: m }));
            }
        }
    }
    return allMoves;
}

// Minimax Algorithm with Alpha-Beta Pruning
function minimax(boardState, depth, alpha, beta, isMaximizingPlayer, currentTurn) {
    if (depth === 0) return evaluateBoard(boardState);

    let allMoves = getAllLegalMoves(currentTurn, boardState);

    if (allMoves.length === 0) {
        if (isKingInCheck(currentTurn, boardState)) {
            // Checkmate: heavily penalize the loser
            return isMaximizingPlayer ? -99999 + (10 - depth) : 99999 - (10 - depth); 
        }
        return 0; // Stalemate
    }

    // Move ordering: check captures first to optimize Alpha-Beta
    allMoves.sort((a, b) => {
        const valA = boardState[a.toR][a.toC] ? PIECE_VALUES[boardState[a.toR][a.toC].type] : 0;
        const valB = boardState[b.toR][b.toC] ? PIECE_VALUES[boardState[b.toR][b.toC].type] : 0;
        return valB - valA;
    });

    if (isMaximizingPlayer) { // White's turn (trying to maximize score)
        let maxEval = -Infinity;
        for (let move of allMoves) {
            const captured = boardState[move.toR][move.toC];
            // Simulate move
            boardState[move.toR][move.toC] = boardState[move.fromR][move.fromC];
            boardState[move.fromR][move.fromC] = null;

            let ev = minimax(boardState, depth - 1, alpha, beta, false, currentTurn === 'w' ? 'b' : 'w');
            
            // Undo move
            boardState[move.fromR][move.fromC] = boardState[move.toR][move.toC];
            boardState[move.toR][move.toC] = captured;

            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break; // Prune
        }
        return maxEval;
    } else { // Black's turn (trying to minimize score)
        let minEval = Infinity;
        for (let move of allMoves) {
            const captured = boardState[move.toR][move.toC];
            // Simulate move
            boardState[move.toR][move.toC] = boardState[move.fromR][move.fromC];
            boardState[move.fromR][move.fromC] = null;

            let ev = minimax(boardState, depth - 1, alpha, beta, true, currentTurn === 'w' ? 'b' : 'w');
            
            // Undo move
            boardState[move.fromR][move.fromC] = boardState[move.toR][move.toC];
            boardState[move.toR][move.toC] = captured;

            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break; // Prune
        }
        return minEval;
    }
}

// The main function called by game.js
function getBestMove(botColor, currentBoard, elo) {
    // Determine search depth based on ELO
    let depth = 1;
    if (elo >= 3000) depth = 4;      // Javed Hussain (Calculates 4 moves ahead)
    else if (elo >= 2000) depth = 3; // Badmosh Bachha
    else if (elo >= 1000) depth = 2; // Ishan ali
    else depth = 1;                  // Beginners

    let allMoves = getAllLegalMoves(botColor, currentBoard);
    if (allMoves.length === 0) return null;

    // Add a "blunder chance" for low ELO bots to make them human-like
    let blunderChance = 0;
    if (elo <= 100) blunderChance = 0.8;      // Plays almost entirely random
    else if (elo <= 200) blunderChance = 0.5; // Plays 50% random
    else if (elo <= 500) blunderChance = 0.2; // Plays 20% random

    if (Math.random() < blunderChance) {
        return allMoves[Math.floor(Math.random() * allMoves.length)];
    }

    let bestMove = null;
    let bestValue = botColor === 'w' ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    // Sort moves to optimize
    allMoves.sort((a, b) => {
        const valA = currentBoard[a.toR][a.toC] ? PIECE_VALUES[currentBoard[a.toR][a.toC].type] : 0;
        const valB = currentBoard[b.toR][b.toC] ? PIECE_VALUES[currentBoard[b.toR][b.toC].type] : 0;
        return valB - valA;
    });

    for (let move of allMoves) {
        const captured = currentBoard[move.toR][move.toC];
        
        // Simulate move
        currentBoard[move.toR][move.toC] = currentBoard[move.fromR][move.fromC];
        currentBoard[move.fromR][move.fromC] = null;

        // If Bot is Black, the NEXT turn is White (Maximizing). If Bot is White, next turn is Black (Minimizing).
        let isNextTurnMaximizing = (botColor === 'b');
        
        let ev = minimax(currentBoard, depth - 1, alpha, beta, isNextTurnMaximizing, botColor === 'w' ? 'b' : 'w');

        // Undo move
        currentBoard[move.fromR][move.fromC] = currentBoard[move.toR][move.toC];
        currentBoard[move.toR][move.toC] = captured;

        if (botColor === 'w') {
            if (ev > bestValue) { bestValue = ev; bestMove = move; }
            alpha = Math.max(alpha, ev);
        } else {
            if (ev < bestValue) { bestValue = ev; bestMove = move; }
            beta = Math.min(beta, ev);
        }
    }

    return bestMove || allMoves[0];
}