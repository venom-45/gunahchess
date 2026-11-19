// --- Bot Setup ---
const botName = localStorage.getItem('botName') || 'Zanjeer ki beti';
const botElo = parseInt(localStorage.getItem('botElo')) || 100;
const playerName = localStorage.getItem('playerName') || 'Nameless Sinner';
const botColor = 'b'; // Bot plays Black, Player plays White
const playerColor = 'w';

document.getElementById('bot-name-display').innerText = `${botName} (${botElo} ELO)`;
document.getElementById('player-name-display').innerText = playerName;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('game-status');
const moveHistoryEl = document.getElementById('move-history-list');
const whiteCapturedEl = document.getElementById('white-captured');
const blackCapturedEl = document.getElementById('black-captured');
const promotionModal = document.getElementById('promotion-modal');
const promotionOptions = document.getElementById('promotion-options');

let board = [];
let turn = 'w';
let selectedSquare = null;
let validMovesForSelected = [];
let enPassantTarget = null;
let castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
let moveHistory = [];
let capturedPieces = { w: [], b: [] };
let isGameOver = false;
let pendingPromotion = null;
let isBotThinking = false;

const initialLayout = [
    ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
    ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
    ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
];

function initGame() {
    board = initialLayout.map(row => row.map(cell => {
        if (!cell) return null;
        return { type: cell[1], color: cell[0], hasMoved: false };
    }));
    turn = 'w';
    selectedSquare = null;
    validMovesForSelected = [];
    enPassantTarget = null;
    castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
    moveHistory = [];
    capturedPieces = { w: [], b: [] };
    isGameOver = false;
    isBotThinking = false;
    
    renderBoard();
    renderSidebar();
    updateStatus();
}

function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            
            if (board[r][c] && board[r][c].type === 'K' && isKingInCheck(board[r][c].color, board)) {
                sq.classList.add('in-check');
            }

            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                sq.classList.add('selected');
            }
            const move = validMovesForSelected.find(m => m.r === r && m.c === c);
            if (move) sq.classList.add(move.capture ? 'valid-capture' : 'valid-move');

            if (board[r][c]) {
                const pieceDiv = document.createElement('div');
                pieceDiv.className = `piece ${board[r][c].color}-${board[r][c].type}`;
                sq.appendChild(pieceDiv);
            }

            sq.addEventListener('click', () => handleSquareClick(r, c));
            boardEl.appendChild(sq);
        }
    }
}

function renderSidebar() {
    whiteCapturedEl.innerHTML = capturedPieces.w.map(p => `<div class="piece-mini ${p.color}-${p.type}"></div>`).join('');
    blackCapturedEl.innerHTML = capturedPieces.b.map(p => `<div class="piece-mini ${p.color}-${p.type}"></div>`).join('');

    moveHistoryEl.innerHTML = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const pair = document.createElement('div');
        pair.style.display = 'contents';
        pair.innerHTML = `
            <div class="move-number">${(i / 2) + 1}.</div>
            <div class="move-white">${moveHistory[i] || ''}</div>
            <div class="move-black">${moveHistory[i + 1] || ''}</div>
        `;
        moveHistoryEl.appendChild(pair);
    }
    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
}

function updateStatus() {
    if (isGameOver) return;
    if (turn === playerColor) {
        if (isKingInCheck(turn, board)) {
            statusEl.textContent = `You are in Check!`;
            statusEl.style.color = 'var(--check-red)';
        } else {
            statusEl.textContent = `Your turn`;
            statusEl.style.color = 'var(--text-main)';
        }
    } else {
        statusEl.textContent = `${botName} is thinking...`;
        statusEl.style.color = 'var(--accent-gold)';
    }
}

function handleSquareClick(r, c) {
    if (isGameOver || pendingPromotion || turn !== playerColor || isBotThinking) return;

    if (selectedSquare) {
        const move = validMovesForSelected.find(m => m.r === r && m.c === c);
        if (move) {
            executeMove(selectedSquare.r, selectedSquare.c, r, c, move);
            return;
        }
    }

    const piece = board[r][c];
    if (piece && piece.color === turn) {
        selectedSquare = { r, c };
        validMovesForSelected = getLegalMoves(r, c);
        renderBoard();
        return;
    }

    selectedSquare = null;
    validMovesForSelected = [];
    renderBoard();
}

