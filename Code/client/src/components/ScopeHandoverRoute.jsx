import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { classifyHandoverBranch } from '../lib/classifyHandoverBranch';
import { PROCESS_META } from '../lib/roleHome';
import FurOutgoingHandoverPage from '../pages/process/FurOutgoingHandoverPage';
import StpOutgoingHandoverPage from '../pages/process/StpOutgoingHandoverPage';
import DrwOutgoingHandoverPage from '../pages/process/DrwOutgoingHandoverPage';
import TmOutgoingHandoverPage from '../pages/process/TmOutgoingHandoverPage';

function resolveMachineAndProcess(searchParams) {
  const machine = searchParams.get('machine') || searchParams.get('machineCode') || '';
  const process = searchParams.get('process') || searchParams.get('processCode') || '';
  if (machine && process) return { machineCode: machine, processCode: process };

  if (process) {
    const meta = PROCESS_META.find((p) => p.id === process.toUpperCase());
    return {
      machineCode: machine || meta?.machineCode || process,
      processCode: process.toUpperCase(),
    };
  }

  if (machine) {
    const meta = PROCESS_META.find(
      (p) => p.machineCode === machine || p.id === machine.toUpperCase()
    );
    return {
      machineCode: machine,
      processCode: meta?.id || machine,
    };
  }

  return { machineCode: 'A-59', processCode: 'TM' };
}

/**
 * Mounts the process-shaped outgoing handover page from ?machine=&process=
 */
export function ScopeHandoverRoute() {
  const [searchParams] = useSearchParams();
  const { machineCode, processCode } = useMemo(
    () => resolveMachineAndProcess(searchParams),
    [searchParams]
  );
  const branch = classifyHandoverBranch(machineCode, processCode);
  const cancelPath = PROCESS_META.find((p) => p.id === processCode)?.path ?? '/tm';

  if (branch === 'fur') {
    return <FurOutgoingHandoverPage machineCode={machineCode} cancelPath={cancelPath} />;
  }
  if (branch === 'stp') {
    return <StpOutgoingHandoverPage machineCode={machineCode} cancelPath={cancelPath} />;
  }
  if (branch === 'drw' || branch === 'swg') {
    return <DrwOutgoingHandoverPage machineCode={machineCode} cancelPath={cancelPath} />;
  }
  return <TmOutgoingHandoverPage machineCode={machineCode} cancelPath={cancelPath} />;
}

export default ScopeHandoverRoute;
