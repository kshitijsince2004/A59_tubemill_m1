import { getEventBus } from '../events/InProcessEventBus';
import type {
  RunOpenedEvent,
  SetupApprovedEvent,
  MachineStateEvent,
  RunClosedEvent,
} from '@a59/shared';

export async function publishRunOpened(payload: RunOpenedEvent): Promise<void> {
  await getEventBus().publish('tm.run_opened', payload);
}

export async function publishSetupApproved(payload: SetupApprovedEvent): Promise<void> {
  await getEventBus().publish('tm.setup_approved', payload);
}

export async function publishMachineState(payload: MachineStateEvent): Promise<void> {
  await getEventBus().publish('tm.machine_state', payload);
}

export async function publishRunClosed(payload: RunClosedEvent): Promise<void> {
  await getEventBus().publish('tm.run_closed', payload);
}
