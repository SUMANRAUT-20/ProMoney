import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../services/api';
import { money } from '../../utils/formatters';
import './reportCard.css';

export function ReportCard({ report, signature }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  async function download(format) {
    setDownloading(true);
    setError('');
    try {
      const file = await apiClient.laboReportExport({ format, report, signature });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `promoney-report.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || 'Could not download the report.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="labo-report-card" aria-label={report.title}>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={report.title}>
        <table>
          <caption>{report.title} · {report.period}</caption>
          <thead><tr>{report.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>
            {report.rows.map(([label, ...values], index) => (
              <tr key={index}>
                <th scope="row">{label}</th>
                {values.map((value, i) => <td key={report.columns[i + 1]}>{money(value)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="inline-editor">
        <button type="button" className="btn secondary compact" disabled={downloading} onClick={() => download('csv')}>Download CSV</button>
        <button type="button" className="btn secondary compact" disabled={downloading} onClick={() => download('pdf')}>Download PDF</button>
        <Link className="btn secondary compact" to="/reports-insights">Open the full report</Link>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
