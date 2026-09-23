import { useQuery } from '@tanstack/react-query';
import { ZBadge, ZButton } from '../ui';
import { tubemillApi } from '../api/tubemillClient';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

export default function LiveStatusPage({ onOpenRun }) {
  const live = useQuery({
    queryKey: ['live-status'],
    queryFn: () => tubemillApi.getLiveStatus(),
    refetchInterval: 5000
  });

  const data = live.data;






  return (/*#__PURE__*/
    _jsxs("div", { className: "live-status", children: [/*#__PURE__*/
      _jsx("header", { className: "page-header", children: /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("div", { className: "eyebrow", children: "A-59" }), /*#__PURE__*/
          _jsx("h1", { children: "Live production status" })] }
        ) }
      ), /*#__PURE__*/
      _jsxs("section", { className: "metric-grid", children: [/*#__PURE__*/
        _jsxs("div", { className: "metric-cell", children: [/*#__PURE__*/
          _jsx("span", { className: "eyebrow", children: "Prime MT today" }), /*#__PURE__*/
          _jsx("strong", { className: "mono", children: data?.shiftSummary?.primeMt?.toFixed(3) ?? '—' })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "metric-cell", children: [/*#__PURE__*/
          _jsx("span", { className: "eyebrow", children: "Scrap MT" }), /*#__PURE__*/
          _jsx("strong", { className: "mono", children: data?.shiftSummary?.scrapMt?.toFixed(3) ?? '—' })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "metric-cell", children: [/*#__PURE__*/
          _jsx("span", { className: "eyebrow", children: "Runs today" }), /*#__PURE__*/
          _jsx("strong", { className: "mono", children: data?.shiftSummary?.runsToday ?? '—' })] }
        )] }
      ), /*#__PURE__*/
      _jsxs("div", { className: "two-up", children: [/*#__PURE__*/
        _jsxs("section", { className: "panel panel--primary-header", children: [/*#__PURE__*/
          _jsxs("header", { className: "panel__header panel__header--primary", children: [/*#__PURE__*/
            _jsx("span", { className: "eyebrow", children: "Current running order" }),
            data?.current && /*#__PURE__*/_jsx(ZBadge, { tone: "running", children: data.current.run_state })] }
          ),
          data?.current ? /*#__PURE__*/
          _jsxs("div", { className: "panel__body", children: [/*#__PURE__*/
            _jsxs("div", { className: "metric-cell", children: [/*#__PURE__*/
              _jsx("span", { className: "eyebrow", children: "Run" }), /*#__PURE__*/
              _jsx("strong", { className: "mono", children: data.current.run_no })] }
            ), /*#__PURE__*/
            _jsxs("div", { className: "metric-cell", children: [/*#__PURE__*/
              _jsx("span", { className: "eyebrow", children: "WO" }), /*#__PURE__*/
              _jsx("strong", { className: "mono", children: data.current.work_order_no ?? '—' })] }
            ),
            data.current.hold_status === 'HELD' && /*#__PURE__*/_jsx(ZBadge, { tone: "pending", children: "HOLD" }), /*#__PURE__*/
            _jsx(ZButton, { variant: "primary", onClick: () => onOpenRun(data.current.id), children: "Open production form" }

            )] }
          ) : /*#__PURE__*/

          _jsx("p", { className: "muted", children: "No draft run \u2014 go to Orders" })] }

        ), /*#__PURE__*/
        _jsxs("section", { className: "panel", children: [/*#__PURE__*/
          _jsxs("header", { className: "panel__header", children: [/*#__PURE__*/
            _jsx("span", { className: "eyebrow", children: "Upcoming queue" }), /*#__PURE__*/
            _jsx(ZBadge, { tone: "idle", children: String(data?.upcoming?.length ?? 0) })] }
          ), /*#__PURE__*/
          _jsx("ul", { className: "panel__list", children:
            (data?.upcoming ?? []).map((u) => /*#__PURE__*/
            _jsxs("li", { className: "mono", children: [
              u.work_order_no, " \xB7 ", u.grade_code, " \xB7 ", u.size_key] }, u.id
            )
            ) }
          )] }
        )] }
      ), /*#__PURE__*/
      _jsxs("section", { className: "panel", children: [/*#__PURE__*/
        _jsx("header", { className: "panel__header", children: /*#__PURE__*/
          _jsx("span", { className: "eyebrow", children: "Stoppage history" }) }
        ), /*#__PURE__*/
        _jsx("ul", { className: "panel__list", children:
          (data?.recentStoppages ?? []).map((s) => /*#__PURE__*/
          _jsxs("li", { children: [/*#__PURE__*/
            _jsx("span", { className: "mono", children: s.stoppage_code ?? 'UNC' }), " \xB7 ", s.reason ?? '—', " \xB7", ' ',
            new Date(s.from_time).toLocaleString()] }, s.id
          )
          ) }
        )] }
      )] }
    ));

}