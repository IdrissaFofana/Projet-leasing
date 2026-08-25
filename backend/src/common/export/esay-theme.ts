/** Charte ESAY pour exports Excel / PDF */
export const ESAY_EXPORT = {
  navy: '004B87',
  navySoft: '005B82',
  blue: '5A8DEE',
  blueBtn: '648EF7',
  teal: '008CA7',
  green: '2DCE89',
  lime: '8DC63F',
  orange: 'FFA500',
  red: 'F33155',
  yellow: 'FEC107',
  paper: 'F8F9FA',
  white: 'FFFFFF',
  ink: '1F2937',
  muted: '6B7280',
  line: 'E5E7EB',
  rowAlt: 'FAFBFC',
} as const;

export function esayHex(key: keyof typeof ESAY_EXPORT) {
  return `#${ESAY_EXPORT[key]}`;
}
