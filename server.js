require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
/** @type {import('socket.io').Server} */
const io = new Server(server);

const isDev = process.argv.includes("--dev");

const raceDuration = isDev ? 60 * 1000 : 10 * 60 * 1000; // 1 min vs 10 min

// Check environment variables
const receptionistKey = process.env.receptionist_key;
const observerKey = process.env.observer_key;
const safetyKey = process.env.safety_key;

if (!receptionistKey || !observerKey || !safetyKey) {
    console.error("Error: Environment variables receptionist_key, observer_key, and safety_key must be set.");
    process.exit(1);
}

// Data structures
/** @type {Array<{id: number, drivers: Array<{name: string, car: number}>, status: 'upcoming' | 'current' | 'finished'}>} */
let raceSessions = [];
/** @type {number | null} */
let currentSessionId = null;
/** @type {'Safe' | 'Hazard' | 'Danger' | 'Finish'} */
let raceMode = 'Safe';
/** @type {ReturnType<typeof setInterval> | null} */
let raceTimerInterval = null;
/** @type {number | null} */
let raceStartTime = null;
/** @type {number | null} */
let pausedRemaining = null;
/** @type {Record<number, {laps: number, bestLap: number | null, lastLapTime: number | null}>} */
let carStats = {};

/** @typedef {{ name: string, car: number }} Driver */
/** @typedef {{ id: number, drivers: Driver[], status: 'upcoming' | 'current' | 'finished' }} RaceSession */
/** @typedef {{ sessionId: number, driverName: string, car: number | null }} AddDriverPayload */
/** @typedef {{ sessionId: number, driverName: string }} RemoveDriverPayload */
/** @typedef {{ sessionId: number, oldName: string, newName: string, car: number }} UpdateDriverPayload */
/** @typedef {{ car: number, lapTime: number }} LapCompletedPayload */
/** @typedef {'Safe' | 'Hazard' | 'Danger' | 'Finish'} RaceMode */

function clearRaceTimer() {
    if (raceTimerInterval !== null) {
        clearInterval(raceTimerInterval);
        raceTimerInterval = null;
    }
}

function getRemainingTime() {
    let remaining;

    // If raceStartTime is set, the clock is actively "ticking" 
    // This applies to both 'Safe' and 'Hazard' modes.
    if (raceStartTime !== null) {
        const elapsed = Date.now() - raceStartTime;
        remaining = Math.max(0, raceDuration - elapsed);
    }
    // If we are in 'Danger' mode, raceStartTime is null, but pausedRemaining stores the freeze-point.
    else if (pausedRemaining !== null) {
        remaining = pausedRemaining;
    }
    // Fallback for before the race starts or after it finishes.
    else {
        remaining = raceDuration;
    }

    return {
        remainingSeconds: Math.ceil(remaining / 1000),
        totalDuration: raceDuration / 1000
    };
}

function emitTimerUpdate() {
    io.emit('timerUpdate', getRemainingTime());
}

function startTimerLoop() {
    // Crucial: Clear ANY existing interval before starting a new one
    if (raceTimerInterval !== null) {
        clearInterval(raceTimerInterval);
    }
    console.log("Interval started. Remaining:", getRemainingTime().remainingSeconds);
    raceTimerInterval = setInterval(() => {
        const status = getRemainingTime();

        // Broadcast the update
        io.emit("timerUpdate", status);

        // Auto-finish if time is up
        if (status.remainingSeconds <= 0) {
            handleRaceFinish();
        }
    }, 1000);
}

function handleRaceFinish() {
    clearRaceTimer();
    raceMode = 'Finish';
    raceStartTime = null;
    pausedRemaining = 0;
    io.emit("raceModeChanged", raceMode);
    io.emit("raceFinished");
    saveData();
}

// Persistence
const dataFile = path.join(__dirname, 'data.json');

