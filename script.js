// Bingo75 en Vivo - Script Principal

// ==========================================
// CONFIGURACIÓN FIREBASE
// ==========================================
const firebaseConfig = {
    databaseURL: "https://bingo-e7d2b-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const bingoRef = db.ref('partida_actual');
const bingoStatusRef = db.ref('bingo_status');

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let chips = [];
let currentCardImage = null;
let sorteoPausado = false;
let lastContainerTap = 0;
const doubleTapDelay = 300;

// Variables para emojis
let selectedEmoji = localStorage.getItem('bingoSelectedEmoji') || null;
let chipEmojis = JSON.parse(localStorage.getItem('bingoChipEmojis')) || {};

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
        // Bingo activo (pausa por verificación)
        sorteoPausado = true;
        pauseOverlay.classList.add('active');
        timerOverlayPlayer.classList.remove('active');
        if (btnBingo) btnBingo.disabled = true;
        if (status.message) {
            document.getElementById('pause-message').innerText = status.message;
        }
    } else if (status && status.waiting) {
        // Estado de espera (temporizador)
        sorteoPausado = true;
        pauseOverlay.classList.remove('active');
        timerOverlayPlayer.classList.add('active');
        if (btnBingo) btnBingo.disabled = true;
        
        // Actualizar display del temporizador
        if (status.remainingTime !== undefined) {
            timerDisplayPlayer.innerText = status.remainingTime;
        }
    } else {
        // Sorteo activo normal
        sorteoPausado = false;
        pauseOverlay.classList.remove('active');
        timerOverlayPlayer.classList.remove('active');
        if (btnBingo) btnBingo.disabled = false;
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

    counter.innerText = `${historial.length} Balotas`;

    if (historial.length > 0) {
        const ultimo = historial[0].numero;
        if (display.innerText !== ultimo) {
            display.innerText = ultimo;
            display.classList.add('text-blue-400');
            setTimeout(() => display.classList.remove('text-blue-400'), 1000);
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
    };
    reader.readAsDataURL(file);
}

resetCardBtn.addEventListener('click', () => {
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
    }
});

clearChipsBtn.addEventListener('click', () => {
    chips = [];
    chipEmojis = {};
    localStorage.removeItem('bingoChipEmojis');
    renderChips();
    saveToLocalStorage();
});

// ==========================================
// EMOJI PICKER - CORREGIDO
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

// Inicializar emoji picker cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
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

    // CORRECCIÓN CLAVE: Esperar a que el web component esté definido
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

// ==========================================
// RELOJ
// ==========================================

setInterval(() => {
    document.getElementById('reloj').innerText = new Date().toLocaleTimeString();
}, 1000);

// ==========================================
// INICIALIZACIÓN
// ==========================================

loadSavedData();

// ==========================================
// SISTEMA DE SONIDOS - AGREGAR AL FINAL DE script.js
// ==========================================

const AudioSystem = {
    sounds: {},
    enabled: true,
    volume: 0.7,
    
    // URLs de sonidos (usando sonidos libres de derechos)
    soundUrls: {
        ballDrawn: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',      // Pop suave
        bingoWin: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',       // Celebración
        chipPlace: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',      // Click suave
        chipRemove: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',     // Click inverso
        timerTick: 'https://assets.mixkit.co/active_storage/sfx/2044/2044-preview.mp3',      // Tick
        gamePause: 'https://assets.mixkit.co/active_storage/sfx/1430/1430-preview.mp3',       // Alerta
        gameResume: 'https://assets.mixkit.co/active_storage/sfx/1431/1431-preview.mp3',     // Success
        cardUpload: 'https://assets.mixkit.co/active_storage/sfx/1438/1438-preview.mp3'        // Magic
    },

    init() {
        // Precargar sonidos
        Object.keys(this.soundUrls).forEach(key => {
            const audio = new Audio(this.soundUrls[key]);
            audio.volume = this.volume;
            audio.preload = 'auto';
            this.sounds[key] = audio;
        });
        
        // Crear control de volumen en UI
        this.createVolumeControl();
        
        console.log('🎵 Sistema de audio inicializado');
    },

    play(soundName) {
        if (!this.enabled || !this.sounds[soundName]) return;
        
        const sound = this.sounds[soundName].cloneNode();
        sound.volume = this.volume;
        sound.play().catch(e => console.log('Audio play prevented:', e));
    },

    createVolumeControl() {
        const control = document.createElement('div');
        control.id = 'audio-control';
        control.innerHTML = `
            <button id="mute-btn" title="Activar/Desactivar sonido">🔊</button>
            <input type="range" id="volume-slider" min="0" max="100" value="${this.volume * 100}">
        `;
        control.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 24px;
            z-index: 40;
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(15, 23, 42, 0.9);
            padding: 8px 12px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1);
        `;
        
        document.body.appendChild(control);
        
        // Event listeners
        const muteBtn = document.getElementById('mute-btn');
        const volumeSlider = document.getElementById('volume-slider');
        
        muteBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            padding: 4px;
        `;
        
        volumeSlider.style.cssText = `
            width: 80px;
            accent-color: #3b82f6;
        `;
        
        muteBtn.addEventListener('click', () => {
            this.enabled = !this.enabled;
            muteBtn.textContent = this.enabled ? '🔊' : '🔇';
        });
        
        volumeSlider.addEventListener('input', (e) => {
            this.volume = e.target.value / 100;
        });
    }
};

