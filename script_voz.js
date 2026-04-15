// ==========================================
// SCRIPT DE VOZ PARA BINGO99
// Síntesis de voz para cantar números
// ==========================================

/**
 * BingoVoiceSystem - Módulo de síntesis de voz para el bingo
 * Se integra con el sistema existente y lee en voz alta los números cantados
 */
class BingoVoiceSystem {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.spanishVoice = null;
        this.isEnabled = true;
        this.volume = 1.0;
        this.rate = 0.9;
        this.pitch = 1.0;

        // Referencia al observador de Firebase
        this.lastNumber = null;
        this.bingoRef = null;

        this.init();
    }

    /**
     * Inicializa el sistema de voz
     */
    init() {
        // Verificar soporte del navegador
        if (!('speechSynthesis' in window)) {
            console.warn('⚠️ Web Speech API no soportada en este navegador');
            this.isEnabled = false;
            return;
        }

        console.log('🎙️ Sistema de voz inicializando...');

        // Cargar voces disponibles
        this.loadVoices();

        // Escuchar cambios en las voces (Chrome las carga asíncronamente)
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this.loadVoices();
        }

        // Cargar preferencias guardadas
        this.loadPreferences();

        // Iniciar observador de números
        this.startNumberObserver();

        console.log('✅ Sistema de voz listo');
    }

    /**
     * Carga las voces disponibles y selecciona una en español
     */
    loadVoices() {
        this.voices = this.synth.getVoices();

        // Buscar voz en español (prioridad: es-VE, es-ES, es-MX, cualquier es)
        this.spanishVoice = this.voices.find(v => v.lang === 'es-VE') ||
                           this.voices.find(v => v.lang === 'es-ES') ||
                           this.voices.find(v => v.lang === 'es-MX') ||
                           this.voices.find(v => v.lang === 'es-AR') ||
                           this.voices.find(v => v.lang === 'es-CO') ||
                           this.voices.find(v => v.lang === 'es-US') ||
                           this.voices.find(v => v.lang.startsWith('es'));

        if (this.spanishVoice) {
            console.log(`🗣️ Voz seleccionada: ${this.spanishVoice.name} (${this.spanishVoice.lang})`);
        } else {
            console.warn('⚠️ No se encontró voz en español, usando voz por defecto');
        }
    }

    /**
     * Carga preferencias guardadas en localStorage
     */
    loadPreferences() {
        const savedEnabled = localStorage.getItem('bingoVoiceEnabled');
        const savedVolume = localStorage.getItem('bingoVoiceVolume');
        const savedRate = localStorage.getItem('bingoVoiceRate');

        if (savedEnabled !== null) {
            this.isEnabled = savedEnabled === 'true';
        }
        if (savedVolume !== null) {
            this.volume = parseFloat(savedVolume);
        }
        if (savedRate !== null) {
            this.rate = parseFloat(savedRate);
        }
    }

    /**
     * Guarda preferencias en localStorage
     */
    savePreferences() {
        localStorage.setItem('bingoVoiceEnabled', this.isEnabled);
        localStorage.setItem('bingoVoiceVolume', this.volume);
        localStorage.setItem('bingoVoiceRate', this.rate);
    }

    /**
     * Inicia el observador de números desde Firebase
     */
    startNumberObserver() {
        // Esperar a que Firebase esté disponible
        const checkFirebase = setInterval(() => {
            if (typeof firebase !== 'undefined' && firebase.database) {
                clearInterval(checkFirebase);

                const db = firebase.database();
                this.bingoRef = db.ref('partida_actual');

                this.bingoRef.on('value', (snapshot) => {
                    const historial = snapshot.val() || [];
                    if (historial.length > 0) {
                        const ultimoNumero = historial[0].numero;

                        // Solo hablar si es un número nuevo
                        if (ultimoNumero !== this.lastNumber && this.isEnabled) {
                            this.speakNumber(ultimoNumero);
                            this.lastNumber = ultimoNumero;
                        } else if (ultimoNumero !== this.lastNumber) {
                            this.lastNumber = ultimoNumero;
                        }
                    }
                });

                console.log('👂 Observador de números iniciado');
            }
        }, 100);
    }

    /**
     * Convierte un número a su representación textual en español
     */
    numberToWords(number) {
        const num = parseInt(number);

        // Números del 1 al 15 (letras B)
        if (num >= 1 && num <= 15) return `B ${num}`;

        // Números del 16 al 30 (letra I)
        if (num >= 16 && num <= 30) return `I ${num}`;

        // Números del 31 al 45 (letra N)
        if (num >= 31 && num <= 45) return `N ${num}`;

        // Números del 46 al 60 (letra G)
        if (num >= 46 && num <= 60) return `G ${num}`;

        // Números del 61 al 75 (letra O)
        if (num >= 61 && num <= 75) return `O ${num}`;

        return num.toString();
    }

    /**
     * Obtiene la letra del bingo para un número
     */
    getBingoLetter(number) {
        const num = parseInt(number);
        if (num >= 1 && num <= 15) return 'B';
        if (num >= 16 && num <= 30) return 'I';
        if (num >= 31 && num <= 45) return 'N';
        if (num >= 46 && num <= 60) return 'G';
        if (num >= 61 && num <= 75) return 'O';
        return '';
    }

    /**
     * Reproduce la voz para un número
     */
    speakNumber(number) {
        if (!this.synth || !this.isEnabled) return;

        // Cancelar cualquier utterance pendiente
        this.synth.cancel();

        const letter = this.getBingoLetter(number);
        const text = `${letter}, ${number}`;

        const utterance = new SpeechSynthesisUtterance(text);

        // Configurar voz
        if (this.spanishVoice) {
            utterance.voice = this.spanishVoice;
            utterance.lang = this.spanishVoice.lang;
        } else {
            utterance.lang = 'es-ES';
        }

        // Configurar parámetros
        utterance.volume = this.volume;
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;

        // Eventos
        utterance.onstart = () => {
            console.log(`🔊 Cantando: ${text}`);
        };

        utterance.onerror = (event) => {
            if (event.error !== 'canceled') {
                console.error('Error en síntesis de voz:', event.error);
            }
        };

        // Reproducir
        this.synth.speak(utterance);
    }

    /**
     * Activa/desactiva la voz
     */
    toggle() {
        this.isEnabled = !this.isEnabled;
        this.savePreferences();

        if (!this.isEnabled) {
            this.synth.cancel();
        }

        return this.isEnabled;
    }

    /**
     * Establece el volumen (0.0 a 1.0)
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        this.savePreferences();
    }

    /**
     * Establece la velocidad (0.1 a 2.0)
     */
    setRate(value) {
        this.rate = Math.max(0.1, Math.min(2, value));
        this.savePreferences();
    }

    /**
     * Verifica si el sistema está activo
     */
    isActive() {
        return this.isEnabled && this.synth !== null;
    }

    /**
     * Obtiene información del estado actual
     */
    getInfo() {
        return {
            enabled: this.isEnabled,
            volume: this.volume,
            rate: this.rate,
            voice: this.spanishVoice ? this.spanishVoice.name : 'Default',
            language: this.spanishVoice ? this.spanishVoice.lang : 'es-ES'
        };
    }
}

