(() => {
    /** @typedef {{ name: string, car: number }} Driver */
    /** @typedef {{ id: number, drivers: Driver[], status: 'upcoming' | 'current' | 'finished' }} RaceSession */
    /** @typedef {{ raceSessions: RaceSession[], currentSessionId: number | null }} InitialData */
    /** @typedef {{ on(event: string, listener: (...args: any[]) => void): void }} SocketLike */
    /** @typedef {Window & typeof globalThis & { io: () => SocketLike, toggleFullscreen: typeof toggleFullscreen }} NextRaceWindow */

    /** @type {NextRaceWindow} */
    const nextRaceWindow = /** @type {NextRaceWindow} */ (window);
    /** @type {SocketLike} */
    const socket = nextRaceWindow.io();

    /** @type {RaceSession[]} */
    let sessions = [];
    /** @type {number | null} */
    let currentSessionId = null;

    /**
     * @param {string} id
     * @returns {HTMLElement}
     */
    function getElement(id) {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Missing element #${id}`);
        return element;
    }

    /**
     * @param {string} id
     * @returns {HTMLUListElement}
     */
    function getListElement(id) {
        const element = getElement(id);
        if (!(element instanceof HTMLUListElement)) throw new Error(`Element #${id} is not a list`);
        return element;
    }

    /**
     * Returns the first upcoming session after the current one,
     * or the first upcoming session overall as fallback.
     * @returns {RaceSession | null}
     */
    function findNextUpcomingSession() {
        return sessions
            .filter(s => s.status === 'upcoming')
            .sort((a, b) => a.id - b.id)[0] ?? null;
    }

    socket.on('initialData', /** @param {InitialData} data */(data) => {
        sessions = data.raceSessions;
        currentSessionId = data.currentSessionId;
        updateDisplay();
    });

    socket.on('sessionsUpdated', (updatedSessions) => {
        console.log("sessionsUpdated RECEIVED:", updatedSessions);
        sessions = updatedSessions;
        updateDisplay();
    });

    socket.on('raceStarted', /** @param {{ currentSessionId?: number }} data */(data) => {
        // Use server-provided sessionId instead of guessing by index
        if (data && data.currentSessionId != null) {
            currentSessionId = data.currentSessionId;
        }
        updateDisplay();
    });

    socket.on('sessionEnded', /** @param {{ raceSessions?: RaceSession[], currentSessionId?: number | null }} data */(data) => {
        console.log("Session Ended received:", data);
        if (data.raceSessions) {
            sessions = data.raceSessions; // Sync the session statuses
        }
        if (data.currentSessionId !== undefined) {
            currentSessionId = data.currentSessionId; // Sync the pointer
        }
        updateDisplay();
    });

    /**
     * @returns {void}
     */
    function updateDisplay() {
        // 1. Try to find the active race
        const activeRace = sessions.find(s => s.status === 'current');

        // 2. Determine the phase (Boolean check handles 'undefined' safely)
        const phase = activeRace ? 'RACE_RUNNING' : 'BETWEEN_RACES';

        const messageDiv = getElement('message');
        const driversList = getListElement('driversList');
        const sessionBadge = document.getElementById('sessionBadge');

        const nextSession = findNextUpcomingSession();

        // PHASE: A race is currently on the track
        if (activeRace) {
            // Look for the session specifically following the active one
            const sessionAfterActive = sessions
                .filter(s => s.status === 'upcoming' && s.id > activeRace.id)
                .sort((a, b) => a.id - b.id)[0];

            if (sessionAfterActive) {
                messageDiv.textContent = `Next Race — Session ${sessionAfterActive.id}`;
                renderDrivers(sessionAfterActive);
            } else {
                messageDiv.textContent = 'Last race in progress';
                driversList.innerHTML = '<li class="no-race">Final Session</li>';
            }
        }
        // PHASE: No race is active (BETWEEN_RACES)
        else if (nextSession) {
            messageDiv.textContent = `Please proceed to paddock for Session ${nextSession.id}`;
            renderDrivers(nextSession);
        }
        // PHASE: No upcoming sessions left
        else {
            messageDiv.textContent = 'No upcoming races at the moment';
            if (sessionBadge) sessionBadge.textContent = '';
            driversList.innerHTML = '<li class="no-race">—</li>';
        }

        /**
         * Helper to update the badge and list with strict types
         * @param {RaceSession} session 
         */
        function renderDrivers(session) {
            if (sessionBadge) {
                sessionBadge.textContent = `Session #${session.id}`;
            }
            driversList.innerHTML = session.drivers.map(
                /** @param {Driver} driver */
                (driver) => `<li><span class="car-number">Car ${driver.car}</span> ${driver.name}</li>`
            ).join('');
        }
    }

    /**
     * @returns {void}
     */
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        } else {
            document.exitFullscreen();
        }
    }

    nextRaceWindow.toggleFullscreen = toggleFullscreen;
})();