function saveData() {
    const elapsed = raceStartTime ? (Date.now() - raceStartTime) : 0;
    const data = { raceSessions, currentSessionId, raceMode, carStats, pausedRemaining, elapsedTime: elapsed };
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function loadData() {
    if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        raceSessions = data.raceSessions || [];
        currentSessionId = data.currentSessionId || null;
        raceMode = data.raceMode || 'Safe';
        carStats = data.carStats || {};
        pausedRemaining = data.pausedRemaining || null;
        if (data.raceMode === 'Safe' && data.elapsedTime > 0) {
            raceStartTime = Date.now() - data.elapsedTime;
            startTimerLoop(); // Restart the interval if it was running
        }
        if (!isDev && data.raceStartTime) {
            raceStartTime = Date.now() - data.raceStartTime;
        }
        if (isDev) {
            pausedRemaining = null;
        }
    }
}

loadData();

// serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Routes
app.get('/', (req, res) => res.redirect('/next-race'));

app.get('/front-desk', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'front-desk.html'));
});

app.get('/race-control', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'race-control.html'));
});

app.get('/lap-line-tracker', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'lap-line-tracker.html'));
});

app.get('/leader-board', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'leader-board.html'));
});

app.get('/next-race', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'next-race.html'));
});

app.get('/race-countdown', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'race-countdown.html'));
});

app.get('/race-flags', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'race-flags.html'));
});

// Auth endpoints
app.post('/auth/front-desk', (req, res) => {
    const { key } = req.body;
    setTimeout(() => {
        if (key === receptionistKey) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Invalid access key' });
        }
    }, key === receptionistKey ? 0 : 500);
});

app.post('/auth/race-control', (req, res) => {
    const { key } = req.body;
    setTimeout(() => {
        if (key === safetyKey) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Invalid access key' });
        }
    }, key === safetyKey ? 0 : 500);
});

