/* ═══════════════════════════════════════════
   TERENZIO — Script v2.0
   Gestione fasi, audio, transizioni
   ═══════════════════════════════════════════ */

(function () {
    'use strict';

    // ═══════════════════════════════════════
    // STATO
    // ═══════════════════════════════════════
    const state = {
        currentPhase: 'intro',
        audioPlaying: false,
    };

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ═══════════════════════════════════════
    // ELEMENTI
    // ═══════════════════════════════════════
    const els = {
        introScreen: $('#intro-screen'),
        theaterPhase: $('#theater-phase'),
        slidesContainer: $('#slides-container'),
        btnStart: $('#btn-start'),
        video: $('#intro-video'),
        videoLayer: $('#video-layer'),
        sceneLayer: $('#scene-layer'),
        theaterFrame: $('#theater-frame'),
        infoPanel: $('#info-panel'),
        typewriterText: $('#typewriter-text'),
        sceneTranslation: $('#scene-translation'),
        sceneAuthor: $('#scene-author'),
        sceneNavLinks: $('#scene-nav-links'),
        audioControls: $('#audio-controls'),
        btnAudioToggle: $('#btn-audio-toggle'),
        volumeSlider: $('#volume-slider'),
        transitionOverlay: $('#transition-overlay'),
        btnBackArrival: $('#btn-back-arrival'),
        slidesNav: $('#slides-nav'),
        particles: $('#particles'),
    };

    // ═══════════════════════════════════════
    // PARTICELLE
    // ═══════════════════════════════════════
    function createParticles() {
        const container = els.particles;
        if (!container) return;
        const count = 40;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDuration = (8 + Math.random() * 15) + 's';
            p.style.animationDelay = (Math.random() * 10) + 's';
            p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
            container.appendChild(p);
        }
    }

    // ═══════════════════════════════════════
    // AUDIO (Lira sintetizzata)
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

            const convolver = this.ctx.createConvolver();
            const reverbLength = 3 * this.ctx.sampleRate;
            const impulse = this.ctx.createBuffer(2, reverbLength, this.ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = impulse.getChannelData(ch);
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

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
            gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.05 + duration * 0.3);
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
                this.playNote(freq, now + i * tempo, duration, 0.08 + Math.random() * 0.06);
            });

            // Drone
            const droneOsc = this.ctx.createOscillator();
            const droneGain = this.ctx.createGain();
            droneOsc.type = 'sine';
            droneOsc.frequency.value = this.getNote(0) / 2;
            droneGain.gain.value = 0.03;
            droneOsc.connect(droneGain);
            droneGain.connect(this.masterGain);
            droneOsc.start(now);
            droneOsc.stop(now + pattern.length * tempo);

            const dur = pattern.length * tempo;
            const pause = 1 + Math.random() * 2;
            setTimeout(() => this.playPattern(), (dur + pause) * 1000);
        }

        start() {
            if (!this.ctx) this.init();
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.isPlaying = true;
            this.playPattern();
        }

        stop() { this.isPlaying = false; }

        toggle() {
            if (this.isPlaying) this.stop();
            else this.start();
            return this.isPlaying;
        }

        setVolume(v) {
            if (this.masterGain) this.masterGain.gain.value = v;
        }
    }

    // ═══════════════════════════════════════
    // TYPEWRITER
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
    // TRANSIZIONI
    // ═══════════════════════════════════════
    function transitionTo(targetId, callback) {
        const overlay = els.transitionOverlay;
        overlay.classList.add('active');

        setTimeout(() => {
            $$('.phase').forEach(p => p.classList.remove('active'));
            const target = $(`#${targetId}`);
            if (target) target.classList.add('active');
            if (callback) callback();

            setTimeout(() => {
                overlay.classList.remove('active');
            }, 400);
        }, 1000);
    }

    // ═══════════════════════════════════════
    // VIDEO → SCENA (taglio netto)
    // ═══════════════════════════════════════
    function startVideo() {
        transitionTo('theater-phase', () => {
            state.currentPhase = 'video';
            els.video.play().catch(err => {
                console.warn('Video autoplay blocked:', err);
                els.video.controls = true;
            });
        });
        els.audioControls.classList.remove('hidden');
    }

    function onVideoEnd() {
        // Taglio netto: nascondi il video layer, la scena è già sotto
        els.videoLayer.classList.add('hidden');
        state.currentPhase = 'arrival';
        startArrivalSequence();
    }

    // ═══════════════════════════════════════
    // SEQUENZA ARRIVO
    // ═══════════════════════════════════════
    async function startArrivalSequence() {
        await delay(400);
        els.infoPanel.classList.add('visible');

        await delay(1200);
        const quoteText = 'Homo sum, humani nihil a me alienum puto.';
        const tw = new Typewriter(els.typewriterText, quoteText, 65);
        await tw.start();

        await delay(600);
        els.sceneTranslation.textContent = '« Sono un essere umano, nulla di ciò che è umano mi è estraneo. »';
        els.sceneTranslation.classList.add('visible');

        await delay(500);
        els.sceneAuthor.classList.add('visible');

        await delay(400);
        els.sceneNavLinks.classList.add('visible');
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
                item.offsetHeight; // force reflow
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
        transitionTo('theater-phase', () => {
            state.currentPhase = 'arrival';
        });
    }

    // ═══════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ═══════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════
    function init() {
        createParticles();

        const audio = new AmbientAudio();

        // Start
        els.btnStart.addEventListener('click', () => {
            audio.start();
            state.audioPlaying = true;
            startVideo();
        });

        // Video end
        els.video.addEventListener('ended', onVideoEnd);

        // Skip video
        els.video.addEventListener('click', () => {
            if (els.video.currentTime > 2) {
                els.video.pause();
                onVideoEnd();
            }
        });

        // Scene nav links
        $$('.scene-link').forEach(btn => {
            btn.addEventListener('click', () => {
                goToSlides(btn.dataset.target);
            });
        });

        // Slide tabs
        $$('.nav-tab[data-slide]').forEach(tab => {
            tab.addEventListener('click', () => {
                showSlide(tab.dataset.slide);
            });
        });

        // Back button
        els.btnBackArrival.addEventListener('click', goBackToArrival);

        // Audio toggle
        els.btnAudioToggle.addEventListener('click', () => {
            const playing = audio.toggle();
            state.audioPlaying = playing;
            els.btnAudioToggle.classList.toggle('muted', !playing);
        });

        // Volume
        els.volumeSlider.addEventListener('input', (e) => {
            audio.setVolume((e.target.value / 100) * 0.3);
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Escape':
                    if (state.currentPhase === 'slides') goBackToArrival();
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
                        const active = $('.slide.active');
                        const next = active?.nextElementSibling;
                        if (next && next.classList.contains('slide')) showSlide(next.id);
                    }
                    break;
                case 'ArrowLeft':
                    if (state.currentPhase === 'slides') {
                        const active = $('.slide.active');
                        const prev = active?.previousElementSibling;
                        if (prev && prev.classList.contains('slide')) showSlide(prev.id);
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

        console.log('🏛️ Terenzio v2.0 — Inizializzato');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
