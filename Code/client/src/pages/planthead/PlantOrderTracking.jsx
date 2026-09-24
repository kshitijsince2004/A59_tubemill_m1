import { useEffect, useRef, useState } from 'react';
import { PlantShell } from '../../components/layout/planthead';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { traceabilityApi } from '../../api/traceabilityApi';
import {
  formatHistoryFields,
  formatOrderFields,
  PROCESS_BADGE,
} from '../../lib/traceabilityFormat';
import { ZButton, ZInput } from '../../ui';

function apiUnavailableMessage(e) {
  const msg = e instanceof Error ? e.message : String(e || '');
  const status = e?.status;
  if (
    status === 404 &&
    (msg === 'Not found' || msg === 'Unknown API route' || /unknown api route/i.test(msg))
  ) {
    return 'API not available — restart the server';
  }
  return msg || 'Traceability search failed';
}

/**
 * Shared Traceability desk: Search → Order Information → Machine Journey → Production History.
 * Used at /plant/orders (Plant) and /machine-head/traceability (Machine Head).
 */
export default function PlantOrderTracking({
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
  shell = 'plant',
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowSuggest(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const data = await traceabilityApi.suggest(q);
          setSuggestions(Array.isArray(data) ? data : []);
          setShowSuggest(true);
        } catch (e) {
          setSuggestions([]);
          const msg = apiUnavailableMessage(e);
          if (msg === 'API not available — restart the server') {
            setError(msg);
          }
        }
      })();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function onQueryChange(value) {
    setQuery(value);
    if (result) setResult(null);
    if (searched) setSearched(false);
    if (error) setError(null);
  }

  async function runSearch(raw) {
    const q = String(raw ?? query).trim();
    if (!q) {
      setError('Enter a work order number, customer name, or coil');
      return;
    }
    setLoading(true);
    setError(null);
    setShowSuggest(false);
    setSearched(true);
    try {
      const data = await traceabilityApi.search(q);
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(apiUnavailableMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function pickSuggestion(item) {
    const text = item?.text ?? item;
    setQuery(String(text));
    setShowSuggest(false);
    void runSearch(text);
  }

  const title = shell === 'machineHead' ? 'Order Tracing' : 'Traceability';
  const subtitle = 'Search by work order number, customer name, or coil';

  const typeLabel = (type) => {
    if (type === 'coil') return 'coil';
    if (type === 'customer') return 'customer';
    if (type === 'wo' || type === 'batch') return 'wo';
    return type || 'match';
  };

  const body = (
    <div className={`trace-console ${shell === 'machineHead' ? 'mh-console' : 'ph-console'}`}>
      {error ? <div className="error-strip">{error}</div> : null}

      <section className={shell === 'machineHead' ? 'mh-panel' : 'ph-panel'}>
        <h2 className={shell === 'machineHead' ? 'mh-panel__title' : 'ph-panel__title'}>
          {title}
        </h2>
        <p className="ph-panel__hint">
          Search by work order number, customer name, or coil…
        </p>
        <div className="trace-search" ref={wrapRef}>
          <div className="trace-search__row">
            <ZInput
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void runSearch();
                }
              }}
              onFocus={() => {
                if (suggestions.length) setShowSuggest(true);
              }}
              placeholder="Work order number, customer name, or coil…"
              aria-autocomplete="list"
              aria-expanded={showSuggest}
            />
            <ZButton variant="primary" disabled={loading} onClick={() => void runSearch()}>
              {loading ? 'Searching…' : 'Search'}
            </ZButton>
          </div>
          {showSuggest && suggestions.length > 0 ? (
            <ul className="trace-suggest" role="listbox">
              {suggestions.map((s) => (
                <li key={`${s.type}-${s.text}`}>
                  <button type="button" onClick={() => pickSuggestion(s)}>
                    <span className="mono">{s.label || s.text}</span>
                    <span className={`trace-suggest__type trace-suggest__type--${typeLabel(s.type)}`}>
                      {typeLabel(s.type)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {loading ? <p className="ph-empty">Loading trace…</p> : null}

      {!loading && searched && !result && !error ? (
        <p className="ph-empty">No results for this query.</p>
      ) : null}

      {!loading && result ? (
        <>
          <section className={shell === 'machineHead' ? 'mh-panel' : 'ph-panel'}>
            <h2 className={shell === 'machineHead' ? 'mh-panel__title' : 'ph-panel__title'}>
              Order Information
            </h2>
            {result.orderInfo ? (
              <dl className="trace-kv">
                {formatOrderFields(result.orderInfo).map((f) => (
                  <div key={f.key} className="trace-kv__row">
                    <dt>{f.label}</dt>
                    <dd className={f.key === 'coilNo' || f.key === 'batchNumber' || f.key === 'sapOrderNo' ? 'mono' : undefined}>
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="ph-empty">No plan / order identity for this query.</p>
            )}
            {result.lineage?.length ? (
              <p className="trace-lineage muted">
                Lineage: {result.lineage.join(' → ')}
              </p>
            ) : null}
          </section>

          <section className={shell === 'machineHead' ? 'mh-panel' : 'ph-panel'}>
            <h2 className={shell === 'machineHead' ? 'mh-panel__title' : 'ph-panel__title'}>
              Machine Journey
            </h2>
            {(result.machineJourney ?? []).length ? (
              <table className={shell === 'machineHead' ? 'mh-table' : 'ph-table'}>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Process</th>
                    <th>Machine</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.machineJourney.map((j) => (
                    <tr key={`step-${j.step}`}>
                      <td>{j.step}</td>
                      <td>{j.process}</td>
                      <td>{j.machine || '—'}</td>
                      <td>{j.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="ph-empty">No journey steps recorded.</p>
            )}
          </section>

          <section className={shell === 'machineHead' ? 'mh-panel' : 'ph-panel'}>
            <h2 className={shell === 'machineHead' ? 'mh-panel__title' : 'ph-panel__title'}>
              Production History
            </h2>
            {(result.history ?? []).length ? (
              <div className="trace-history">
                {result.history.map((h, i) => (
                  <article key={`${h.process}-${h.coilNo}-${i}`} className="trace-history__card">
                    <header className="trace-history__head">
                      <span className="trace-badge">{PROCESS_BADGE[h.process] || h.process}</span>
                      {h.coilNo ? <span className="mono muted">{h.coilNo}</span> : null}
                    </header>
                    <dl className="trace-kv trace-kv--compact">
                      {formatHistoryFields(h.record).map((f) => (
                        <div key={f.key} className="trace-kv__row">
                          <dt>{f.label}</dt>
                          <dd>{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {h.siblings?.length ? (
                      <p className="trace-siblings muted">
                        Charge siblings: {h.siblings.join(', ')}
                      </p>
                    ) : null}
                    {Array.isArray(h.stoppages) ? (
                      <p className="muted">Stoppages: {h.stoppages.length}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="ph-empty">No production history for this coil / order.</p>
            )}
          </section>
        </>
      ) : null}

      {!loading && !searched && !result ? (
        <p className="ph-empty">Enter a work order number or customer name to begin.</p>
      ) : null}
    </div>
  );

  if (shell === 'machineHead') {
    return (
      <MachineHeadShell
        title={title}
        subtitle={subtitle}
        roleLabel={roleLabel}
        showAdmin={showAdmin}
        showPlant={showPlant}
        onLogout={onLogout}
        firstFloorPath={firstFloorPath}
      >
        {body}
      </MachineHeadShell>
    );
  }

  return (
    <PlantShell
      title={title}
      subtitle={subtitle}
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      {body}
    </PlantShell>
  );
}
