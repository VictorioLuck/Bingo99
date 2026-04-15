
const firebaseConfig = {
    databaseURL: "https://bingo-99-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const bingoRef = db.ref('partida_actual');
const bingoStatusRef = db.ref('bingo_status');
const readyPlayersRef = db.ref('ready_players');

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let chips = [];
let currentCardImage = null;
let sorteoPausado = false;
let lastContainerTap = 0;
const doubleTapDelay = 300;
let isPlayerReady = false;
let playerReadyKey = null;

// Variables para emojis
let selectedEmoji = localStorage.getItem('bingoSelectedEmoji') || null;
let chipEmojis = JSON.parse(localStorage.getItem('bingoChipEmojis')) || {};

// Variables para control de audio
let audioEnabled = localStorage.getItem('bingoAudioEnabled') !== 'false';
let audioVolume = parseFloat(localStorage.getItem('bingoAudioVolume')) || 0.7;
let sounds = {};

// ==========================================
// REFERENCIAS DOM
// ==========================================
const uploadSection = document.getElementById('upload-section');
const cardSection = document.getElementById('card-section');
const cardUpload = document.getElementById('card-upload');
const bingoCard = document.getElementById('bingo-card');
const bingoContainer = document.getElementById('bingo-container');
const resetCardBtn = document.getElementById('reset-card');
const clearChipsBtn = document.getElementById('clear-chips');
const undoChipBtn = document.getElementById('undo-chip');
const btnBingo = document.getElementById('btn-bingo');

// Emoji picker DOM
const fab = document.getElementById('emoji-fab');
const modal = document.getElementById('emoji-modal');
const modalClose = document.getElementById('emoji-modal-close');
const picker = document.getElementById('emoji-picker');
const indicator = document.getElementById('emoji-indicator');
const emojiPreview = document.getElementById('current-emoji-preview');

// Temporizador DOM
const timerOverlayPlayer = document.getElementById('timer-overlay-player');
const timerDisplayPlayer = document.getElementById('timer-display-player');

// Audio control DOM
const muteBtn = document.getElementById('mute-btn');
const volumeSlider = document.getElementById('volume-slider');

// Botón Listo DOM
const readyBtn = document.getElementById('ready-btn');
const readyCounter = document.getElementById('ready-counter');
const readyCountDisplay = document.getElementById('ready-count');
const readyOverlay = document.getElementById('ready-overlay');
const readyOverlayCount = document.getElementById('ready-overlay-count');

// ==========================================
// SISTEMA DE AUDIO
// ==========================================

// URLs de sonidos de Mixkit (libres de derechos)
const soundUrls = {
    ballDrawn: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
    bingoWin: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
    chipPlace: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
    chipRemove: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
    timerTick: 'https://assets.mixkit.co/active_storage/sfx/2044/2044-preview.mp3',
    gamePause: 'https://assets.mixkit.co/active_storage/sfx/1430/1430-preview.mp3',
    gameResume: 'https://assets.mixkit.co/active_storage/sfx/1431/1431-preview.mp3',
    cardUpload: 'https://assets.mixkit.co/active_storage/sfx/1438/1438-preview.mp3',
    playerReady: 'https://assets.mixkit.co/active_storage/sfx/1431/1431-preview.mp3',
    playerUnready: 'https://assets.mixkit.co/active_storage/sfx/1430/1430-preview.mp3'
};

function initAudio() {
    Object.keys(soundUrls).forEach(key => {
        const audio = new Audio(soundUrls[key]);
        audio.volume = audioVolume;
        audio.preload = 'auto';
        sounds[key] = audio;
    });

    updateAudioUI();

    muteBtn.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', (e) => {
        audioVolume = e.target.value / 100;
        localStorage.setItem('bingoAudioVolume', audioVolume);
        updateAudioVolume();
    });

    console.log('🎵 Sistema de audio inicializado');
}