function executeMove(fromR, fromC, toR, toC, moveObj, isBot = false) {
    const piece = board[fromR][fromC];
    const captured = board[toR][toC];

    if (moveObj.enPassant) {
        const epR = fromR;
        const epC = toC;
        capturedPieces[piece.color].push(board[epR][epC]);
        board[epR][epC] = null;
    } else if (captured) {
        capturedPieces[piece.color].push(captured);
    }

    board[toR][toC] = piece;
    board[fromR][fromC] = null;
    piece.hasMoved = true;

    if (piece.type === 'K' && Math.abs(toC - fromC) === 2) {
        const rC = toC > fromC ? 7 : 0;
        const tC = toC > fromC ? toC - 1 : toC + 1;
        const rook = board[fromR][rC];
        board[fromR][tC] = rook;
        board[fromR][rC] = null;
        rook.hasMoved = true;
    }

    enPassantTarget = null;
    if (piece.type === 'P' && Math.abs(toR - fromR) === 2) {
        enPassantTarget = { r: (fromR + toR) / 2, c: fromC };
    }

    if (piece.type === 'K') {
        if (piece.color === 'w') { castlingRights.wK = false; castlingRights.wQ = false; }
        else { castlingRights.bK = false; castlingRights.bQ = false; }
    }
    if (piece.type === 'R') {
        if (fromC === 0) { if (piece.color === 'w') castlingRights.wQ = false; else castlingRights.bQ = false; }
        if (fromC === 7) { if (piece.color === 'w') castlingRights.wK = false; else castlingRights.bK = false; }
    }

    // AI doesn't need promotion UI, it always chooses Queen
    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
        if (isBot) {
            board[toR][toC] = { type: 'Q', color: piece.color, hasMoved: true };
            finalizeMove(fromR, fromC, toR, toC);
        } else {
            pendingPromotion = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };
            showPromotionModal(piece.color);
        }
        return;
    }

    finalizeMove(fromR, fromC, toR, toC);
}

function finalizeMove(fromR, fromC, toR, toC) {
    moveHistory.push(getAlgebraicNotation(fromR, fromC, toR, toC));
    turn = turn === 'w' ? 'b' : 'w';
    selectedSquare = null;
    validMovesForSelected = [];

    const inCheck = isKingInCheck(turn, board);
    const hasMoves = hasLegalMoves(turn);

    if (!hasMoves) {
        isGameOver = true;
        if (inCheck) {
            statusEl.textContent = `CHECKMATE! ${turn === 'w' ? botName : playerName} Wins!`;
            statusEl.style.color = 'var(--accent-red-bright)';
        } else {
            statusEl.textContent = 'STALEMATE! Draw.';
            statusEl.style.color = 'var(--text-muted)';
        }
    } else {
        updateStatus();
        if (turn === botColor && !isGameOver) {
            // Trigger Bot
            isBotThinking = true;
            setTimeout(makeBotMove, 500); // 500ms delay for realism
        }
    }

    renderBoard();
    renderSidebar();
}

function makeBotMove() {
    const bestMove = getBestMove(botColor, board, botElo);
    if (bestMove) {
        executeMove(bestMove.fromR, bestMove.fromC, bestMove.toR, bestMove.toC, bestMove.moveObj, true);
    }
    isBotThinking = false;
}

function showPromotionModal(color) {
    promotionOptions.innerHTML = '';
    ['Q', 'R', 'B', 'N'].forEach(type => {
        const btn = document.createElement('button');
        btn.className = `promo-btn ${color}-${type}`;
        btn.onclick = () => {
            board[pendingPromotion.to.r][pendingPromotion.to.c] = { type, color, hasMoved: true };
            const { from, to } = pendingPromotion;
            pendingPromotion = null;
            promotionModal.classList.add('hidden');
            finalizeMove(from.r, from.c, to.r, to.c);
        };
        promotionOptions.appendChild(btn);
    });
    promotionModal.classList.remove('hidden');
}

// --- Engine Helpers (Shared with bot.js) ---
function getLegalMoves(r, c, currentBoard = board) {
    const piece = currentBoard[r][c];
    if (!piece) return [];
    return getPseudoLegalMoves(r, c, currentBoard).filter(move => {
        const captured = currentBoard[move.r][move.c];
        currentBoard[move.r][move.c] = piece;
        currentBoard[r][c] = null;
        const check = isKingInCheck(piece.color, currentBoard);
        currentBoard[r][c] = piece;
        currentBoard[move.r][move.c] = captured;
        return !check;
    });
}

