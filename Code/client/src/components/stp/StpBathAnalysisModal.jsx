import { useEffect, useState } from 'react';
import FormModal from '../FormModal';
import { ZButton, ZInput } from '../../ui';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

const BATH_GROUPS = [
  {
    title: 'Degreasing',
    fields: [['degreaseTa', 'TA', '78–90']],
  },
  {
    title: 'HCl pickling',
    fields: [
      ['hclPct', 'HCl %', '6–22'],
      ['fePct', 'Fe %', '≤10'],
    ],
  },
  {
    title: 'Activation',
    fields: [['activationPh', 'pH', '7–8']],
  },
  {
    title: 'Phosphating',
    fields: [
      ['phosTa', 'TA', '32–38'],
      ['phosFa', 'FA', '4–6'],
      ['phosAcc', 'ACC', '3–5'],
      ['phosOxta', 'OXTA', '18–22'],
    ],
  },
  {
    title: 'Neutralizer',
    fields: [['neutPh', 'pH', '8–10']],
  },
  {
    title: 'Lubrication',
    fields: [
      ['lubeCon', 'Concentration', '4–6'],
      ['lubeFa', 'FA', '0–1'],
      ['lubePh', 'pH', '8–10'],
    ],
  },
  {
    title: 'Rinse',
    fields: [['rinsePh', 'Rinse pH', '2–10']],
  },
  {
    title: 'Oil bath',
    fields: [['oilWaterAcidNo', 'Acid number', '100–200']],
  },
];

const EMPTY = Object.fromEntries(
  BATH_GROUPS.flatMap((g) => g.fields.map(([k]) => [k, '']))
);

function toBody(fields) {
  const body = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === '' || v == null) continue;
    const n = Number(v);
    body[k] = Number.isFinite(n) ? n : v;
  }
  return body;
}

export default function StpBathAnalysisModal({ open, busy = false, onClose, onSave }) {
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFields(EMPTY);
    setError('');
  }, [open]);

  async function handleSave() {
    setError('');
    try {
      await onSave?.(toBody(fields));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  return /*#__PURE__*/ _jsx(FormModal, {
    open,
    eyebrow: 'Capture',
    title: 'Bath Analysis',
    className: 'stp-bath-modal',
    onClose,
    footer: /*#__PURE__*/ _jsxs('div', {
      className: 'furnace-cons-modal__footer',
      children: [
        /*#__PURE__*/ _jsx(ZButton, { variant: 'ghost', disabled: busy, onClick: onClose, children: 'Cancel' }),
        /*#__PURE__*/ _jsx(ZButton, {
          variant: 'primary',
          disabled: busy,
          onClick: () => void handleSave(),
          children: busy ? 'Saving…' : 'Save Bath Analysis',
        }),
      ],
    }),
    children: /*#__PURE__*/ _jsxs('div', {
      className: 'stp-bath-modal__body',
      children: [
        BATH_GROUPS.map((g) =>
          /*#__PURE__*/ _jsxs(
            'section',
            {
              className: 'stp-bath-modal__group',
              children: [
                /*#__PURE__*/ _jsx('h3', { children: g.title }),
                /*#__PURE__*/ _jsx('div', {
                  className: 'form-grid',
                  children: g.fields.map(([key, label, spec]) =>
                    /*#__PURE__*/ _jsxs(
                      'label',
                      {
                        children: [
                          `${label} (${spec})`,
                          /*#__PURE__*/ _jsx(ZInput, {
                            type: 'number',
                            step: 'any',
                            value: fields[key],
                            onChange: (e) => setFields((f) => ({ ...f, [key]: e.target.value })),
                          }),
                        ],
                      },
                      key
                    )
                  ),
                }),
              ],
            },
            g.title
          )
        ),
        error ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--error', children: error }) : null,
      ],
    }),
  });
}
