"use strict";

const Utils = require('./helpers/utils.js');
const Field = require('./field.js');
const CollisionAverage = require('./physics/collision.js');
const WeaponManager = require('./weapons/weapon.manager.js');

const DEBUG = true;

class Slot {
    constructor(wol, gameId, mapName, playerCount, gameDuration, turnDuration) {
        this.WOL = wol;
        this.gameId = gameId;

        this.mapName = mapName;
        this.playerCount = playerCount;
        this.gameDuration = gameDuration;
        this.turnDuration = turnDuration;

        this.initialize();
        console.log(`🕹 Slot ${this.gameId} created for map "${this.mapName}"`);
    }

    initialize() {
        this.currentPlayer = -1;
        this.clients = {};
        this.deadPlayers = [];
        this.physicsObjects = [];
        this.status = "idle";
        this.startingTimeout = null;
        this.tick = 0;
        this.turnEndTick = 0;
        this.randomSeed = 0;
        this.weapon = new WeaponManager(this);
        this.field = new Field(this);
        this.completedTurns = 0;
        console.log(`🔄 Slot ${this.gameId} initialized`);
    }

    addClient(client) {
        if (this.clients[client.player.id]) {
            console.warn(`⚠️ Client ${client.player.id} already in slot ${this.gameId}`);
            return;
        }

        this.clients[client.player.id] = client;

        if (client.avatar) {
            this.physicsObjects.push(client.avatar);
            console.log(`➕ Client avatar added to physicsObjects for ${client.player.id}`);
        } else {
            console.warn(`!! Client avatar is null for ${client.player.id}`);
        }

        if (this.currentPlayer === -1 || client.player.id < this.currentPlayer) {
            this.currentPlayer = client.player.id;
        }

        console.log(`➕ Client ${client.player.id} added to slot ${this.gameId}`);
        this.sendConfirmation(client);

        // Trigger refresh on join
        this.refresh();

        // Auto-start logic
        this.checkGame();
    }

    removeClient(client) {
        console.log(`➖ Removing client ${client.player.id} from slot ${this.gameId}`);

        delete this.clients[client.player.id];

        const deadIndex = this.deadPlayers.indexOf(client.player.id);
        if (deadIndex !== -1) this.deadPlayers.splice(deadIndex, 1);

        if (this.isStarting()) {
            console.log(`⏹ Game start stopped due to client leaving`);
            this.stopGameStart();
        } else {
            this.refresh();
        }

        this.checkGame();
    }

    checkGame() {
        const playerCount = Object.keys(this.clients).length;

        if (!this.isRunning()) {
            if (playerCount >= 2 && !this.startingTimeout) {
                console.log(`⏱ Starting game in 5s: ${playerCount} players ready`);
                this.updateGameStatus("starting");
                this.refresh();

                this.startingTimeout = setTimeout(() => {
                    console.log(`🚀 Starting game now`);
                    this.startGame();
                    clearTimeout(this.startingTimeout);
                    this.startingTimeout = null;
                }, 5000);

            } else if (playerCount < 2) {
                if (this.status !== "idle") {
                    console.log(`🔄 Not enough players, setting status to idle`);
                    this.updateGameStatus("idle");
                }

                if (this.startingTimeout) {
                    console.log("🛑 Clearing pending game start timeout");
                    clearTimeout(this.startingTimeout);
                    this.startingTimeout = null;
                }
                this.refresh();
            }
        } else {
            this.checkIfTurnIsOver();

            if (this.countPlayersAlive() <= 1 || playerCount <= 1) {
                this.endGame();
            }

            if (!this.clients[this.currentPlayer]) {
                this.sendChangeTurn();
            }
        }
    }

    stopGameStart() {
        console.log("🛑 Stopping pending game start");
        if (this.startingTimeout) clearTimeout(this.startingTimeout);
        this.startingTimeout = null;
        this.updateGameStatus("idle");
        this.refresh();
    }

    startGame() {
        this.updateGameStatus("running");
        this.generateRndSeed();
        this.setDefaultPositions();

        const cmd = {
            command: "startGame",
            randomSeed: this.randomSeed,
            co: this.getPlayerIds(),
            currentPlayer: this.currentPlayer,
            tick: this.tick,
            playerlist: this.getPlayerList(),
            positions: this.getPlayerPositions()
        };

        console.log(`🚀 Game started in slot ${this.gameId} with players:`, cmd.co);
        this.sendPacket(cmd);

        // Refresh players only once at game start
        this.refresh();

        this.setNextTurn(200);
    }

    setDefaultPositions() {
        let index = 0;
        for (const key in this.clients) {
            const c = this.clients[key];
            if (!c || !c.avatar) continue;
            const pos = this.WOL.mapsObj[this.mapName].positions[index];
            c.avatar.X = pos[0];
            c.avatar.Y = pos[1];
            index++;
        }
    }

    generateRndSeed() {
        this.randomSeed = Utils.randInt();
        console.log(`🎲 Random seed generated: ${this.randomSeed}`);
    }

    setNextTurn(delay) {
        this.turnEndTick = this.tick + (this.turnDuration / 10) + delay;
        console.log(`⏳ Next turn will end at tick ${this.turnEndTick}`);
    }

    sendPacket(packet) {
        for (const key in this.clients) {
            const client = this.clients[key];
            if (client) {
                if (packet.hasOwnProperty("session")) packet.session = client.gameSession;
                client.sendPacket(packet);
            }
        }
        if (DEBUG) console.log(`📡 Packet sent:`, packet.command || "no command");
    }

    sendPacketE(packet, clientExcl) {
        for (const key in this.clients) {
            const client = this.clients[key];
            if (client && client !== clientExcl) {
                if (packet.hasOwnProperty("session")) packet.session = client.gameSession;
                client.sendPacket(packet);
            }
        }
    }

    refresh() {
        // Refresh only on events, not every tick
        this.sendPacket({ command: "gameRefresh", status: this.status });
    }

    sendConfirmation(client) {
        client.sendPacket({ command: "game_join_confirmed" });
    }

    countPlayersAlive() {
        return Object.keys(this.clients).length - this.deadPlayers.length;
    }

    getPlayerIds() {
        return Object.keys(this.clients);
    }

    getPlayerList() {
        const list = [];
        for (const key in this.clients) list.push(this.clients[key].player);
        return list;
    }

    isRunning() { return this.status === "running"; }
    isStarting() { return this.status === "starting"; }
    isGameOver() { return this.status === "gameover"; }
}

module.exports = Slot;
