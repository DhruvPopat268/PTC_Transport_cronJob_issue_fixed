const express = require("express");
const router = express.Router();
const { updateAllData2, setPendingStatus } = require("../Controller/vehicleCron.controller");

router.get("/set-pending", setPendingStatus);
router.get("/update-all-data", updateAllData2);

module.exports = router;