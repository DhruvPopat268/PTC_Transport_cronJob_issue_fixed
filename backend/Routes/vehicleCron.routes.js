const express = require("express");
const router = express.Router();
const { updateAllData2 } = require("../controllers/vehicleCron.controller");

router.get("/update-all-data/:from?/:to?", updateAllData2);

module.exports = router;