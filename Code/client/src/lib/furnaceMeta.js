/** Resolve furnace master row by code — never hardcode RHF-nn gas/type in UI. */
export function getFurnaceMeta(machines, code) {
  if (!code) return null;
  const list = Array.isArray(machines) ? machines : [];
  const row = list.find(
    (m) => m.machineCode === code || m.machine_code === code
  );
  if (!row) {
    return {
      machineCode: code,
      label: code,
      gasType: null,
      furnaceType: 'RHF',
      enabled: true,
      displayOrder: 100,
    };
  }
  return {
    machineCode: row.machineCode ?? row.machine_code,
    label: row.label ?? row.machineCode ?? row.machine_code,
    gasType: row.gasType ?? row.gas_type ?? null,
    furnaceType: row.furnaceType ?? row.furnace_type ?? 'RHF',
    enabled: row.enabled !== false,
    displayOrder: row.displayOrder ?? row.display_order ?? 100,
  };
}

export function machineCodeOf(m) {
  return m?.machineCode ?? m?.machine_code ?? '';
}
