import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/http';
import { genealogyApi } from '../api/plantApi';
import { UpstreamLotSelect } from '../components/UpstreamLotSelect';
import { ProcessStoppagePanel } from '../components/ProcessStoppagePanel';
import { ErpWoSelect } from '../components/ErpWoSelect';
import { validateProcessForm } from '../lib/validateForm';
import { ZButton, ZInput, ZSelect, ZBadge, statusTone } from '../ui';
import { getStoredUser, primaryRole } from '../lib/authStore';
import ProcessStationShell from '../components/process/ProcessStationShell';import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";




const swageApi = {
  list: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/swage/lots${qs ? `?${qs}` : ''}`);
  },
  get: (id) => apiRequest(`/swage/lots/${id}`),
  create: (body) =>
  apiRequest('/swage/lots', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
  apiRequest(`/swage/lots/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  submit: (id) => apiRequest(`/swage/lots/${id}/submit`, { method: 'POST' }),
  approve: (id) => apiRequest(`/swage/lots/${id}/approve`, { method: 'POST' }),
  machines: () => apiRequest('/swage/machines')
};

const emptyForm = () => ({
  lotNo: `SWG-${Date.now().toString(36).toUpperCase()}`,
  workOrderNo: '',
  customerCode: 'TATA',
  gradeCode: '1010',
  swgMachine: 'SWG-01',
  swgDie: '',
  pieces: '',
  remarks: '',
  materialLotId: ''
});

