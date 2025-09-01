const express = require('express');
const app = express();
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const path = require('path');
const morgan = require('morgan');

// ---------- Middleware ----------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// ---------- Global constants ----------
const FULLNAME = "Wild Ones Latin";
const SHORTNAME = "WOL";

let db;

// ---------- MongoDB ----------
/*MongoClient.connect('mongodb://localhost:27017')
  .then(client => {
    console.log(`[DB] ✅ Connected to MongoDB`);
    db = client.db('emu');
  })
  .catch(err => console.error(`[DB ERROR] ${err}`));
*/
MongoClient.connect('mongodb://localhost:27017')
  .then(client => {
    console.log(`[DB] ✅ Connected to MongoDB`);
    db = client.db('emu');

    // confirm collections
    db.listCollections().toArray().then(cols => {
      console.log("[DB] Collections:", cols.map(c => c.name));
    });
  })
  .catch(err => console.error(`[DB ERROR] ${err}`));
// ---------- Registration ----------
app.post('/registered', async (req, res) => {
  try {
    const { dname, snum, email } = req.body;
    const users = db.collection('users');

    if (await users.findOne({ email }) || await users.findOne({ dname })) {
      return res.sendFile(path.join(__dirname, 'alreadyexists.html'));
    }

    await users.insertOne({
      dname,
      snum,
      email,
      nw: -1.0,
      level: 0.0,
      currentPet: "3",
      login_streak: 1.0,
      playerStatus: "playing",
      status: "playing",
      net: "M",
      lkey: snum,
      gamecount: 100.0,
      gold: 1000.0,
      treats: 200.0,
      hp: 500000.0,
      wins: 0,
      sesscount: 0,
      losses: 0,
      speed: 5.0,
      attack: 100.0,
      defence: 5.0,
      jump: 5.0,
      xp: 0.0,
      userAccessories: ["top_playdom_black"],
      durability: { "head_ninjaA_white": 30.0 },
      ownedPets: {
        "1": {
          gender: "M",
          id: 1.0,
          pers: "brave",
          name: dname,
          accessories: ["top_playdom_black"],
          color2: "0xE1E2E3",
          type: "dog",
          deaths: 0.0,
          kills: 0.0,
          color1: "0x6C6C6C"
        }
      },
      userWeaponsOwned: {},
      userWeaponsEquipped: ["walk", "bone", "superjump", "climb", "punch", "dig", "mortar"],
      allowedMaps: ["Crash Landing"],
      command: "player",
      online: 1.0
    });

    res.sendFile(path.join(__dirname, 'registered.html'));
  } catch (err) {
    console.error(`[REGISTER ERROR] ${err}`);
    res.status(500).send("Registration error");
  }
});


// ---------- Login / Game (minimal old-style) ----------
app.post('/juego', async (req, res) => {
  const { dname, snum } = req.body;
  console.log('[LOGIN] Attempt:', dname, snum);

  if (!db) {
    console.error('[DB] Not connected yet!');
    return res.status(500).send('Database not ready');
  }

  const users = db.collection('users');

  try {
    const count = await users.countDocuments({});
    console.log(`[DB] Users count: ${count}`);

    const user = await users.findOne({ dname, snum });
    console.log("[DB] Query result:", user);

    if (user) {
      console.log('[LOGIN] Success for', dname);

      // Directly serve the SWF loader
      return res.send(`
        <html>
          <head><title>Game</title></head>
          <body style="margin:0;padding:0;background:#000;overflow:hidden;">
            <object width="100%" height="100%">
              <param name="movie" value="/privatewolswf/publicV1.swf?dname=${dname}&snum=${snum}&net=M"/>
              <param name="quality" value="high"/>
              <param name="scale" value="exactfit"/>
              <embed src="/privatewolswf/publicV1.swf?dname=${dname}&snum=${snum}&net=M"
                     width="100%" height="100%"
                     quality="high"
                     scale="exactfit"/>
            </object>
          </body>
        </html>
      `);
    } else {
      console.log('[LOGIN] Failed for', dname);
      return res.sendFile(path.join(__dirname, 'errorLogin.html'));
    }
  } catch (err) {
    console.error('[DB ERROR]', err);
    res.status(500).send('DB error');
  }
});


// ---------- Static files & index ----------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use(express.static(__dirname));
app.use('/css', express.static(path.join(__dirname, '/css')));
app.use('/js', express.static(path.join(__dirname, '/js')));
app.use('/img', express.static(path.join(__dirname, '/img')));
app.use('/auth-des', express.static(path.join(__dirname, '/auth-des')));

// ---------- Start server ----------
app.listen(80, () => console.log(`[SERVER] HTTP server running on port 80`));
