/**
 * Map pin colours by kind, shared by the native and web maps and the legend.
 * Shape differs too (outages are square), so colour is never the only signal.
 */
export const PIN_COLORS = {
  place: '#4F46E5',
  selected: '#C2410C',
  report: '#B45309',
  outage: '#0E7490',
  fixed: '#047857',
} as const;
