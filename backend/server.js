const express = require('express');
const db = require('./Database/db');
const userRoutes = require('./Routes/userRoutes');
const vehicleCronRoutes = require("./Routes/vehicleCron.routes");

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use('/api/users', userRoutes);
app.use("/api/vehicle", vehicleCronRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});