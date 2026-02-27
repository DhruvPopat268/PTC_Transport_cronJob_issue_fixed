const axios = require("axios");
const pool = require("../Database/db");

require("dotenv").config();

async function getDVSAAccessToken() {
  try {
    const response = await axios.post(
      `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AZURE_CLIENT_ID,
        client_secret: process.env.AZURE_CLIENT_SECRET,
        scope: "https://tapi.dvsa.gov.uk/.default",
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return response.data.access_token || null;
  } catch (err) {
    console.error("DVSA Token Error:", err.response?.data || err.message);
    return null;
  }
}

const updateAllData2 = async (req, res) => {
  try {
    const query = "SELECT * FROM vehicles WHERE cron_status IN ('Pending', 'Failed')";
    const [vehicles] = await pool.query(query);

    const apiKey2 = "dmVdeybS8M99rT3PrZ6iw8VZvP5gR6la3wSy2Mld";
    const apiUrl2 = "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";

    // Chunk vehicles (50 per batch)
    const chunks = [];
    for (let i = 0; i < vehicles.length; i += 50) {
      chunks.push(vehicles.slice(i, i + 50));
    }

    for (const vehicleChunk of chunks) {
      for (const vehicle of vehicleChunk) {
        const registrationNumber = vehicle.registrations;
        const companyName = vehicle.companyName;

        try {
          // 🔐 Get DVSA Access Token
          const accessToken = await getDVSAAccessToken();
          if (!accessToken) {
            await pool.query("UPDATE vehicles SET cron_status='Failed' WHERE id=?", [
              vehicle.id,
            ]);
            continue;
          }

          // 🚗 Call DVSA Trade MOT API
          const response = await axios.get(`${apiUrl2}/${registrationNumber}`, {
            headers: {
              "x-api-key": apiKey2,
              Authorization: `Bearer ${accessToken}`,
            },
          });

          const resp = response.data;

          if (!resp || !resp.registration) {
            await pool.query("UPDATE vehicles SET cron_status='Failed' WHERE id=?", [
              vehicle.id,
            ]);
            continue;
          }

          // 🛠 Update vehicles table
          await pool.query(
            `UPDATE vehicles SET 
              make=?, model=?, first_used_date=?, fuel_type=?, primary_colour=?,
              registration_date=?, manufacture_date=?, engine_size=?, 
              has_outstanding_recall=?, cron_status='Completed'
             WHERE id=?`,
            [
              resp.make,
              resp.model,
              resp.firstUsedDate,
              resp.fuelType,
              resp.primaryColour,
              resp.registrationDate,
              resp.manufactureDate,
              resp.engineSize,
              resp.hasOutstandingRecall,
              vehicle.id,
            ]
          );

          // 🔗 Update vehicleDetails (if exists)
          const [details] = await pool.query(
            "SELECT * FROM vehicleDetails WHERE registrationNumber=? LIMIT 1",
            [registrationNumber]
          );

          if (details.length > 0) {
            await pool.query(
              "UPDATE vehicleDetails SET vehicle_id=? WHERE id=?",
              [vehicle.id, details[0].id]
            );
          }

          // 🧪 MOT TESTS
          if (resp.motTests && Array.isArray(resp.motTests)) {
            const testsReversed = [...resp.motTests].reverse();

            for (const test of testsReversed) {
              // Insert/update annual test
              await pool.query(
                `INSERT INTO vehicles_annual_tests 
                 (companyName, vehicle_id, mot_test_number, completed_date, expiry_date, 
                  odometer_value, odometer_unit, odometer_result_type, test_result, 
                  data_source, location)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE 
                    completed_date=?, expiry_date=?, odometer_value=?`,
                [
                  companyName,
                  vehicle.id,
                  test.motTestNumber,
                  test.completedDate,
                  test.expiryDate,
                  test.odometerValue,
                  test.odometerUnit,
                  test.odometerResultType,
                  test.testResult,
                  test.dataSource,
                  test.location,

                  // update
                  test.completedDate,
                  test.expiryDate,
                  test.odometerValue,
                ]
              );

              // Fetch annual test ID
              const [annualTestRow] = await pool.query(
                "SELECT id FROM vehicles_annual_tests WHERE mot_test_number=? AND vehicle_id=?",
                [test.motTestNumber, vehicle.id]
              );

              const annualTestID = annualTestRow[0].id;

              // 🛠️ Defects
              if (test.defects) {
                for (const defect of test.defects) {
                  await pool.query(
                    `INSERT INTO vehicles_annual_test_defects
                     (companyName, vehicle_id, annual_test_id, dangerous, text, type)
                     VALUES (?,?,?,?,?,?)
                     ON DUPLICATE KEY UPDATE type=?`,
                    [
                      companyName,
                      vehicle.id,
                      annualTestID,
                      defect.dangerous ? "true" : "false",
                      defect.text,
                      defect.type,
                      defect.type,
                    ]
                  );
                }
              }
            }
          }
        } catch (err) {
          console.error("FAILED:", registrationNumber, err.message);
          await pool.query(
            "UPDATE vehicles SET cron_status='Failed' WHERE id=?",
            [vehicle.id]
          );
        }
      }
    }

    return res.json({
      success: true,
      message: "Cron executed successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { updateAllData2 };