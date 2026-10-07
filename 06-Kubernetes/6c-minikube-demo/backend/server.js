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

app.get('/api/pets', async (req, res) => {
  const pets = await Pet.find();
  res.json(pets);
});

app.post('/api/pets', async (req, res) => {
  const pet = new Pet(req.body);
  await pet.save();
  res.json(pet);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
