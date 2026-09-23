import { useQuery } from '@tanstack/react-query';
import { erpApi } from '../api/erpApi';
import { ZSelect } from '../ui';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";







/** WO picker fed by erp.released_order (Released only). */
export function ErpWoSelect({ value, onChange, disabled }) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['erp-orders'],
    queryFn: () => erpApi.orders('Released'),
    staleTime: 60_000
  });

  return (/*#__PURE__*/
    _jsxs(ZSelect, {
      value: value,
      disabled: disabled || isLoading,
      onChange: (e) => {
        const wo = e.target.value;
        const order = orders.find((o) => o.workOrderNo === wo);
        onChange(wo, order);
      }, children: [/*#__PURE__*/

      _jsx("option", { value: "", children: isLoading ? 'Loading WOs…' : 'Select WO…' }),
      value && !orders.some((o) => o.workOrderNo === value) && /*#__PURE__*/
      _jsxs("option", { value: value, children: [value, " (manual)"] }),

      orders.map((o) => /*#__PURE__*/
      _jsxs("option", { value: o.workOrderNo, children: [
        o.workOrderNo,
        o.lotNo ? ` · ${o.lotNo}` : '',
        o.customerCode ? ` · ${o.customerCode}` : ''] }, o.workOrderNo
      )
      )] }
    ));

}