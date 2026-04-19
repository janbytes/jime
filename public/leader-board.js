(() => {

/** @typedef {{ name: string, car: number }} Driver */
/** @typedef {{ id: number, drivers: Driver[], status: 'upcoming' | 'current' | 'finished' }} RaceSession */
/** @typedef {{ laps: number, bestLap: number | null, lastLapTime: number | null }} CarStat */
/** @typedef {{ raceSessions: RaceSession[], currentSessionId: number | null, carStats: Record<number, CarStat>, raceMode: 'Safe' | 'Hazard' | 'Danger' | 'Finish' }} InitialData */
/** @typedef {{ session: RaceSession, carStats: Record<number, CarStat> }} RaceStartedData */
/** @typedef {{ remainingSeconds: number, totalDuration: number }} TimerData */
/** @typedef {{ on(event: string, listener: (...args: any[]) => void): void }} SocketLike */
/** @typedef {Window & typeof globalThis & { io: () => SocketLike, toggleFullscreen: typeof toggleFullscreen }} LeaderBoardWindow */

/** @type {LeaderBoardWindow} */
const leaderBoardWindow = /** @type {LeaderBoardWindow} */ (window);
/** @type {SocketLike} */
const socket = leaderBoardWindow.io();
/** @type {RaceSession | null} */
let currentSession = null;
/** @type {Record<number, CarStat>} */
let carStats = {};
/** @type {Driver[]} */
let drivers = [];

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
 * @returns {HTMLTableSectionElement}
 */
function getTableSection(id) {
    const element = getElement(id);
    if (!(element instanceof HTMLTableSectionElement)) {
        throw new Error(`Element #${id} is not a table section`);
    }
    return element;
}

socket.on('initialData', /** @param {InitialData} data */ (data) => {
    updateData(data);
});

socket.on('sessionsUpdated', /** @param {RaceSession[]} sessions */ (sessions) => {
    // Find current session
    const currentSessionId = currentSession ? currentSession.id : null;
    currentSession = sessions.find((session) => session.id === currentSessionId) || sessions.find((session) => session.status === 'current') || null;
    if (currentSession) {
        drivers = currentSession.drivers;
    } else {
        drivers = [];
    }
    updateDisplay();
});

socket.on('raceStarted', /** @param {RaceStartedData} data */ (data) => {
    currentSession = data.session;
    drivers = data.session.drivers;
    carStats = data.carStats;
    updateDisplay();
});

socket.on('carStatsUpdated', /** @param {Record<number, CarStat>} stats */ (stats) => {
    carStats = stats;
    updateDisplay();
});

socket.on('timerUpdate', /** @param {TimerData} data */ (data) => {
    updateTimer(data);
});

socket.on('raceModeChanged', /** @param {'Safe' | 'Hazard' | 'Danger' | 'Finish'} mode */ (mode) => {
    updateFlag(mode);
});

socket.on('raceFinished', () => {
    updateFlag('Finish');
});

/**
 * @param {InitialData} data
 * @returns {void}
 */
function updateData(data) {
    currentSession = data.raceSessions.find((session) => session.id === data.currentSessionId) || null;
    if (currentSession) {
        drivers = currentSession.drivers;
    } else {
        drivers = [];
    }
    carStats = data.carStats;
    updateFlag(data.raceMode);
    updateDisplay();
}

/**
 * @returns {void}
 */
function updateDisplay() {
    const tbody = getTableSection('leaderboardBody');
    tbody.innerHTML = '';

    if (!currentSession || !drivers.length) {
        tbody.innerHTML = '<tr><td colspan="5">No active race</td></tr>';
        return;
    }

    // Create list of drivers with stats
    const leaderboard = drivers.map((driver) => ({
        ...driver,
        stats: carStats[driver.car] || { laps: 0, bestLap: null, lastLapTime: null }
    }));

    // Sort by best lap (ascending), then by laps (descending)
    leaderboard.sort((a, b) => {
        if (a.stats.bestLap === null && b.stats.bestLap === null) return b.stats.laps - a.stats.laps;
        if (a.stats.bestLap === null) return 1;
        if (b.stats.bestLap === null) return -1;
        if (a.stats.bestLap === b.stats.bestLap) return b.stats.laps - a.stats.laps;
        return a.stats.bestLap - b.stats.bestLap;
    });

    leaderboard.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.name}</td>
            <td>${item.car}</td>
            <td>${item.stats.bestLap ? item.stats.bestLap.toFixed(2) + 's' : '-'}</td>
            <td>${item.stats.laps}</td>
        `;
        tbody.appendChild(row);
    });
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
function updateFlag(mode) {
    getElement('flag').textContent = `Flag: ${mode}`;
}

/**
 * @returns {void}
 */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

leaderBoardWindow.toggleFullscreen = toggleFullscreen;
})();