export default function SwageCapture({
  processes,
  processId,
  onProcessChange,
  onLogout,
  showAdmin,
  onAdmin,
  roleLabel
}) {
  const qc = useQueryClient();
  const user = getStoredUser();
  const role = primaryRole(user);
  const canWrite = role !== 'PLANT_HEAD';
  const canApprove = role === 'MACHINE_HEAD' || role === 'ADMIN';
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const { data: lots = [] } = useQuery({
    queryKey: ['swage-lots'],
    queryFn: () => swageApi.list()
  });
  const { data: machines = [] } = useQuery({
    queryKey: ['swage-machines'],
    queryFn: () => swageApi.machines()
  });

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const body = useMemo(
    () => ({
      lotNo: form.lotNo,
      workOrderNo: form.workOrderNo || undefined,
      customerCode: form.customerCode || undefined,
      gradeCode: form.gradeCode || undefined,
      swgMachine: form.swgMachine || undefined,
      swgDie: form.swgDie || undefined,
      pieces: form.pieces ? Number(form.pieces) : undefined,
      remarks: form.remarks || undefined,
      materialLotId: form.materialLotId || undefined
    }),
    [form]
  );

  async function save() {
    setError(null);
    const v = validateProcessForm('SWG', body);
    setFieldErrors(Object.fromEntries(v.errors.map((e) => [e.field, e.message])));
    if (!v.ok) {
      setError(v.errors.map((e) => e.message).join('; '));
      return;
    }
    try {
      if (selectedId) {
        await swageApi.update(selectedId, body);
        setMsg('Updated');
      } else {
        const created = await swageApi.create(body);
        setSelectedId(String(created.id));
        if (form.materialLotId) {
          await genealogyApi.attach({
            materialLotId: form.materialLotId,
            toProcess: 'SWG',
            toRecordId: String(created.id)
          });
        }
        setMsg('Created');
      }
      void qc.invalidateQueries({ queryKey: ['swage-lots'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  return (/*#__PURE__*/
    _jsx(ProcessStationShell, {
      processId: processId,
      processLabel: "Swaging",
      machineCode: "SWG-01",
      processes: processes,
      onProcessChange: onProcessChange,
      onLogout: onLogout,
      showAdmin: showAdmin,
      onAdmin: onAdmin,
      roleLabel: roleLabel ?? role,
      millStatus: selectedId ? 'CAPTURE' : 'IDLE',
      activeOrderId: form.workOrderNo || form.lotNo || null,
      jobActive: !!selectedId, children: /*#__PURE__*/

      _jsxs("div", { className: "process-capture process-capture--embedded", children: [/*#__PURE__*/
        _jsxs("header", { className: "process-capture__header", children: [/*#__PURE__*/
          _jsx("h1", { children: "Swaging" }),
          msg && /*#__PURE__*/_jsx(ZBadge, { tone: "success", children: msg }),
          error && /*#__PURE__*/_jsx(ZBadge, { tone: "danger", children: error })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "process-capture__layout", children: [/*#__PURE__*/
          _jsxs("aside", { className: "process-capture__list", children: [/*#__PURE__*/
            _jsx("h2", { children: "Lots" }), /*#__PURE__*/
            _jsx("ul", { children:
              lots.map((l) => /*#__PURE__*/
              _jsx("li", { children: /*#__PURE__*/
                _jsxs("button", {
                  type: "button",
                  onClick: () => {
                    setSelectedId(String(l.id));
                    setForm({
                      lotNo: String(l.lotNo ?? ''),
                      workOrderNo: String(l.workOrderNo ?? ''),
                      customerCode: String(l.customerCode ?? ''),
                      gradeCode: String(l.gradeCode ?? ''),
                      swgMachine: String(l.swgMachine ?? 'SWG-01'),
                      swgDie: String(l.swgDie ?? ''),
                      pieces: l.pieces != null ? String(l.pieces) : '',
                      remarks: String(l.remarks ?? ''),
                      materialLotId: String(l.materialLotId ?? '')
                    });
                  }, children: [

                  String(l.lotNo), " \xB7 ", /*#__PURE__*/_jsx(ZBadge, { tone: statusTone(String(l.status)), children: String(l.status) })] }
                ) }, String(l.id)
              )
              ) }
            ), /*#__PURE__*/
            _jsx(ZButton, {
              variant: "ghost",
              onClick: () => {
                setSelectedId(null);
                setForm(emptyForm());
              }, children:
              "New lot" }

            )] }
          ), /*#__PURE__*/
          _jsxs("section", { className: "process-capture__form", children: [/*#__PURE__*/
            _jsx("h2", { children: "Header" }), /*#__PURE__*/
            _jsxs("div", { className: "form-grid", children: [/*#__PURE__*/
              _jsxs("label", { children: ["Lot no", /*#__PURE__*/

                _jsx(ZInput, { value: form.lotNo, onChange: (e) => setField('lotNo', e.target.value), disabled: !!selectedId }),
                fieldErrors.lotNo && /*#__PURE__*/_jsx("span", { className: "field-error", children: fieldErrors.lotNo })] }
              ), /*#__PURE__*/
              _jsxs("label", { children: ["WO", /*#__PURE__*/

                _jsx(ErpWoSelect, {
                  value: form.workOrderNo,
                  onChange: (wo, order) => {
                    setField('workOrderNo', wo);
                    if (order?.customerCode) setField('customerCode', order.customerCode);
                    if (order?.gradeCode) setField('gradeCode', order.gradeCode);
                  } }
                )] }
              ), /*#__PURE__*/
              _jsxs("label", { children: ["Upstream", /*#__PURE__*/

                _jsx(UpstreamLotSelect, {
                  process: "SWG",
                  workOrderNo: form.workOrderNo,
                  value: form.materialLotId,
                  onChange: (lot) => {
                    setField('materialLotId', lot?.id ?? '');
                    if (lot?.workOrderNo) setField('workOrderNo', lot.workOrderNo);
                    if (lot?.customerCode) setField('customerCode', lot.customerCode);
                    if (lot?.gradeCode) setField('gradeCode', lot.gradeCode);
                  } }
                )] }
              ), /*#__PURE__*/
              _jsxs("label", { children: ["Machine", /*#__PURE__*/

                _jsx(ZSelect, { value: form.swgMachine, onChange: (e) => setField('swgMachine', e.target.value), children:
                  (machines.length ? machines : [{ machine_code: 'SWG-01', label: 'SWG-01' }]).map((m) => /*#__PURE__*/
                  _jsx("option", { value: m.machine_code, children:
                    m.label || m.machine_code }, m.machine_code
                  )
                  ) }
                )] }
              ), /*#__PURE__*/
              _jsxs("label", { children: ["Die", /*#__PURE__*/

                _jsx(ZInput, { value: form.swgDie, onChange: (e) => setField('swgDie', e.target.value) })] }
              ), /*#__PURE__*/
              _jsxs("label", { children: ["Pieces", /*#__PURE__*/

                _jsx(ZInput, { value: form.pieces, onChange: (e) => setField('pieces', e.target.value) }),
                fieldErrors.pieces && /*#__PURE__*/_jsx("span", { className: "field-error", children: fieldErrors.pieces })] }
              )] }
            ), /*#__PURE__*/
            _jsxs("div", { className: "btn-row", children: [/*#__PURE__*/
              _jsx(ZButton, { variant: "primary", disabled: !canWrite, onClick: () => void save(), children: "Save" }

              ),
              selectedId && /*#__PURE__*/
              _jsxs(_Fragment, { children: [/*#__PURE__*/
                _jsx(ZButton, {
                  disabled: !canWrite,
                  onClick: () =>
                  void swageApi.submit(selectedId).then(() => {
                    setMsg('Submitted');
                    void qc.invalidateQueries({ queryKey: ['swage-lots'] });
                  }), children:

                  "Submit" }

                ), /*#__PURE__*/
                _jsx(ZButton, {
                  disabled: !canApprove,
                  onClick: () =>
                  void swageApi.approve(selectedId).then(() => {
                    setMsg('Approved');
                    void qc.invalidateQueries({ queryKey: ['swage-lots'] });
                  }), children:

                  "Approve" }

                )] }
              )] }

            ), /*#__PURE__*/
            _jsx(ProcessStoppagePanel, { processCode: "SWG", sourceId: selectedId, disabled: !canWrite })] }
          )] }
        )] }
      ) }
    ));

}