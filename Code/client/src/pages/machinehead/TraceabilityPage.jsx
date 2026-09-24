import PlantOrderTracking from '../planthead/PlantOrderTracking';

/** Machine Head Traceability entry — shared desk UI under MH shell. */
export default function TraceabilityPage(props) {
  return <PlantOrderTracking {...props} shell="machineHead" />;
}
