# Racetrack Real-Time Event Architecture (Socket.IO)

This document defines interfaces and events for the Racetrack system.

---

# Employee Interfaces (Private)

## /front-desk — Receptionist

### Emits
```js
socket.emit("raceCreated", { raceId: 1, drivers: [] });
socket.emit("driverRegistered", {raceId: 1, driverName: "John", carNumber: 7 }); // presume we can assign car number here too, or do it randomly later. RaceId will be here also already?
socket.emit("raceUpdated", { raceId: 1, drivers: [] });

// is "Remove" separate event  
socket.emit("driverRemoved", { carNumber: 7 });
```
### Listens
```js
socket.on("raceUpdated", (data) => {}); // maybe nothing needed here for receptionist, need to check
```
---

## /race-control — Safety Official


### Emits
```js
socket.emit("raceStart", { raceId: 1, startTime: Date.now() });
socket.emit("flagUpdate", { mode: "Safe" });    // Green
// Another "mode" options would be: 
// socket.emit("flagUpdate", { mode: "Hazard" });  // Yellow
// socket.emit("flagUpdate", { mode: "Danger" });  // Red
// socket.emit("flagUpdate", { mode: "Finish" });  // End, Chequered Black/White. 
socket.emit("raceEnd", { raceId: 1 }); // declares the race is over
```

### Listens
```js
socket.on("lapCompleted", (data) => {}); // need to review if needed
socket.on("leaderboardUpdate", (data) => {}); // to review
socket.on("raceCreated", (data) => {});
socket.on("raceUpdated", (data) => {});

```
---

## /lap-line-tracker — Lap-line Observer

### Emits
```js
socket.emit("lapCompleted", {
  raceId: 1,
  carNumber: 7,
  lapTime: 62.35
  // current lap #
});
```
### Listens
```js
socket.on("raceStart", () => {});
socket.on("raceEnd", () => {});

```
---

# Public Displays

## /leader-board

```js
socket.on("raceStart", () => {});
socket.on("racePause", () => {});
socket.on("raceResume", () => {});
socket.on("raceCaution", () => {});
socket.on("raceEnd", () => {});
socket.on("raceFinish", () => {});
socket.on("leaderboardUpdate", () => {});
```

---

## /next-race

```js
socket.on("raceCreated", () => {});
socket.on("raceUpdated", () => {});
```

---

## /race-countdown

```js
socket.on("raceStart", () => {});
socket.on("countdownUpdate", () => {});
```

---

## /race-flags

```js
socket.on("flagUpdate", (data) => {
  const body = document.body;

  if (data.mode === "Safe") body.style.background = "green";
  if (data.mode === "Hazard") body.style.background = "yellow";
  if (data.mode === "Danger") body.style.background = "red";
  if (data.mode === "Finish") {
    body.style.background = "repeating-linear-gradient(45deg, black 0 20px, white 20px 40px)";
  }
});
```

---

# Race Flags Logic



| Mode   | Meaning        | System Effect |
|--------|---------------|--------------|
| Safe   | Green         | Race running |
| Hazard | Yellow        | Caution      |
| Danger | Red           | Race paused  |
| Finish | Checkered     | Race finished   |

---

# Server Logic (Flag → Race State)

Server converts flags into race events:

```js
socket.on("flagUpdate", (data) => {
  io.emit("flagUpdate", data);

  if (data.mode === "Safe") {
    io.emit("raceResume");
  }
  if (data.mode === "Hazard") {
    io.emit("raceCaution");
  }

  if (data.mode === "Danger") {
    io.emit("racePause");
  }

  if (data.mode === "Finish") {
    io.emit("raceFinish"); 
  }
});
```

---