function playSound(soundName) {
    if (!audioEnabled || !sounds[soundName]) return;

    const sound = sounds[soundName].cloneNode();
    sound.volume = audioVolume;
    sound.play().catch(e => console.log('Audio play prevented:', e));
}

function toggleMute() {
    audioEnabled = !audioEnabled;
    localStorage.setItem('bingoAudioEnabled', audioEnabled);
    updateAudioUI();
}

function updateAudioUI() {
    muteBtn.textContent = audioEnabled ? '🔊' : '🔇';
    volumeSlider.value = audioVolume * 100;
}

function updateAudioVolume() {
    Object.values(sounds).forEach(audio => {
        audio.volume = audioVolume;
    });
}

// ==========================================
// SISTEMA DE JUGADORES LISTOS
// ==========================================

function initReadySystem() {
    // Verificar si ya estaba listo en esta sesión
    const savedReadyKey = localStorage.getItem('playerReadyKey');
    if (savedReadyKey) {
        playerReadyKey = savedReadyKey;
        // Verificar si aún existe en Firebase
        readyPlayersRef.child(playerReadyKey).once('value', (snapshot) => {
            if (snapshot.exists()) {
                isPlayerReady = true;
                updateReadyButtonUI();
            } else {
                localStorage.removeItem('playerReadyKey');
                playerReadyKey = null;
            }
        });
    }

    // Escuchar cambios en el contador
    readyPlayersRef.on('value', (snapshot) => {
        const players = snapshot.val() || {};
        const count = Object.keys(players).length;
        updateReadyCounter(count);
    });

    readyBtn.addEventListener('click', toggleReadyStatus);
}

function toggleReadyStatus() {
    if (!currentCardImage) {
        // Mostrar alerta si no hay cartón cargado
        showNotification('⚠️ Primero debes cargar tu cartón de bingo', 'warning');
        playSound('gamePause');
        return;
    }

    if (isPlayerReady) {
        // Quitar de la lista
        if (playerReadyKey) {
            readyPlayersRef.child(playerReadyKey).remove();
            localStorage.removeItem('playerReadyKey');
            playerReadyKey = null;
        }
        isPlayerReady = false;
        playSound('playerUnready');
    } else {
        // Agregar a la lista
        const newPlayerRef = readyPlayersRef.push();
        newPlayerRef.set({
            timestamp: Date.now(),
            joinedAt: new Date().toISOString()
        });
        playerReadyKey = newPlayerRef.key;
        localStorage.setItem('playerReadyKey', playerReadyKey);
        isPlayerReady = true;
        playSound('playerReady');
        showNotification('✅ ¡Estás listo para jugar!', 'success');
    }

    updateReadyButtonUI();
}

function updateReadyButtonUI() {
    if (isPlayerReady) {
        readyBtn.classList.add('ready-active');
        readyBtn.innerHTML = '✅ LISTO<br><span class="text-xs opacity-80">Cancelar</span>';
        readyBtn.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
        readyBtn.style.borderColor = '#86efac';
        readyBtn.style.animation = 'readyPulse 1.5s infinite';
    } else {
        readyBtn.classList.remove('ready-active');
        readyBtn.innerHTML = '🎯 LISTO<br><span class="text-xs opacity-80">Para Jugar</span>';
        readyBtn.style.background = '';
        readyBtn.style.borderColor = '';
        readyBtn.style.animation = '';
    }
}

function updateReadyCounter(count) {
    readyCountDisplay.textContent = count;
    if (readyOverlayCount) readyOverlayCount.textContent = count;
    readyCounter.classList.add('counter-update');
    setTimeout(() => readyCounter.classList.remove('counter-update'), 300);

    // Mostrar/ocultar overlay según si hay jugadores listos
    if (count > 0) {
        readyOverlay.classList.add('active');
    } else {
        readyOverlay.classList.remove('active');
    }
}

