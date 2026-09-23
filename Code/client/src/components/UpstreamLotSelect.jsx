import { useQuery } from '@tanstack/react-query';
import { genealogyApi } from '../api/plantApi';
import { ZSelect } from '../ui';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";









export function UpstreamLotSelect({ process, workOrderNo, value, onChange, disabled }) {
  const { data: lots = [], isLoading } = useQuery({
    queryKey: ['genealogy-upstream', process, workOrderNo ?? ''],
    queryFn: () => genealogyApi.upstream(process, workOrderNo),
    staleTime: 30_000
  });

  return (/*#__PURE__*/
    _jsxs(ZSelect, {
      value: value ?? '',
      disabled: disabled || isLoading,
      onChange: (e) => {
        const id = e.target.value;
        onChange(lots.find((l) => l.id === id) ?? null);
      }, children: [/*#__PURE__*/

      _jsx("option", { value: "", children: isLoading ? 'Loading upstream…' : 'Upstream lot (optional)…' }),
      lots.map((l) => /*#__PURE__*/
      _jsxs("option", { value: l.id, children: [
        l.lotTag,
        l.coilTag ? ` · coil ${l.coilTag}` : '',
        l.workOrderNo ? ` · ${l.workOrderNo}` : '',
        l.currentProcess ? ` · from ${l.currentProcess}` : ''] }, l.id
      )
      )] }
    ));

}