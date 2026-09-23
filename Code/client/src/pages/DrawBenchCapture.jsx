import { useState } from 'react';
import { getStoredUser, primaryRole } from '../lib/authStore';
import ProcessStationShell from '../components/process/ProcessStationShell';
import DrawBenchWorkOrderHub from '../components/drawbench/DrawBenchWorkOrderHub';
import DrawBenchBoard from '../components/drawbench/DrawBenchBoard';
import DrawBenchConsole from '../components/drawbench/DrawBenchConsole';
import DrawBenchHistory from '../components/drawbench/DrawBenchHistory';

const DRW_NAV = [
  { id: 'orders', icon: '▣', label: 'Work Order' },
  { id: 'capture', icon: '◎', label: 'Capture' },
  { id: 'history', icon: '▤', label: 'History' },
];

export default function DrawBenchCapture({
  processes,
  processId,
  onProcessChange,
  onLogout,
  showAdmin,
  onAdmin,
  roleLabel,
}) {
  const role = primaryRole(getStoredUser());
  const canMachineHead = role === 'MACHINE_HEAD' || role === 'ADMIN';
  const isWritable = role !== 'PLANT_HEAD';

  const [nav, setNav] = useState('orders');
  const [selectedId, setSelectedId] = useState(null);
  const [consoleMode, setConsoleMode] = useState(false);
  const [focusBench, setFocusBench] = useState('');

  function openLot(lot, benchCode) {
    if (lot?.id) setSelectedId(lot.id);
    if (benchCode) setFocusBench(benchCode);
    else if (lot?.benchCode) setFocusBench(lot.benchCode);
    setConsoleMode(true);
    setNav('capture');
  }

  function openBench(row) {
    setFocusBench(row.benchCode);
    if (row.lotId) {
      setSelectedId(row.lotId);
      setConsoleMode(true);
    } else {
      setSelectedId(null);
      setConsoleMode(true);
    }
  }

  return (
    <ProcessStationShell
      processId={processId ?? 'DRW'}
      processLabel="Draw Bench"
      machineCode={focusBench || 'DRW'}
      processes={processes}
      onProcessChange={onProcessChange}
      onLogout={onLogout}
      showAdmin={showAdmin}
      onAdmin={onAdmin}
      roleLabel={roleLabel}
      nav={nav}
      onNavChange={(id) => {
        setNav(id);
        if (id === 'capture' && !consoleMode) {
          /* board landing */
        }
        if (id === 'orders') {
          setConsoleMode(false);
        }
      }}
      navItems={DRW_NAV}
      millStatus={selectedId ? 'RUNNING' : 'IDLE'}
      activeOrderId={selectedId}
      captureTitle={consoleMode ? 'Production console' : 'Draw Bench Capture'}
      ordersContent={
        <DrawBenchWorkOrderHub isWritable={isWritable} onMoveToProduction={(lot, bench) => openLot(lot, bench)} />
      }
      historyContent={
        <DrawBenchHistory
          onOpenLot={(lot) => {
            openLot(lot, lot.benchCode);
          }}
        />
      }
    >
      {consoleMode ? (
        <DrawBenchConsole
          selectedId={selectedId}
          onSelectedId={setSelectedId}
          isWritable={isWritable}
          canMachineHead={canMachineHead}
          initialBenchCode={focusBench}
          onBackToBoard={() => {
            setConsoleMode(false);
            setSelectedId(null);
          }}
        />
      ) : (
        <DrawBenchBoard
          onOpenBench={openBench}
          onAssigned={(lot, bench) => openLot(lot, bench)}
        />
      )}
    </ProcessStationShell>
  );
}
