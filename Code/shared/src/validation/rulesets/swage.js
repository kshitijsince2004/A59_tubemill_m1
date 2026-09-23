import { required, range } from '../rules';


export const swageRules = [
{
  field: 'lotNo',
  label: 'Lot no',
  rules: [required('lotNo', 'Lot no')]
},
{
  field: 'pieces',
  label: 'Pieces',
  rules: [range('pieces', 1, 100000, 'Pieces')]
}];