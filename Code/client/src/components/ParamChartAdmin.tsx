import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZButton, ZInput } from '../ui';
import { tubemillApi } from '../api/tubemillClient';

export default function ParamChartAdmin() {
  const qc = useQueryClient();
  const chart = useQuery({ queryKey: ['param-chart'], queryFn: () => tubemillApi.getParamChart() });
  const mut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => tubemillApi.patchParamChart(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['param-chart'] }),
  });

  return (
    <section className="panel">
      <header className="panel__header">
        <span className="eyebrow">TM-02 Param chart</span>
      </header>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Size</th>
              <th>Thk</th>
              <th>Grade</th>
              <th>Power min/max</th>
              <th>Speed min/max</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(chart.data ?? []).map((row) => (
              <tr key={String(row.id)}>
                <td className="mono">{String(row.size_key)}</td>
                <td className="mono">{String(row.thk_mm)}</td>
                <td>{String(row.grade_code)}</td>
                <td>
                  <div className="inline-fields">
                    <ZInput
                      defaultValue={String(row.power_kw_min ?? '')}
                      id={`pmin-${row.id}`}
                      type="number"
                      style={{ width: 72 }}
                    />
                    <ZInput
                      defaultValue={String(row.power_kw_max ?? '')}
                      id={`pmax-${row.id}`}
                      type="number"
                      style={{ width: 72 }}
                    />
                  </div>
                </td>
                <td>
                  <div className="inline-fields">
                    <ZInput
                      defaultValue={String(row.speed_min_mpm ?? '')}
                      id={`smin-${row.id}`}
                      type="number"
                      style={{ width: 72 }}
                    />
                    <ZInput
                      defaultValue={String(row.speed_max_mpm ?? '')}
                      id={`smax-${row.id}`}
                      type="number"
                      style={{ width: 72 }}
                    />
                  </div>
                </td>
                <td>
                  <ZButton
                    variant="primary"
                    disabled={mut.isPending}
                    onClick={() => {
                      const id = String(row.id);
                      mut.mutate({
                        id,
                        body: {
                          power_kw_min: Number((document.getElementById(`pmin-${id}`) as HTMLInputElement)?.value),
                          power_kw_max: Number((document.getElementById(`pmax-${id}`) as HTMLInputElement)?.value),
                          speed_min_mpm: Number((document.getElementById(`smin-${id}`) as HTMLInputElement)?.value),
                          speed_max_mpm: Number((document.getElementById(`smax-${id}`) as HTMLInputElement)?.value),
                        },
                      });
                    }}
                  >
                    Save
                  </ZButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
