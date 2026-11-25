export function statementSheetBadge(sheet) {
  if (sheet.parseMethod === 'exact') return 'Parsed exactly';
  if (sheet.parseMethod === 'ai') return `AI-cleaned (${sheet.cleaned} rows, ${sheet.toCheck} to check)`;
  if (sheet.parseMethod === 'fallback') return 'Code parser fallback';
  return '';
}

export function statementSheetDetail({ found, skipped, reasons, note }) {
  const why = reasons.map(({ reason, count }) => `${count} × ${reason}`).join(', ');
  return [`${found} found, ${skipped} skipped${why ? ' (' + why + ')' : ''}`, note].filter(Boolean).join(' · ');
}
