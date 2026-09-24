/**
 * Smoke: machine handover preview / draft / ACL surface (requires migrated DB).
 */
import { config } from './config.js';
import {
  buildOutgoingPreview,
  saveDraftHandover,
  getPendingForMachine,
  assertProductionAllowed,
  getHandoverOverview,
} from './services/MachineHandoverService.js';
import { assertHandoverMachineAccess } from './auth/handoverAccessPolicy.js';

async function main() {
  const machineCode = process.env.SMOKE_MACHINE || 'A-59';
  const user = {
    userId: '00000000-0000-4000-8000-000000000099',
    roles: ['ADMIN'],
    processAccess: [],
    machineAccess: [],
  };

  console.log('tenant', config.tenantId);
  await assertHandoverMachineAccess(user, machineCode);
  console.log('ACL ok', machineCode);

  const preview = await buildOutgoingPreview(machineCode, user.userId);
  console.log('preview', {
    processCode: preview.processCode,
    shift: preview.shift?.shiftCode,
    openWork: preview.productionSummary?.openWorkCount,
    canSubmit: preview.canSubmit,
  });

  const draft = await saveDraftHandover(machineCode, user.userId, {
    machineStatus: 'IDLE',
    remarks: 'Smoke draft remarks for handover test..',
    handoverPriority: 'MEDIUM',
  });
  console.log('draft', draft?.handover_id, draft?.status);

  await assertProductionAllowed(machineCode, user.userId);
  console.log('production allowed (no pending)');

  const pending = await getPendingForMachine(machineCode);
  console.log('pending', pending?.handover_id ?? null);

  const overview = await getHandoverOverview(null);
  console.log('overview awaiting', overview.awaitingAcceptance);

  console.log('SMOKE_HANDOVER_OK');
}

main().catch((e) => {
  console.error('SMOKE_HANDOVER_FAIL', e);
  process.exit(1);
});
