const axios = require("axios");
const pool = require("./Database/db");
const cron = require("node-cron");
require("dotenv").config();

let isRunning = false;
let currentCronLogId = null;

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

async function processVehicles() {
  if (isRunning) {
    console.log("⚠️  Worker already running, skipping...");
    return;
  }

  isRunning = true;
  console.log(`\n🚀 [${new Date().toISOString()}] Starting vehicle processing...\n`);

  let successCount = 0;
  let failedCount = 0;
  let invalidCount = 0;

  try {
    // Create cron log entry
    const [logResult] = await pool.query(
      "INSERT INTO cron_logs (job_type, status) VALUES ('vehicle_update', 'Started')"
    );
    currentCronLogId = logResult.insertId;

    const [vehicles] = await pool.query(
      "SELECT * FROM vehicles WHERE cron_status IN ('Pending', 'Failed')"
    );

    console.log(`📊 Found ${vehicles.length} vehicles to process\n`);

    const apiKey2 = "dmVdeybS8M99rT3PrZ6iw8VZvP5gR6la3wSy2Mld";
    const apiUrl2 = "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";

    for (const vehicle of vehicles) {
      const registrationNumber = vehicle.registrations;
      const companyName = vehicle.companyName;

      try {
        const accessToken = await getDVSAAccessToken();
        if (!accessToken) {
          console.log(`❌ ${registrationNumber} - Token generation failed`);
          await pool.query("UPDATE vehicles SET cron_status='Failed' WHERE id=?", [vehicle.id]);
          await pool.query(
            "INSERT INTO vehicle_process_logs (cron_log_id, vehicle_id, registration_number, status, error_message) VALUES (?,?,?,?,?)",
            [currentCronLogId, vehicle.id, registrationNumber, 'Failed', 'Token generation failed']
          );
          failedCount++;
          continue;
        }

        const response = await axios.get(`${apiUrl2}/${registrationNumber}`, {
          headers: {
            "x-api-key": apiKey2,
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const resp = response.data;

        if (!resp || !resp.registration) {
          console.log(`❌ ${registrationNumber} - No data returned`);
          await pool.query("UPDATE vehicles SET cron_status='Failed' WHERE id=?", [vehicle.id]);
          await pool.query(
            "INSERT INTO vehicle_process_logs (cron_log_id, vehicle_id, registration_number, status, error_message) VALUES (?,?,?,?,?)",
            [currentCronLogId, vehicle.id, registrationNumber, 'Failed', 'No data returned from API']
          );
          failedCount++;
          continue;
        }

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

        const [details] = await pool.query(
          "SELECT * FROM vehicle_details WHERE registrationNumber=? LIMIT 1",
          [registrationNumber]
        );

        if (details.length > 0) {
          await pool.query("UPDATE vehicle_details SET vehicle_id=? WHERE id=?", [
            vehicle.id,
            details[0].id,
          ]);
        }

        if (resp.motTests && Array.isArray(resp.motTests)) {
          const testsReversed = [...resp.motTests].reverse();

          for (const test of testsReversed) {
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
                test.completedDate,
                test.expiryDate,
                test.odometerValue,
              ]
            );

            const [annualTestRow] = await pool.query(
              "SELECT id FROM vehicles_annual_tests WHERE mot_test_number=? AND vehicle_id=?",
              [test.motTestNumber, vehicle.id]
            );

            if (!annualTestRow || annualTestRow.length === 0) {
              console.log(`⚠️  ${registrationNumber} - Annual test not found for MOT ${test.motTestNumber}`);
              continue;
            }

            const annualTestID = annualTestRow[0].id;

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

        console.log(`✅ ${registrationNumber} - Completed`);
        await pool.query(
          "INSERT INTO vehicle_process_logs (cron_log_id, vehicle_id, registration_number, status) VALUES (?,?,?,?)",
          [currentCronLogId, vehicle.id, registrationNumber, 'Success']
        );
        successCount++;
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.log(`❌ ${registrationNumber} - Invalid (404)`);
          await pool.query("UPDATE vehicles SET cron_status='Invalid' WHERE id=?", [vehicle.id]);
          await pool.query(
            "INSERT INTO vehicle_process_logs (cron_log_id, vehicle_id, registration_number, status, error_message) VALUES (?,?,?,?,?)",
            [currentCronLogId, vehicle.id, registrationNumber, 'Invalid', 'Not found in DVSA database']
          );
          invalidCount++;
        } else {
          console.log(`❌ ${registrationNumber} - Failed: ${err.message}`);
          await pool.query("UPDATE vehicles SET cron_status='Failed' WHERE id=?", [vehicle.id]);
          await pool.query(
            "INSERT INTO vehicle_process_logs (cron_log_id, vehicle_id, registration_number, status, error_message) VALUES (?,?,?,?,?)",
            [currentCronLogId, vehicle.id, registrationNumber, 'Failed', err.message]
          );
          failedCount++;
        }
      }
    }

    // Update cron log as completed
    await pool.query(
      "UPDATE cron_logs SET status='Completed', vehicles_processed=?, vehicles_success=?, vehicles_failed=?, vehicles_invalid=?, completed_at=NOW() WHERE id=?",
      [vehicles.length, successCount, failedCount, invalidCount, currentCronLogId]
    );

    console.log(`\n✅ [${new Date().toISOString()}] Processing completed\n`);
    console.log(`📊 Summary: ${successCount} success, ${failedCount} failed, ${invalidCount} invalid\n`);
  } catch (error) {
    console.error("❌ Worker error:", error.message);
    if (currentCronLogId) {
      await pool.query(
        "UPDATE cron_logs SET status='Failed', error_message=?, completed_at=NOW() WHERE id=?",
        [error.message, currentCronLogId]
      );
    }
  } finally {
    isRunning = false;
    currentCronLogId = null;
  }
}

// Schedule: Every day at 2 AM
cron.schedule("0 2 * * *", () => {
  console.log("⏰ Scheduled cron triggered");
  processVehicles();
});

console.log("✅ Worker started - Scheduled for 2 AM daily");

// Export for manual trigger
module.exports = { processVehicles };
