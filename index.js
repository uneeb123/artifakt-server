/* Server configuration */

const express = require('express')
const app = express()
const port = 8000
const cors = require('cors');

/* Authentication */

const sigUtil = require('eth-sig-util')
const signUpTerms = require('./terms.json'); 


/* Database configuration */

const MongoClient = require('mongodb').MongoClient;
const password = "QCTlAIXVHJaShBoi";
const username = 'uneeb123';
const mongoUri = "mongodb+srv://" + username + ":" + password + "@artifakt-4k2c1.mongodb.net/test?retryWrites=true"
const databaseName = "test5";
const collectionName = "users";

var client;
var database;
var collection;

function safeExit() {
  if (client) {
    client.closed();
  }
}

// make sure client is closed in case process is interrupted
process.on('SIGINT', () => {
  console.log("Closing connection");
  safeExit();
  process.exit();
});



/* API calls */

const bodyParser = require('body-parser')
// to support JSON-encoded bodies
app.use(bodyParser.json());
// to support URL-encoded bodies
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cors());


app.get('/', (request, response) => {
  response.send("This thing is alive");
});

function validate(record) {
  return (record.username && record.address && record.email);
}

app.post('/user/:address', (request, response) => {
  let address = request.params.address;
  let username = request.body.username;
  let email = request.body.email;
  let sig = request.body.sig;
  let msgParams = {data: signUpTerms.text, sig: sig};
  let recoveredAddress = sigUtil.recoverPersonalSignature(msgParams);
  if (recoveredAddress.toLowerCase() !== address.toLowerCase() ) {
    console.log("Address on request failed to match with the signer");
    response.sendStatus(401);
    return;
  }

  let record = {
    address: address,
    username: username,
    email: email
  };
  if (!validate(record)) {
    response.status(400);
    response.send("Unable to read user");
  }
  collection.insertOne(record, function(err, result) {
    if (err) {
      response.status(500);
      response.send("Unable to write to the database");
    }
    else {
      console.log("New user (" + username + ") just registered");
      response.sendStatus(201);
    }
  });
});

app.get('/user/:address', (request, response) => {
  let address = request.params.address;
  collection.find({address: address}).toArray(function(err, docs) {
    if (err != null || docs === undefined || docs.length == 0) {
      response.status(404)
      response.send("User not found");
    }
    else {
      response.send(docs[0]);
    }
  });
});

app.post('/auth/:address', (request, response) => {
  let address = request.params.address;
  // msg contains timestamp
  let msg = request.body.msg;
  let sig = request.body.sig;
  let recovered = sigUtil.recoverPersonalSignature({ data: msg, sig: sig });
  if (recovered.toLowerCase() === address.toLowerCase()) {
    console.log("Authentication for " + address + " successful");
    // TODO: issue a token here
    response.sendStatus(200);
  } else {
    console.log("Authentication for " + address + " unsuccessful");
    response.sendStatus(401);
  }
});

/* Establish connections */

// Open database connection before starting server
MongoClient.connect(mongoUri, {useNewUrlParser: true}, function(err, client)  {
  if (err) {
    console.error(err);
  }

  console.log("Connection established with MongoDb cluster");
  database = client.db(databaseName);
  collection = database.collection(collectionName);
  collection.createIndex({ address: 1 }, { unique: true }, function(err, results) {
    if (err) {
      console.error(err);
    }
    console.log("Successfully created index for table");
  });

  app.listen(port, (err) => {
    if (err) {
      console.error('Server unable to start', err)
      safeExit();
      process.exit();
    }
    console.log(`Server is now listening on ${port}`)
  });
});