function showNotification(message, type = 'info') {
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.className = `fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl font-bold text-white shadow-2xl transition-all duration-300`;

    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
    } else if (type === 'warning') {
        notification.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    } else {
        notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==========================================
// FUNCIONES FIREBASE / BINGO
// ==========================================

function loadSavedData() {
    const savedImage = localStorage.getItem('bingoCardImage');
    const savedChips = localStorage.getItem('bingoChips');

    if (savedImage) {
        currentCardImage = savedImage;
        bingoCard.src = currentCardImage;
        uploadSection.classList.add('hidden');
        cardSection.classList.remove('hidden');
        resetCardBtn.classList.remove('hidden');

        if (savedChips) {
            chips = JSON.parse(savedChips);
            renderChips();
        }
    }
}

function saveToLocalStorage() {
    if (currentCardImage) {
        localStorage.setItem('bingoCardImage', currentCardImage);
    }
    localStorage.setItem('bingoChips', JSON.stringify(chips));
}

// Escuchar estado de Bingo
bingoStatusRef.on('value', (snapshot) => {
    const status = snapshot.val();
    const pauseOverlay = document.getElementById('pause-overlay');

    if (status && status.active) {
        sorteoPausado = true;
        pauseOverlay.classList.add('active');
        timerOverlayPlayer.classList.remove('active');
        if (btnBingo) btnBingo.disabled = true;
        if (status.message) {
            document.getElementById('pause-message').innerText = status.message;
        }
        playSound('gamePause');
    } else if (status && status.waiting) {
        sorteoPausado = true;
        pauseOverlay.classList.remove('active');
        timerOverlayPlayer.classList.add('active');
        if (btnBingo) btnBingo.disabled = true;

        if (status.remainingTime !== undefined) {
            timerDisplayPlayer.innerText = status.remainingTime;
        }
        playSound('timerTick');
    } else {
        const wasPaused = sorteoPausado;
        sorteoPausado = false;
        pauseOverlay.classList.remove('active');
        timerOverlayPlayer.classList.remove('active');
        if (btnBingo) btnBingo.disabled = false;
        if (wasPaused) {
            playSound('gameResume');
        }
    }
});

// Escucha en tiempo real
bingoRef.on('value', (snapshot) => {
    const historial = snapshot.val() || [];
    actualizarVista(historial);
});

function actualizarVista(historial) {
    const container = document.getElementById('lista-historial');
    const counter = document.getElementById('counter');
    const emptyState = document.getElementById('empty-state');
    const display = document.getElementById('result');

    const prevCount = parseInt(counter.innerText.match(/\d+/)?.[0] || 0);
    counter.innerText = `${historial.length} Balotas`;

    if (historial.length > 0) {
        const ultimo = historial[0].numero;
        if (display.innerText !== ultimo) {
            display.innerText = ultimo;
            display.classList.add('text-blue-400');
            setTimeout(() => display.classList.remove('text-blue-400'), 1000);
            if (historial.length > prevCount) {
                playSound('ballDrawn');
            }
        }
    } else {
        display.innerText = '--';
    }

    if (historial.length === 0) {
        container.innerHTML = "";
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.innerHTML = historial.map((item, index) => `
    <tr class="border-b border-white/5 group hover:bg-white/5">
        <td class="p-4 text-slate-500 font-mono">#${historial.length - index}</td>
        <td class="p-4">
            <span class="text-2xl font-bold text-white group-hover:text-blue-400 transition">
                ${item.numero}
            </span>
        </td>
        <td class="p-4 text-slate-400 text-right font-mono">${item.hora}</td>
    </tr>
    `).join('');
}

function cantarBingo() {
    if (sorteoPausado) return;

    playSound('bingoWin');

    bingoStatusRef.set({
        active: true,
        timestamp: Date.now(),
        message: 'Un Jugador a Cantado Bingo',
        cantadoPor: 'Jugador'
    });

    window.open('https://wa.me/584120825020?text=¡BINGO!%20He%20completado%20mi%20cartón%20de%20bingo.%20¡Verifiquen%20mi%20victoria!', '_blank');
}

// ==========================================
// FUNCIONES DEL CARTÓN
// ==========================================

uploadSection.addEventListener('click', () => cardUpload.click());

uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadSection.classList.add('dragover');
});

