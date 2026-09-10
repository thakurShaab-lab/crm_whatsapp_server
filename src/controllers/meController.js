/**
 * GET /api/me — the logged-in agent's own profile, for the chat header's Profile
 * popup. `req.employee` is already the full `tbl_employees` row loaded once per
 * request by agentContext middleware (the same "single configured employee" stand-in
 * for real auth used everywhere else in this app) — no extra query needed here.
 */
export async function getMyProfile(req, res) {
  const employee = req.employee
  const name = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ')

  res.json({
    empId: employee.empId,
    name,
    email: employee.email || null,
    mobile: employee.phoneNumber || null,
    isdCode: employee.isdCode || null,
    whatsappWabano: employee.whatsappWabano || null,
  })
}
