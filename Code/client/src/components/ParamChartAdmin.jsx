import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZButton, ZInput } from '../ui';
import { tubemillApi } from '../api/tubemillClient';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

export default function ParamChartAdmin() {
  const qc = useQueryClient();
  const chart = useQuery({ queryKey: ['param-chart'], queryFn: () => tubemillApi.getParamChart() });
  const mut = useMutation({
    mutationFn: ({ id, body }) => tubemillApi.patchParamChart(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['param-chart'] })
  });

  return (/*#__PURE__*/
    _jsxs("section", { className: "panel", children: [/*#__PURE__*/
      _jsx("header", { className: "panel__header", children: /*#__PURE__*/
        _jsx("span", { className: "eyebrow", children: "TM-02 Param chart" }) }
      ), /*#__PURE__*/
      _jsx("div", { className: "table-scroll", children: /*#__PURE__*/
        _jsxs("table", { className: "data-table", children: [/*#__PURE__*/
          _jsx("thead", { children: /*#__PURE__*/
            _jsxs("tr", { children: [/*#__PURE__*/
              _jsx("th", { children: "Size" }), /*#__PURE__*/
              _jsx("th", { children: "Thk" }), /*#__PURE__*/
              _jsx("th", { children: "Grade" }), /*#__PURE__*/
              _jsx("th", { children: "Power min/max" }), /*#__PURE__*/
              _jsx("th", { children: "Speed min/max" }), /*#__PURE__*/
              _jsx("th", {})] }
            ) }
          ), /*#__PURE__*/
          _jsx("tbody", { children:
            (chart.data ?? []).map((row) => /*#__PURE__*/
            _jsxs("tr", { children: [/*#__PURE__*/
              _jsx("td", { className: "mono", children: String(row.size_key) }), /*#__PURE__*/
              _jsx("td", { className: "mono", children: String(row.thk_mm) }), /*#__PURE__*/
              _jsx("td", { children: String(row.grade_code) }), /*#__PURE__*/
              _jsx("td", { children: /*#__PURE__*/
                _jsxs("div", { className: "inline-fields", children: [/*#__PURE__*/
                  _jsx(ZInput, {
                    defaultValue: String(row.power_kw_min ?? ''),
                    id: `pmin-${row.id}`,
                    type: "number",
                    style: { width: 72 } }
                  ), /*#__PURE__*/
                  _jsx(ZInput, {
                    defaultValue: String(row.power_kw_max ?? ''),
                    id: `pmax-${row.id}`,
                    type: "number",
                    style: { width: 72 } }
                  )] }
                ) }
              ), /*#__PURE__*/
              _jsx("td", { children: /*#__PURE__*/
                _jsxs("div", { className: "inline-fields", children: [/*#__PURE__*/
                  _jsx(ZInput, {
                    defaultValue: String(row.speed_min_mpm ?? ''),
                    id: `smin-${row.id}`,
                    type: "number",
                    style: { width: 72 } }
                  ), /*#__PURE__*/
                  _jsx(ZInput, {
                    defaultValue: String(row.speed_max_mpm ?? ''),
                    id: `smax-${row.id}`,
                    type: "number",
                    style: { width: 72 } }
                  )] }
                ) }
              ), /*#__PURE__*/
              _jsx("td", { children: /*#__PURE__*/
                _jsx(ZButton, {
                  variant: "primary",
                  disabled: mut.isPending,
                  onClick: () => {
                    const id = String(row.id);
                    mut.mutate({
                      id,
                      body: {
                        power_kw_min: Number(document.getElementById(`pmin-${id}`)?.value),
                        power_kw_max: Number(document.getElementById(`pmax-${id}`)?.value),
                        speed_min_mpm: Number(document.getElementById(`smin-${id}`)?.value),
                        speed_max_mpm: Number(document.getElementById(`smax-${id}`)?.value)
                      }
                    });
                  }, children:
                  "Save" }

                ) }
              )] }, String(row.id)
            )
            ) }
          )] }
        ) }
      )] }
    ));

}