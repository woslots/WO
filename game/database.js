"use strict";

const { MongoClient } = require('mongodb');

const url = 'mongodb://localhost:27017/emu';

let database;

class Database {
    connect() {
        return new Promise((resolve, reject) => {
            MongoClient.connect(url)
                .then(client => {
                    console.log("Connected correctly to server.");
                    database = client.db(); // get the database
                    resolve(database);
                })
                .catch(err => reject(err));
        });
    }

    update(condition, data) {
        return database.collection('users').updateOne(
            condition,
            { $set: data }
        );
    }

    count(condition, callback) {
        database.collection('users').find(condition).count((err, n) => {
            callback(n);
        });
    }

    fetch(condition, callback) {
        database.collection('users').findOne(condition, (err, document) => {
            callback(document);
        });
    }

    getDb() {
        return database;
    }
}

module.exports = Database;
