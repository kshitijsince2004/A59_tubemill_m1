/**
 * Plant Head is denied PPC / plan-import commit operations.
 * Wire onto PPC routes when they exist.
 */
export function denyPlantHeadPpc(req, res, next) {
  const role = req.appRole ?? req.user?.primaryRole;
  const roles = req.user?.roles ?? [];
  if (role === 'PLANT_HEAD' || roles.includes('PLANT_HEAD')) {
    res.status(403).json({
      data: null,
      errors: [{ message: 'PLANT_HEAD cannot run PPC import / commit' }],
    });
    return;
  }
  next();
}
