
import { ZButton, ZInput, ZBadge, statusTone, ZPageHeader, ZFilterPills, ZOperatorCard } from '../../ui';import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
























function countBy(queue, pred) {
  return queue.filter(pred).length;
}

export default function TubeMillHub({
  machineCode,
  processLabel,
  shiftLabel,
  queue,
  filteredQueue,
  pending,
  inProgress,
  queueFilter,
  onFilterChange,
  queueSearch,
  onSearchChange,
  selectedCard,
  onSelectCard,
  busy,
  isWritable = true,
  onRefresh,
  onOpenRun,
  onResumeRun
}) {
  const counts = {
    ALL: queue.length,
    Pending: countBy(queue, (c) => c.status === 'Pending'),
    'In Progress': countBy(
      queue,
      (c) => c.status === 'In Progress' || c.status !== 'Pending' && c.status !== 'Hold' && c.status !== 'Completed'
    ),
    Hold: countBy(queue, (c) => c.status === 'Hold'),
    Completed: countBy(queue, (c) => c.status === 'Completed')
  };

  const pills = ['ALL', 'Pending', 'In Progress', 'Hold', 'Completed'].map((f) => ({
    id: f,
    label: f === 'ALL' ? 'All' : f,
    count: counts[f]
  }));

  return (/*#__PURE__*/
    _jsxs(_Fragment, { children: [/*#__PURE__*/
      _jsx(ZPageHeader, {
        title: `Machine / ${machineCode} · ${processLabel}`,
        subtitle: `${shiftLabel} · ${queue.length} orders (ops.queue_card · ERP / seed)`,
        actions: /*#__PURE__*/
        _jsx(ZButton, { variant: "ghost", size: "sm", onClick: onRefresh, "aria-label": "Refresh queue", children: "\u21BB" }

        ) }

      ), /*#__PURE__*/

      _jsxs("div", { className: "hub-toolbar", children: [/*#__PURE__*/
        _jsx(ZInput, {
          placeholder: "Search WO / batch / customer\u2026",
          value: queueSearch,
          onChange: (e) => onSearchChange(e.target.value),
          style: { flex: 1, minWidth: '14rem', minHeight: 56 } }
        ), /*#__PURE__*/
        _jsx(ZFilterPills, { pills: pills, value: queueFilter, onChange: (id) => onFilterChange(id) })] }
      ), /*#__PURE__*/

      _jsxs("div", { className: "hub-split", children: [/*#__PURE__*/
        _jsx(ZOperatorCard, { title: `Queue · ${filteredQueue.length} orders`, children: /*#__PURE__*/
          _jsxs("div", { className: "hub-list-scroll", children: [
            (queueFilter === 'ALL' || queueFilter === 'Pending') && pending.length > 0 && /*#__PURE__*/
            _jsxs(_Fragment, { children: [/*#__PURE__*/
              _jsxs("div", { className: "queue-group-header pending", children: ["Pending \xB7 ", pending.length] }),
              pending.map((card) => /*#__PURE__*/
              _jsxs("button", {

                type: "button",
                className: `queue-card ${selectedCard?.id === card.id ? 'selected' : ''}`,
                onClick: () => onSelectCard(card), children: [/*#__PURE__*/

                _jsxs("div", { className: "queue-card__top", children: [/*#__PURE__*/
                  _jsx("strong", { className: "font-mono queue-card__id", title: card.workOrderNo, children:
                    card.workOrderNo }
                  ), /*#__PURE__*/
                  _jsx(ZBadge, { tone: "pending", children: "PENDING" })] }
                ), /*#__PURE__*/
                _jsx("div", { className: "queue-card__customer", children: card.customerCode }), /*#__PURE__*/
                _jsxs("div", { className: "font-mono queue-card__meta", children: [
                  card.sizeKey, " \xB7 ", card.gradeCode, " \xB7 ", card.bcBatchNumber,
                  card.qtyPieces != null ? ` · ${card.qtyPieces} pcs` : ''] }
                )] }, card.id
              )
              )] }
            ),


            (queueFilter === 'ALL' ||
            queueFilter === 'In Progress' ||
            queueFilter === 'Hold' ||
            queueFilter === 'Completed') &&
            inProgress.length > 0 && /*#__PURE__*/
            _jsxs(_Fragment, { children: [/*#__PURE__*/
              _jsxs("div", { className: "queue-group-header", children: ["In Progress / other \xB7 ", inProgress.length] }),
              inProgress.map((card) => /*#__PURE__*/
              _jsxs("button", {

                type: "button",
                className: `queue-card ${selectedCard?.id === card.id ? 'selected' : ''}`,
                disabled: busy,
                onClick: () => {
                  onSelectCard(card);
                  if (card.runId) void onResumeRun(card);
                }, children: [/*#__PURE__*/

                _jsxs("div", { className: "queue-card__top", children: [/*#__PURE__*/
                  _jsx("strong", { className: "font-mono queue-card__id", title: card.workOrderNo, children:
                    card.workOrderNo }
                  ), /*#__PURE__*/
                  _jsx(ZBadge, { tone: statusTone(card.status), children: card.status.toUpperCase() })] }
                ), /*#__PURE__*/
                _jsx("div", { className: "queue-card__customer", children: card.customerCode }), /*#__PURE__*/
                _jsxs("div", { className: "font-mono queue-card__meta", children: [
                  card.sizeKey, " \xB7 ", card.gradeCode, " \xB7 ", card.bcBatchNumber] }
                )] }, card.id
              )
              )] }
            ),


            filteredQueue.length === 0 && /*#__PURE__*/
            _jsx("p", { className: "empty-hint", children: "No orders match this filter." })] }

          ) }
        ), /*#__PURE__*/

        _jsx(ZOperatorCard, { title: "Order Details", className: "detail-pane", children:
          selectedCard ? /*#__PURE__*/
          _jsxs(_Fragment, { children: [/*#__PURE__*/
            _jsx("div", { className: "font-mono detail-pane__wo", title: selectedCard.workOrderNo, children:
              selectedCard.workOrderNo }
            ), /*#__PURE__*/
            _jsxs("div", { className: "meta-grid", children: [/*#__PURE__*/
              _jsxs("div", { className: "meta-grid__item", children: [/*#__PURE__*/
                _jsx("label", { children: "BC Batch" }), /*#__PURE__*/
                _jsx("div", { className: "value font-mono", children: selectedCard.bcBatchNumber })] }
              ), /*#__PURE__*/
              _jsxs("div", { className: "meta-grid__item", children: [/*#__PURE__*/
                _jsx("label", { children: "Size" }), /*#__PURE__*/
                _jsx("div", { className: "value font-mono", children: selectedCard.sizeKey })] }
              ), /*#__PURE__*/
              _jsxs("div", { className: "meta-grid__item", children: [/*#__PURE__*/
                _jsx("label", { children: "Grade" }), /*#__PURE__*/
                _jsx("div", { className: "value font-mono", children: selectedCard.gradeCode })] }
              ), /*#__PURE__*/
              _jsxs("div", { className: "meta-grid__item", children: [/*#__PURE__*/
                _jsx("label", { children: "Customer" }), /*#__PURE__*/
                _jsx("div", { className: "value", children: selectedCard.customerCode })] }
              ), /*#__PURE__*/
              _jsxs("div", { className: "meta-grid__item", children: [/*#__PURE__*/
                _jsx("label", { children: "Qty" }), /*#__PURE__*/
                _jsxs("div", { className: "value font-mono", children: [selectedCard.qtyPieces ?? '—', " pcs"] })] }
              ), /*#__PURE__*/
              _jsxs("div", { className: "meta-grid__item", children: [/*#__PURE__*/
                _jsx("label", { children: "Mill" }), /*#__PURE__*/
                _jsx("div", { className: "value font-mono", children: selectedCard.millCode || machineCode })] }
              ), /*#__PURE__*/
              _jsxs("div", { className: "meta-grid__item", children: [/*#__PURE__*/
                _jsx("label", { children: "Status" }), /*#__PURE__*/
                _jsx("div", { className: "value", children: /*#__PURE__*/
                  _jsx(ZBadge, { tone: statusTone(selectedCard.status), children: selectedCard.status }) }
                )] }
              )] }
            ), /*#__PURE__*/
            _jsxs("div", { className: "detail-pane__footer btn-row", children: [/*#__PURE__*/
              _jsx(ZButton, {
                variant: "primary",
                block: true,
                disabled: selectedCard.status !== 'Pending' || busy || !!selectedCard.runId || !isWritable,
                onClick: onOpenRun, children:
                "Move to Production\u2026" }

              ),
              selectedCard.runId ? /*#__PURE__*/
              _jsx(ZButton, { variant: "ghost", block: true, disabled: busy, onClick: () => onResumeRun(selectedCard), children: "Open Run" }

              ) :
              null] }
            )] }
          ) : /*#__PURE__*/

          _jsx("p", { className: "empty-hint", children: "Select a queue card." }) }

        )] }
      )] }
    ));

}