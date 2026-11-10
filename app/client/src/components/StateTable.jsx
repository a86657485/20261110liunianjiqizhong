import React from 'react';

/** Render a trial-record / state micro-table from question.stateTable. */
export default function StateTable({ table }) {
  if (!table || typeof table !== 'object') return null;
  const headers = table.headers || [];
  const rows = table.rows || [];
  if (!headers.length && !rows.length) return null;
  return (
    <div className="state-table-wrap">
      {table.caption ? <div className="state-table-caption">{table.caption}</div> : null}
      <table className="state-table">
        {headers.length ? (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {(Array.isArray(row) ? row : [row]).map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.note ? <p className="muted state-table-note">{table.note}</p> : null}
    </div>
  );
}
