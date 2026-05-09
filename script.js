const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const suitSymbols = {
    'hearts': '♥',
    'diamonds': '♦',
    'clubs': '♣',
    'spades': '♠'
};

const rankValues = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const payouts = [
    { name: 'ROYAL FLUSH', pays: [250, 500, 750, 1000, 4000], check: isRoyalFlush },
    { name: 'STRAIGHT FLUSH', pays: [50, 100, 150, 200, 250], check: isStraightFlush },
    { name: 'FOUR OF A KIND', pays: [25, 50, 75, 100, 125], check: isFourOfAKind },
    { name: 'FULL HOUSE', pays: [9, 18, 27, 36, 45], check: isFullHouse },
    { name: 'FLUSH', pays: [6, 12, 18, 24, 30], check: isFlush },
    { name: 'STRAIGHT', pays: [4, 8, 12, 16, 20], check: isStraight },
    { name: 'THREE OF A KIND', pays: [3, 6, 9, 12, 15], check: isThreeOfAKind },
    { name: 'TWO PAIR', pays: [2, 4, 6, 8, 10], check: isTwoPair },
    { name: 'JACKS OR BETTER', pays: [1, 2, 3, 4, 5], check: isJacksOrBetter }
];

let deck = [];
let hand = [null, null, null, null, null];
let held = [false, false, false, false, false];
let credits = 1000;
let bet = 5;
let state = 'IDLE'; // IDLE, DEAL1, DEAL2, GAMEOVER

// DOM Elements
const creditsDisplay = document.getElementById('credits-display');
const betDisplay = document.getElementById('bet-display');
const winDisplay = document.getElementById('win-display');
const btnDeal = document.getElementById('btn-deal');
const btnBetMin = document.getElementById('btn-bet-min');
const btnBetMax = document.getElementById('btn-bet-max');
const gameMessage = document.getElementById('game-message');
const payoutTable = document.getElementById('payout-table');

function init() {
    renderPayoutTable();
    updateDisplays();
    setupEventListeners();
    initBlackjack();
    initGoStop();
    initSeotda();
    initHoldem();
}

function renderPayoutTable() {
    let html = '<tr><th>HAND</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>';
    payouts.forEach((p, index) => {
        html += `<tr id="payout-row-${index}">
            <td>${p.name}</td>
            <td class="col-1">${p.pays[0]}</td>
            <td class="col-2">${p.pays[1]}</td>
            <td class="col-3">${p.pays[2]}</td>
            <td class="col-4">${p.pays[3]}</td>
            <td class="col-5">${p.pays[4]}</td>
        </tr>`;
    });
    payoutTable.innerHTML = html;
    highlightBetColumn();
}

function highlightBetColumn() {
    document.querySelectorAll('.payout-table td').forEach(td => {
        td.style.color = '';
        td.style.fontWeight = '';
    });
    const colIndex = bet;
    document.querySelectorAll(`.col-${colIndex}`).forEach(td => {
        td.style.color = 'var(--accent-gold)';
        td.style.fontWeight = 'bold';
    });
}

function createDeck() {
    deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ suit, rank, value: rankValues[rank] });
        }
    }
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function updateDisplays() {
    creditsDisplay.textContent = credits;
    betDisplay.textContent = bet;
    highlightBetColumn();
}

function setupEventListeners() {
    btnDeal.addEventListener('click', onDealClick);
    
    btnBetMin.addEventListener('click', () => {
        if (state !== 'IDLE') return;
        bet = bet % 5 + 1;
        updateDisplays();
    });

    btnBetMax.addEventListener('click', () => {
        if (state !== 'IDLE') return;
        bet = 5;
        updateDisplays();
        onDealClick();
    });

    for (let i = 0; i < 5; i++) {
        document.getElementById(`slot-${i}`).addEventListener('click', () => toggleHold(i));
    }
}

function toggleHold(index) {
    if (state !== 'DEAL1') return;
    held[index] = !held[index];
    playSound('select');
    const slot = document.getElementById(`slot-${index}`);
    if (held[index]) {
        slot.classList.add('held');
    } else {
        slot.classList.remove('held');
    }
}

async function onDealClick() {
    if (state === 'IDLE' || state === 'GAMEOVER') {
        if (credits < bet) {
            gameMessage.textContent = 'NOT ENOUGH CREDITS';
            return;
        }
        
        playSound('deal');
        // Start game
        state = 'DEAL1';
        credits -= bet;
        winDisplay.textContent = '0';
        updateDisplays();
        btnBetMin.disabled = true;
        btnBetMax.disabled = true;
        btnDeal.textContent = 'DRAW';
        gameMessage.textContent = 'GOOD LUCK';
        
        // Reset highlights
        document.querySelectorAll('.payout-table tr').forEach(tr => tr.classList.remove('active'));
        
        createDeck();
        shuffleDeck();
        
        held = [false, false, false, false, false];
        for (let i = 0; i < 5; i++) {
            document.getElementById(`slot-${i}`).classList.remove('held');
            hand[i] = deck.pop();
        }
        
        await renderCards(false, true);
        checkHand(true); // Auto-hold suggestions or early win preview
        gameMessage.textContent = 'SELECT CARDS TO HOLD';
        
    } else if (state === 'DEAL1') {
        playSound('deal');
        // Draw new cards
        state = 'DEAL2';
        btnDeal.disabled = true;
        
        for (let i = 0; i < 5; i++) {
            if (!held[i]) {
                hand[i] = deck.pop();
            }
        }
        
        await renderCards(true); // only flip new ones
        evaluateFinalHand();
    }
}

async function renderCards(onlyUnheld = false, initialDeal = false) {
    for (let i = 0; i < 5; i++) {
        if (onlyUnheld && held[i]) continue;
        
        const slot = document.getElementById(`slot-${i}`);
        
        // Get card HTML
        const card = hand[i];
        const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black';
        
        const cardHTML = `
            <div class="card ${initialDeal || !held[i] ? 'anim-deal' : ''}" style="animation-delay: ${i * 0.1}s">
                <div class="card-face card-back"></div>
                <div class="card-face card-front" data-color="${color}">
                    <div class="card-top"><span>${card.rank}</span><span>${suitSymbols[card.suit]}</span></div>
                    <div class="card-middle">${suitSymbols[card.suit]}</div>
                    <div class="card-bottom"><span>${card.rank}</span><span>${suitSymbols[card.suit]}</span></div>
                </div>
            </div>
        `;
        
        slot.innerHTML = `<div class="hold-indicator">HELD</div>${cardHTML}`;
        if (held[i]) slot.classList.add('held');
    }
    
    await new Promise(r => setTimeout(r, 600));
}

function evaluateFinalHand() {
    const result = checkHand(false);
    
    if (result) {
        const winAmount = result.payout.pays[bet - 1];
        credits += winAmount;
        winDisplay.textContent = winAmount;
        gameMessage.textContent = `${result.payout.name} - YOU WIN ${winAmount}!`;
        updateDisplays();
        
        // Highlight row
        document.getElementById(`payout-row-${result.index}`).classList.add('active');
        
        // Visual effect for win
        const msg = document.getElementById('game-message');
        msg.style.transform = 'scale(1.2)';
        setTimeout(() => msg.style.transform = 'scale(1)', 300);
    } else {
        gameMessage.textContent = 'GAME OVER';
    }
    
    state = 'GAMEOVER';
    btnDeal.textContent = 'PLAY AGAIN';
    btnDeal.disabled = false;
    btnBetMin.disabled = false;
    btnBetMax.disabled = false;
}

// HAND EVALUATION LOGIC
function checkHand(preview = false) {
    // Sort hand by value descending
    const sorted = [...hand].sort((a, b) => b.value - a.value);
    
    for (let i = 0; i < payouts.length; i++) {
        if (payouts[i].check(sorted)) {
            if (preview) {
                // Could highlight early
            }
            return { payout: payouts[i], index: i };
        }
    }
    return null;
}

function countGroups(sorted) {
    const counts = {};
    sorted.forEach(c => {
        counts[c.rank] = (counts[c.rank] || 0) + 1;
    });
    return Object.values(counts).sort((a, b) => b - a);
}

function isFlush(sorted) {
    return sorted.every(c => c.suit === sorted[0].suit);
}

