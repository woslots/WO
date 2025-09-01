"use strict";

const Utils = require('../helpers/utils.js');
const Slot = require('../slot.js');

function LobbyClient(clientRef) {
    clientRef.newObject = this;

    // References
    this.sock = clientRef.sock;
    this.db = clientRef.db;
    this.WOL = clientRef.WOL || {};

    this.id = clientRef.id || Utils.generateUUID();
    this.connectionType = clientRef.connectionType || "lobby";
    this.initialized = false;

    this.player = {};
    this.gameId = null;
    this.gameSession = "";

    console.log(">> Initialized lobby client", this.id);

    // Auto-add client only if not already added
    if (typeof this.WOL.addClient === 'function' && this.connectionType === "lobby") {
        if (!this.WOL.lobbyClients || !this.WOL.lobbyClients[this.id]) {
            this.WOL.addClient(this);
            console.log("[GAME SERVER] ➕ Client added to WOL:", this.id);
        } else {
            console.log("[GAME SERVER] ⚠️ Client already exists in WOL:", this.id);
        }
    }
}

LobbyClient.prototype = {

    setupPlayer(doc) {
        if (!doc) return -1;

        // Store full DB doc
        this.player = { ...doc };
        this.player.command = "setPlayer";
        this.player.online = this.WOL.getLobbyLoad ? this.WOL.getLobbyLoad() : 0;

        console.log(`>> Player ${this.player.dname || this.id} entered lobby`, this.player);

        this.sendLoginAck();
        this.sendAssets();

        return 1;
    },

    write(data) {
        if (this.sock && !this.sock.destroyed) {
            this.sock.write(data);
            console.log(`[GAME SERVER] 📤 Sent data to ${this.id}:`, data.toString().slice(0, 200) + (data.length > 200 ? "..." : ""));
        } else {
            console.warn(`[GAME SERVER] ⚠️ Attempted to write to destroyed socket ${this.id}`);
        }
    },

    sendPacket(packet) {
        if (!packet) return;
        try {
            const str = JSON.stringify(packet);
            this.write(str);
            console.log(`[GAME SERVER] ✅ Packet sent for ${this.id}:`, packet.command || "no command");
        } catch (e) {
            console.error(`[GAME SERVER] ❌ Failed to send packet for ${this.id}:`, e);
        }
    },

    sendLoginAck() {
        const ack = {
            command: "logInAck",
            id: this.id,
            dname: this.player.dname || "unknown",
            treats: this.player.treats ?? 0,
            gold: this.player.gold ?? 0,
            level: this.player.level ?? 0,
            xp: this.player.xp ?? 0,
        };
        this.sendPacket(ack);
        console.log("[GAME SERVER] 🔑 Sending login acknowledgment:", ack);
    },

    sendAssets() {
        if (!this.WOL) return;

        const assets = {
            command: "assets",
            data: {
                config: this.WOL.config || {},
                levels: this.WOL.levelsObj || {},
                weapons: this.WOL.weaponsObj || {},
                maps: this.WOL.mapsObj || {}
            }
        };
        this.sendPacket(assets);
        console.log("[GAME SERVER] 📦 Sending assets to client:", Object.keys(assets.data));
    },

    sendUpdate() {
        this.sendPacket(this.player);
        if (this.WOL.updateLobbyPlayer) this.WOL.updateLobbyPlayer(this.player);
    },

    chargeTreats(amount) {
        if (amount < 0) return false;
        this.player.treats = parseInt(this.player.treats || 0);
        if (this.player.treats >= amount) {
            this.player.treats -= amount;
            this.sendUpdate();
            this.updatePlayerData();
            return true;
        }
        return false;
    },

    chargeGold(amount) {
        if (amount < 0) return false;
        this.player.gold = parseInt(this.player.gold || 0);
        if (this.player.gold >= amount) {
            this.player.gold -= amount;
            this.sendUpdate();
            this.updatePlayerData();
            return true;
        }
        return false;
    },

    addWeapon(type, amount) {
        if (!this.player.userWeaponsOwned) this.player.userWeaponsOwned = {};
        if (this.player.userWeaponsOwned[type]) this.player.userWeaponsOwned[type] += amount;
        else this.player.userWeaponsOwned[type] = amount;
        this.sendUpdate();
        this.updatePlayerData();
        console.log(`[GAME SERVER] 🛠 Added weapon to ${this.id}: ${type} x${amount}`);
    },

    updatePlayerData() {
        if (this.db && this.player.id) {
            this.db.update({ id: this.player.id }, this.player);
            console.log(`[GAME SERVER] 💾 Updated player data in DB for ${this.id}`);
        }
    },

    generateGameKey() {
        this.gameSession = this.WOL.updateGameKey ? this.WOL.updateGameKey(Utils.randKey()) : Utils.randKey();
        console.log(`[GAME SERVER] 🔑 Generated game session key for ${this.id}: ${this.gameSession}`);
        return this.gameSession;
    },

    sendJoinGame() {
        if (!this.gameId || !this.WOL.slots[this.gameId]) return;

        const slot = this.WOL.slots[this.gameId];

        // Send join confirmation
        this.sendPacket({ command: "game_join_confirmed", session: this.generateGameKey() });

        // Send initial slot state
        const initData = slot.getString("game");
        initData.session = this.gameSession;
        this.sendPacket(initData);

        console.log(`[GAME SERVER] 🎮 Lobby client ${this.id} joined game ${this.gameId} and received initial data`);
    }
};

module.exports = LobbyClient;
