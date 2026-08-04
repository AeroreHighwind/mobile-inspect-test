export interface BootStep {
  label: string;
  value?: string;
}

export const bootSteps: BootStep[] = [
  { label: 'Commencing System Check' },
  { label: 'Memory Unit', value: 'Green' },
  { label: 'Initializing Tactics Log' },
  { label: 'Loading Geographic Data' },
  { label: 'Vitals', value: 'Green' },
  { label: 'Remaining MP', value: '100%' },
  { label: 'Black Box Temperature', value: 'Normal' },
  { label: 'Black Box Internal Pressure', value: 'Normal' },
  { label: 'Activating IFF' },
  { label: 'Activating FCS' },
  { label: 'Initializing Pod Connection' },
  { label: 'Launching DBU Setup' },
  { label: 'Activating Inertia Control System' },
  { label: 'Activating Environmental Sensors' },
  { label: 'Equipment Authentication', value: 'Complete' },
  { label: 'Equipment Status', value: 'Green' },
  { label: 'All Systems Green' },
  { label: 'Combat Preparations Complete' }
];