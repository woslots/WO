"use strict";

const md5 = require('md5');
const { v4: uuidv4 } = require('uuid');

function Utils() {}

var zeroValue = "0".charCodeAt(0);
var aValue = "A".charCodeAt(0);

// --- Existing functions ---
Utils.intToString = function(val){
    var bytes = Buffer.alloc(8);
    var b;
    var res = "";
    bytes.writeDoubleBE(val);
    var i = 0;
    while(i < bytes.length){
        b = ((bytes[i] >> 4) & 15);
        res += String.fromCharCode((b > 9) ? ((aValue + b) - 10) : (zeroValue + b));
        b = (bytes[i] & 15);
        res += String.fromCharCode((b > 9) ? ((aValue + b) - 10) : (zeroValue + b));
        i++;
    }
    return res;
};

Utils.string2Bin = function(str) {
    var result = [];
    for (var i = 0; i < str.length; i++) {
        result.push(str.charCodeAt(i).toString(2));
    }
    return result;
};

Utils.bin2String = function(array) {
    var result = "";
    for (var i = 0; i < array.length; i++) {
        result += String.fromCharCode(parseInt(array[i], 2));
    }
    return result;
};

Utils.stringToInt = function(str){
    if(!str) return 0;
    if(str.length != 16){
        console.log("Bad number!");
        return -1;
    }
    var n = 0;
    var b = 0;
    var ch;
    var bytes = Buffer.alloc(8);
    var loc = 0;

    for(var i = 0; i < str.length; i++){
        ch = str.charCodeAt(i);
        b = ch >= aValue ? (10 + ch - aValue) : (ch - zeroValue);
        i++;
        b = b << 4;
        ch = str.charCodeAt(i);
        b |= (ch >= aValue ? 10 + ch - aValue : ch - zeroValue);
        b &= 0xFF;
        bytes.writeUInt8(b, loc++);
    }

    n = bytes.readDoubleBE(0);
    return n;
};

Utils.randKey = function(){
    const key = Math.random().toString(36).substring(7);
    console.log(`🔑 Utils.randKey -> ${key}`);
    return key;
};

Utils.randInt = function(){
    const val = parseInt(Math.random() * 1000);
    console.log(`🔢 Utils.randInt -> ${val}`);
    return val;
};

Utils.md5 = function(str){
    const hash = md5(str);
    console.log(`🔒 Utils.md5('${str}') -> ${hash}`);
    return hash;
};

// --- NEW: UUID generator ---
Utils.generateUUID = function(){
    const id = uuidv4();
    console.log(`🔑 Utils.generateUUID -> ${id}`);
    return id;
};

module.exports = Utils;
