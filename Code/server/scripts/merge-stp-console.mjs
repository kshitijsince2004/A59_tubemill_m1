import fs from 'fs';

const path = 'c:/dev/A59 Tube Mill M1/Code/client/src/pages/StpCapture.jsx';
let s = fs.readFileSync(path, 'utf8');
const start = s.indexOf('  function renderConsole() {');
const end = s.indexOf('  function renderWorkOrders() {');
if (start < 0 || end < 0) {
  console.error('markers not found', start, end);
  process.exit(1);
}

const merged = `  function renderMergedRun() {
    const stages = Array.isArray(stagesQ.data) ? stagesQ.data : stagesQ.data?.stages ?? [];
    const snap = lineSnapshot;
    const size = snap?.size ?? lot?.size;
    const parts = sizeParts(size);

    const headerActions = lot
      ? /*#__PURE__*/ _jsxs(_Fragment, {
          children: [
            canStart
              ? /*#__PURE__*/ _jsx(ZButton, {
                  variant: 'primary',
                  disabled: busy,
                  onClick: () => void handleStart(),
                  children: 'Start',
                })
              : null,
            canEnd
              ? /*#__PURE__*/ _jsx(ZButton, {
                  variant: 'primary',
                  disabled: busy,
                  onClick: () => void handleEnd(),
                  children: 'End',
                })
              : null,
            canSave
              ? /*#__PURE__*/ _jsx(ZButton, {
                  disabled: busy,
                  onClick: () => void handleSave(),
                  children: 'Save',
                })
              : null,
            isWritable && selectedId && lot?.status === 'DRAFT'
              ? /*#__PURE__*/ _jsx(ZButton, {
                  disabled: busy,
                  onClick: () => void handleSubmit(),
                  children: 'Submit',
                })
              : null,
            /*#__PURE__*/ _jsx(ZButton, {
              variant: 'ghost',
              disabled: !selectedId,
              onClick: () => {
                setCaptureSub('bath');
                setNav('capture');
                setBathOpen(true);
              },
              children: 'Bath',
            }),
            /*#__PURE__*/ _jsx(ZButton, {
              variant: 'ghost',
              disabled: !selectedId,
              onClick: () => {
                setCaptureSub('chem');
                setNav('capture');
                setChemOpen(true);
              },
              children: 'Chem',
            }),
            canSupervise && selectedId && lot?.status === 'SUBMITTED'
              ? /*#__PURE__*/ _jsx(ZButton, {
                  variant: 'primary',
                  disabled: busy,
                  onClick: () => void handleApprove(),
                  children: 'Approve',
                })
              : null,
            canSupervise && selectedId && lot?.status !== 'APPROVED'
              ? /*#__PURE__*/ _jsx(ZButton, {
                  disabled: busy,
                  onClick: () => void handleHold(),
                  children: 'Hold',
                })
              : null,
          ],
        })
      : null;

    const productionBlock = lot
      ? /*#__PURE__*/ _jsxs('div', {
          className: 'stp-run-console__production',
          children: [
            /*#__PURE__*/ _jsxs('section', {
              className: 'stp-console__summary',
              children: [
                /*#__PURE__*/ _jsx('h3', { children: 'Running order (read-only)' }),
                /*#__PURE__*/ _jsxs('div', {
                  className: 'stp-console__grid',
                  children: [
                    /*#__PURE__*/ _jsx(RoField, { label: 'Work order', value: snap?.workOrderNo }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Line', value: snap?.lineNo }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Customer', value: snap?.customerCode }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Grade', value: snap?.gradeCode }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'OD', value: parts.od }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Slit', value: parts.slit }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'TH', value: parts.thk }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Length', value: parts.len }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Qty (NOS)',
                      value: snap?.qtyPieces ?? lot.qtyNo,
                    }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Qty (MT)',
                      value: snap?.plannedQty ?? lot.qtyMt,
                    }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'TDC', value: snap?.tdc }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Coil', value: snap?.coilNo }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Pass', value: snap?.passNo }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Final size',
                      value:
                        typeof snap?.finalSize === 'object'
                          ? fmtSize(snap.finalSize)
                          : snap?.finalSize,
                    }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Shape',
                      value: snap?.tubeShape || parts.profile,
                    }),
                    /*#__PURE__*/ _jsx(RoField, { label: 'Next process', value: snap?.nextProcess }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Started',
                      value: lot.productionStartedAt
                        ? new Date(lot.productionStartedAt).toLocaleString()
                        : null,
                    }),
                    /*#__PURE__*/ _jsx(RoField, {
                      label: 'Ended',
                      value: lot.productionEndedAt
                        ? new Date(lot.productionEndedAt).toLocaleString()
                        : null,
                    }),
                  ],
                }),
              ],
            }),
            /*#__PURE__*/ _jsxs('section', {
              className: 'stp-console__edit',
              children: [
                /*#__PURE__*/ _jsx('h3', { children: 'Production inputs' }),
                /*#__PURE__*/ _jsxs('div', {
                  className: 'form-grid',
                  children: [
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Produced qty (NOS)',
                        /*#__PURE__*/ _jsx(ZInput, {
                          type: 'number',
                          disabled: !isWritable || lot.status === 'APPROVED',
                          value: prodForm.qtyNo,
                          onChange: (e) => setProdForm((f) => ({ ...f, qtyNo: e.target.value })),
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Produced qty (MT)',
                        /*#__PURE__*/ _jsx(ZInput, {
                          type: 'number',
                          step: 'any',
                          disabled: !isWritable || lot.status === 'APPROVED',
                          value: prodForm.qtyMt,
                          onChange: (e) => setProdForm((f) => ({ ...f, qtyMt: e.target.value })),
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Surface finish',
                        /*#__PURE__*/ _jsx(ZInput, {
                          disabled: !isWritable || lot.status === 'APPROVED',
                          value: prodForm.surfaceFinish,
                          onChange: (e) =>
                            setProdForm((f) => ({ ...f, surfaceFinish: e.target.value })),
                        }),
                      ],
                    }),
                    /*#__PURE__*/ _jsxs('label', {
                      children: [
                        'Disposition',
                        /*#__PURE__*/ _jsxs(ZSelect, {
                          disabled: !isWritable || lot.status === 'APPROVED',
                          value: prodForm.disposition,
                          onChange: (e) =>
                            setProdForm((f) => ({ ...f, disposition: e.target.value })),
                          children: [
                            /*#__PURE__*/ _jsx('option', { value: 'ACCEPT', children: 'ACCEPT' }),
                            /*#__PURE__*/ _jsx('option', {
                              value: 'QUARANTINE',
                              children: 'QUARANTINE',
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            msg ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--ok', children: msg }) : null,
            err ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--error', children: err }) : null,
          ],
        })
      : null;

    return /*#__PURE__*/ _jsx(StpProcessMonitor, {
      lot,
      stages,
      displayStatus,
      isWritable,
      busy,
      openStoppage,
      headerActions,
      productionBlock,
      emptyTitle: 'Production console',
      emptyHint: 'Select a work order line and open Production Console, or pick a run from History.',
      onGoOrders: () => {
        setNav('order');
        setOrderSub('work-orders');
      },
      onGoHistory: () => setNav('history'),
      onOpenStoppage: () => setStoppageDialogOpen(true),
      onEndStoppage: () => void handleEndStoppage(),
      onOpenBath: () => {
        setCaptureSub('bath');
        setNav('capture');
        setBathOpen(true);
      },
      onAdvance: handleAdvanceStage,
      onSaveReading: handleMonitorSave,
    });
  }

`;

s = s.slice(0, start) + merged + s.slice(end);

const monStart = s.indexOf('  function renderMonitoring() {');
const monEnd = s.indexOf('  function renderHistory() {');
if (monStart < 0 || monEnd < 0) {
  console.error('monitoring markers not found', monStart, monEnd);
  process.exit(1);
}
s =
  s.slice(0, monStart) +
  `  function renderMonitoring() {
    return renderMergedRun();
  }

` +
  s.slice(monEnd);

s = s.replaceAll('renderConsole()', 'renderMergedRun()');

fs.writeFileSync(path, s);
console.log('merged OK');
