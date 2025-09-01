"use strict";

const gameport = 8000;
const UUID = require("node-uuid");
const net = require("net");
const Database = require("./database.js");
const PacketHandler = require("./handler.js");
const Slot = require("./slot.js");
const Utils = require("./helpers/utils.js");
const Client = require("./client/client.abstract.js");

const AccessoriesProperties = require("./properties/accessories.properties.js");
const WeaponProperties = require("./properties/weapon.properties.js");
const MapProperties = require("./properties/map.properties.js");
const PetFoodProperties = require("./properties/pet.food.properties.js");
const ChassisProperties = require("./properties/chassis.properties.js");

class WOL {
    constructor() {
        this.lobbyClients = {};
        this.ladderClients = {};
        this.slots = {};

        this.db = new Database();
        this.packetHandler = new PacketHandler(this);

        this.assetsURL = "http://localhost/assets/json/";
        this.assetsCacheVersion = "debug_0002";
        this.assetsList = [
            "Config", "Accessories", "Crate", "Gifts",
            "Levels", "Maps", "Other", "PetFoods",
            "Pets", "WeaponsGrid"
        ];
        this.assetsObj = {};
        this.config = {};
        this.accessoriesObj = {};
        this.crateObj = {};
        this.levelsObj = {};
        this.weaponsObj = {};
        this.mapsObj = {};
        this.petFoodsObj = {};
        this.petsObj = {};
        this.itemLevel = {};
        this.DEFAULT_TIME_AFTER_WEAPON = 400;
    }

    async start() {
        try {
            await this.db.connect();
            console.log("✅ DB connected");

            await this.loadAssetsAsync();
            console.log("✅ Assets loaded");

            this.onAssetsLoaded();

            // Create test slot properly
            this.createTestSlot();

            this.run();

            this.procTimer = setInterval(this.update.bind(this), 100);

        } catch (err) {
            console.error("❌ Startup failed:", err);
            process.exit(1);
        }
    }

    async loadAssetsAsync() {
        const request = require("request-promise-native");
        for (let item of this.assetsList) {
            try {
                const body = await request(this.assetsURL + item + ".dat?cachev=" + this.assetsCacheVersion);
                this.assetsObj[item] = JSON.parse(body);
                console.log("✅ Loaded asset:", item);
            } catch (e) {
                console.error("❌ Failed to load asset:", item, e);
            }
        }
    }

    onAssetsLoaded() {
        console.log("Processing assets...");
        this.processConfig();
        this.processAccessories();
        this.processCrate();
        this.processLevels();
        this.processMaps();
        this.processPetFoods();
        this.processPets();
        this.processWeaponsGrid();
        console.log("✅ Assets processed.");
    }

    processConfig() { this.config = this.assetsObj["Config"]; }

    processAccessories() {
        for (let item of this.assetsObj["Accessories"]) {
            const obj = new AccessoriesProperties();
            Object.assign(obj, item);
            this.accessoriesObj[obj.type] = obj;
        }
    }

    processCrate() { this.crateObj = this.assetsObj["Crate"]; }

    processLevels() {
        this.levelsObj = this.assetsObj["Levels"];
        let _level = 1;
        for (let i in this.levelsObj) {
            const level = this.levelsObj[i];
            if (Array.isArray(level.map)) for (let x of level.map) this.itemLevel[x] = _level;
            if (Array.isArray(level.chassis)) for (let x of level.chassis) this.itemLevel[x] = _level;
            if (Array.isArray(level.weapon)) for (let x of level.weapon) this.itemLevel[x] = _level;
            _level++;
        }
    }

    processMaps() {
        for (let item of this.assetsObj["Maps"]) {
            const obj = new MapProperties();
            Object.assign(obj, item);
            this.mapsObj[obj.name] = obj;
        }
    }

    processPetFoods() {
        for (let item of this.assetsObj["PetFoods"]) {
            const obj = new PetFoodProperties();
            Object.assign(obj, item);
            this.petFoodsObj[obj.type] = obj;
        }
    }

    processPets() {
        for (let item of this.assetsObj["Pets"]) {
            const obj = new ChassisProperties();
            Object.assign(obj, item);
            this.petsObj[obj.type] = obj;
        }
    }

    processWeaponsGrid() {
        for (let item of this.assetsObj["WeaponsGrid"]) {
            const obj = new WeaponProperties();
            Object.assign(obj, item);
            this.weaponsObj[obj.type] = obj;
        }
    }

    createTestSlot() {
        const testGameId = "test1";
        const testMap = "Critter Falls";
        const minPlayers = 1;
        const gameDuration = 60; // seconds
        const turnDuration = 10; // seconds

        const slot = new Slot(testGameId, this); // Proper constructor
        slot.mapName = testMap;
        slot.minPlayers = minPlayers;
        slot.gameDuration = gameDuration;
        slot.turnDuration = turnDuration;

        this.slots[testGameId] = slot;
        console.log(`🕹 Slot ${testGameId} created for map "${testMap}"`);
    }