function isStraight(sorted) {
    // Normal straight
    let straight = true;
    for (let i = 0; i < 4; i++) {
        if (sorted[i].value - 1 !== sorted[i+1].value) {
            straight = false;
            break;
        }
    }
    if (straight) return true;
    
    // Low Ace straight (A, 5, 4, 3, 2)
    if (sorted[0].rank === 'A' && sorted[1].rank === '5' && 
        sorted[2].rank === '4' && sorted[3].rank === '3' && sorted[4].rank === '2') {
        return true;
    }
    
    return false;
}

function isRoyalFlush(sorted) {
    return isFlush(sorted) && isStraight(sorted) && sorted[0].rank === 'A' && sorted[4].rank === '10';
}

function isStraightFlush(sorted) {
    return isFlush(sorted) && isStraight(sorted);
}

function isFourOfAKind(sorted) {
    const counts = countGroups(sorted);
    return counts[0] === 4;
}

function isFullHouse(sorted) {
    const counts = countGroups(sorted);
    return counts[0] === 3 && counts[1] === 2;
}

function isThreeOfAKind(sorted) {
    const counts = countGroups(sorted);
    return counts[0] === 3;
}

function isTwoPair(sorted) {
    const counts = countGroups(sorted);
    return counts[0] === 2 && counts[1] === 2;
}

function isJacksOrBetter(sorted) {
    const counts = {};
    sorted.forEach(c => {
        counts[c.rank] = (counts[c.rank] || 0) + 1;
    });
    
    for (let rank in counts) {
        if (counts[rank] === 2 && rankValues[rank] >= 11) {
            return true;
        }
    }
    return false;
}

// UI NAVIGATION LOGIC
function openMode(mode) {
    if (mode === 'single') {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-menu').classList.remove('hidden');
    } else if (mode === 'multi') {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('multi-menu').classList.remove('hidden');
        hideMultiPanels();
    }
}

function openMainMenu() {
    document.querySelectorAll('.menu-container, .game-container').forEach(container => {
        container.classList.add('hidden');
    });
    document.getElementById('main-menu').classList.remove('hidden');
}

function openGame(gameId) {
    document.querySelectorAll('.menu-container, .game-container').forEach(container => {
        container.classList.add('hidden');
    });
    
    let targetId = gameId;
    if (gameId === 'seotda3') {
        targetId = 'seotda';
        sdMode = 3;
        const el = document.getElementById('sd-game-title');
        if (el) el.textContent = '섯다 (3장)';
    } else if (gameId === 'seotda') {
        sdMode = 2;
        const el = document.getElementById('sd-game-title');
        if (el) el.textContent = '섯다 (2장)';
    }

    const gameEl = document.getElementById(targetId);
    if (gameEl) {
        gameEl.classList.remove('hidden');
        // Optional: Reset game state if entering Video Poker
        if (gameId === 'video-poker' && state === 'GAMEOVER') {
            gameMessage.textContent = 'PLACE YOUR BET';
            document.querySelectorAll('.payout-table tr').forEach(tr => tr.classList.remove('active'));
            highlightBetColumn();
            hand = [null, null, null, null, null];
            for (let i = 0; i < 5; i++) {
                const slot = document.getElementById(`slot-${i}`);
                slot.innerHTML = '<div class="card empty"></div>';
            }
            state = 'IDLE';
            btnDeal.textContent = 'DEAL';
        }
    }
}

function openMenu() {
    document.querySelectorAll('.menu-container, .game-container').forEach(container => {
        container.classList.add('hidden');
    });
    document.getElementById('game-menu').classList.remove('hidden');
}

// ------------------------------------
// BLACKJACK LOGIC
// ------------------------------------
let bjDeck = [];
let bjDealerHand = [];

// --- AUDIO LOGIC ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

// High-quality sound assets from user provided link
const cardSounds = {
    deal: new Audio('https://drive.google.com/uc?id=1PGh8ZdPlso6hN6duw-xkX_BUhc2hvDqI'),
    flip: new Audio('https://drive.google.com/uc?id=1P1H_17yAaOkI-NrdhTdTvbJycIKDCVjl'),
    select: new Audio('https://drive.google.com/uc?id=1U2NLvfESQjvoZ_sNh4BnRfY5YZMPUVMc')
};

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Global click listener to unlock audio on first interaction
document.addEventListener('click', () => {
    initAudio();
    // "Bless" the audio elements so they can be played later (even in timeouts)
    for (let key in cardSounds) {
        const s = cardSounds[key];
        if (s.paused) {
            s.play().then(() => {
                s.pause();
                s.currentTime = 0;
            }).catch(e => {});
        }
    }
}, { once: true });

function playSound(type) {
    const sound = cardSounds[type];
    if (sound) {
        sound.currentTime = 0;
        const playPromise = sound.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Fallback to legacy synthesis if audio file fails to load or play
                playLegacySound(type);
            });
        }
    } else {
        playLegacySound(type);
    }
}

function playLegacySound(type) {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        
        if (type === 'deal') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.5, now + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'select') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'flip') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(500, now + 0.1);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    } catch(e) {}
}

function playDealStaggered(count) {
    for(let i=0; i<count; i++) {
        setTimeout(() => playSound('deal'), i * 100);
    }
}
// -------------------
let bjPlayerHand = [];
let bjCredits = 1000;
let bjBet = 10;
let bjState = 'IDLE'; // IDLE, PLAYING, GAMEOVER

const bjCreditsDisplay = document.getElementById('bj-credits-display');
const bjBetDisplay = document.getElementById('bj-bet-display');
const bjDealerScoreEl = document.getElementById('bj-dealer-score');
const bjPlayerScoreEl = document.getElementById('bj-player-score');
const bjMessage = document.getElementById('bj-game-message');
const bjDealerCards = document.getElementById('bj-dealer-cards');
const bjPlayerCards = document.getElementById('bj-player-cards');

const btnBjDeal = document.getElementById('btn-bj-deal');
const btnBjHit = document.getElementById('btn-bj-hit');
const btnBjStand = document.getElementById('btn-bj-stand');
const btnBjBetMinus = document.getElementById('btn-bj-bet-minus');
const btnBjBetPlus = document.getElementById('btn-bj-bet-plus');
const bjActionControls = document.getElementById('bj-action-controls');
const bjBetControls = document.getElementById('bj-bet-controls');

function initBlackjack() {
    btnBjDeal.addEventListener('click', bjDeal);
    btnBjHit.addEventListener('click', bjHit);
    btnBjStand.addEventListener('click', bjStand);
    
    btnBjBetMinus.addEventListener('click', () => {
        if (bjState !== 'IDLE') return;
        if (bjBet > 10) bjBet -= 10;
        bjUpdateDisplays();
    });
    
    btnBjBetPlus.addEventListener('click', () => {
        if (bjState !== 'IDLE') return;
        if (bjBet + 10 <= bjCredits) bjBet += 10;
        bjUpdateDisplays();
    });
    
    bjUpdateDisplays();
}

function bjUpdateDisplays() {
    bjCreditsDisplay.textContent = bjCredits;
    bjBetDisplay.textContent = bjBet;
}

function getCardHTML(card, hidden = false) {
    if (hidden) {
        return `
        <div class="card-slot" style="width: 100px; height: 140px; margin-left: -50px; position: relative;">
            <div class="card">
                <div class="card-face card-back" style="box-shadow: -5px 0 10px rgba(0,0,0,0.5);"></div>
            </div>
        </div>`;
    }
    const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black';
    return `
    <div class="card-slot" style="width: 100px; height: 140px; margin-left: -50px; position: relative;">
        <div class="card flipped">
            <div class="card-face card-back" style="box-shadow: -5px 0 10px rgba(0,0,0,0.5);"></div>
            <div class="card-face card-front" data-color="${color}" style="box-shadow: -5px 0 10px rgba(0,0,0,0.5);">
                <div class="card-top" style="font-size: 1rem;"><span>${card.rank}</span><span>${suitSymbols[card.suit]}</span></div>
                <div class="card-middle" style="font-size: 2.5rem;">${suitSymbols[card.suit]}</div>
                <div class="card-bottom" style="font-size: 1rem;"><span>${card.rank}</span><span>${suitSymbols[card.suit]}</span></div>
            </div>
        </div>
    </div>`;
}

