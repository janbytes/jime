(() => {
/** @typedef {{ remainingSeconds: number, totalDuration: number }} TimerData */
/** @typedef {{ on(event: string, listener: (...args: any[]) => void): void }} SocketLike */
/** @typedef {Window & typeof globalThis & { io: () => SocketLike, toggleFullscreen: typeof toggleFullscreen }} RaceCountdownWindow */

/** @type {RaceCountdownWindow} */
const raceCountdownWindow = /** @type {RaceCountdownWindow} */ (window);
/** @type {SocketLike} */
const socket = raceCountdownWindow.io();

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

socket.on('timerUpdate', /** @param {TimerData} data */ (data) => {
    const minutes = Math.floor(data.remainingSeconds / 60);
    const seconds = data.remainingSeconds % 60;
    getElement('countdown').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

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

raceCountdownWindow.toggleFullscreen = toggleFullscreen;
})();
