import { getEventBus } from '../events/InProcessEventBus';







export async function publishRunOpened(payload) {
  await getEventBus().publish('tm.run_opened', payload);
}

export async function publishSetupApproved(payload) {
  await getEventBus().publish('tm.setup_approved', payload);
}

export async function publishMachineState(payload) {
  await getEventBus().publish('tm.machine_state', payload);
}

export async function publishRunClosed(payload) {
  await getEventBus().publish('tm.run_closed', payload);
}