function bjRenderCards(hideDealerCard = false, animateLast = false, initialDeal = false) {
    bjDealerCards.innerHTML = '';
    bjDealerHand.forEach((card, i) => {
        const isHidden = (hideDealerCard && i === 1);
        bjDealerCards.innerHTML += getCardHTML(card, isHidden);
    });
    
    bjPlayerCards.innerHTML = '';
    bjPlayerHand.forEach((card, i) => {
        bjPlayerCards.innerHTML += getCardHTML(card);
    });

    // Apply animations
    if (initialDeal) {
        let delay = 0;
        bjPlayerCards.querySelectorAll('.card').forEach((el, i) => {
            el.classList.add('anim-deal');
            el.style.animationDelay = `${delay}s`;
            delay += 0.1;
        });
        bjDealerCards.querySelectorAll('.card').forEach((el, i) => {
            el.classList.add('anim-deal');
            el.style.animationDelay = `${delay}s`;
            delay += 0.1;
        });
    } else if (animateLast) {
        const cards = bjPlayerCards.querySelectorAll('.card');
        if (cards.length > 0) {
            cards[cards.length - 1].classList.add('anim-deal');
            cards[cards.length - 1].style.animationDelay = '0s';
        }
    }
    
    bjPlayerScoreEl.textContent = bjCalculateScore(bjPlayerHand);
    bjDealerScoreEl.textContent = hideDealerCard ? '?' : bjCalculateScore(bjDealerHand);
}

function bjCalculateScore(hand) {
    let score = 0;
    let aces = 0;
    
    hand.forEach(card => {
        if (['J', 'Q', 'K'].includes(card.rank)) {
            score += 10;
        } else if (card.rank === 'A') {
            aces += 1;
            score += 11;
        } else {
            score += parseInt(card.rank);
        }
    });
    
    while (score > 21 && aces > 0) {
        score -= 10;
        aces -= 1;
    }
    
    return score;
}

function bjDeal() {
    if (bjState === 'PLAYING') return;
    if (bjCredits < bjBet) {
        bjMessage.textContent = 'NOT ENOUGH CREDITS';
        return;
    }
    
    bjState = 'PLAYING';
    bjCredits -= bjBet;
    bjUpdateDisplays();
    bjMessage.textContent = 'GOOD LUCK';
    
    btnBjDeal.classList.add('hidden');
    bjActionControls.classList.remove('hidden');
    bjBetControls.style.opacity = '0.5';
    bjBetControls.style.pointerEvents = 'none';
    
    // Create & shuffle deck for BJ
    bjDeck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            bjDeck.push({ suit, rank, value: rankValues[rank] });
        }
    }
    for (let i = bjDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bjDeck[i], bjDeck[j]] = [bjDeck[j], bjDeck[i]];
    }
    
    bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
    bjDealerHand = [bjDeck.pop(), bjDeck.pop()];
    
    playDealStaggered(4);
    bjRenderCards(true, false, true);
    
    // Check for player Blackjack
    const pScore = bjCalculateScore(bjPlayerHand);
    if (pScore === 21) {
        bjEndGame(true);
    }
}

function bjHit() {
    if (bjState !== 'PLAYING') return;
    
    bjPlayerHand.push(bjDeck.pop());
    playSound('deal');
    bjRenderCards(true, true);
    
    const pScore = bjCalculateScore(bjPlayerHand);
    if (pScore > 21) {
        bjMessage.textContent = 'BUST! YOU LOSE.';
        bjEndGame(false);
    } else if (pScore === 21) {
        bjStand();
    }
}

async function bjStand() {
    if (bjState !== 'PLAYING') return;
    
    bjActionControls.classList.add('hidden');
    
    bjRenderCards(false); // Reveal dealer card
    let dScore = bjCalculateScore(bjDealerHand);
    
    // Dealer hits on soft 17 (simple logic: hits until >= 17)
    while (dScore < 17) {
        await new Promise(r => setTimeout(r, 800));
        bjDealerHand.push(bjDeck.pop());
        bjRenderCards(false);
        dScore = bjCalculateScore(bjDealerHand);
    }
    
    const pScore = bjCalculateScore(bjPlayerHand);
    
    if (dScore > 21) {
        bjMessage.textContent = 'DEALER BUSTS! YOU WIN!';
        bjCredits += bjBet * 2;
    } else if (dScore > pScore) {
        bjMessage.textContent = 'DEALER WINS!';
    } else if (dScore < pScore) {
        bjMessage.textContent = 'YOU WIN!';
        bjCredits += bjBet * 2;
    } else {
        bjMessage.textContent = 'PUSH! IT\'S A TIE.';
        bjCredits += bjBet;
    }
    
    bjEndGame(false);
}

function bjEndGame(playerBlackjack = false) {
    bjState = 'GAMEOVER';
    if (playerBlackjack) {
        const dScore = bjCalculateScore(bjDealerHand);
        if (dScore === 21) {
            bjMessage.textContent = 'PUSH! BOTH BLACKJACK.';
            bjCredits += bjBet;
        } else {
            bjMessage.textContent = 'BLACKJACK! YOU WIN 3:2!';
            bjCredits += bjBet + (bjBet * 1.5);
        }
        bjRenderCards(false);
    }
    
    bjUpdateDisplays();
    
    setTimeout(() => {
        btnBjDeal.classList.remove('hidden');
        btnBjDeal.textContent = 'PLAY AGAIN';
        bjActionControls.classList.add('hidden');
        bjBetControls.style.opacity = '1';
        bjBetControls.style.pointerEvents = 'all';
    }, 1000);
}

// ------------------------------------
// GO-STOP (HWATU) LOGIC (Simplified)
// ------------------------------------
let gsDeck = [];
let gsBoard = [];
let gsPlayerHand = [];
let gsComHand = [];
let gsPlayerCol = { kwang: [], yul: [], dan: [], pi: [] };
let gsComCol = { kwang: [], yul: [], dan: [], pi: [] };

let gsPlayerScore = 0;
let gsComScore = 0;
let gsTurn = 'PLAYER'; // PLAYER, COM
let gsState = 'IDLE';

const gsMonthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const gsCardDefs = [
    ['kwang', 'dan', 'pi', 'pi'], // 1
    ['yul', 'dan', 'pi', 'pi'], // 2
    ['kwang', 'dan', 'pi', 'pi'], // 3
    ['yul', 'dan', 'pi', 'pi'], // 4
    ['yul', 'dan', 'pi', 'pi'], // 5
    ['yul', 'dan', 'pi', 'pi'], // 6
    ['yul', 'dan', 'pi', 'pi'], // 7
    ['kwang', 'yul', 'pi', 'pi'], // 8
    ['yul', 'dan', 'pi', 'pi'], // 9
    ['yul', 'dan', 'pi', 'pi'], // 10
    ['kwang', 'pi', 'pi', 'pi'], // 11
    ['kwang', 'yul', 'dan', 'pi'] // 12
];

function initGoStop() {
    document.getElementById('btn-gs-start').addEventListener('click', gsStartGame);
    // Go / Stop buttons would go here in a full implementation, for now auto-stop on 3 points.
}