    run() {
        console.log(`🚀 WOL server listening on 127.0.0.1:${gameport}`);

        this.server = net.createServer((socket) => {
            socket.id = UUID();
            console.log(`🔗 New connection: ${socket.remoteAddress}:${socket.remotePort} (ID: ${socket.id})`);

            socket.on("data", (data) => {
                const text = data.toString().trim();
                console.log(`📥 Data received from ${socket.id}:`, text.slice(0, 200) + (text.length > 200 ? "..." : ""));

                // Flash policy request
                if (text.startsWith("<policy-file-request")) {
                    console.log(`⚡ Flash policy request received from ${socket.id}`);
                    const policy =
                        '<?xml version="1.0"?>\n' +
                        '<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n' +
                        '<cross-domain-policy>\n' +
                        '   <allow-access-from domain="*" to-ports="*" />\n' +
                        "</cross-domain-policy>\0";
                    socket.write(policy);
                    socket.end();
                    return;
                }

                // Handle HTTP-style POST from browser game
                let jsonData = null;
                if (text.startsWith("POST")) {
                    const bodyIndex = text.indexOf("\r\n\r\n");
                    if (bodyIndex !== -1) {
                        const body = text.slice(bodyIndex + 4);
                        const jsonStart = body.indexOf("{");
                        if (jsonStart !== -1) {
                            jsonData = body.slice(jsonStart);
                        }
                    }
                } else {
                    jsonData = text;
                }

                if (jsonData) {
                    try {
                        this.packetHandler.handle(socket.clientObj?.currentScope, Buffer.from(jsonData));
                    } catch (e) {
                        console.error(`❌ Error handling data from ${socket.id}:`, e);
                        console.error("❌ Raw data:", jsonData);
                    }
                }
            });

            socket.on("error", (e) => console.error(`⚠️ Socket error ${socket.id}:`, e));
            socket.on("close", () => this.removeClientObj(socket.clientObj?.currentScope));
            socket.on("end", () => this.removeClientObj(socket.clientObj?.currentScope));

            // Create Client wrapper
            const obj = new Client(socket, this.db, this);
            obj.currentScope = obj;
            socket.clientObj = obj;

            console.log(`✅ Client object created for ${socket.id}`);

            obj.eventTrigger.on("newScope", () => {
                console.log(`🔄 New scope assigned for ${socket.id}`);
                obj.currentScope = obj.newObject || obj.currentScope;
            });
        });

        this.server.listen(gameport, "127.0.0.1", () => {
            console.log(`✅ Server listening on 127.0.0.1:${gameport}`);
        });

        this.server.on("error", (err) => console.error("❌ Server error:", err));
    }

    update() {
        for (let key in this.slots) {
            try {
                const slot = this.slots[key];
                if (typeof slot.update === "function") slot.update();
            } catch (e) {
                console.error("❌ Slot update error:", e);
            }
        }
    }

    addClient(obj) {
        console.log(`➕ Adding client ${obj.sock.id} type: ${obj.connectionType}`);

        if (obj.connectionType === "lobby") {
            if (!this.lobbyClients[obj.sock.id]) this.lobbyClients[obj.sock.id] = obj;
            else console.warn(`⚠️ Lobby client ${obj.sock.id} already exists, skipping add`);
        } else if (obj.connectionType === "ladder") {
            if (!this.ladderClients[obj.sock.id]) this.ladderClients[obj.sock.id] = obj;
            else console.warn(`⚠️ Ladder client ${obj.sock.id} already exists, skipping add`);
        } else if (obj.connectionType === "game") {
            if (!obj.gameId) {
                console.warn(`⚠️ Game client ${obj.sock.id} has no gameId`);
                return;
            }
            if (!this.slots[obj.gameId]) {
                console.log(`🕹 Creating new game slot: ${obj.gameId}`);
                this.slots[obj.gameId] = new Slot(obj.gameId, this);
            }
            if (!this.slots[obj.gameId].clients.includes(obj)) {
                console.log(`🎮 Adding client ${obj.sock.id} to game slot ${obj.gameId}`);
                this.slots[obj.gameId].addClient(obj);
            } else {
                console.warn(`⚠️ Client ${obj.sock.id} already in game slot ${obj.gameId}`);
            }
        }
    }

    removeClientObj(obj) {
        if (!obj) return;
        console.log(`➖ Removing client ${obj.sock.id} type: ${obj.connectionType}`);
        if (obj.connectionType === "lobby") delete this.lobbyClients[obj.sock.id];
        else if (obj.connectionType === "ladder") delete this.ladderClients[obj.sock.id];
        else if (obj.connectionType === "game" && obj.gameId && this.slots[obj.gameId]) {
            console.log(`🗑 Removing client ${obj.sock.id} from game slot ${obj.gameId}`);
            this.slots[obj.gameId].removeClient(obj);
        }
    }
}

module.exports = WOL;