app.post('/auth/lap-line-tracker', (req, res) => {
    const { key } = req.body;
    setTimeout(() => {
        if (key === observerKey) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Invalid access key' });
        }
    }, key === observerKey ? 0 : 500);
});

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send initial data
    socket.emit('initialData', {
        raceSessions,
        currentSessionId,
        raceMode,
        carStats
    });
    socket.emit('timerUpdate', getRemainingTime());

    // --- FRONT DESK ---
    socket.on("createSession", () => {
        const newId = raceSessions.length > 0 ? Math.max(...raceSessions.map(s => s.id)) + 1 : 1;
        raceSessions.push({ id: newId, drivers: [], status: 'upcoming' });
        io.emit("sessionsUpdated", raceSessions);
        saveData();
    });

    socket.on("deleteSession", /** @param {number} sessionId */(sessionId) => {
        raceSessions = raceSessions.filter(s => s.id !== sessionId);
        if (currentSessionId === sessionId) {
            currentSessionId = null;
        }
        io.emit("sessionsUpdated", raceSessions);
        saveData();
    });

    socket.on("addDriver", /** @param {AddDriverPayload} payload */({ sessionId, driverName, car }) => {
        const session = raceSessions.find(s => s.id === sessionId);
        if (session && session.drivers.length < 8 && !session.drivers.some(d => d.name === driverName)) {
            // Assign car if not provided or taken
            if (!car || session.drivers.some(d => d.car === car)) {
                const usedCars = session.drivers.map(d => d.car);
                car = [1, 2, 3, 4, 5, 6, 7, 8].find(c => !usedCars.includes(c)) || 1;
            }
            session.drivers.push({ name: driverName, car });
            io.emit("sessionsUpdated", raceSessions);
            saveData();
        }
    });

    socket.on("removeDriver", /** @param {RemoveDriverPayload} payload */({ sessionId, driverName }) => {
        const session = raceSessions.find(s => s.id === sessionId);
        if (session) {
            session.drivers = session.drivers.filter(d => d.name !== driverName);
            io.emit("sessionsUpdated", raceSessions);
            saveData();
        }
    });

    socket.on("updateDriver", ({ sessionId, oldName, newName, car }) => {
        const session = raceSessions.find(s => s.id === sessionId);
        if (!session) return;

        const driver = session.drivers.find(d => d.name === oldName);
        if (!driver) return;

        // // Name uniqueness (case-insensitive) Optional to add this check back in if we want to enforce unique driver names
        // const nameTaken = session.drivers.some(d =>
        //     d.name.toLowerCase() === newName.toLowerCase() && d.name !== oldName
        // );
        // if (nameTaken) return;

        let finalCar = driver.car;
        const requestedCar = Number(car);

        if (!isNaN(requestedCar) && requestedCar >= 1 && requestedCar <= 8) {
            const carTakenByOther = session.drivers.some(d =>
                Number(d.car) === requestedCar && d.name !== oldName
            );

            if (!carTakenByOther) {
                finalCar = requestedCar;
            }
        }

        driver.name = newName;
        driver.car = finalCar;

        io.emit("sessionsUpdated", raceSessions);
        saveData();
    });

    // --- LAP TRACKER ---
    socket.on("lapCompleted", /** @param {LapCompletedPayload} payload */({ car, lapTime }) => {
        if (!carStats[car]) {
            carStats[car] = { laps: 0, bestLap: null, lastLapTime: null };
        }
        carStats[car].laps += 1;
        carStats[car].lastLapTime = lapTime;
        if (carStats[car].bestLap === null || lapTime < carStats[car].bestLap) {
            carStats[car].bestLap = lapTime;
        }
        io.emit("carStatsUpdated", carStats);
        saveData();
    });

    // --- RACE CONTROL ---

    socket.on("startRace", () => {
        if (!currentSessionId) {
            const upcoming = raceSessions.find(s => s.status === 'upcoming');
            if (upcoming) {
                currentSessionId = upcoming.id;
            } else {
                return; // no session
            }
        }
        const session = raceSessions.find(s => s.id === currentSessionId);
        if (session) {
            session.status = 'current';
            io.emit("sessionsUpdated", raceSessions);
            clearRaceTimer();
            raceStartTime = Date.now();
            pausedRemaining = null;
            raceMode = 'Safe';
            io.emit("raceModeChanged", raceMode);
            carStats = {};
            // Initialize carStats for registered cars
            session.drivers.forEach(d => {
                carStats[d.car] = { laps: 0, bestLap: null, lastLapTime: null };
            });

            startTimerLoop();


            io.emit("raceModeChanged", raceMode);
            io.emit("raceStarted", { session, carStats, raceMode, currentSessionId });
            saveData();
        }
    });

    socket.on("setRaceMode", (mode) => {
        if (raceMode === mode) return;
        const oldMode = raceMode;
        raceMode = mode;

        // Group Safe and Hazard together
        const isRunningMode = (mode === 'Safe' || mode === 'Hazard');
        const wasRunningMode = (oldMode === 'Safe' || oldMode === 'Hazard');

        if (isRunningMode) {
            // Only re-calculate if we are coming from a paused state (Danger)
            if (oldMode === 'Danger' && pausedRemaining !== null) {
                raceStartTime = Date.now() - (raceDuration - pausedRemaining);
                pausedRemaining = null;
                startTimerLoop();
            }
            // If we were already running (Safe <-> Hazard), do nothing! 
            // The clock is already ticking.
        } else if (mode === 'Danger') {
            if (raceStartTime !== null) {
                const elapsed = Date.now() - raceStartTime;
                pausedRemaining = Math.max(0, raceDuration - elapsed);
                raceStartTime = null;
            }
            clearRaceTimer();
        } else if (mode === 'Finish') {
            handleRaceFinish();
        }

        io.emit("raceModeChanged", raceMode);
        // Send an immediate timer update so the UI doesn't "guess"
        io.emit("timerUpdate", getRemainingTime());
        saveData();
    });

    socket.on("endSession", () => {
        if (currentSessionId) {
            const session = raceSessions.find(s => s.id === currentSessionId);
            if (session) {
                session.status = 'finished';
                io.emit("sessionsUpdated", raceSessions);
                handleRaceFinish();
                const currentIndex = raceSessions.findIndex(s => s.id === currentSessionId);
                currentSessionId = null; // nullify current session to not be able to accidentally end next session without starting it first
                //currentSessionId = currentIndex < raceSessions.length - 1 ? raceSessions[currentIndex + 1].id : null;
                io.emit("sessionEnded", { raceMode, currentSessionId, raceSessions });
                saveData();
            }
        }
    });

    socket.on("disconnect", () => {
        console.log("Disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (Dev: ${isDev})`);
});
