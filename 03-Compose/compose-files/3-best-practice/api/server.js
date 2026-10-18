const express = require('express')
const mongoose = require('mongoose')
const app = express()
const cors = require('cors')
app.use(express.json()) 
app.use(cors())

const port = process.env.PORT || 3000 

// DB connection, repeat until connection is established since Mongo caontainer might start after the backend one
let connectWithRetry = function() {
  return mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/foodsdb')
      .then(() => console.log('Connected to MongoDB!'))
      .catch ((error) => {
        console.error('Failed to connect to mongo on startup - retrying in 1 sec', error);
        setTimeout(connectWithRetry, 1000);
      }); 
};
connectWithRetry();

// Define Food Schema
const foodSchema = new mongoose.Schema({
  name: String,
  color: String,
});

// Create Food Model
const Food = mongoose.model("Food", foodSchema);

// Seed Function
async function seedFoods() {
  // Define five foods with name and color
  const foods = [
    { name: "Apple", color: "Red" },
    { name: "Banana", color: "Yellow" },
    { name: "Grapes", color: "Purple" },
    { name: "Orange", color: "Orange" },
    { name: "Lettuce", color: "Green" },
  ];

  try {
    //empty the DB
    await Food.deleteMany({});
    // Insert foods
    await Food.insertMany(foods);
    console.log("Foods seeded successfully:", foods);
  } catch (error) {
    console.error("Error seeding foods:", error);
  }
  
}

//Wait 1.5 seconds and seed the Mongo DB zith the placeholder foods
setTimeout(seedFoods,1500)

// the / endpoint
app.get("/", async (req, res) => {
  try {
    const foods = await Food.find();
    res.send(foods);
  } catch (error) {
    res.status(500).json({ message: "Error fetching foods", error });
  }
});

//Start Node server and listen on port
app.listen(port, () => {
  console.log(`Foods API listening on port ${port}`)
})