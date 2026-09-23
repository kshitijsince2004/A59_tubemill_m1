import { useEffect, useMemo, useState } from 'react';
import { ZButton, ZInput, ZSelect } from '../../ui';
import {
  emptyGasParams,
  gasParamDefsFor,
  normalizeGasParams,
  validateGasPlantReading,
} from '../../../../shared/src/furnaceGasPlant';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

/**
 * Hourly N2-PSA / EXO gas plant matrix (Excel Gas Plant Params).
 * Persists quality columns + gas_params jsonb via onSubmit.
 */
export default function FurnaceGasMatrix({
  defaultGasType = 'N2-PSA',
  disabled,
  onSubmit,
  recentLogs = [],
}) {
  const [gasType, setGasType] = useState(defaultGasType === 'EXO' ? 'EXO' : 'N2-PSA');
  const [dewPoint, setDewPoint] = useState('');
  const [h2, setH2] = useState('');
  const [o2, setO2] = useState('');
  const [changeoverNote, setChangeoverNote] = useState('');
  const [params, setParams] = useState(() => emptyGasParams(defaultGasType));
  const [warn, setWarn] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = defaultGasType === 'EXO' ? 'EXO' : 'N2-PSA';
    setGasType(t);
    setParams(emptyGasParams(t));
  }, [defaultGasType]);

  const defs = useMemo(() => gasParamDefsFor(gasType), [gasType]);

  function setParam(key, value) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  async function submit() {
    setWarn('');
    setMsg('');
    const gasParams = normalizeGasParams(gasType, params);
    const issues = validateGasPlantReading({
      gasType,
      dewPointC: dewPoint || null,
      h2Pct: h2 || null,
      o2Ppm: o2 || null,
      gasParams,
    });
    if (issues.length) {
      setWarn(issues.map((i) => i.message).join('; '));
    }
    setBusy(true);
    try {
      await onSubmit?.({
        gasType,
        dewPointC: dewPoint ? Number(dewPoint) : undefined,
        h2Pct: h2 ? Number(h2) : undefined,
        o2Ppm: o2 ? Number(o2) : undefined,
        gasParams: {
          ...gasParams,
          changeoverNote: changeoverNote || undefined,
        },
        remarks: changeoverNote || undefined,
        changeoverTime:
          gasType === 'N2-PSA' && changeoverNote
            ? new Date().toISOString()
            : undefined,
      });
      setMsg('Gas log added');
      setDewPoint('');
      setH2('');
      setO2('');
      setChangeoverNote('');
      setParams(emptyGasParams(gasType));
    } catch (e) {
      setWarn(e instanceof Error ? e.message : 'Gas log failed');
    } finally {
      setBusy(false);
    }
  }

  return /*#__PURE__*/ _jsxs('div', {
    className: 'furnace-gas-matrix',
    children: [
      /*#__PURE__*/ _jsx('h2', { children: 'Gas plant log (hourly)' }),
      /*#__PURE__*/ _jsx('p', {
        className: 'muted',
        children:
          gasType === 'EXO'
            ? 'EXO plant params — Excel Gas Plant Params (RHF-03)'
            : 'N2 PSA plant params — Excel Gas Plant Params (RHF-04/05)',
      }),
      (warn || msg) &&
        /*#__PURE__*/ _jsx('div', {
          className: warn ? 'banner banner--warn' : 'banner',
          children: warn || msg,
        }),
      /*#__PURE__*/ _jsxs('div', {
        className: 'form-grid',
        children: [
          /*#__PURE__*/ _jsxs('label', {
            children: [
              'Atmosphere',
              /*#__PURE__*/ _jsxs(ZSelect, {
                value: gasType,
                disabled,
                onChange: (e) => {
                  const t = e.target.value;
                  setGasType(t);
                  setParams(emptyGasParams(t));
                },
                children: [
                  /*#__PURE__*/ _jsx('option', { value: 'N2-PSA', children: 'N2-PSA' }),
                  /*#__PURE__*/ _jsx('option', { value: 'EXO', children: 'EXO' }),
                ],
              }),
            ],
          }),
          /*#__PURE__*/ _jsxs('label', {
            children: [
              'Dew point °C',
              /*#__PURE__*/ _jsx(ZInput, {
                value: dewPoint,
                disabled,
                onChange: (e) => setDewPoint(e.target.value),
                inputMode: 'decimal',
              }),
            ],
          }),
          /*#__PURE__*/ _jsxs('label', {
            children: [
              'H2 %',
              /*#__PURE__*/ _jsx(ZInput, {
                value: h2,
                disabled,
                onChange: (e) => setH2(e.target.value),
                inputMode: 'decimal',
              }),
            ],
          }),
          /*#__PURE__*/ _jsxs('label', {
            children: [
              'O2 ppm',
              /*#__PURE__*/ _jsx(ZInput, {
                value: o2,
                disabled,
                onChange: (e) => setO2(e.target.value),
                inputMode: 'decimal',
              }),
            ],
          }),
          gasType === 'N2-PSA'
            ? /*#__PURE__*/ _jsxs('label', {
                className: 'span-2',
                children: [
                  'Dryer / tower change-over note',
                  /*#__PURE__*/ _jsx(ZInput, {
                    value: changeoverNote,
                    disabled,
                    onChange: (e) => setChangeoverNote(e.target.value),
                  }),
                ],
              })
            : null,
        ],
      }),
      /*#__PURE__*/ _jsx('h3', {
        className: 'furnace-gas-matrix__sub',
        children: 'Plant parameters',
      }),
      /*#__PURE__*/ _jsx('div', {
        className: 'form-grid furnace-gas-matrix__grid',
        children: defs.map((d) =>
          /*#__PURE__*/ _jsxs(
            'label',
            {
              children: [
                `${d.label} (${d.unit})`,
                /*#__PURE__*/ _jsx(ZInput, {
                  value: params[d.key] ?? '',
                  disabled,
                  placeholder: `${d.min}–${d.max}`,
                  inputMode: 'decimal',
                  onChange: (e) => setParam(d.key, e.target.value),
                }),
              ],
            },
            d.key
          )
        ),
      }),
      /*#__PURE__*/ _jsx(ZButton, {
        variant: 'primary',
        disabled: disabled || busy,
        onClick: () => void submit(),
        children: busy ? 'Saving…' : 'Add gas log row',
      }),
      /*#__PURE__*/ _jsx('ul', {
        className: 'child-list',
        children: recentLogs.map((g) =>
          /*#__PURE__*/ _jsxs(
            'li',
            {
              children: [
                String(g.gasType ?? '—'),
                ' · dew ',
                String(g.dewPointC ?? '—'),
                ' · H2 ',
                String(g.h2Pct ?? '—'),
                ' · O2 ',
                String(g.o2Ppm ?? '—'),
                g.gasParams && Object.keys(g.gasParams).length
                  ? ` · ${Object.keys(g.gasParams).filter((k) => k !== 'changeoverNote').length} params`
                  : '',
              ],
            },
            String(g.id)
          )
        ),
      }),
    ],
  });
}
