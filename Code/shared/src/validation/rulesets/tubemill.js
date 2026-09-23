import { required, range, toleranceVsSpec, oneOf } from '../rules';


export const tubeMillRules = [
{
  field: 'workOrderNo',
  label: 'Work Order',
  rules: [required('workOrderNo', 'Work Order')]
},
{
  field: 'coolantConcPct',
  label: 'Coolant conc',
  rules: [range('coolantConcPct', 2, 15, 'Coolant conc', 'WARN')]
},
{
  field: 'powerKwObs',
  label: 'Power kW',
  rules: [toleranceVsSpec('powerKwObs', 'powerKwSpec', 5, 'Power')]
},
{
  field: 'firstOffResult',
  label: 'First-off',
  rules: [oneOf('firstOffResult', ['PASS', 'FAIL', 'PENDING', ''], 'First-off')]
}];