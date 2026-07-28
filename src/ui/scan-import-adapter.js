import { detectScanSource, parseCuratorSpeedReport } from './imported-scan-parsers.js';

export function parseExternalScan(value, isCsv, parseCsv, parseJson) {
  const sourceType = detectScanSource(value, isCsv);
  const findings = isCsv
    ? parseCsv()
    : sourceType === 'Curator Speed JSON'
      ? parseCuratorSpeedReport(value)
      : parseJson(value);
  return { sourceType, findings };
}
