(() => {

    /** @typedef {{ name: string, car: number }} Driver */
    /** @typedef {{ id: number, drivers: Driver[], status: 'upcoming' | 'current' | 'finished' }} RaceSession */
    /** @typedef {{ raceSessions: RaceSession[], currentSessionId: number | null, raceMode: 'Safe' | 'Hazard' | 'Danger' | 'Finish' }} InitialData */
    /** @typedef {{ session: RaceSession, raceMode: 'Safe' | 'Hazard' | 'Danger' | 'Finish' }} RaceStartedData */
    /** @typedef {{ remainingSeconds: number, totalDuration: number }} TimerData */
    /** @typedef {{ success: boolean, message?: string }} AuthResponse */
    /** @typedef {{ on(event: string, listener: (...args: any[]) => void): void, emit(event: string, payload?: unknown): void }} SocketLike */
    /** @typedef {Window & typeof globalThis & { io: () => SocketLike, authenticate: typeof authenticate }} LapLineTrackerWindow */

    /** @type {SocketLike | null} */
    let socket = null;
    let authenticated = false;
    /** @type {Set<number>} */
    let registeredCars = new Set();
    let raceEnded = false;
    /** @type {number | null} */
    let animationFrameId = null;
    /** @type {number | null} */
    let dangerStartTime = null;
    /** @type {Record<number, number>} */
    let carLapStartTimes = {}; // Stores the timestamp of the last time the car crossed the line
    /** @type {LapLineTrackerWindow} */
    const lapLineTrackerWindow = /** @type {LapLineTrackerWindow} */ (window);

    /**
     * @param {string} id
     * @returns {HTMLElement}
     */
    function getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Missing element #${id}`);
        }
        return element;
    }

    /**
     * @param {string} id
     * @returns {HTMLInputElement}
     */
    function getInputElement(id) {
        const element = getElement(id);
        if (!(element instanceof HTMLInputElement)) {
            throw new Error(`Element #${id} is not an input`);
        }
        return element;
    }

    /**
     * @param {string} id
     * @returns {HTMLDivElement}
     */
    function getDivElement(id) {
        const element = getElement(id);
        if (!(element instanceof HTMLDivElement)) {
            throw new Error(`Element #${id} is not a div`);
        }
        return element;
    }

    /**
     * @returns {Promise<void>}
     */
    async function authenticate() {
        const key = getInputElement('accessKey').value;
        const response = await fetch('/auth/lap-line-tracker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        /** @type {AuthResponse} */
        const result = await response.json();
        if (result.success) {
            authenticated = true;
            getElement('auth').style.display = 'none';
            getElement('main').style.display = 'block';
            initSocket();
        } else {
            getElement('authError').textContent = result.message ?? 'Authentication failed';
        }
    }

    /**
     * @returns {void}
     */
    function initSocket() {
        socket = lapLineTrackerWindow.io();

        socket.on('initialData', /** @param {InitialData} data */(data) => {
            updateRegisteredCars(data.raceSessions, data.currentSessionId);
            updateStatus(data.raceMode);
        });

        socket.on('sessionsUpdated', /** @param {RaceSession[]} sessions */(sessions) => {
            updateRegisteredCars(sessions, null); // Assume current is set elsewhere
        });

        socket.on('raceStarted', /** @param {RaceStartedData} data */(data) => {
            raceEnded = false;
            const startTime = Date.now(); // The "Green Flag" time
            carLapStartTimes = {}; // Reset tracking
            data.session.drivers.forEach(driver => {
                carLapStartTimes[driver.car] = startTime;
            });
            updateRegisteredCars([data.session], data.session.id);
            updateStatus(data.raceMode);

        });

        socket.on('timerUpdate', /** @param {TimerData} data */(data) => {
            updateTimer(data);
        });

        socket.on('raceModeChanged', /** @param {'Safe' | 'Hazard' | 'Danger' | 'Finish'} mode */(mode) => {
            updateStatus(mode);
            if (mode === 'Danger') {
                dangerStartTime = Date.now(); // Record when the pause started
            }
            else if (dangerStartTime !== null && (mode === 'Safe' || mode === 'Hazard')) {
                // Calculate how long the pause lasted
                const pauseDuration = Date.now() - dangerStartTime;

                // "Shift" every car's lap start time forward by the pause duration
                for (let car in carLapStartTimes) {
                    carLapStartTimes[car] += pauseDuration;
                }

                dangerStartTime = null; // Reset for next time
            }
            updateButtons();

        });

        socket.on('raceFinished', () => {

            updateButtons();
            updateStatus('Finish');
        });

        socket.on('sessionEnded', () => {
            raceEnded = true;
            updateButtons();
            getElement('status').textContent = 'Race session ended.';
        });
    }
    function startLiveDisplays() {
        if (animationFrameId) return; // Already running

        const updateLoop = () => {
            if (raceEnded) {
                animationFrameId = null;
                return;
            }

            const now = Date.now();

            // Loop through all cars we are tracking
            for (const carNum in carLapStartTimes) {
                const display = document.getElementById(`lapDisplay-${carNum}`);
                if (display) {
                    let startTime = carLapStartTimes[carNum];

                    // If the race is currently PAUSED (Danger), 
                    // we stop the clock from moving forward visually
                    let elapsed;
                    if (dangerStartTime) {
                        elapsed = (dangerStartTime - startTime) / 1000;
                    } else {
                        elapsed = (now - startTime) / 1000;
                    }

                    // Update the text (e.g., 42.53)
                    display.textContent = elapsed.toFixed(2);
                }
            }

            animationFrameId = requestAnimationFrame(updateLoop);
        };

        animationFrameId = requestAnimationFrame(updateLoop);
    }
    /**
     * @param {number} car
     * @returns {void}
     */
    function submitLap(car) {
        if (raceEnded || !socket) return;
        const now = Date.now();
        const startTime = carLapStartTimes[car];
        if (!startTime) {
            console.error(`No start time recorded for car ${car}`);
            return;
        }
        // Calculate lap time in seconds (e.g., 45200ms -> 45.20s)
        const lapTime = (now - startTime) / 1000;
        // Safety: Prevent "double clicks" (e.g., ignore if lap is under 2 seconds)
        if (lapTime < 2) {
            return;
        }
        // Send to server
        socket.emit('lapCompleted', { car, lapTime: parseFloat(lapTime.toFixed(3)) });

        // Update the start point for the NEXT lap to "now"
        carLapStartTimes[car] = now;

        // Optional: Flash the UI or show the time briefly
        console.log(`Car ${car} completed lap in ${lapTime.toFixed(2)}s`);
    }

    /**
     * @param {RaceSession[]} sessions
     * @param {number | null} currentId
     * @returns {void}
     */
    function updateRegisteredCars(sessions, currentId) {
        registeredCars.clear();
        if (currentId !== null) {
            const session = sessions.find((s) => s.id === currentId);
            if (session) {
                session.drivers.forEach((driver) => registeredCars.add(driver.car));
            }
        }
        updateButtons();
    }

    /**
     * @returns {void}
     */
    function updateButtons() {
        const carsDiv = getDivElement('cars');
        carsDiv.innerHTML = '';
        for (let i = 1; i <= 8; i += 1) {
            const carDiv = document.createElement('div');
            carDiv.className = 'car-container'; // For styling

            const button = document.createElement('button');
            button.textContent = `Car ${i}`;
            button.className = 'car-btn';
            button.disabled = !registeredCars.has(i) || raceEnded;
            button.onclick = () => submitLap(i);

            // This replaces the old input field
            const display = document.createElement('div');
            display.id = `lapDisplay-${i}`;
            display.className = 'lap-timer-display';
            display.textContent = '0.00';

            carDiv.appendChild(button);
            carDiv.appendChild(display); // Add the timer below the button
            carsDiv.appendChild(carDiv);
        }
        startLiveDisplays();
    }

    /**
     * @param {TimerData} data
     * @returns {void}
     */
    function updateTimer(data) {
        const minutes = Math.floor(data.remainingSeconds / 60);
        const seconds = data.remainingSeconds % 60;
        getElement('timer').textContent = `Timer: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * @param {'Safe' | 'Hazard' | 'Danger' | 'Finish'} mode
     * @returns {void}
     */
    function updateStatus(mode) {
        getElement('status').textContent = `Race Mode: ${mode}`;
    }

    lapLineTrackerWindow.authenticate = authenticate;
})();
