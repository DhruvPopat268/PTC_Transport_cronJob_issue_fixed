const pool = require("../Database/db");
const { processVehicles } = require("../worker");

const updateAllData2 = async (req, res) => {
  try {
    const [vehicles] = await pool.query(
      "SELECT COUNT(*) as count FROM vehicles WHERE cron_status IN ('Pending', 'Failed')"
    );

    const count = vehicles[0].count;

    // Trigger background processing without waiting
    setImmediate(() => processVehicles());

    return res.json({
      success: true,
      message: "Vehicle processing started in background",
      vehiclesToProcess: count,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const setPendingStatus = async (req, res) => {
  try {
    const [result] = await pool.query(
      "UPDATE vehicles SET cron_status='Pending'"
    );
    
    console.log(`✅ Updated ${result.affectedRows} vehicles to Pending status`);
    
    return res.json({
      success: true,
      message: "All vehicles set to Pending status",
      count: result.affectedRows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { updateAllData2, setPendingStatus };