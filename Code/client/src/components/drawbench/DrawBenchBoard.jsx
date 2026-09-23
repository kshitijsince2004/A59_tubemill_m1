import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { drawBenchApi } from '../../api/processApi';
import { ErpWoSelect } from '../ErpWoSelect';
import { ZButton, ZFilterPills, ZPageHeader } from '../../ui';
import DrawBenchCard from './DrawBenchCard';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'RUNNING', label: 'Running' },
  { id: 'PREPARING', label: 'Preparing' },
  { id: 'STOPPAGE', label: 'Stoppage' },
  { id: 'COMPLETE', label: 'Complete' },
  { id: 'IDLE', label: 'Idle' },
];

export default function DrawBenchBoard({ onOpenBench, onAssigned }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('ALL');
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignWo, setAssignWo] = useState('');
  const [assignErr, setAssignErr] = useState('');
  const [assigning, setAssigning] = useState(false);

  const { data: rows = [], isFetching, refetch, error } = useQuery({
    queryKey: ['drw-board'],
    queryFn: () => drawBenchApi.board(),
    refetchInterval: 30_000,
  });

  const counts = useMemo(() => {
    const c = { ALL: rows.length };
    for (const r of rows) {
      const s = String(r.status ?? 'IDLE');
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((r) => String(r.status) === filter);
  }, [rows, filter]);

  const pills = FILTERS.map((p) => ({
    ...p,
    count: p.id === 'ALL' ? counts.ALL : counts[p.id] ?? 0,
  }));

  async function confirmAssign() {
    if (!assignTarget || !assignWo) return;
    setAssigning(true);
    setAssignErr('');
    try {
      const lot = await drawBenchApi.assign(assignTarget.benchCode, {
        workOrderNo: assignWo,
      });
      setAssignTarget(null);
      setAssignWo('');
      await qc.invalidateQueries({ queryKey: ['drw-board'] });
      await qc.invalidateQueries({ queryKey: ['drw-lots'] });
      onAssigned?.(lot, assignTarget.benchCode);
    } catch (e) {
      setAssignErr(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="db-board">
      <ZPageHeader
        title="Draw Bench board"
        subtitle="Select a bench or assign a released work order"
        actions={
          <ZButton variant="ghost" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </ZButton>
        }
      />

      <ZFilterPills pills={pills} value={filter} onChange={setFilter} />

      {error ? (
        <p className="banner banner--error">{error instanceof Error ? error.message : 'Board load failed'}</p>
      ) : null}

      <div className="db-board__grid">
        {filtered.map((row) => (
          <DrawBenchCard
            key={row.benchCode}
            row={row}
            assigning={assigning && assignTarget?.benchCode === row.benchCode}
            onOpen={(r) => onOpenBench?.(r)}
            onAssign={(r) => {
              setAssignTarget(r);
              setAssignWo('');
              setAssignErr('');
            }}
          />
        ))}
      </div>

      {!filtered.length ? <p className="empty-hint">No draw benches match this filter.</p> : null}

      {assignTarget ? (
        <div className="furnace-assign-dialog" role="dialog" aria-label={`Assign order to ${assignTarget.benchCode}`}>
          <div className="furnace-assign-dialog__panel">
            <h3>{`Assign order → ${assignTarget.benchCode}`}</h3>
            <p className="muted">Creates a DRAFT production lot on this bench from a released ERP work order.</p>
            <label>
              Work order
              <ErpWoSelect value={assignWo} onChange={(wo) => setAssignWo(wo)} />
            </label>
            {assignErr ? <p className="banner banner--error">{assignErr}</p> : null}
            <div className="btn-row">
              <ZButton variant="ghost" disabled={assigning} onClick={() => setAssignTarget(null)}>
                Cancel
              </ZButton>
              <ZButton variant="primary" disabled={assigning || !assignWo} onClick={() => void confirmAssign()}>
                {assigning ? 'Assigning…' : 'Assign & open'}
              </ZButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
