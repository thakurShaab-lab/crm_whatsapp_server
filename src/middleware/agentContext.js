import { config } from '../config/index.js'
import { findEmployeeById } from '../models/employeesModel.js'
import { HttpError } from './errorHandler.js'

/**
 * Stand-in for real auth (out of scope for this build): every request acts as the
 * single configured `tbl_employees` row rather than a logged-in session. Loads that
 * row once per request so `waNumber`/vendor config always reflect the real record.
 */
export async function agentContext(req, res, next) {
  const employee = await findEmployeeById(config.defaultEmployeeId)
  if (!employee) {
    throw new HttpError(500, `Configured employee ${config.defaultEmployeeId} was not found in tbl_employees`)
  }

  req.userAdminId = config.defaultUserAdminId
  req.employeeId = employee.empId
  req.waNumber = employee.whatsappWabano
  req.vendorCode = employee.whatsappVendor
  req.employee = employee
  next()
}