function getPseudoLegalMoves(r, c, currentBoard, checkCastling = true) {
    const piece = currentBoard[r][c];
    const moves = [];
    const dir = piece.color === 'w' ? -1 : 1;
    const startRow = piece.color === 'w' ? 6 : 1;
    const enemyColor = piece.color === 'w' ? 'b' : 'w';

    const addMove = (tr, tc) => {
        if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;
        const target = currentBoard[tr][tc];
        if (!target) { moves.push({ r: tr, c: tc, capture: false }); return true; }
        if (target.color !== piece.color) { moves.push({ r: tr, c: tc, capture: true }); return false; }
        return false;
    };

    if (piece.type === 'P') {
        if (r + dir >= 0 && r + dir <= 7 && !currentBoard[r + dir][c]) {
            moves.push({ r: r + dir, c: c, capture: false });
            if (r === startRow && !currentBoard[r + dir * 2][c]) moves.push({ r: r + dir * 2, c: c, capture: false });
        }
        for (const dc of [-1, 1]) {
            const tr = r + dir, tc = c + dc;
            if (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
                if (currentBoard[tr][tc]?.color === enemyColor) moves.push({ r: tr, c: tc, capture: true });
                if (enPassantTarget && tr === enPassantTarget.r && tc === enPassantTarget.c) moves.push({ r: tr, c: tc, capture: true, enPassant: true });
            }
        }
    } else if (piece.type === 'N') {
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => addMove(r + dr, c + dc));
    } else if (piece.type === 'K') {
        [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr, dc]) => addMove(r + dr, c + dc));
        if (checkCastling && !piece.hasMoved) {
            const row = piece.color === 'w' ? 7 : 0;
            if (castlingRights[piece.color + 'K'] && !currentBoard[row][5] && !currentBoard[row][6] && currentBoard[row][7]?.type === 'R') {
                if (!isKingInCheck(piece.color, currentBoard) && !isSquareAttacked(row, 5, piece.color, currentBoard) && !isSquareAttacked(row, 6, piece.color, currentBoard)) {
                    moves.push({ r: row, c: 6, capture: false, castle: 'K' });
                }
            }
            if (castlingRights[piece.color + 'Q'] && !currentBoard[row][3] && !currentBoard[row][2] && !currentBoard[row][1] && currentBoard[row][0]?.type === 'R') {
                if (!isKingInCheck(piece.color, currentBoard) && !isSquareAttacked(row, 3, piece.color, currentBoard) && !isSquareAttacked(row, 2, piece.color, currentBoard)) {
                    moves.push({ r: row, c: 2, capture: false, castle: 'Q' });
                }
            }
        }
    } else if (['R', 'B', 'Q'].includes(piece.type)) {
        const dirs = [];
        if (['R', 'Q'].includes(piece.type)) dirs.push([0,1],[0,-1],[1,0],[-1,0]);
        if (['B', 'Q'].includes(piece.type)) dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
        dirs.forEach(([dr, dc]) => {
            let tr = r + dr, tc = c + dc;
            while (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
                if (!addMove(tr, tc)) break;
                tr += dr; tc += dc;
            }
        });
    }
    return moves;
}

function isKingInCheck(color, currentBoard) {
    let kingPos = null;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (currentBoard[r][c]?.type === 'K' && currentBoard[r][c]?.color === color) { kingPos = { r, c }; break; }
        }
        if (kingPos) break;
    }
    if (!kingPos) return true;

    const enemyColor = color === 'w' ? 'b' : 'w';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = currentBoard[r][c];
            if (p && p.color === enemyColor) {
                const moves = getPseudoLegalMoves(r, c, currentBoard, false);
                if (moves.some(m => m.r === kingPos.r && m.c === kingPos.c)) return true;
            }
        }
    }
    return false;
}

function isSquareAttacked(row, col, color, currentBoard) {
    const original = currentBoard[row][col];
    currentBoard[row][col] = { type: 'X', color: color === 'w' ? 'b' : 'w' };
    const attacked = isKingInCheck(color, currentBoard);
    currentBoard[row][col] = original;
    return attacked;
}

function hasLegalMoves(color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c]?.color === color && getLegalMoves(r, c).length > 0) return true;
        }
    }
    return false;
}

function getAlgebraicNotation(fromR, fromC, toR, toC) {
    const files = 'abcdefgh';
    const piece = board[toR][toC];
    const capture = board[toR][toC] ? 'x' : '';
    return `${piece.type}${files[fromC]}${8 - fromR}${capture}${files[toC]}${8 - toR}`;
}

initGame();
document.getElementById('btn-new-game').addEventListener('click', initGame);