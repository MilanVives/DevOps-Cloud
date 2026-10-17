const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_USERNAME = process.env.MONGO_USERNAME || '';
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || '';
const MONGO_HOST = process.env.MONGO_HOST || 'localhost';
const MONGO_PORT = process.env.MONGO_PORT || '27017';
const MONGO_DATABASE = process.env.MONGO_DATABASE || 'petshelter';

let MONGO_URL;
if (MONGO_USERNAME && MONGO_PASSWORD) {
  MONGO_URL = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}?authSource=admin`;
} else {
  MONGO_URL = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`;
}

console.log('Connecting to MongoDB...');
mongoose.connect(MONGO_URL);

const petSchema = new mongoose.Schema({
  name: String,
  type: String,
  age: Number
});

const Pet = mongoose.model('Pet', petSchema);

async function seedDatabase() {
  const count = await Pet.countDocuments();
  if (count === 0) {
    await Pet.insertMany([
      { name: 'Max', type: 'Dog', age: 3 },
      { name: 'Bella', type: 'Cat', age: 2 },
      { name: 'Charlie', type: 'Dog', age: 5 },
      { name: 'Luna', type: 'Cat', age: 1 }
    ]);
    console.log('Database seeded with initial pets');
  }
}

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
  seedDatabase();
});

// 200 only while MongoDB is connected: used by Docker healthchecks and Kubernetes probes.
app.get('/health', (req, res) => {
  const up = mongoose.connection.readyState === 1;
  res.status(up ? 200 : 503).json({ status: up ? 'ok' : 'database unavailable' });
});

app.get('/api/pets', async (req, res) => {
  try {
    res.json(await Pet.find());
  } catch (err) {
    console.error('Error reading pets:', err);
    res.status(500).json({ error: 'Failed to read pets' });
  }
});

app.post('/api/pets', async (req, res) => {
  // Only the known fields, validated: never pass req.body straight to the model.
  const { name, type } = req.body || {};
  const age = Number(req.body?.age); // the form sends it as a string
  const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
  if (!text(name, 50) || !text(type, 30) || !Number.isInteger(age) || age < 0 || age > 50) {
    return res.status(400).json({ error: 'name (max 50), type (max 30) and age (0-50) are required' });
  }
  try {
    const pet = await Pet.create({ name: name.trim(), type: type.trim(), age });
    res.status(201).json(pet);
  } catch (err) {
    console.error('Error adding pet:', err);
    res.status(500).json({ error: 'Failed to add pet' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
