(() => {
    /** @typedef {{ name: string, car: number }} Driver */
    /** @typedef {{ id: number, drivers: Driver[], status: 'upcoming' | 'current' | 'finished' }} RaceSession */
    /** @typedef {{ raceSessions: RaceSession[], currentSessionId: number | null, raceMode: 'Safe' | 'Hazard' | 'Danger' | 'Finish' }} InitialData */
    /** @typedef {{ session: RaceSession, raceMode: 'Safe' | 'Hazard' | 'Danger' | 'Finish' }} RaceStartedData */
    /** @typedef {{ remainingSeconds: number, totalDuration: number }} TimerData */
    /** @typedef {'Safe' | 'Hazard' | 'Danger' | 'Finish'} RaceMode */
    /** @typedef {{ success: boolean, message?: string }} AuthResponse */
    /** @typedef {{ on(event: string, listener: (...args: any[]) => void): void, emit(event: string, payload?: unknown): void }} SocketLike */

    /** * Define the window interface including external Socket.io and our custom functions
     * @typedef {Window & typeof globalThis & { 
     * io: () => SocketLike, 
     * editDriver: (id: number, old: string, car: number) => void,
     * authenticate: () => Promise<void>,
     * startRace: (restart: boolean) => void,
     * setMode: (mode: RaceMode) => void,
     * endSession: () => void
     * }} RaceControlWindow 
     */

    /** @type {SocketLike | null} */
    let socket = null;
    /** @type {RaceSession | null} */
    let currentSession = null;
    /** @type {RaceSession | null} */
    let nextSession = null;
    /** @type {boolean} */
    let isSessionEnded = false;

    /** @type {RaceControlWindow} */
    const rcWindow = /** @type {any} */(window);

    // --- DOM HELPERS ---

    /** @param {string} id @returns {HTMLElement} */
    function getElement(id) {
        const el = document.getElementById(id);
        if (!el) throw new Error(`Missing #${id}`);
        return el;
    }

    /** @param {string} id @returns {HTMLDivElement} */
    function getDiv(id) {
        const el = getElement(id);
        if (!(el instanceof HTMLDivElement)) throw new Error(`#${id} not a div`);
        return el;
    }

    // --- AUTHENTICATION ---

    async function authenticate() {
        const input = getElement('accessKey');
        if (!(input instanceof HTMLInputElement)) return;

        const key = input.value;
        const res = await fetch('/auth/race-control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });

        /** @type {AuthResponse} */
        const result = await res.json();

        if (result.success) {
            getElement('auth').style.display = 'none';
            getElement('main').style.display = 'block';
            initSocket();
        } else {
            getElement('authError').textContent = result.message || 'Auth Failed';
        }
    }

    // --- SOCKET LOGIC ---

    function initSocket() {
        // 'io' is now recognized thanks to the updated typedef
        socket = rcWindow.io();
        if (!socket) return;

        socket.on('initialData', /** @param {InitialData} data */(data) => {
            updateState(data.raceSessions, data.currentSessionId);
            updateModeButtons(data.raceMode);
        });

        socket.on('sessionsUpdated', /** @param {RaceSession[]} sessions */(sessions) => {
            const currentId = currentSession ? currentSession.id : null;
            updateState(sessions, currentId);
        });

        socket.on('raceStarted', /** @param {RaceStartedData} data */(data) => {
            isSessionEnded = false;
            updateState([data.session], data.session.id);
            updateModeButtons(data.raceMode);
        });

        socket.on('timerUpdate', /** @param {TimerData} data */(data) => updateTimer(data));
        socket.on('raceModeChanged', /** @param {RaceMode} mode */(mode) => updateModeButtons(mode));

        socket.on('sessionEnded', () => {
            isSessionEnded = true;
            renderCurrentSession();
            const timerEl = document.getElementById('timer');
            if (timerEl) {
                timerEl.textContent = "Timer: --:--";
                // Or "Timer: 0:00" depending on your preference
            }
        });
    }

    // --- CORE FUNCTIONS ---

    /** @param {boolean} isRestart */
    function startRace(isRestart) {
        if (!socket) return;

        if (isRestart) {
            if (!currentSession) return alert("No active race to restart.");
            if (isSessionEnded) {
                return alert("The race has already ended. You cannot restart the timer now.");
            }
            if (confirm("RESTART TIMER?")) socket.emit('startRace');
        } else {
            if (!nextSession) return alert("No upcoming race scheduled.");

            if (currentSession && !isSessionEnded) {
                if (!confirm("A race is live. Override and start next session?")) return;
            }
            socket.emit('startRace');
        }
    }

    /** @type {boolean} */
    let isProcessingEnd = false;

    function endSession() {
        if (!socket || !currentSession || isProcessingEnd) return;

        if (confirm("Close and Archive? This will clear the current race view.")) {
            // 1. Set the flag to block further clicks
            isProcessingEnd = true;

            // 2. Optionally disable the button visually
            const endBtn = /** @type {HTMLButtonElement|null} */(document.querySelector('.danger-btn'));
            if (endBtn) endBtn.disabled = true;

            socket.emit('endSession');

            // 3. Reset the flag after a short delay or when the state updates
            // This ensures the button becomes usable again for the NEXT race
            setTimeout(() => {
                isProcessingEnd = false;
                if (endBtn) endBtn.disabled = false;
            }, 2000);
        }
    }

    /** @param {RaceMode} mode */
    function setMode(mode) {
        if (socket) socket.emit('setRaceMode', mode);
    }

    // --- RENDERING ---

    /**
     * @param {RaceSession[]} sessions 
     * @param {number|null} currentId 
     */
    function updateState(sessions, currentId) {
        currentSession = sessions.find(s => s.id === currentId) || null;
        nextSession = sessions.find(s => s.status === 'upcoming' && s.id !== currentId) || null;

        renderCurrentSession();
        renderNextSession();
    }

    function renderCurrentSession() {
        const div = getDiv('currentSession');
        const endBtn = /** @type {HTMLButtonElement|null} */(document.querySelector('.danger-btn'));

        if (!currentSession || isSessionEnded) {
            // If no session exists OR the race just finished (but isn't archived)
            // We show the "Ended" state and LOCK the button
            div.innerHTML = currentSession
                ? `<h3>Session ${currentSession.id} <span class="badge badge-ended">ENDED</span></h3>`
                : '<h3>Current Race</h3><p>No active session.</p>';

            if (endBtn) {
                endBtn.disabled = true;
                endBtn.style.opacity = "0.5";
                endBtn.style.cursor = "not-allowed";
            }
            return;
        }

        // If we reach here, a race is LIVE
        if (endBtn) {
            endBtn.disabled = false;
            endBtn.style.opacity = "1";
            endBtn.style.cursor = "pointer";
        }

        div.innerHTML = `
        <h3>Session ${currentSession.id} <span class="badge badge-live">LIVE</span></h3>
        <ul>${currentSession.drivers.map(d => `<li>Car ${d.car}: ${d.name}</li>`).join('')}</ul>
    `;
    }

    function renderNextSession() {
        const div = getDiv('nextSession');
        const startNextBtn = /** @type {HTMLButtonElement|null} */(document.querySelector('.primary-btn'));
        if (!nextSession) {
            div.innerHTML = '<p>No upcoming races in schedule.</p>';
            if (startNextBtn) {
                startNextBtn.disabled = true;
                startNextBtn.style.opacity = "0.5";
                startNextBtn.style.cursor = "not-allowed";
            }
            return;
        }
        if (startNextBtn) {
            startNextBtn.disabled = false;
            startNextBtn.style.opacity = "1";
            startNextBtn.style.cursor = "pointer";
        }
        /** @type {RaceSession} */
        const session = nextSession;
        div.innerHTML = `
            <h3>Next: Session ${session.id}</h3>
            <ul>
                ${session.drivers.map(d => `
                    <li>
                        Car ${d.car}: ${d.name}
                        <button class="edit-small" onclick="editDriver(${session.id}, '${d.name}', ${d.car})">Edit</button>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    // --- EXPOSING TO HTML ---

    /** @param {number} sessionId @param {string} oldName @param {number} currentCar */
    rcWindow.editDriver = (sessionId, oldName, currentCar) => {
        const newName = prompt("Edit Driver Name:", oldName);
        if (!newName) return;
        const carInput = prompt("Edit Car Number:", currentCar.toString());
        const car = carInput ? parseInt(carInput, 10) : currentCar;

        if (socket) {
            socket.emit('updateDriver', { sessionId, oldName, newName, car });
        }
    };

    /** @param {TimerData} data */
    function updateTimer(data) {
        const min = Math.floor(data.remainingSeconds / 60);
        const sec = data.remainingSeconds % 60;
        getElement('timer').textContent = `Timer: ${min}:${sec.toString().padStart(2, '0')}`;
    }

    /** @param {RaceMode} mode */
    function updateModeButtons(mode) {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        const active = document.getElementById(mode.toLowerCase());
        if (active) active.classList.add('active');
    }

    rcWindow.authenticate = authenticate;
    rcWindow.startRace = startRace;
    rcWindow.setMode = setMode;
    rcWindow.endSession = endSession;

})();
