const express = require("express");
const router = express.Router();
const { updateAllData2 } = require("../Controller/vehicleCron.controller");

router.get("/update-all-data", updateAllData2);

module.exports = router;