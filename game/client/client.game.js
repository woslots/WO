"use strict";

const Utils = require('../helpers/utils.js');
const Avatar = require('./extensions/avatar.js');

function GameClient(clientRef) {
    clientRef.newObject = this;

    // References
    this.sock = clientRef.sock;
    this.db = clientRef.db;
    this.WOL = clientRef.WOL || {}; // ensure WOL exists
    this.id = clientRef.id;
    this.connectionType = clientRef.connectionType;

    this.newPacketHeader = "Originality is undetected plagiarism.\r\n\r\n";
    this.initialized = false;
    this.mapLoaded = false;

    this.tempBuffer = "";
    this.tempBufferLen = 0;
    this.awaitingData = false;
    this.dataParts = 0;

    this.loggedIn = false;

    this.player = {};
    this.avatar = new Avatar(this);

    this.lastMessageTime = 0;
    this.shotThisTurn = false;

    this.startingXP = 0;
    this.startingGold = 0;

    this.gameId = null;
    this.gameSession = "";

    // Add client to WOL safely
    if (typeof this.WOL.addClient === 'function') {
        this.WOL.addClient(this);
        console.log(`➕ GameClient added to WOL: ${this.id}`);
    } else {
        console.warn(`⚠️ WOL.addClient missing for game client ${this.id}`);
    }

    console.log(`>> Initialized game client ${this.id}`);
}

GameClient.prototype = {

    setupPlayer(doc) {
        if (!doc) return -1;

        this.player = { ...doc };
        this.player.command = "player";
        this.player.online = this.WOL.getLobbyLoad ? this.WOL.getLobbyLoad() : 0;

        console.log(`>> Player ${this.player.dname || this.id} entered game`);

        // Initialize avatar
        this.avatar.initialize();
        console.log(`🖼 Avatar initialized for ${this.player.dname || this.id}`);

        // Send login acknowledgment
        this.sendLoginAck();

        return 1;
    },

    write(data) {
        if (this.sock && !this.sock.destroyed) {
            this.sock.write(data);
            console.log(`📤 Sent data to ${this.id}:`, data.toString().slice(0, 200) + (data.length > 200 ? "..." : ""));
        } else {
            console.warn(`⚠️ Attempted to write to destroyed socket ${this.id}`);
        }
    },

    sendPacket(packet) {
        if (!packet) return;
        try {
            const str = JSON.stringify(packet);
            let len = ("000000" + str.length).slice(-6);

            if (!this.initialized) {
                this.initialized = true;
                this.write(this.newPacketHeader + len + str);
            } else {
                this.write(len + str);
            }

            console.log(`✅ Packet sent for ${this.id}:`, packet.command || "no command");
        } catch (e) {
            console.error(`❌ Failed to send packet for ${this.id}:`, e);
        }
    },

    sendLoginAck() {
        const ack = {
            command: "logInAck",
            id: this.id,
            dname: this.player.dname || "unknown",
            treats: this.player.treats || 0,
            gold: this.player.gold || 0
        };
        console.log(`🔑 Sending login acknowledgment to ${this.id}:`, ack);
        this.sendPacket(ack);
    },

    sendUpdate() {
        this.sendPacket(this.player);
        if (this.WOL.updateLobbyPlayer) this.WOL.updateLobbyPlayer(this.player);
    },

    updatePlayerData() {
        if (this.db && this.player.id) {
            this.db.update({ id: this.player.id }, this.player);
            console.log(`💾 Updated player data in DB for ${this.id}`);
        }
    },

    addXP(amount) {
        this.player.xp = (this.player.xp || 0) + amount;
        console.log(`⭐ Added ${amount} XP to ${this.id}. Total XP: ${this.player.xp}`);
        this.sendUpdate();
        this.updatePlayerData();
    },

    addGold(amount, update = true) {
        this.player.gold = (this.player.gold || 0) + amount;
        console.log(`💰 Added ${amount} gold to ${this.id}. Total gold: ${this.player.gold}`);
        if (update) {
            this.sendUpdate();
            this.updatePlayerData();
        }
    },

    addTreats(amount, update = true) {
        this.player.treats = (this.player.treats || 0) + amount;
        console.log(`🍪 Added ${amount} treats to ${this.id}. Total treats: ${this.player.treats}`);
        if (update) {
            this.sendUpdate();
            this.updatePlayerData();
        }
    },

    generateGameKey() {
        this.gameSession = this.WOL.updateGameKey ? this.WOL.updateGameKey(Utils.randKey()) : Utils.randKey();
        console.log(`🔑 Generated game session key for ${this.id}: ${this.gameSession}`);
        return this.gameSession;
    }
};

module.exports = GameClient;
