(() => {
/** @typedef {'Safe' | 'Hazard' | 'Danger' | 'Finish'} RaceMode */
/** @typedef {{ raceMode: RaceMode }} RaceModePayload */
/** @typedef {{ on(event: string, listener: (...args: any[]) => void): void }} SocketLike */
/** @typedef {Window & typeof globalThis & { io: () => SocketLike, toggleFullscreen: typeof toggleFullscreen }} RaceFlagsWindow */

/** @type {RaceFlagsWindow} */
const raceFlagsWindow = /** @type {RaceFlagsWindow} */ (window);
/** @type {SocketLike} */
const socket = raceFlagsWindow.io();
const body = document.body;
const flagText = document.getElementById("flag-text");

socket.on('initialData', /** @param {RaceModePayload} data */ (data) => {
    setFlag(data.raceMode);
});

socket.on('raceModeChanged', /** @param {RaceMode} mode */ (mode) => {
    setFlag(mode);
});

socket.on('raceStarted', /** @param {RaceModePayload} data */ (data) => {
    setFlag(data.raceMode);
});

socket.on('raceFinished', () => {
    setFlag('Finish');
});

socket.on('sessionEnded', /** @param {RaceModePayload} data */ (data) => {
    setFlag(data.raceMode);
});

/**
 * @param {RaceMode} mode
 * @returns {void}
 */
function setFlag(mode) {
    if (!flagText) return;
    switch (mode) {
        case "Safe":
            body.style.background = "green";
            flagText.textContent = "SAFE";
            flagText.style.color = "white";
            break;
        case "Hazard":
            body.style.background = "yellow";
            flagText.textContent = "HAZARD";
            flagText.style.color = "black";
            break;
        case "Danger":
            body.style.background = "red";
            flagText.textContent = "DANGER";
            flagText.style.color = "white";
            break;
        case "Finish":
            body.style.background = 'repeating-conic-gradient(from 0deg, black 0deg 90deg, white 90deg 180deg) 0 0 / 200px 200px';
            body.style.backgroundColor = "white";
            flagText.textContent = "FINISH";
            flagText.style.color = "green";
            break;
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

raceFlagsWindow.toggleFullscreen = toggleFullscreen;
})();
