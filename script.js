/* ═══════════════════════════════════════════
   TERENZIO — Script Interattivo (Clean)
   Gestione fasi, audio, transizioni, face annotation
   ═══════════════════════════════════════════ */

(function () {
    'use strict';

    // ═══════════════════════════════════════
    // STATO GLOBALE
    // ═══════════════════════════════════════
    const state = {
        currentPhase: 'intro',
        audioPlaying: false,
    };

    // ═══════════════════════════════════════
    // ELEMENTI DOM
    // ═══════════════════════════════════════
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const els = {
        introScreen: $('#intro-screen'),
        videoPortal: $('#video-portal'),
        arrivalScene: $('#arrival-scene'),
        slidesContainer: $('#slides-container'),
        btnStart: $('#btn-start'),
        video: $('#intro-video'),
        typewriterText: $('#typewriter-text'),
        audioControls: $('#audio-controls'),
        btnAudioToggle: $('#btn-audio-toggle'),
        btnMusicSelect: $('#btn-music-select'),
        musicDropdown: $('#music-dropdown'),
        volumeSlider: $('#volume-slider'),
        transitionOverlay: $('#transition-overlay'),
        btnBackArrival: $('#btn-back-arrival'),
        slidesNav: $('#slides-nav'),
        faceAnnotation: $('#face-annotation'),
        faceLabel: $('#face-label'),
    };

    // ═══════════════════════════════════════
    // AUDIO AMBIENTE (Web Audio API)
    // Lira greca sintetizzata
    // ═══════════════════════════════════════
    class AmbientAudio {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.isPlaying = false;
            this.currentScale = 0;
        }

        init() {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.15;

            // Riverbero con convolver simulato
            const convolver = this.ctx.createConvolver();
            const reverbLength = 3 * this.ctx.sampleRate;
            const impulse = this.ctx.createBuffer(2, reverbLength, this.ctx.sampleRate);
            for (let channel = 0; channel < 2; channel++) {
                const data = impulse.getChannelData(channel);
                for (let i = 0; i < reverbLength; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLength, 2.5);
                }
            }
            convolver.buffer = impulse;

            const reverbGain = this.ctx.createGain();
            reverbGain.gain.value = 0.3;

            this.masterGain.connect(this.ctx.destination);
            this.masterGain.connect(convolver);
            convolver.connect(reverbGain);
            reverbGain.connect(this.ctx.destination);
        }

        // Scala pentatonica greca (modo dorico)
        getNote(index) {
            const baseFreq = 220;
            const intervals = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19];
            const octave = Math.floor(index / intervals.length);
            const note = intervals[index % intervals.length];
            return baseFreq * Math.pow(2, (note + octave * 12) / 12);
        }

        playNote(freq, startTime, duration, volume = 0.12) {
            if (!this.ctx) return;

            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc1.type = 'triangle';
            osc1.frequency.value = freq;

            osc2.type = 'sine';
            osc2.frequency.value = freq * 2;

            const gain2 = this.ctx.createGain();
            gain2.gain.value = 0.15;

            osc1.connect(gain);
            osc2.connect(gain2);
            gain2.connect(gain);
            gain.connect(this.masterGain);

            const attackTime = 0.05;
            const decayTime = duration * 0.3;
            const sustainLevel = volume * 0.4;

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(volume, startTime + attackTime);
            gain.gain.linearRampToValueAtTime(sustainLevel, startTime + attackTime + decayTime);
            gain.gain.linearRampToValueAtTime(0, startTime + duration);

            osc1.start(startTime);
            osc1.stop(startTime + duration + 0.1);
            osc2.start(startTime);
            osc2.stop(startTime + duration + 0.1);
        }

        playPattern() {
            if (!this.isPlaying || !this.ctx) return;

            const now = this.ctx.currentTime;
            const tempo = 0.8;

            const patterns = [
                [0, 2, 4, 5, 4, 2, 0, -1],
                [2, 4, 5, 7, 5, 4, 2, 0],
                [5, 4, 2, 0, 2, 4, 5, 7],
                [7, 5, 4, 2, 4, 5, 7, 9],
                [0, 4, 7, 5, 4, 2, 0, 2],
            ];

            const pattern = patterns[this.currentScale % patterns.length];
            this.currentScale++;

            pattern.forEach((noteIdx, i) => {
                const freq = this.getNote(noteIdx + 3);
                const duration = tempo * (0.7 + Math.random() * 0.6);
                const startTime = now + i * tempo;
                this.playNote(freq, startTime, duration, 0.08 + Math.random() * 0.06);
            });

            // Drone di base
            const droneFreq = this.getNote(0);
            const droneGain = this.ctx.createGain();
            const droneOsc = this.ctx.createOscillator();
            droneOsc.type = 'sine';
            droneOsc.frequency.value = droneFreq / 2;
            droneGain.gain.value = 0.03;
            droneOsc.connect(droneGain);
            droneGain.connect(this.masterGain);
            droneOsc.start(now);
            droneOsc.stop(now + pattern.length * tempo);

            const patternDuration = pattern.length * tempo;
            const pause = 1 + Math.random() * 2;
            setTimeout(() => this.playPattern(), (patternDuration + pause) * 1000);
        }

        start() {
            if (!this.ctx) this.init();
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            this.isPlaying = true;
            this.playPattern();
        }

        stop() {
            this.isPlaying = false;
        }

        toggle() {
            if (this.isPlaying) {
                this.stop();
            } else {
                this.start();
            }
            return this.isPlaying;
        }

        setVolume(value) {
            if (this.masterGain) {
                this.masterGain.gain.value = value;
            }
        }
    }

    // ═══════════════════════════════════════
    // EFFETTO TYPEWRITER
    // ═══════════════════════════════════════
    class Typewriter {
        constructor(element, text, speed = 60) {
            this.element = element;
            this.text = text;
            this.speed = speed;
            this.index = 0;
        }

        start() {
            return new Promise((resolve) => {
                const type = () => {
                    if (this.index < this.text.length) {
                        this.element.textContent += this.text[this.index];
                        this.index++;
                        setTimeout(type, this.speed);
                    } else {
                        resolve();
                    }
                };
                type();
            });
        }
    }

    // ═══════════════════════════════════════
    // GESTIONE TRANSIZIONI TRA FASI
    // ═══════════════════════════════════════
    function transitionTo(targetId, callback, immediate = false) {
        if (immediate) {
            $$('.phase').forEach(p => {
                p.classList.add('no-transition');
                p.classList.remove('active');
            });

            const target = $(`#${targetId}`);
            if (target) {
                target.classList.add('active');
            }

            if (callback) callback();

            setTimeout(() => {
                $$('.phase').forEach(p => p.classList.remove('no-transition'));
            }, 50);
            return;
        }

        const overlay = els.transitionOverlay;
        overlay.classList.add('active');

        setTimeout(() => {
            $$('.phase').forEach(p => p.classList.remove('active'));

            const target = $(`#${targetId}`);
            if (target) {
                target.classList.add('active');
            }

            if (callback) callback();

            setTimeout(() => {
                overlay.classList.remove('active');
            }, 500);
        }, 1200);
    }

    // ═══════════════════════════════════════
    // ANIMAZIONE FACCIA
    // ═══════════════════════════════════════
    function animateFaceAnnotation() {
        // Mostra il container
        els.faceAnnotation.classList.add('visible');

        // Mostra la label con nome e link
        setTimeout(() => {
            els.faceLabel.classList.add('visible');
        }, 600);
    }

    // ═══════════════════════════════════════
    // GESTIONE VIDEO
    // ═══════════════════════════════════════
    function startVideo() {
        transitionTo('video-portal', () => {
            state.currentPhase = 'video';
            els.video.play().catch(err => {
                console.warn('Video autoplay blocked:', err);
                els.video.controls = true;
            });

            // PREPARA SCENA ARRIVO (dietro il video per taglio istantaneo)
            els.arrivalScene.classList.add('active', 'no-transition');
            els.arrivalScene.style.zIndex = '1';
            els.videoPortal.style.zIndex = '10';
        });

        // Show audio controls
        els.audioControls.classList.remove('hidden');
    }

    function onVideoEnd() {
        // Taglio istantaneo
        els.videoPortal.classList.remove('active');
        els.videoPortal.style.zIndex = '1';
        els.arrivalScene.style.zIndex = '10';
        els.arrivalScene.classList.remove('no-transition');

        state.currentPhase = 'arrival';
        startArrivalSequence();
    }

    // ═══════════════════════════════════════
    // SEQUENZA ARRIVO
    // ═══════════════════════════════════════
    async function startArrivalSequence() {
        // Anima la face annotation
        await delay(600);
        animateFaceAnnotation();

        // Typewriter per la citazione
        await delay(1500);
        const quoteText = 'Homo sum, humani nihil a me alienum puto.';
        const typewriter = new Typewriter(els.typewriterText, quoteText, 70);
        await typewriter.start();

        // Mostra traduzione
        await delay(800);
        const translation = $('.quote-translation');
        translation.textContent = '« Sono un essere umano, nulla di ciò che è umano mi è estraneo. »';
        translation.classList.add('visible');

        // Mostra autore
        await delay(600);
        $('.quote-author').classList.add('visible');
    }

    // ═══════════════════════════════════════
    // NAVIGAZIONE SLIDES
    // ═══════════════════════════════════════
    function showSlide(slideId) {
        $$('.slide').forEach(s => s.classList.remove('active'));
        $$('.nav-tab').forEach(t => t.classList.remove('active'));

        const targetSlide = $(`#${slideId}`);
        if (targetSlide) {
            targetSlide.classList.add('active');
            targetSlide.querySelectorAll('.timeline-item').forEach((item, i) => {
                item.style.animation = 'none';
                item.offsetHeight;
                item.style.animation = `fade-in-left 0.6s ease ${i * 0.15}s forwards`;
            });
        }

        const activeTab = $(`.nav-tab[data-slide="${slideId}"]`);
        if (activeTab) activeTab.classList.add('active');
    }

    function goToSlides(slideId) {
        if (state.currentPhase === 'slides') {
            showSlide(slideId);
            return;
        }

        transitionTo('slides-container', () => {
            state.currentPhase = 'slides';
            showSlide(slideId || 'slide-vita');
        });
    }

    function goBackToArrival() {
        transitionTo('arrival-scene', () => {
            state.currentPhase = 'arrival';
        });
    }

    // ═══════════════════════════════════════
    // MUSIC DROPDOWN
    // ═══════════════════════════════════════
    function toggleMusicDropdown() {
        els.musicDropdown.classList.toggle('open');
    }

    function selectMusicTrack(trackBtn) {
        // Rimuovi active da tutti
        $$('.music-option').forEach(o => o.classList.remove('active'));
        trackBtn.classList.add('active');

        const trackId = trackBtn.dataset.track;
        console.log(`🎵 Traccia selezionata: ${trackId}`);

        // Chiudi dropdown
        els.musicDropdown.classList.remove('open');

        // TODO: Per ora solo la lira sintetizzata funziona.
        // Quando l'utente aggiungerà le tracce mp3, si potrà
        // integrare qui il cambio di sorgente audio.
    }

    // ═══════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ═══════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════
    function init() {
        // Audio
        const audio = new AmbientAudio();

        // ── Event: Pulsante Start ──
        els.btnStart.addEventListener('click', () => {
            audio.start();
            state.audioPlaying = true;
            startVideo();
        });

        // ── Event: Video terminato ──
        els.video.addEventListener('ended', onVideoEnd);

        // ── Event: Skip video (click) ──
        els.video.addEventListener('click', () => {
            if (els.video.currentTime > 2) {
                els.video.pause();
                onVideoEnd();
            }
        });

        // ── Event: Face info links (arrivo → slides) ──
        $$('.face-info-link').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                goToSlides(target);
            });
        });

        // ── Event: Navigazione tabs slides ──
        $$('.nav-tab[data-slide]').forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.slide;
                showSlide(target);
            });
        });

        // ── Event: Torna indietro ──
        els.btnBackArrival.addEventListener('click', goBackToArrival);

        // ── Event: Music Select (dropdown) ──
        els.btnMusicSelect.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMusicDropdown();
        });

        // ── Event: Music Options ──
        $$('.music-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                selectMusicTrack(option);
            });
        });

        // ── Event: Close dropdown on outside click ──
        document.addEventListener('click', () => {
            els.musicDropdown.classList.remove('open');
        });

        // ── Event: Toggle Audio ──
        els.btnAudioToggle.addEventListener('click', () => {
            const playing = audio.toggle();
            state.audioPlaying = playing;
            els.btnAudioToggle.classList.toggle('muted', !playing);
        });

        // ── Event: Volume Slider ──
        els.volumeSlider.addEventListener('input', (e) => {
            const value = e.target.value / 100;
            audio.setVolume(value * 0.3);
        });

        // ── Keyboard shortcuts ──
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Escape':
                    if (state.currentPhase === 'slides') goBackToArrival();
                    els.musicDropdown.classList.remove('open');
                    break;
                case ' ':
                    if (state.currentPhase === 'video') {
                        e.preventDefault();
                        els.video.pause();
                        onVideoEnd();
                    }
                    break;
                case 'ArrowRight':
                    if (state.currentPhase === 'slides') {
                        const activeSlide = $('.slide.active');
                        const next = activeSlide?.nextElementSibling;
                        if (next && next.classList.contains('slide')) {
                            showSlide(next.id);
                        }
                    }
                    break;
                case 'ArrowLeft':
                    if (state.currentPhase === 'slides') {
                        const activeSlide = $('.slide.active');
                        const prev = activeSlide?.previousElementSibling;
                        if (prev && prev.classList.contains('slide')) {
                            showSlide(prev.id);
                        }
                    }
                    break;
                case 'm':
                case 'M':
                    const playing = audio.toggle();
                    state.audioPlaying = playing;
                    els.btnAudioToggle.classList.toggle('muted', !playing);
                    break;
            }
        });

        console.log('🏛️ Terenzio — Sito inizializzato (clean UI)');
    }

    // Avvia quando il DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
