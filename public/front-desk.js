(() => {
    /** @typedef {{ name: string, car: number }} Driver */
    /** @typedef {{ id: number, drivers: Driver[], status: 'upcoming' | 'current' | 'finished' }} RaceSession */
    /** @typedef {{ raceSessions: RaceSession[] }} InitialData */
    /** @typedef {{ success: boolean, message?: string }} AuthResponse */
    /** @typedef {{ on(event: string, listener: (...args: any[]) => void): void, emit(event: string, payload?: unknown): void }} SocketLike */
    /** @typedef {Window & typeof globalThis & { io: () => SocketLike, authenticate: typeof authenticate, createSession: typeof createSession, deleteSession: typeof deleteSession, addDriver: typeof addDriver, removeDriver: typeof removeDriver, editDriver: typeof editDriver }} FrontDeskWindow */

    /** @type {SocketLike | null} */
    let socket = null;
    let authenticated = false;
    /** @type {FrontDeskWindow} */
    const frontDeskWindow = /** @type {FrontDeskWindow} */ (window);

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
        const response = await fetch('/auth/front-desk', {
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
        socket = frontDeskWindow.io();

        socket.on('initialData', /** @param {InitialData} data */(data) => {
            updateSessions(data.raceSessions);
        });

        socket.on('sessionsUpdated', /** @param {RaceSession[]} sessions */(sessions) => {
            updateSessions(sessions);
        });

    }

    /**
     * @returns {void}
     */
    function createSession() {
        if (!socket) return;
        socket.emit('createSession');
    }

    /**
     * @param {number} sessionId
     * @returns {void}
     */
    function deleteSession(sessionId) {
        if (!socket) return;
        socket.emit('deleteSession', sessionId);
    }

    /**
     * @param {number} sessionId
     * @returns {void}
     */
    function addDriver(sessionId) {
        const name = prompt('Driver name:');
        const carInput = prompt('Car number (1-8, leave empty for auto-assign):');
        const car = carInput ? Number.parseInt(carInput, 10) : null;
        if (name) {
            if (!socket) return;
            socket.emit('addDriver', { sessionId, driverName: name, car });
        }
    }

    /**
     * @param {number} sessionId
     * @param {string} driverName
     * @returns {void}
     */
    function removeDriver(sessionId, driverName) {
        if (!socket) return;
        socket.emit('removeDriver', { sessionId, driverName });
    }

    /**
     * @param {number} sessionId
     * @param {string} oldName
     * @param {number} currentCar
     * @returns {void}
     */
    function editDriver(sessionId, oldName, currentCar) {
        const newName = prompt('New driver name:', oldName);
        if (!newName) return; // User cancelled name prompt
        const carInput = prompt('New car number (1-8):');
        // If user hits cancel on car prompt, use the current car.
        // If they leave it blank, use the current car.
        const car = (carInput === null || carInput.trim() === "")
            ? currentCar
            : Number.parseInt(carInput, 10);

        if (!socket) return;
        socket.emit('updateDriver', { sessionId, oldName, newName, car });
    }

    /**
     * @param {RaceSession[]} sessions
     * @returns {void}
     */
    function updateSessions(sessions) {
        const container = getDivElement('sessions');
        container.innerHTML = '';
        sessions.forEach((session) => {
            const div = document.createElement('div');
            div.className = 'session';
            div.innerHTML = `
            <h3>Session ${session.id} (${session.status})</h3>
            <button onclick="deleteSession(${session.id})">Delete</button>
            <button onclick="addDriver(${session.id})">Add Driver</button>
            <ul>
                ${session.drivers.map((driver) => `
                    <li class="driver">
                        ${driver.name} - Car ${driver.car}
                        <button onclick="editDriver(${session.id}, '${driver.name}', ${driver.car})">Edit</button>
                        <button onclick="removeDriver(${session.id}, '${driver.name}')">Remove</button>
                    </li>
                `).join('')}
            </ul>
        `;
            container.appendChild(div);
        });
    }

    frontDeskWindow.authenticate = authenticate;
    frontDeskWindow.createSession = createSession;
    frontDeskWindow.deleteSession = deleteSession;
    frontDeskWindow.addDriver = addDriver;
    frontDeskWindow.removeDriver = removeDriver;
    frontDeskWindow.editDriver = editDriver;
})();