uploadSection.addEventListener('dragleave', () => {
    uploadSection.classList.remove('dragover');
});

uploadSection.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadSection.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'image/png') {
        loadCardImage(file);
    }
});

cardUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadCardImage(file);
});

function loadCardImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        currentCardImage = e.target.result;
        bingoCard.src = currentCardImage;
        uploadSection.classList.add('hidden');
        cardSection.classList.remove('hidden');
        resetCardBtn.classList.remove('hidden');
        chips = [];
        renderChips();
        saveToLocalStorage();
        playSound('cardUpload');
        showNotification('📸 Cartón cargado correctamente', 'success');
    };
    reader.readAsDataURL(file);
}

resetCardBtn.addEventListener('click', () => {
    // Si estaba listo, quitarlo de la lista
    if (isPlayerReady && playerReadyKey) {
        readyPlayersRef.child(playerReadyKey).remove();
        localStorage.removeItem('playerReadyKey');
        playerReadyKey = null;
        isPlayerReady = false;
        updateReadyButtonUI();
    }

    bingoCard.src = '';
    currentCardImage = null;
    chips = [];
    localStorage.removeItem('bingoCardImage');
    localStorage.removeItem('bingoChips');
    localStorage.removeItem('bingoChipEmojis');
    localStorage.removeItem('bingoSelectedEmoji');
    uploadSection.classList.remove('hidden');
    cardSection.classList.add('hidden');
    resetCardBtn.classList.add('hidden');
    cardUpload.value = '';
    selectedEmoji = null;
    chipEmojis = {};
    updateEmojiIndicator();
});

function handleContainerDoubleTap(e) {
    if (e.target.classList.contains('chip') || e.target.closest('.chip')) return;

    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastContainerTap;

    if (tapLength < doubleTapDelay && tapLength > 0) {
        const rect = bingoContainer.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

        const x = ((clientX - rect.left) / rect.width) * 100;
        const y = ((clientY - rect.top) / rect.height) * 100;

        const chipNumber = chips.length + 1;
        const newChip = { x, y, number: chipNumber, active: true };

        if (selectedEmoji) {
            newChip.emoji = selectedEmoji;
            chipEmojis[chips.length] = selectedEmoji;
            localStorage.setItem('bingoChipEmojis', JSON.stringify(chipEmojis));
        }

        chips.push(newChip);
        renderChips();
        saveToLocalStorage();
        playSound('chipPlace');
    }

    lastContainerTap = currentTime;
}

bingoContainer.addEventListener('click', handleContainerDoubleTap);

bingoContainer.addEventListener('touchend', (e) => {
    if (e.target.classList.contains('chip') || e.target.closest('.chip')) return;

    e.preventDefault();
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastContainerTap;

    if (tapLength < doubleTapDelay && tapLength > 0) {
        const touch = e.changedTouches[0];
        const rect = bingoContainer.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 100;
        const y = ((touch.clientY - rect.top) / rect.height) * 100;

        const chipNumber = chips.length + 1;
        const newChip = { x, y, number: chipNumber, active: true };

        if (selectedEmoji) {
            newChip.emoji = selectedEmoji;
            chipEmojis[chips.length] = selectedEmoji;
            localStorage.setItem('bingoChipEmojis', JSON.stringify(chipEmojis));
        }

        chips.push(newChip);
        renderChips();
        saveToLocalStorage();
        playSound('chipPlace');
    }

    lastContainerTap = currentTime;
});

function isEmoji(str) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}]|[\u{2B06}]|[\u{2B07}]|[\u{2B05}]|[\u{27A1}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{2934}-\u{2935}]|[\u{25AA}-\u{25AB}]|[\u{25FB}-\u{25FE}]|[\u{25FD}-\u{25FE}]|[\u{25FC}]|[\u{25FB}]|[\u{25B6}]|[\u{25C0}]|[\u{1F200}-\u{1F251}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{3030}]|[\u{2B50}]|[\u{2B55}]/u;
    return emojiRegex.test(str);
}

