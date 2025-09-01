"use strict";

const net = require('net');
const Utils = require('./helpers/utils.js');
const LobbyClient = require('./client/client.lobby.js');
const GameClient = require('./client/client.game.js');
const Slot = require('./slot.js');

function Handler(WOL, db) {
    this.WOL = WOL || {};
    this.db = db || null;
}

// Handle raw data from socket
Handler.prototype.handle = function(socket, data) {
    if(!data) return;

    const text = data.toString().trim();
    if(text.startsWith('<')) return; // Ignore Flash Policy or HTML

    try {
        const json = JSON.parse(text);
        this.handleJSON(socket, json);
    } catch (err) {
        console.error(`[GAME SERVER] ❌ Failed to parse JSON from ${socket.id}:`, err);
    }
};

// Handle JSON packets
Handler.prototype.handleJSON = function(socket, packet) {
    if(!packet.command) return;

    switch(packet.command) {
        case "logIn":
            this.handleLogin(socket, packet);
            break;

        case "joinGame":
            this.handleJoinGame(socket, packet);
            break;

        case "chat":
            this.handleChat(socket, packet);
            break;

        default:
            console.warn(`[GAME SERVER] ⚠️ Unknown command "${packet.command}" from ${socket.id}`);
    }
};

// Login handler
Handler.prototype.handleLogin = function(socket, packet) {
    if(socket.client) return; // already logged in

    const clientId = packet.id || Utils.randKey();
    const client = new LobbyClient({
        sock: socket,
        db: this.db,
        WOL: this.WOL,
        connectionType: "lobby",
        id: clientId
    });

    socket.client = client;
    if(packet.dname) {
        client.setupPlayer({
            id: client.id,
            dname: packet.dname,
            treats: 0,
            gold: 0,
            userWeaponsOwned: {}
        });
    }
};

// Join game handler — now fully functional
Handler.prototype.handleJoinGame = function(socket, packet) {
    const client = socket.client;
    if(!client || !client.player) return;

    // Assign gameId
    const gameId = packet.gameId || "default";
    client.gameId = gameId;

    // Find or create slot
    if(!this.WOL.slots[gameId]) {
        console.log(`[GAME SERVER] 🆕 Creating new slot: ${gameId}`);
        this.WOL.slots[gameId] = new Slot(this.WOL, gameId, packet.mapName || "defaultMap", packet.playerCount || 2, packet.gameDuration || 180000, packet.turnDuration || 10000);
    }
    const slot = this.WOL.slots[gameId];

    // Move client to slot
    if(!slot.containsClient(client)) {
        slot.addClient(client);
        client.connectionType = "game";
        console.log(`[GAME SERVER] 🎮 Client ${client.id} moved to slot ${gameId}`);
    }

    // Confirm join
    if(typeof client.sendJoinGame === "function") {
        client.sendJoinGame();
    }
};

// Chat handler
Handler.prototype.handleChat = function(socket, packet) {
    const client = socket.client;
    if(!client) return;
    const msg = packet.text || "";
    if(typeof client.sendChatMessage === "function") client.sendChatMessage(msg);
};

module.exports = Handler;
