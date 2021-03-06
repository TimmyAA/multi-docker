const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});
pgClient.on('error', () => console.log('Lost PG connection'));

pgClient
  .query('CREATE TABLE IF NOT EXISTS values(number INT)')
  .catch((err) => console.log(err));


// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// Express route handlers
app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');
  console.log("/values/all from pg: " + values.rows);
  res.send(values.rows);
});

app.get('/values/current', async (req,res) => {
  redisClient.hgetall('values', (err, values) => {
	console.log('/values/current from redis: ' + values);
    res.send(values);
  });
});


app.post('/values', async( req, res) => {
  const index = req.body.index;
  if(!isNumeric( index)) {
    return res.status(423).send('Not an integer');
  }
  if(parseInt(index)>40) {
    return res.status(422).send('Index too high');
  }
  console.log('Publishing to redis/values: ' + index + ' Nothing yet!');
  redisClient.hset('values', index, 'Nothing yet!');
  redisPublisher.publish('insert', index);
  console.log('Inserting to pg/values ' + index);
  pgClient.query('insert into values(number) VALUES($1)', [index]);
  res.send({working: true });
});

app.listen(5000, err => {
   console.log('Listening');
});

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
