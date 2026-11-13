import pool from "../../../config/db.js";

async function getConnection() {
  return pool.getConnection();
}

async function findActiveUserForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, address, city, pincode, status
       FROM users
      WHERE id = ?
      LIMIT 1
      FOR UPDATE`,
    [userId],
  );
  return rows[0] || null;
}

async function findCasesByUserIdForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, user_id, business_type, status, steps_completed
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id ASC
      LIMIT 2
      FOR UPDATE`,
    [userId],
  );
  return rows;
}

async function findStepByCaseIdAndNumber(connection, caseId, stepNumber) {
  const [rows] = await connection.execute(
    `SELECT step_number, status, completed_at
       FROM kyc_steps
      WHERE case_id = ?
         AND step_number = ?
      LIMIT 1
      FOR UPDATE`,
    [caseId, stepNumber],
  );
  return rows[0] || null;
}

async function resetStep1ToInProgress(connection, caseId) {
  await connection.execute(
    `UPDATE kyc_steps
        SET status = 'in_progress',
            completed_at = NULL,
            failure_code = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE case_id = ?
        AND step_number = 1`,
    [caseId],
  );
  return true;
}

async function updateCaseBasicDetails(connection, caseId, businessType) {
  await connection.execute(
    `UPDATE kyc_cases
        SET business_type = ?,
            steps_completed = (
              SELECT COUNT(*)
                FROM kyc_steps
               WHERE case_id = ?
                 AND status = 'completed'
            ),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [businessType, caseId, caseId],
  );
  return true;
}

async function updateUserAddress(connection, userId, { shopAddress, city, pincode }) {
  await connection.execute(
    `UPDATE users
        SET address = ?,
            city = ?,
            pincode = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [shopAddress, city, pincode, userId],
  );
  return true;
}

async function countCompletedSteps(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS steps_completed
       FROM kyc_steps
      WHERE case_id = ?
        AND status = 'completed'`,
    [caseId],
  );
  return Number(rows[0]?.steps_completed || 0);
}

async function completeStep1(connection, caseId) {
  const [result] = await connection.execute(
    `UPDATE kyc_steps
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            failure_code = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE case_id = ?
        AND step_number = 1
        AND status <> 'completed'`,
    [caseId],
  );
  return Number(result.affectedRows || 0) === 1;
}

async function updateCompletedStepsCount(connection, caseId) {
  const stepsCompleted = await countCompletedSteps(connection, caseId);
  await connection.execute(
    `UPDATE kyc_cases
        SET steps_completed = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [stepsCompleted, caseId],
  );
  return stepsCompleted;
}

async function findStepCompletionState(caseId) {
  const [rows] = await pool.execute(
    `SELECT step.status, step.completed_at, kyc.steps_completed
       FROM kyc_steps AS step
       JOIN kyc_cases AS kyc ON kyc.id = step.case_id
      WHERE step.case_id = ?
        AND step.step_number = 1
      LIMIT 1`,
    [caseId],
  );
  return rows[0] || null;
}

const basicDetailsModel = {
  getConnection,
  findActiveUserForUpdate,
  findCasesByUserIdForUpdate,
  findStepByCaseIdAndNumber,
  resetStep1ToInProgress,
  updateCaseBasicDetails,
  updateUserAddress,
  countCompletedSteps,
  completeStep1,
  updateCompletedStepsCount,
  findStepCompletionState,
};

export {
  getConnection,
  findActiveUserForUpdate,
  findCasesByUserIdForUpdate,
  findStepByCaseIdAndNumber,
  resetStep1ToInProgress,
  updateCaseBasicDetails,
  updateUserAddress,
  countCompletedSteps,
  completeStep1,
  updateCompletedStepsCount,
  findStepCompletionState,
};

export default basicDetailsModel;