function renderChips() {
    document.querySelectorAll('.chip').forEach(chip => chip.remove());

    chips.forEach((chip, index) => {
        const chipEl = document.createElement('div');
        chipEl.className = `chip ${chip.active ? 'active' : ''}`;
        chipEl.style.left = `${chip.x}%`;
        chipEl.style.top = `${chip.y}%`;

        const displayContent = chip.emoji || chipEmojis[index] || chip.number;

        if (isEmoji(displayContent.toString())) {
            chipEl.innerHTML = `<span class="chip-emoji">${displayContent}</span>`;
        } else {
            chipEl.innerHTML = `<span class="chip-number">${displayContent}</span>`;
        }

        const handleChipTap = (e) => {
            e.stopPropagation();
            e.preventDefault();
            chip.active = !chip.active;
            chipEl.classList.toggle('active');
            saveToLocalStorage();
        };

        chipEl.addEventListener('click', handleChipTap);
        chipEl.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleChipTap(e);
        });

        bingoContainer.appendChild(chipEl);
    });

    undoChipBtn.disabled = chips.length === 0;
    undoChipBtn.style.opacity = chips.length === 0 ? '0.5' : '1';
}

undoChipBtn.addEventListener('click', () => {
    if (chips.length > 0) {
        chips.pop();
        delete chipEmojis[chips.length];
        localStorage.setItem('bingoChipEmojis', JSON.stringify(chipEmojis));
        renderChips();
        saveToLocalStorage();
        playSound('chipRemove');
    }
});

clearChipsBtn.addEventListener('click', () => {
    if (chips.length > 0) {
        chips = [];
        chipEmojis = {};
        localStorage.removeItem('bingoChipEmojis');
        renderChips();
        saveToLocalStorage();
        playSound('chipRemove');
        
        // Resetear el estado "Listo" del jugador
        if (isPlayerReady && playerReadyKey) {
            readyPlayersRef.child(playerReadyKey).remove();
            localStorage.removeItem('playerReadyKey');
            playerReadyKey = null;
            isPlayerReady = false;
            updateReadyButtonUI();
            showNotification('🔄 Estado reiniciado. Marca "Listo" cuando termines.', 'info');
        }
    }
});

// ==========================================
// EMOJI PICKER
// ==========================================

function updateEmojiIndicator() {
    if (selectedEmoji) {
        indicator.classList.add('active');
        emojiPreview.textContent = selectedEmoji;
        fab.textContent = selectedEmoji;
    } else {
        indicator.classList.remove('active');
        fab.textContent = '😊';
    }
}

function openEmojiModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeEmojiModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function handleEmojiSelect(event) {
    const emoji = event.detail.unicode;
    selectedEmoji = emoji;

    localStorage.setItem('bingoSelectedEmoji', emoji);
    updateEmojiIndicator();
    closeEmojiModal();

    fab.textContent = emoji;
    fab.style.animation = 'none';
    setTimeout(() => {
        fab.style.animation = 'fabPulse 2s infinite';
    }, 100);
}

// ==========================================
// RELOJ
// ==========================================

setInterval(() => {
    document.getElementById('reloj').innerText = new Date().toLocaleTimeString();
}, 1000);

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initAudio();
    initReadySystem();
    updateEmojiIndicator();

    fab.addEventListener('click', openEmojiModal);
    modalClose.addEventListener('click', closeEmojiModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeEmojiModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeEmojiModal();
        }
    });

    if (customElements) {
        customElements.whenDefined('emoji-picker').then(() => {
            console.log('Emoji picker listo');
            const pickerEl = document.getElementById('emoji-picker');
            if (pickerEl) {
                pickerEl.addEventListener('emoji-click', handleEmojiSelect);
            }
        }).catch(err => {
            console.error('Error cargando emoji picker:', err);
        });
    }
});

loadSavedData();