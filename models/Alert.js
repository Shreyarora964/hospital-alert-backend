// backend/models/Alert.js
const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  name: String,
  email: String,
  address: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Alert", alertSchema);
