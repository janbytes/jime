# Racetrack Info-Screens

A real-time race control system for Beachside Racetrack, providing interfaces for race management, lap tracking, and spectator information displays.

## Overview

This system allows receptionists to configure race sessions, safety officials to control race modes and timers, lap-line observers to record lap times, and spectators to view leaderboards and race information in real-time.

## Features

- **Race Session Management**: Configure upcoming races with driver assignments
- **Real-time Race Control**: Start races, control safety modes (Safe, Hazard, Danger, Finish)
- **Lap Time Recording**: Record lap times for up to 8 cars
- **Live Leaderboards**: Display fastest lap times and current positions
- **Public Displays**: Countdown timers, next race info, and flag status
- **Data Persistence**: Race data survives server restarts
- **Access Control**: Secure interfaces with access keys

## Setup and Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set environment variables for access keys by adding .env file to root folder with content as below (write your own keys):
   ```bash
   export receptionist_key=your_receptionist_key
   export observer_key=your_observer_key
   export safety_key=your_safety_key
   ```
   Sample file as .env.example is included.
4. Start the server: `npm start`
   - For development (1 minute races): `npm run dev`

The server will start on port 3000 (or PORT environment variable).

## Usage Guide

### Employee Interfaces

Access these with the respective access keys:

- **Front Desk** (`/front-desk`): Configure race sessions
  - Create new sessions
  - Add/remove drivers
  - Assign cars to drivers

- **Race Control** (`/race-control`): Control active races
  - Start race
  - Change race modes
  - End session

- **Lap Line Tracker** (`/lap-line-tracker`): Record lap times
  - Click car buttons when they cross the finish line
  - Enter lap times in seconds

### Public Displays

No authentication required:

- **Leader Board** (`/leader-board`): Shows current race standings
- **Next Race** (`/next-race`): Lists drivers for upcoming race
- **Race Countdown** (`/race-countdown`): Displays remaining race time
- **Race Flags** (`/race-flags`): Shows current safety flag status

### Example Workflow

1. Receptionist creates a race session and adds drivers
2. Safety Official starts the race
3. Lap Observer records lap times as cars pass
4. Spectators view live leaderboards
5. Safety Official controls race modes as needed
6. Race ends automatically after 10 minutes (or 1 in dev mode)
7. Safety Official ends the session

## Bonus Features

- **Data Persistence**: All race data is saved to `data.json`
- **Car Assignment**: Receptionist can manually assign cars to drivers

## Technologies

- Node.js
- Express
- Socket.IO
- HTML/CSS/JavaScript