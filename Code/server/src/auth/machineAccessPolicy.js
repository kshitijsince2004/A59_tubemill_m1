const MACHINE_LEVEL_RANK = {
  READ: 1,
  WRITE: 2,
  MANAGE: 3,
};

function hasMachineWrite(user, machineCode) {
  if (!user) return false;
  if (user.roles?.includes('ADMIN')) return true;
  const grant = (user.machineAccess ?? []).find((g) => g.machineCode === machineCode);
  if (!grant) return false;
  return MACHINE_LEVEL_RANK[grant.level] >= MACHINE_LEVEL_RANK.WRITE;
}

/**
 * Machine-scoped approval for MACHINE_HEAD.
 * ADMIN always allowed. Empty machineAccess does NOT bypass.
 * @param {{ roles?: string[], machineAccess?: { machineCode: string, level?: string }[] } | null | undefined} user
 * @param {string | null | undefined} machineCode
 */
export function assertMachineApproval(user, machineCode) {
  if (!user) {
    const err = new Error('Unauthenticated');
    err.status = 401;
    throw err;
  }
  // ADMIN and PLANT_HEAD (escalation) may approve plant-wide.
  if (user.roles?.includes('ADMIN') || user.roles?.includes('PLANT_HEAD')) return;
  if (!machineCode) {
    const err = new Error('Machine identity required for approval');
    err.status = 403;
    throw err;
  }
  if (!hasMachineWrite(user, machineCode)) {
    const err = new Error(`Requires WRITE on machine ${machineCode}`);
    err.status = 403;
    throw err;
  }
}

/**
 * Every machineCode must be in the user's machineAccess (WRITE+).
 * Empty machineAccess never bypasses. ADMIN always allowed.
 */
export function assertMachinesApproval(user, machineCodes) {
  if (!user) {
    const err = new Error('Unauthenticated');
    err.status = 401;
    throw err;
  }
  if (user.roles?.includes('ADMIN') || user.roles?.includes('PLANT_HEAD')) return;
  const codes = [...new Set((machineCodes ?? []).filter(Boolean))];
  if (!codes.length) {
    const err = new Error('Machine identity required for approval');
    err.status = 403;
    throw err;
  }
  for (const code of codes) {
    assertMachineApproval(user, code);
  }
}

/** Machine codes the user may act on (empty for non-admin with no grants). */
export function accessibleMachineCodes(user) {
  if (!user) return [];
  if (user.roles?.includes('ADMIN') || user.roles?.includes('PLANT_HEAD')) {
    return null; // null = all machines
  }
  return (user.machineAccess ?? []).map((g) => g.machineCode).filter(Boolean);
}