// ==========================================
// HOOKS DE SONIDO - Integración sin modificar funciones originales
// ==========================================

// Hook para nueva balota
const originalActualizarVista = actualizarVista;
actualizarVista = function(historial) {
    const prevLength = document.getElementById('counter')?.innerText.match(/\d+/)?.[0] || 0;
    originalActualizarVista(historial);
    const newLength = historial.length;
    
    if (newLength > prevLength && newLength > 0) {
        AudioSystem.play('ballDrawn');
    }
};

// Hook para estado de Bingo/pausa
const originalBingoStatusHandler = bingoStatusRef.on;
bingoStatusRef.on('value', (snapshot) => {
    const status = snapshot.val();
    const pauseOverlay = document.getElementById('pause-overlay');
    const wasActive = pauseOverlay.classList.contains('active');
    
    // Llamar al handler original (que está definido en el archivo)
    // Nota: Como el original ya está suscrito, solo agregamos sonidos aquí
    
    if (status && status.active && !wasActive) {
        AudioSystem.play('gamePause');
    } else if (status && status.waiting && !wasActive) {
        AudioSystem.play('timerTick');
    } else if (!status?.active && !status?.waiting && wasActive) {
        AudioSystem.play('gameResume');
    }
});

// Hook para cantar Bingo
const originalCantarBingo = cantarBingo;
cantarBingo = function() {
    AudioSystem.play('bingoWin');
    return originalCantarBingo.apply(this, arguments);
};

// Hook para fichas (chip placement)
const originalRenderChips = renderChips;
renderChips = function() {
    const prevCount = document.querySelectorAll('.chip').length;
    originalRenderChips();
    const newCount = chips.length;
    
    if (newCount > prevCount) {
        AudioSystem.play('chipPlace');
    }
};

// Hook para deshacer ficha
const originalUndoClick = undoChipBtn.onclick;
undoChipBtn.addEventListener('click', () => {
    if (chips.length > 0) {
        AudioSystem.play('chipRemove');
    }
});

// Hook para limpiar fichas
const originalClearClick = clearChipsBtn.onclick;
clearChipsBtn.addEventListener('click', () => {
    if (chips.length > 0) {
        AudioSystem.play('chipRemove');
    }
});

// Hook para subir cartón
const originalLoadCardImage = loadCardImage;
loadCardImage = function(file) {
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
        AudioSystem.play('cardUpload'); // Sonido después de cargar
    };
    reader.readAsDataURL(file);
};

// ==========================================
// INICIALIZACIÓN DEL SISTEMA DE AUDIO
// ==========================================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AudioSystem.init());
} else {
    AudioSystem.init();
}

// También inicializar en el loadSavedData existente para recuperar preferencias
const originalLoadSavedData = loadSavedData;
loadSavedData = function() {
    originalLoadSavedData();
    // Recuperar preferencias de audio si existen
    const savedVolume = localStorage.getItem('bingoAudioVolume');
    const savedEnabled = localStorage.getItem('bingoAudioEnabled');
    if (savedVolume) AudioSystem.volume = parseFloat(savedVolume);
    if (savedEnabled !== null) AudioSystem.enabled = savedEnabled === 'true';
};