// ==========================================
// INICIALIZACIÓN GLOBAL
// ==========================================

// Crear instancia global cuando el DOM esté listo
let bingoVoice = null;

document.addEventListener('DOMContentLoaded', () => {
    // Pequeña demora para asegurar que todo esté cargado
    setTimeout(() => {
        bingoVoice = new BingoVoiceSystem();

        // Hacer disponible globalmente para debugging
        window.bingoVoice = bingoVoice;

        console.log('🎯 BingoVoiceSystem disponible como window.bingoVoice');
    }, 500);
});

// ==========================================
// API PÚBLICA (opcional para controles externos)
// ==========================================

/**
 * Activa o desactiva la voz del bingo
 * @returns {boolean} Nuevo estado
 */
function toggleBingoVoice() {
    if (bingoVoice) {
        const state = bingoVoice.toggle();
        console.log(state ? '🔊 Voz activada' : '🔇 Voz desactivada');
        return state;
    }
    return false;
}

/**
 * Prueba la voz con un número de ejemplo
 */
function testBingoVoice() {
    if (bingoVoice) {
        const testNumbers = ['B-5', 'I-23', 'N-42', 'G-55', 'O-71'];
        const randomTest = testNumbers[Math.floor(Math.random() * testNumbers.length)];
        bingoVoice.speakNumber(randomTest.replace(/[^0-9]/g, ''));
    }
}
