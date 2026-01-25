/**
 * Logic.js - Main Application Controller
 * Handles state, user input, animation sequencing, and data.
 */

/* -------------------------------------------------------------------------- */
/*                                    DATA                                    */
/* -------------------------------------------------------------------------- */

const LAST_NAMES = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣 邓郁单杭洪包诸左石崔吉钮龚".split("");
const FIRST_NAMES = "明国华建文平志伟东海强晓生光林小民永杰军金新涛君清利信子杰波辉刚健若云飞风雨雷电春夏秋冬梅兰竹菊松柏杨柳山河湖海天地日月星辰".split("");

function generateParticipants(count = 200) {
    const participants = [];
    for (let i = 0; i < count; i++) {
        const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] + (Math.random() > 0.5 ? FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] : "");
        participants.push(ln + fn);
    }
    return participants;
}

const participants = generateParticipants();
console.log(`Loaded ${participants.length} participants.`);


/* -------------------------------------------------------------------------- */
/*                               STATE MACHINE                                */
/* -------------------------------------------------------------------------- */

const STATE = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    STOPPING: 'STOPPING',
    RESULT: 'RESULT'
};

let currentState = STATE.IDLE;
let animationInterval = null;
let currentBatchSize = 1;

// Elements
const nameRoller = document.getElementById('name-roller');
const winnerCard = document.getElementById('winner-card');
const winnerContainer = document.getElementById('winner-container');
const btnAction = document.getElementById('btn-action');

/* -------------------------------------------------------------------------- */
/*                                   LOGIC                                    */
/* -------------------------------------------------------------------------- */

// Global function for HTML buttons
window.setBatchSize = function(size) {
    if (currentState === STATE.RUNNING) return; // Can't change while running
    currentBatchSize = size;
    
    // UI Feedback
    document.querySelectorAll('.btn-secondary').forEach(btn => btn.classList.remove('active'));
    // Find button with matching text or logic (simplified for now by text or order, but strict matching is better)
    // For this simple app, we can just rely on the click updating the class, 
    // but better to re-render. here we just trust the clicked element logic if attached inline, 
    // OR we iterate buttons to find the one calling the function.
    // For simplicity, we just rely on the onclick adding 'active' class via this function:
    
    // We update class based on text content (hacky but works for this simple single page)
    const buttons = document.querySelectorAll('.control-row button');
    buttons.forEach(btn => {
        if (btn.textContent.includes(size.toString())) {
            btn.classList.add('active');
        }
    });

    console.log(`Batch size set to ${currentBatchSize}`);
}

function startDraw() {
    if (currentState !== STATE.IDLE && currentState !== STATE.RESULT) return;

    currentState = STATE.RUNNING;
    
    // UI Updates
    winnerCard.style.display = 'none';
    nameRoller.style.display = 'block';
    nameRoller.style.opacity = '1';
    btnAction.textContent = '停止';

    // Reset Animations
    gsap.set(winnerCard, { scale: 0 });

    // Speed up Background
    if (window.setBackgroundSpeed) window.setBackgroundSpeed(15);

    // Speed up Horse Animation (CSS variable or class? We use simple CSS animation now, maybe speed up via JS?)
    const horseImg = document.querySelector('.horse-img');
    if(horseImg) horseImg.style.animationDuration = '0.3s';

    // Start Name Rolling
    clearInterval(animationInterval);
    animationInterval = setInterval(() => {
        const name = participants[Math.floor(Math.random() * participants.length)];
        nameRoller.innerText = name;
    }, 50); 
}

function stopDraw() {
    if (currentState !== STATE.RUNNING) return;

    currentState = STATE.STOPPING;
    
    // Pick winners (unique)
    const winners = [];
    const tempParticipants = [...participants];
    for(let i=0; i<currentBatchSize; i++) {
        if(tempParticipants.length === 0) break;
        const idx = Math.floor(Math.random() * tempParticipants.length);
        winners.push(tempParticipants[idx]);
        tempParticipants.splice(idx, 1);
    }
    
    // Slow down effect
    if (window.setBackgroundSpeed) window.setBackgroundSpeed(2);
    
    const horseImg = document.querySelector('.horse-img');
    if(horseImg) horseImg.style.animationDuration = '0.6s';

    // Stop rolling
    let delay = 50;
    const decelerate = () => {
        delay *= 1.1; 
        if (delay > 400) {
            finalizeBatch(winners);
        } else {
            nameRoller.innerText = participants[Math.floor(Math.random() * participants.length)];
            setTimeout(decelerate, delay);
        }
    };
    
    clearInterval(animationInterval);
    decelerate();
}

function finalizeBatch(winners) {
    currentState = STATE.RESULT;
    btnAction.textContent = '开始抽奖';
    nameRoller.style.display = 'none';
    
    // Render Winners
    winnerContainer.innerHTML = '';
    
    if (winners.length === 1) {
        // Single Winner Style
        winnerContainer.className = 'winner-name single';
        winnerContainer.textContent = winners[0];
    } else {
        // Grid Style
        winnerContainer.className = 'winner-grid';
        if (winners.length > 5) {
             winnerContainer.style.gridTemplateColumns = 'repeat(5, 1fr)';
        }
        
        winners.forEach(w => {
            const div = document.createElement('div');
            div.className = 'winner-grid-item';
            div.textContent = w;
            winnerContainer.appendChild(div);
        });
    }

    // Show Card
    winnerCard.style.display = 'flex';
    gsap.to(winnerCard, { 
        scale: 1, 
        duration: 0.5, 
        ease: "back.out(1.7)" 
    });

    fireConfetti();
}

function fireConfetti() {
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#FFD700', '#D20F15', '#FFF']
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#FFD700', '#D20F15', '#FFF']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

function resetDraw() {
    currentState = STATE.IDLE;
    nameRoller.style.display = 'block';
    nameRoller.innerText = "准备抽奖";
    winnerCard.style.display = 'none';
    btnAction.textContent = '开始抽奖';
    if (window.setBackgroundSpeed) window.setBackgroundSpeed(2);
    clearInterval(animationInterval);
}

/* -------------------------------------------------------------------------- */
/*                               EVENT LISTENERS                              */
/* -------------------------------------------------------------------------- */

// Keyboard
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        if (currentState === STATE.IDLE || currentState === STATE.RESULT) {
            startDraw();
        } else if (currentState === STATE.RUNNING) {
            stopDraw();
        }
    }
    if (e.code === 'Escape') {
        resetDraw();
    }
});

// UI Buttons
btnAction.addEventListener('click', (e) => {
    e.stopPropagation(); 
    if (currentState === STATE.IDLE || currentState === STATE.RESULT) {
        startDraw();
    } else if (currentState === STATE.RUNNING) {
        stopDraw();
    }
});

document.getElementById('btn-reset').addEventListener('click', (e) => {
    e.stopPropagation();
    resetDraw();
});

// Global Click
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    
    if (currentState === STATE.IDLE || currentState === STATE.RESULT) {
        startDraw();
    } else if (currentState === STATE.RUNNING) {
        stopDraw();
    }
});

// Initial state
resetDraw();
