"use strict";

const EventEmitter = require("events");

class Client {
    constructor(sock, db, server) {
        this.sock = sock;
        this.db = db;
        this.server = server;

        this.eventTrigger = new EventEmitter();

        // Stable reference for circular scope handling
        this.currentScope = this;

        // Connection type: lobby, game, ladder
        this.connectionType = "lobby";
        this.gameId = null;

        this.player = null; // placeholder for player object
        this.id = sock.id; // uuid of the client

        console.log(`>> Client abstract initialized: ${this.id}, type: ${this.connectionType}`);
    }

    // Assign a new scope object while keeping stable reference
    assignNewScope(newObj) {
        if (!newObj) return;
        this.currentScope = newObj;
        this.eventTrigger.emit("newScope");
        console.log(`[GAME SERVER] 🔄 Client ${this.id} assigned new scope`);
    }

    // Set or update player object
    setPlayer(playerObj) {
        this.player = playerObj;
        console.log(`[GAME SERVER] 🎯 Player set for client ${this.id}:`, playerObj?.dname || "unknown");
    }

    // Write raw data to socket safely
    write(data) {
        if (this.sock && !this.sock.destroyed) {
            this.sock.write(data);
            console.log(`[GAME SERVER] 📤 Data sent to client ${this.id}:`, data?.toString().slice(0, 200));
        } else {
            console.warn(`[GAME SERVER] ⚠️ Attempted to write to destroyed or missing socket for client ${this.id}`);
        }
    }

    // Send JSON packet safely
    sendPacket(packet) {
        if (!packet) return;
        try {
            const str = JSON.stringify(packet);
            this.write(str);
            console.log(`[GAME SERVER] ✅ Packet sent to client ${this.id}:`, str?.slice(0, 200));
        } catch (err) {
            console.error(`[GAME SERVER] ❌ Failed to send packet to client ${this.id}:`, err);
        }
    }

    // Send player update to client
    sendUpdate() {
        if (!this.player) {
            console.warn(`[GAME SERVER] ⚠️ sendUpdate called but player not set for client ${this.id}`);
            return;
        }
        this.sendPacket(this.player);
    }
}

module.exports = Client;