function gsCreateDeck() {
    let id = 0;
    const deck = [];
    for (let m = 0; m < 12; m++) {
        for (let i = 0; i < 4; i++) {
            deck.push({
                id: id++,
                month: m + 1,
                type: gsCardDefs[m][i],
                imgIndex: i + 1
            });
        }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function gsStartGame() {
    gsDeck = gsCreateDeck();
    gsBoard = [];
    gsPlayerHand = [];
    gsComHand = [];
    gsPlayerCol = { kwang: [], yul: [], dan: [], pi: [] };
    gsComCol = { kwang: [], yul: [], dan: [], pi: [] };
    gsPlayerScore = 0;
    gsComScore = 0;
    gsTurn = 'PLAYER';
    gsState = 'PLAYING';

    document.getElementById('btn-gs-start').classList.add('hidden');
    document.getElementById('gs-game-message').textContent = 'YOUR TURN (Select a card to play)';

    // Deal 10 to each, 8 to board
    for (let i = 0; i < 10; i++) {
        gsPlayerHand.push(gsDeck.pop());
        gsComHand.push(gsDeck.pop());
    }
    for (let i = 0; i < 8; i++) {
        gsBoard.push(gsDeck.pop());
    }

    gsSortHand(gsPlayerHand);
    playDealStaggered(15);
    gsRender(true);
}

function gsSortHand(hand) {
    hand.sort((a, b) => a.month - b.month);
}

function gsRenderCard(card, isHidden = false, onClick = null, animateIndex = -1) {
    const el = document.createElement('div');
    if (animateIndex >= 0) {
        el.classList.add('anim-deal');
        el.style.animationDelay = `${animateIndex * 0.05}s`;
    }
    if (isHidden) {
        el.className = `gs-card back ${animateIndex >= 0 ? 'anim-deal' : ''}`;
    } else {
        el.className = `gs-card ${card.type} ${animateIndex >= 0 ? 'anim-deal' : ''}`;
        const mStr = card.month < 10 ? '0' + card.month : card.month;
        const imgUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/Hwatu_${mStr}-${card.imgIndex}.svg`;
        el.innerHTML = `
            <img src="${imgUrl}" class="hwatu-img" onerror="this.style.display='none'">
            <div class="month" style="position: relative; z-index: 2;">${card.month}</div>
            <div class="type" style="position: relative; z-index: 2;">${getTypeName(card.type)}</div>
        `;
    }
    if (onClick && !isHidden) {
        el.onclick = () => onClick(card);
    }
    return el;
}

function getTypeName(type) {
    switch (type) {
        case 'kwang': return '광';
        case 'yul': return '열';
        case 'dan': return '띠';
        case 'pi': return '피';
    }
}

function gsRender(initialDeal = false) {
    // Deck
    document.getElementById('gs-deck-count').textContent = gsDeck.length;

    // Board
    const boardEl = document.getElementById('gs-board');
    boardEl.innerHTML = '';
    gsBoard.forEach((card, i) => {
        boardEl.appendChild(gsRenderCard(card, false, null, initialDeal ? i : -1));
    });

    // Player Hand
    const pHandEl = document.getElementById('gs-player-hand');
    pHandEl.innerHTML = '';
    gsPlayerHand.forEach((card, i) => {
        pHandEl.appendChild(gsRenderCard(card, false, gsPlayPlayerCard, initialDeal ? gsBoard.length + i : -1));
    });

    // Com Hand
    const cHandEl = document.getElementById('gs-com-hand');
    cHandEl.innerHTML = '';
    gsComHand.forEach(card => {
        cHandEl.appendChild(gsRenderCard(card, true));
    });

    // Collected
    ['kwang', 'yul', 'dan', 'pi'].forEach(type => {
        const pCol = document.getElementById(`player-${type}`);
        pCol.innerHTML = '';
        gsPlayerCol[type].forEach(c => pCol.appendChild(gsRenderCard(c)));

        const cCol = document.getElementById(`com-${type}`);
        cCol.innerHTML = '';
        gsComCol[type].forEach(c => cCol.appendChild(gsRenderCard(c)));
    });

    // Scores
    document.getElementById('gs-player-score').textContent = gsPlayerScore;
    document.getElementById('gs-com-score').textContent = gsComScore;
}

async function gsPlayPlayerCard(card) {
    if (gsTurn !== 'PLAYER' || gsState !== 'PLAYING') return;
    playSound('select');
    gsTurn = 'RESOLVING';

    // Remove from hand
    gsPlayerHand = gsPlayerHand.filter(c => c.id !== card.id);
    
    await gsResolvePlay(card, gsPlayerCol);
    
    gsPlayerScore = gsCalcScore(gsPlayerCol);
    gsRender();
    
    if (gsPlayerScore >= 3) {
        document.getElementById('gs-game-message').textContent = 'YOU WIN!';
        gsState = 'GAMEOVER';
        document.getElementById('btn-gs-start').classList.remove('hidden');
        document.getElementById('btn-gs-start').textContent = 'PLAY AGAIN';
        return;
    }

    if (gsPlayerHand.length === 0 && gsDeck.length === 0) {
        document.getElementById('gs-game-message').textContent = 'DRAW!';
        gsState = 'GAMEOVER';
        document.getElementById('btn-gs-start').classList.remove('hidden');
        return;
    }

    gsTurn = 'COM';
    document.getElementById('gs-game-message').textContent = 'COM TURN...';
    setTimeout(gsComPlay, 1000);
}

async function gsComPlay() {
    if (gsState !== 'PLAYING') return;

    // AI: find a card that matches the board, else play random
    let cardToPlay = null;
    for (let c of gsComHand) {
        if (gsBoard.some(bc => bc.month === c.month)) {
            cardToPlay = c; break;
        }
    }
    if (!cardToPlay) {
        cardToPlay = gsComHand[Math.floor(Math.random() * gsComHand.length)];
    }

    gsComHand = gsComHand.filter(c => c.id !== cardToPlay.id);
    
    await gsResolvePlay(cardToPlay, gsComCol);
    
    gsComScore = gsCalcScore(gsComCol);
    gsRender();

    if (gsComScore >= 3) {
        document.getElementById('gs-game-message').textContent = 'COM WINS!';
        gsState = 'GAMEOVER';
        document.getElementById('btn-gs-start').classList.remove('hidden');
        document.getElementById('btn-gs-start').textContent = 'PLAY AGAIN';
        return;
    }

    gsTurn = 'PLAYER';
    document.getElementById('gs-game-message').textContent = 'YOUR TURN';
}

async function gsResolvePlay(playedCard, colArea) {
    const collected = [];
    
    // 1. Play card to board and match
    let boardMatches = gsBoard.filter(c => c.month === playedCard.month);
    
    if (boardMatches.length > 0) {
        collected.push(playedCard);
        collected.push(boardMatches[0]);
        gsBoard = gsBoard.filter(c => c.id !== boardMatches[0].id);
    } else {
        gsBoard.push(playedCard);
    }
    gsRender();
    await new Promise(r => setTimeout(r, 600));

    // 2. Turn deck card
    if (gsDeck.length > 0) {
        const deckCard = gsDeck.pop();
        let deckMatches = gsBoard.filter(c => c.month === deckCard.month);
        
        if (deckMatches.length > 0) {
            collected.push(deckCard);
            collected.push(deckMatches[0]);
            gsBoard = gsBoard.filter(c => c.id !== deckMatches[0].id);
        } else {
            gsBoard.push(deckCard);
        }
    }
    gsRender();
    await new Promise(r => setTimeout(r, 600));

    // 3. Move collected to area
    collected.forEach(c => {
        colArea[c.type].push(c);
    });
}

function gsCalcScore(col) {
    let score = 0;
    
    // Kwang: 3=3pt, 4=4pt, 5=15pt (simplified)
    if (col.kwang.length === 5) score += 15;
    else if (col.kwang.length === 4) score += 4;
    else if (col.kwang.length === 3) score += 3;

    // Yul: 5=1pt, +1 each extra
    if (col.yul.length >= 5) score += (col.yul.length - 4);
    
    // Dan: 5=1pt, +1 each extra
    if (col.dan.length >= 5) score += (col.dan.length - 4);
    
    // Pi: 10=1pt, +1 each extra
    if (col.pi.length >= 10) score += (col.pi.length - 9);

    return score;
}

// ------------------------------------
// SEOTDA LOGIC
// ------------------------------------
let sdDeck = [];
let sdPlayerHand = [];
let sdComHand = [];
let sdCredits = 1000;
let sdBet = 50;
let sdPot = 0;
let sdState = 'IDLE';
let sdMode = 2;

const sdCreditsDisplay = document.getElementById('sd-credits-display');
const sdBetDisplay = document.getElementById('sd-bet-display');
const sdPotDisplay = document.getElementById('sd-pot-display');
const sdMessage = document.getElementById('sd-game-message');

const btnSdDeal = document.getElementById('btn-sd-deal');
const btnSdDie = document.getElementById('btn-sd-die');
const btnSdCall = document.getElementById('btn-sd-call');
const btnSdHalf = document.getElementById('btn-sd-half');
const sdActionControls = document.getElementById('sd-action-controls');
const sdBetControls = document.getElementById('sd-bet-controls');

function initSeotda() {
    btnSdDeal.addEventListener('click', sdDeal);
    btnSdDie.addEventListener('click', () => sdAction('DIE'));
    btnSdCall.addEventListener('click', () => sdAction('CALL'));
    btnSdHalf.addEventListener('click', () => sdAction('HALF'));
    
    document.getElementById('btn-sd-bet-minus').addEventListener('click', () => {
        if (sdState !== 'IDLE') return;
        if (sdBet > 50) sdBet -= 50;
        sdUpdateDisplays();
    });
    
    document.getElementById('btn-sd-bet-plus').addEventListener('click', () => {
        if (sdState !== 'IDLE') return;
        if (sdBet + 50 <= sdCredits) sdBet += 50;
        sdUpdateDisplays();
    });
    
    sdUpdateDisplays();
}

function sdUpdateDisplays() {
    sdCreditsDisplay.textContent = sdCredits;
    sdBetDisplay.textContent = sdBet;
    sdPotDisplay.textContent = sdPot;
}

function sdCreateDeck() {
    const deck = [];
    const seotdaDefs = [
        [{type: 'kwang', i: 1}, {type: 'pi', i: 2}], // 1
        [{type: 'pi', i: 1}, {type: 'pi', i: 2}],    // 2
        [{type: 'kwang', i: 1}, {type: 'pi', i: 2}], // 3
        [{type: 'pi', i: 1}, {type: 'pi', i: 2}],    // 4
        [{type: 'pi', i: 1}, {type: 'pi', i: 2}],    // 5
        [{type: 'pi', i: 1}, {type: 'pi', i: 2}],    // 6
        [{type: 'pi', i: 1}, {type: 'pi', i: 2}],    // 7
        [{type: 'kwang', i: 1}, {type: 'pi', i: 2}], // 8
        [{type: 'pi', i: 1}, {type: 'pi', i: 2}],    // 9
        [{type: 'pi', i: 1}, {type: 'pi', i: 2}]     // 10
    ];
    for (let m = 0; m < 10; m++) {
        deck.push({ month: m + 1, type: seotdaDefs[m][0].type, imgIndex: seotdaDefs[m][0].i });
        deck.push({ month: m + 1, type: seotdaDefs[m][1].type, imgIndex: seotdaDefs[m][1].i });
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function sdRenderCards(hideCom = true, initialDeal = false) {
    const pArea = document.getElementById('sd-player-cards');
    pArea.innerHTML = '';
    sdPlayerHand.forEach((card, idx) => {
        let animIdx = -1;
        if (initialDeal) {
            if (sdState === 'SELECT_OPEN' || sdState === 'PLAYING') animIdx = idx;
            else if (idx === 2) animIdx = 0;
        }
        const onClick = (sdMode === 3 && sdState === 'SELECT_OPEN') ? () => sdOpenCard(idx) : null;
        const cardEl = gsRenderCard(card, false, onClick, animIdx);
        if (sdMode === 3 && sdState === 'SELECT_OPEN') {
            cardEl.style.cursor = 'pointer';
            cardEl.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.5)';
        }
        pArea.appendChild(cardEl);
    });

    const cArea = document.getElementById('sd-com-cards');
    cArea.innerHTML = '';
    sdComHand.forEach((card, idx) => {
        let animIdx = -1;
        if (initialDeal) {
            if (sdState === 'SELECT_OPEN' || sdState === 'PLAYING') animIdx = sdPlayerHand.length + idx;
            else if (idx === 2) animIdx = 1;
        }
        const isHidden = hideCom && !card.isOpen && sdState !== 'GAMEOVER';
        cArea.appendChild(gsRenderCard(card, isHidden, null, animIdx));
    });

    if (sdMode === 3 && sdState === 'SELECT_OPEN') {
        document.getElementById('sd-player-score').textContent = '1장을 선택해 오픈하세요';
        document.getElementById('sd-com-score').textContent = '?';
    } else {
        document.getElementById('sd-player-score').textContent = sdGetScoreName(sdPlayerHand);
        document.getElementById('sd-com-score').textContent = hideCom ? '?' : sdGetScoreName(sdComHand);
    }
}

function sdOpenCard(idx) {
    if (sdMode !== 3 || sdState !== 'SELECT_OPEN') return;
    playSound('flip');
    sdPlayerHand[idx].isOpen = true;
    
    // AI randomly opens one card
    const aiOpenIdx = Math.floor(Math.random() * 2);
    sdComHand[aiOpenIdx].isOpen = true;

    sdState = 'BETTING_ROUND1';
    sdMessage.textContent = 'POT: ' + sdPot + ' - FIRST BETTING ROUND';
    sdActionControls.classList.remove('hidden');
    sdRenderCards(true, false);
}

function sdEvaluateHand(hand) {
    if (hand.length === 3) {
        const combs = [
            [hand[0], hand[1]],
            [hand[0], hand[2]],
            [hand[1], hand[2]]
        ];
        let bestScoreObj = { val: -1, name: '' };
        combs.forEach(comb => {
            const scoreObj = sdEvaluate2Cards(comb);
            if (scoreObj.val > bestScoreObj.val) {
                bestScoreObj = scoreObj;
            }
        });
        return bestScoreObj;
    }
    return sdEvaluate2Cards(hand);
}

function sdEvaluate2Cards(hand) {
    const m1 = hand[0].month;
    const m2 = hand[1].month;
    const t1 = hand[0].type;
    const t2 = hand[1].type;
    const m = [m1, m2].sort((a,b) => a-b);
    
    // Gwangdding
    if (t1 === 'kwang' && t2 === 'kwang') {
        if (m[0] === 3 && m[1] === 8) return { val: 1000, name: '38 광땡' };
        if (m[0] === 1 && m[1] === 8) return { val: 900, name: '18 광땡' };
        if (m[0] === 1 && m[1] === 3) return { val: 800, name: '13 광땡' };
    }
    
    // Ttaeng (땡)
    if (m1 === m2) {
        if (m1 === 10) return { val: 110, name: '장땡' };
        return { val: 100 + m1, name: `${m1}땡` };
    }
    
    // Special combos
    if (m[0] === 1 && m[1] === 2) return { val: 90, name: '알리' };
    if (m[0] === 1 && m[1] === 4) return { val: 89, name: '독사' };
    if (m[0] === 1 && m[1] === 9) return { val: 88, name: '구삥' };
    if (m[0] === 4 && m[1] === 10) return { val: 87, name: '장사' };
    if (m[0] === 4 && m[1] === 6) return { val: 86, name: '세륙' };
    
    // Kkeut (끗)
    const sum = (m1 + m2) % 10;
    if (sum === 9) return { val: 9, name: '갑오' };
    if (sum === 0) return { val: 0, name: '망통' };
    return { val: sum, name: `${sum}끗` };
}

function sdGetScoreName(hand) {
    if (!hand || hand.length < 2) return '';
    return sdEvaluateHand(hand).name;
}

function sdDeal() {
    if (sdCredits < sdBet * 2) { // Need at least base bet to play
        sdMessage.textContent = 'NOT ENOUGH CREDITS';
        return;
    }
    
    sdState = 'PLAYING';
    sdCredits -= sdBet; // Ante
    sdPot = sdBet * 2; // Assume Com matches ante
    sdUpdateDisplays();
    sdMessage.textContent = 'POT: ' + sdPot + ' - SELECT ACTION';
    
    btnSdDeal.classList.add('hidden');
    sdActionControls.classList.remove('hidden');
    sdBetControls.style.opacity = '0.5';
    sdBetControls.style.pointerEvents = 'none';
    
    sdDeck = sdCreateDeck();
    if (sdMode === 3) {
        sdPlayerHand = [sdDeck.pop(), sdDeck.pop()];
        sdComHand = [sdDeck.pop(), sdDeck.pop()];
        sdState = 'SELECT_OPEN';
        sdMessage.textContent = 'SELECT 1 CARD TO OPEN (1장을 선택해 오픈하세요)';
        playDealStaggered(4);
        sdRenderCards(true, true);
        btnSdDeal.classList.add('hidden');
    } else {
        sdPlayerHand = [sdDeck.pop(), sdDeck.pop()];
        sdComHand = [sdDeck.pop(), sdDeck.pop()];
        sdState = 'PLAYING';
        sdMessage.textContent = 'POT: ' + sdPot + ' - SELECT ACTION';
        btnSdDeal.classList.add('hidden');
        sdActionControls.classList.remove('hidden');
        playDealStaggered(4);
        sdRenderCards(true, true);
    }
}

async function sdAction(action) {
    if (sdState !== 'PLAYING' && sdState !== 'BETTING_ROUND1' && sdState !== 'BETTING_ROUND2') return;

    if (action === 'DIE') {
        sdMessage.textContent = 'YOU FOLDED. COM WINS THE POT.';
        sdEndGame(false);
        return;
    }

    let addedBet = 0;
    if (action === 'HALF') {
        addedBet = Math.floor(sdPot / 2);
        if (sdCredits < addedBet) {
            sdMessage.textContent = 'NOT ENOUGH CREDITS FOR HALF';
            return;
        }
        sdMessage.textContent = 'YOU RAISED HALF. COM IS THINKING...';
    } else if (action === 'CALL') {
        addedBet = sdBet;
        sdMessage.textContent = 'YOU CALLED. COM IS THINKING...';
    }

    sdCredits -= addedBet;
    sdPot += addedBet;
    sdUpdateDisplays();

    // Hide actions while COM thinks
    sdActionControls.classList.add('hidden');

    await new Promise(r => setTimeout(r, 1000));

    // COM simple AI
    const cScore = sdEvaluateHand(sdComHand).val;
    
    // AI decision
    if (cScore < 3 && action === 'HALF' && Math.random() > 0.3) {
        if (sdState !== 'BETTING_ROUND1') {
            // AI folds
            sdMessage.textContent = 'COM FOLDS. YOU WIN THE POT!';
            sdCredits += sdPot;
            sdEndGame(true);
            return;
        }
    }

    // AI calls
    sdPot += addedBet; // AI matches the player's bet
    sdUpdateDisplays();
    sdMessage.textContent = 'COM CALLS!';
    
    await new Promise(r => setTimeout(r, 1000));

    if (sdMode === 3 && sdState === 'BETTING_ROUND1') {
        sdState = 'BETTING_ROUND2';
        sdPlayerHand.push(sdDeck.pop());
        sdComHand.push(sdDeck.pop());
        sdMessage.textContent = 'POT: ' + sdPot + ' - FINAL BETTING ROUND';
        playSound('deal');
        setTimeout(() => playSound('deal'), 100);
        sdRenderCards(true, true);
        sdActionControls.classList.remove('hidden');
        return;
    }

    // SHOWDOWN
    sdMessage.textContent = 'SHOWDOWN!';
    sdRenderCards(false, false);
    
    const pScoreObj = sdEvaluateHand(sdPlayerHand);
    const cScoreObj = sdEvaluateHand(sdComHand);
    
    if (pScoreObj.val > cScoreObj.val) {
        sdMessage.textContent = `YOU WIN WITH ${pScoreObj.name}!`;
        sdCredits += sdPot;
    } else if (pScoreObj.val < cScoreObj.val) {
        sdMessage.textContent = `COM WINS WITH ${cScoreObj.name}!`;
    } else {
        sdMessage.textContent = 'TIE (DRAW)! POT IS SPLIT.';
        sdCredits += Math.floor(sdPot / 2);
    }
    
    sdEndGame(true);
}

function sdEndGame(showCards) {
    sdState = 'GAMEOVER';
    if (showCards) sdRenderCards(false);
    
    sdPot = 0;
    sdUpdateDisplays();
    
    setTimeout(() => {
        btnSdDeal.classList.remove('hidden');
        btnSdDeal.textContent = 'PLAY AGAIN';
        sdActionControls.classList.add('hidden');
        sdBetControls.style.opacity = '1';
        sdBetControls.style.pointerEvents = 'all';
    }, 1500);
}

// ------------------------------------
// TEXAS HOLD'EM LOGIC
// ------------------------------------
let thDeck = [];
let thPlayerHole = [];
let thComHole = [];
let thBoard = [];
let thCredits = 1000;
let thPot = 0;
let thRaiseAmt = 50;
let thState = 'IDLE'; // IDLE, PREFLOP, FLOP, TURN, RIVER, SHOWDOWN
let thCurrentBet = 0; // The current amount needed to call
let thPlayerBet = 0; // Amount player has put in this round
let thComBet = 0;

const thCreditsDisplay = document.getElementById('th-credits-display');
const thPotDisplay = document.getElementById('th-pot-display');
const thRaiseDisplay = document.getElementById('th-raise-amount');
const thMessage = document.getElementById('th-game-message');

const btnThDeal = document.getElementById('btn-th-deal');
const btnThFold = document.getElementById('btn-th-fold');
const btnThCheckCall = document.getElementById('btn-th-check-call');
const btnThRaise = document.getElementById('btn-th-raise');
const thActionControls = document.getElementById('th-action-controls');
const thBetControls = document.getElementById('th-bet-controls');

function initHoldem() {
    btnThDeal.addEventListener('click', thDeal);
    btnThFold.addEventListener('click', () => thAction('FOLD'));
    btnThCheckCall.addEventListener('click', () => thAction('CALL'));
    btnThRaise.addEventListener('click', () => thAction('RAISE'));
    
    document.getElementById('btn-th-raise-minus').addEventListener('click', () => {
        if (thState === 'IDLE' || thState === 'SHOWDOWN') return;
        if (thRaiseAmt > 50) thRaiseAmt -= 50;
        thRaiseDisplay.textContent = thRaiseAmt;
    });
    
    document.getElementById('btn-th-raise-plus').addEventListener('click', () => {
        if (thState === 'IDLE' || thState === 'SHOWDOWN') return;
        if (thRaiseAmt + 50 <= thCredits) thRaiseAmt += 50;
        thRaiseDisplay.textContent = thRaiseAmt;
    });
    
    thUpdateDisplays();
}

function thUpdateDisplays() {
    thCreditsDisplay.textContent = thCredits;
    thPotDisplay.textContent = thPot;
}

function getThCardHTML(card, hidden = false, animateIndex = -1) {
    const animStyle = animateIndex >= 0 ? `animation-delay: ${animateIndex * 0.1}s;` : '';
    const animClass = animateIndex >= 0 ? 'anim-deal' : '';
    
    if (hidden) {
        return `
        <div class="card-slot" style="width: 100px; height: 140px; position: relative;">
            <div class="card ${animClass}" style="box-shadow: 0 5px 10px rgba(0,0,0,0.5); ${animStyle}">
                <div class="card-face card-back" style="box-shadow: 0 5px 10px rgba(0,0,0,0.5);"></div>
            </div>
        </div>`;
    }
    const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black';
    return `
    <div class="card-slot" style="width: 100px; height: 140px; position: relative;">
        <div class="card flipped ${animClass}" style="${animStyle}">
            <div class="card-face card-back" style="box-shadow: 0 5px 10px rgba(0,0,0,0.5);"></div>
            <div class="card-face card-front" data-color="${color}" style="box-shadow: 0 5px 10px rgba(0,0,0,0.5);">
                <div class="card-top" style="font-size: 1rem;"><span>${card.rank}</span><span>${suitSymbols[card.suit]}</span></div>
                <div class="card-middle" style="font-size: 2.5rem;">${suitSymbols[card.suit]}</div>
                <div class="card-bottom" style="font-size: 1rem;"><span>${card.rank}</span><span>${suitSymbols[card.suit]}</span></div>
            </div>
        </div>
    </div>`;
}

function thRenderBoard(animateCount = 0) {
    for (let i = 0; i < 5; i++) {
        const slot = document.getElementById(`th-board-${i}`);
        if (i < thBoard.length) {
            const isNewCard = (i >= thBoard.length - animateCount);
            // We only want the inner contents to avoid nested card-slots, so we do string replacement
            // BUT, our getThCardHTML returns a wrapper. We can safely inject it and strip the outer wrapper logic
            const rawHtml = getThCardHTML(thBoard[i], false, isNewCard ? i : -1);
            // Simple approach: grab the inner div.card
            const match = rawHtml.match(/<div class="card[^>]*>[\s\S]*<\/div>\s*<\/div>$/m);
            if (match) {
                // To keep it simple, we just set innerHTML to the whole thing and replace the outer slot class
                slot.innerHTML = rawHtml.replace('class="card-slot"', 'class="card-slot" style="display:contents;"');
            } else {
                slot.innerHTML = rawHtml.replace('card-slot', '');
            }
        } else {
            slot.innerHTML = '<div class="card empty"></div>';
        }
    }
}

function thRenderHands(hideCom = true, initialDeal = false) {
    const pArea = document.getElementById('th-player-cards');
    pArea.innerHTML = '';
    thPlayerHole.forEach((card, i) => pArea.innerHTML += getThCardHTML(card, false, initialDeal ? i : -1));

    const cArea = document.getElementById('th-com-cards');
    cArea.innerHTML = '';
    thComHole.forEach((card, i) => cArea.innerHTML += getThCardHTML(card, hideCom, initialDeal ? thPlayerHole.length + i : -1));
    
    // Evaluate if not preflop
    if (thBoard.length >= 3) {
        const pEval = thEvaluate7Cards([...thPlayerHole, ...thBoard]);
        document.getElementById('th-player-score').textContent = pEval.name;
        if (!hideCom) {
            const cEval = thEvaluate7Cards([...thComHole, ...thBoard]);
            document.getElementById('th-com-score').textContent = cEval.name;
        } else {
            document.getElementById('th-com-score').textContent = '?';
        }
    } else {
        document.getElementById('th-player-score').textContent = 'Hole Cards';
        document.getElementById('th-com-score').textContent = '?';
    }
}

function thDeal() {
    if (thCredits < 10) {
        thMessage.textContent = 'NOT ENOUGH CREDITS FOR ANTE (10)';
        return;
    }
    
    thState = 'PREFLOP';
    thCredits -= 10;
    thPot = 20; // Assume Com matches ante 10
    thPlayerBet = 10;
    thComBet = 10;
    thCurrentBet = 10;
    
    thUpdateDisplays();
    thMessage.textContent = 'PREFLOP - SELECT ACTION';
    document.getElementById('th-com-action').textContent = '';
    
    btnThDeal.classList.add('hidden');
    thActionControls.classList.remove('hidden');
    thBetControls.style.opacity = '1';
    thBetControls.style.pointerEvents = 'all';
    
    // Create & shuffle deck
    thDeck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            thDeck.push({ suit, rank, value: rankValues[rank] });
        }
    }
    for (let i = thDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [thDeck[i], thDeck[j]] = [thDeck[j], thDeck[i]];
    }
    
    thPlayerHole = [thDeck.pop(), thDeck.pop()];
    thComHole = [thDeck.pop(), thDeck.pop()];
    thBoard = [];
    
    playDealStaggered(4);
    thRenderHands(true, true);
    thRenderBoard();
    updateThButtons();
}

function updateThButtons() {
    const toCall = thCurrentBet - thPlayerBet;
    btnThCheckCall.textContent = toCall > 0 ? `CALL ${toCall}` : 'CHECK';
}

async function thAction(action) {
    if (thState === 'IDLE' || thState === 'SHOWDOWN') return;

    if (action === 'FOLD') {
        thMessage.textContent = 'YOU FOLDED. COM WINS THE POT.';
        thEndGame(false);
        return;
    }

    const toCall = thCurrentBet - thPlayerBet;

    if (action === 'CALL') {
        if (thCredits < toCall) {
            thMessage.textContent = 'NOT ENOUGH CREDITS TO CALL';
            return;
        }
        thCredits -= toCall;
        thPot += toCall;
        thPlayerBet += toCall;
        thMessage.textContent = toCall > 0 ? 'YOU CALLED. COM THINKS...' : 'YOU CHECKED. COM THINKS...';
    } else if (action === 'RAISE') {
        const raiseTotal = toCall + thRaiseAmt;
        if (thCredits < raiseTotal) {
            thMessage.textContent = 'NOT ENOUGH CREDITS TO RAISE';
            return;
        }
        thCredits -= raiseTotal;
        thPot += raiseTotal;
        thPlayerBet += raiseTotal;
        thCurrentBet = thPlayerBet;
        thMessage.textContent = `YOU RAISED ${thRaiseAmt}. COM THINKS...`;
    }

    thUpdateDisplays();
    thActionControls.classList.add('hidden');

    await new Promise(r => setTimeout(r, 1000));

    // COM AI Logic (Very Simple)
    let cToCall = thCurrentBet - thComBet;
    let cAction = '';

    if (cToCall > 0) {
        // Decide to fold, call, or raise
        const rand = Math.random();
        if (rand < 0.2 && cToCall > 20) {
            cAction = 'FOLD';
        } else {
            cAction = 'CALL';
            thComBet += cToCall;
            thPot += cToCall;
        }
    } else {
        // Check or Raise
        if (Math.random() < 0.2) {
            cAction = 'RAISE';
            const cRaise = 50;
            thComBet += cRaise;
            thPot += cRaise;
            thCurrentBet = thComBet;
        } else {
            cAction = 'CHECK';
        }
    }

    document.getElementById('th-com-action').textContent = cAction;
    thUpdateDisplays();

    if (cAction === 'FOLD') {
        thMessage.textContent = 'COM FOLDS. YOU WIN!';
        thCredits += thPot;
        thEndGame(false);
        return;
    }

    if (cAction === 'RAISE') {
        thMessage.textContent = `COM RAISES 50. ACTION TO YOU.`;
        thActionControls.classList.remove('hidden');
        updateThButtons();
        return; // Wait for player to respond
    }

    // Both matched bets -> next stage
    await new Promise(r => setTimeout(r, 1000));
    thNextStage();
}

function thNextStage() {
    document.getElementById('th-com-action').textContent = '';
    thPlayerBet = 0;
    thComBet = 0;
    thCurrentBet = 0;

    let animateCount = 0;
    if (thState === 'PREFLOP') {
        thState = 'FLOP';
        thBoard.push(thDeck.pop(), thDeck.pop(), thDeck.pop());
        thMessage.textContent = 'FLOP - YOUR ACTION';
        animateCount = 3;
    } else if (thState === 'FLOP') {
        thState = 'TURN';
        thBoard.push(thDeck.pop());
        thMessage.textContent = 'TURN - YOUR ACTION';
        animateCount = 1;
    } else if (thState === 'TURN') {
        thState = 'RIVER';
        thBoard.push(thDeck.pop());
        thMessage.textContent = 'RIVER - YOUR ACTION';
        animateCount = 1;
    } else if (thState === 'RIVER') {
        thShowdown();
        return;
    }

    if (animateCount > 0) playDealStaggered(animateCount);
    thRenderBoard(animateCount);
    thRenderHands(true);
    thActionControls.classList.remove('hidden');
    updateThButtons();
}

function thShowdown() {
    thState = 'SHOWDOWN';
    thRenderHands(false); // Reveal COM
    
    const pEval = thEvaluate7Cards([...thPlayerHole, ...thBoard]);
    const cEval = thEvaluate7Cards([...thComHole, ...thBoard]);
    
    if (pEval.score > cEval.score) {
        thMessage.textContent = `YOU WIN WITH ${pEval.name}!`;
        thCredits += thPot;
    } else if (pEval.score < cEval.score) {
        thMessage.textContent = `COM WINS WITH ${cEval.name}!`;
    } else {
        thMessage.textContent = `SPLIT POT! TIE WITH ${pEval.name}`;
        thCredits += Math.floor(thPot / 2);
    }
    
    thEndGame(true);
}

function thEndGame(showdown) {
    thState = 'SHOWDOWN';
    thUpdateDisplays();
    
    setTimeout(() => {
        btnThDeal.classList.remove('hidden');
        btnThDeal.textContent = 'PLAY AGAIN';
        thActionControls.classList.add('hidden');
    }, 2000);
}

// Evaluate best 5 cards out of 7
function getCombinations(array, size) {
    const result = [];
    function p(t, i) {
        if (t.length === size) {
            result.push(t);
            return;
        }
        if (i + 1 <= array.length) {
            p(t.concat(array[i]), i + 1);
            p(t, i + 1);
        }
    }
    p([], 0);
    return result;
}

function thEvaluate7Cards(cards7) {
    const combs = getCombinations(cards7, 5);
    let bestScore = -1;
    let bestName = '';
    
    combs.forEach(comb => {
        const sorted = [...comb].sort((a, b) => b.value - a.value);
        let score = 0;
        let name = '';
        
        if (isRoyalFlush(sorted)) { score = 9000; name = 'Royal Flush'; }
        else if (isStraightFlush(sorted)) { score = 8000 + sorted[0].value; name = 'Straight Flush'; }
        else if (isFourOfAKind(sorted)) { score = 7000 + getGroupVal(sorted, 4); name = 'Four of a Kind'; }
        else if (isFullHouse(sorted)) { score = 6000 + getGroupVal(sorted, 3); name = 'Full House'; }
        else if (isFlush(sorted)) { score = 5000 + sorted[0].value; name = 'Flush'; }
        else if (isStraight(sorted)) { score = 4000 + sorted[0].value; name = 'Straight'; }
        else if (isThreeOfAKind(sorted)) { score = 3000 + getGroupVal(sorted, 3); name = 'Three of a Kind'; }
        else if (isTwoPair(sorted)) { score = 2000 + getGroupVal(sorted, 2); name = 'Two Pair'; }
        else if (isJacksOrBetter(sorted) || getGroupVal(sorted, 2) > 0) { score = 1000 + getGroupVal(sorted, 2); name = 'Pair'; }
        else { score = sorted[0].value; name = 'High Card ' + sorted[0].rank; }
        
        // Add kickers weight for tie-breaking
        for (let i = 0; i < 5; i++) {
            score += sorted[i].value / Math.pow(100, i + 1);
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestName = name;
        }
    });
    
    return { score: bestScore, name: bestName };
}

function getGroupVal(sorted, count) {
    const counts = {};
    sorted.forEach(c => { counts[c.value] = (counts[c.value] || 0) + 1; });
    for (let val in counts) {
        if (counts[val] === count) return parseInt(val);
    }
    return 0;
}

function openMode(mode) {
    document.getElementById('main-menu').classList.add('hidden');
    if (mode === 'single') {
        document.getElementById('game-menu').classList.remove('hidden');
    } else if (mode === 'multi') {
        document.getElementById('multi-menu').classList.remove('hidden');
    }
}

function openMainMenu() {
    document.querySelectorAll('.menu-container, .game-container').forEach(el => el.classList.add('hidden'));
    document.getElementById('main-menu').classList.remove('hidden');
}

function openMenu() {
    // Back to game selection (single player)
    document.querySelectorAll('.game-container').forEach(el => el.classList.add('hidden'));
    document.getElementById('game-menu').classList.remove('hidden');
}

function openGame(gameId) {
    document.getElementById('game-menu').classList.add('hidden');
    document.getElementById(gameId).classList.remove('hidden');
}

// RULES MODAL LOGIC
function openRulesModal(gameType) {
    document.querySelectorAll('.rules-section').forEach(sec => {
        sec.classList.add('hidden');
    });
    
    if (gameType) {
        const target = document.getElementById(`rules-${gameType}`);
        if (target) target.classList.remove('hidden');
    }
    
    document.getElementById('rules-modal').classList.remove('hidden');
}

function closeRulesModal() {
    document.getElementById('rules-modal').classList.add('hidden');
}

// MULTIPLAYER LOGIC
const firebaseConfig = {
    apiKey: "AIzaSyCPir74hZq4ZOu1nPXz8bSgKzSzztC65Ao",
    authDomain: "game-53f85.firebaseapp.com",
    projectId: "game-53f85",
    storageBucket: "game-53f85.firebasestorage.app",
    messagingSenderId: "671149285789",
    appId: "1:671149285789:web:f686bc284d643c93d60f74",
    measurementId: "G-HZQBMXKKXT",
    databaseURL: "https://game-53f85-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};

// Initialize Firebase
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) {
    console.warn("Firebase initialization failed. Check your config.");
}

let currentRoomCode = null;
let myPlayerRef = null;
let roomListener = null;

function setupRoomListener(roomCode) {
    if (roomListener) db.ref('rooms/' + currentRoomCode).off();
    
    roomListener = db.ref('rooms/' + roomCode).on('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) {
            if (currentRoomCode === roomCode) {
                alert("방이 사라졌거나 종료되었습니다.");
                hideMultiPanels();
            }
            return;
        }

        document.getElementById('lobby-room-code').textContent = 'CODE: ' + roomCode;
        document.getElementById('lobby-game-type').textContent = getGameName(roomData.gameType);
        document.getElementById('lobby-credits').textContent = roomData.credits;
        
        const players = [];
        if (roomData.players) {
            Object.keys(roomData.players).forEach(key => {
                players.push({ ...roomData.players[key], id: key });
            });
        }
        
        updateLobbyPlayers(players, roomData.maxPlayers);

        // Check if game has started
        if (roomData.status === 'STARTING') {
            document.getElementById('multi-menu').classList.add('hidden');
            openGame(roomData.gameType === 'seotda3' ? 'seotda' : roomData.gameType);
            // In a real app, we would sync credits and seats here
        }

        // Only host can click start, others see it disabled or hidden
        const startBtn = document.getElementById('btn-lobby-start');
        if (roomData.hostId !== myPlayerRef.key) {
            startBtn.style.opacity = '0.5';
            startBtn.style.pointerEvents = 'none';
            startBtn.textContent = '호스트 대기 중...';
        } else {
            startBtn.style.opacity = '1';
            startBtn.style.pointerEvents = 'all';
            startBtn.textContent = '게임 시작';
        }
    });
}

function startMultiGame() {
    if (!currentRoomCode) return;
    
    db.ref('rooms/' + currentRoomCode).once('value', snapshot => {
        const roomData = snapshot.val();
        if (roomData && roomData.hostId === myPlayerRef.key) {
            // Check if at least 2 players
            const playerCount = roomData.players ? Object.keys(roomData.players).length : 0;
            if (playerCount < 2) {
                if(!confirm("혼자서 시작하시겠습니까? (테스트용)")) return;
            }

            db.ref('rooms/' + currentRoomCode).update({
                status: 'STARTING',
                startTime: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });
}

function updateLobbyPlayers(players, max) {
    document.getElementById('lobby-players').textContent = `${players.length} / ${max}`;
    const playerList = document.getElementById('lobby-player-list');
    playerList.innerHTML = '';
    players.forEach(p => {
        const isMe = p.id === myPlayerRef.key;
        const li = document.createElement('li');
        li.style.marginBottom = '5px';
        if (p.isHost) {
            li.style.color = 'var(--accent-blue)';
            li.innerHTML = `👑 <strong>${p.nickname}</strong> (호스트${isMe ? '/나' : ''})`;
        } else {
            li.style.color = isMe ? 'var(--accent-pink)' : 'white';
            li.innerHTML = `${isMe ? '👋' : '👤'} <strong>${p.nickname}</strong> ${isMe ? '(나)' : ''}`;
        }
        playerList.appendChild(li);
    });
}

function getGameName(type) {
    const names = {
        holdem: '텍사스 홀덤',
        seotda: '섯다 (2장)',
        seotda3: '섯다 (3장)',
        gostop: '고스톱',
        blackjack: '블랙잭',
        poker: '비디오 포커'
    };
    return names[type] || type;
}

function showMultiCreate() {
    document.getElementById('multi-options').classList.add('hidden');
    document.getElementById('multi-create-panel').classList.remove('hidden');
}

function showMultiJoin() {
    document.getElementById('multi-options').classList.add('hidden');
    document.getElementById('multi-join-panel').classList.remove('hidden');
}

function hideMultiPanels() {
    if (currentRoomCode) {
        if (myPlayerRef) myPlayerRef.remove();
        db.ref('rooms/' + currentRoomCode).off();
        currentRoomCode = null;
    }
    document.getElementById('multi-create-panel').classList.add('hidden');
    document.getElementById('multi-join-panel').classList.add('hidden');
    document.getElementById('multi-lobby-panel').classList.add('hidden');
    document.getElementById('multi-options').classList.remove('hidden');
}

function createRoom() {
    const gameType = document.getElementById('room-game-type').value;
    const credits = document.getElementById('room-credits').value;
    const maxPlayers = document.getElementById('room-players').value;
    const nickname = document.getElementById('create-nickname').value.trim() || 'HostPlayer';
    
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    currentRoomCode = roomCode;
    const roomRef = db.ref('rooms/' + roomCode);
    
    console.log("Creating room...", roomCode);
    
    // 1. Create the room metadata first
    roomRef.set({
        gameType,
        credits,
        maxPlayers,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        status: 'LOBBY'
    }).then(() => {
        // 2. Add the host player
        myPlayerRef = roomRef.child('players').push();
        const hostId = myPlayerRef.key;
        
        myPlayerRef.set({
            nickname,
            isHost: true
        }).then(() => {
            // 3. Update the room's hostId
            roomRef.update({
                hostId: hostId
            });
            
            document.getElementById('multi-create-panel').classList.add('hidden');
            document.getElementById('multi-lobby-panel').classList.remove('hidden');
            setupRoomListener(roomCode);
        });
    }).catch(error => {
        console.error("Firebase Error:", error);
        alert("방 생성 실패: " + error.message);
    });
}

function joinRoom() {
    const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();
    const nickname = document.getElementById('join-nickname').value.trim() || 'GuestPlayer';

    if (roomCode.length === 0) {
        alert("올바른 방 코드를 입력해주세요.");
        return;
    }
    
    db.ref('rooms/' + roomCode).once('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) {
            alert("방을 찾을 수 없습니다.");
            return;
        }

        const playerCount = roomData.players ? Object.keys(roomData.players).length : 0;
        if (playerCount >= roomData.maxPlayers) {
            alert("방이 가득 찼습니다.");
            return;
        }

        currentRoomCode = roomCode;
        myPlayerRef = db.ref('rooms/' + roomCode + '/players').push();
        myPlayerRef.set({
            nickname,
            isHost: false
        }).then(() => {
            document.getElementById('multi-join-panel').classList.add('hidden');
            document.getElementById('multi-lobby-panel').classList.remove('hidden');
            setupRoomListener(roomCode);
        }).catch(error => {
            alert("참가 실패: " + error.message);
        });
    }).catch(error => {
        alert("데이터 불러오기 실패: " + error.message);
    });
}

// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    const modal = document.getElementById('rules-modal');
    if (e.target === modal) {
        closeRulesModal();
    }
});

// Start
init();
