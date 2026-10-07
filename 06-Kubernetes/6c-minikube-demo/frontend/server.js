const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(express.static('public'));
app.use(express.json());

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

app.get('/api/pets', async (req, res) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/pets`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching pets:', error);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

app.post('/api/pets', async (req, res) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error adding pet:', error);
    res.status(500).json({ error: 'Failed to add pet' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frontend running on port ${PORT}`);
});
