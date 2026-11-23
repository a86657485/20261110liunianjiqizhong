import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const CLASS_IDS = ['601', '602', '603', '604', '605', '606'];

function fmtDiag(map) {
  if (!map) return '—';
  const keys = Object.keys(map).sort();
  if (!keys.length) return '—';
  return keys.map((k) => k + ':' + map[k].correct + '/' + map[k].total).join(' ');
}

function compositeOf(s) {
  return s.mainPercent == null ? null : s.mainPercent + (s.challengeBonus || 0);
}

function compareRows(a, b, key, dir) {
  const va = a[key];
  const vb = b[key];
  if (va == null && vb == null) return 0;
  if (va == null) return 1; // 无记录始终排在最后
  if (vb == null) return -1;
  let r = 0;
  if (typeof va === 'number' && typeof vb === 'number') r = va - vb;
  else if (typeof va === 'boolean' && typeof vb === 'boolean') r = (va ? 1 : 0) - (vb ? 1 : 0);
  else r = String(va).localeCompare(String(vb), 'zh-Hans-CN', { numeric: true });
  if (r === 0) r = String(a.name).localeCompare(String(b.name), 'zh-Hans-CN');
  return dir === 'asc' ? r : -r;
}

function SortTh({ label, k, sortKey, sortDir, onSort, className }) {
  const active = sortKey === k;
  return (
    <th className={className}>
      <button
        type="button"
        className={'th-sort' + (active ? ' active' : '')}
        onClick={() => onSort(k)}
        aria-label={`按${label}排序`}
      >
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

export default function TeacherPage() {
  const [classId, setClassId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sortKey, setSortKey] = useState('classId');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    api
      .teacher(classId || null)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [classId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    setSelected(new Set());
    setNotice('');
  }, [classId]);

  const rows = useMemo(
    () => (data && data.students ? data.students : []).map((s) => ({ ...s, composite: compositeOf(s) })),
    [data]
  );

  const sorted = useMemo(() => {
    const arr = rows.slice();
    arr.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return arr;
  }, [rows, sortKey, sortDir]);

  const ranked = useMemo(
    () =>
      rows
        .filter((r) => r.mainPercent != null)
        .sort(
          (a, b) =>
            b.composite - a.composite ||
            b.mainPercent - a.mainPercent ||
            String(a.name).localeCompare(String(b.name), 'zh-Hans-CN')
        )
        .slice(0, 10),
    [rows]
  );
  const rankedCount = rows.filter((r) => r.mainPercent != null).length;
  const compositeAvg =
    rankedCount > 0
      ? Math.round(rows.filter((r) => r.mainPercent != null).reduce((a, r) => a + r.composite, 0) / rankedCount)
      : null;

  function onSort(k) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(k);
    setSortDir(k === 'name' || k === 'classId' ? 'asc' : 'desc');
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.id));
  function toggleAll() {
    setSelected((prev) => {
      if (sorted.every((r) => prev.has(r.id))) return new Set();
      return new Set(sorted.map((r) => r.id));
    });
  }

  async function removeSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    const yes = window.confirm(
      `确定删除选中的 ${ids.length} 名学生成绩？\n将清除其作答记录与分数，学生可重新作答。此操作不可撤销。`
    );
    if (!yes) return;
    setDeleting(true);
    setError('');
    setNotice('');
    try {
      const r = await api.teacherReset(ids);
      setSelected(new Set());
      setNotice(
        `已删除 ${r.removed} 名学生的成绩` +
          (ids.length > r.removed ? `（${ids.length - r.removed} 人原本无记录）` : '')
      );
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="app-shell teacher-shell">
      <div className="topbar">
        <div className="brand">教师大屏 · 控制探秘营诊断</div>
        <div className="chip">免密 · 仅局域网 · 删除需二次确认</div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="class-pills">
          <button
            type="button"
            className={'class-pill' + (!classId ? ' active' : '')}
            onClick={() => setClassId('')}
          >
            全年级
          </button>
          {CLASS_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={'class-pill' + (classId === id ? ' active' : '')}
              onClick={() => setClassId(id)}
            >
              {id}
            </button>
          ))}
          <button type="button" className="btn-ghost" onClick={load}>
            刷新
          </button>
        </div>
        {data ? (
          <div className="stat-row">
            <div className="stat">
              <span className="muted">进入</span>
              <b>
                {data.entered}/{data.denominator}
              </b>
            </div>
            <div className="stat">
              <span className="muted">主卷已交</span>
              <b>{data.mainSubmitted}</b>
            </div>
            <div className="stat">
              <span className="muted">主卷均分</span>
              <b>{data.avgMainPercent != null ? data.avgMainPercent : '—'}</b>
            </div>
            <div className="stat">
              <span className="muted">综合均分</span>
              <b>{compositeAvg != null ? compositeAvg : '—'}</b>
            </div>
            <div className="stat">
              <span className="muted">最高综合</span>
              <b>{ranked.length ? ranked[0].composite : '—'}</b>
            </div>
            <div className="stat">
              <span className="muted">主卷题量</span>
              <b>{data.mainQuestionCount != null ? data.mainQuestionCount : '—'}</b>
            </div>
            <div className="stat">
              <span className="muted">命题</span>
              <b style={{ fontSize: '0.85rem' }}>{data.paperVersion}</b>
            </div>
          </div>
        ) : null}
        {data && data.diagnostics ? (
          <div className="diag-block">
            <p>
              <b>按课：</b>
              {fmtDiag(data.diagnostics.byLesson)}
            </p>
            <p>
              <b>按题型：</b>
              {fmtDiag(data.diagnostics.byType)}
            </p>
            <p>
              <b>按素养：</b>
              {fmtDiag(data.diagnostics.byLiteracy)}
            </p>
          </div>
        ) : null}
        {error ? <div className="error-box">{error}</div> : null}
      </div>

      <div className="card leaderboard-card">
        <div className="leaderboard-head">
          <h3>排行榜 · 综合分</h3>
          <span className="muted">
            综合分＝主卷%＋挑战加分 · 已交主卷 {rankedCount} 人{rankedCount > 10 ? '，显示前 10' : ''}
          </span>
        </div>
        {ranked.length ? (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th style={{ width: 56 }}>名次</th>
                <th style={{ width: 72 }}>班</th>
                <th>姓名</th>
                <th style={{ width: 90 }}>主卷%</th>
                <th style={{ width: 90 }}>挑战+</th>
                <th style={{ width: 96 }}>综合分</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s, i) => (
                <tr key={s.id} className={i < 3 ? 'top rank-row-' + (i + 1) : ''}>
                  <td>
                    <span className={'rank rank-' + (i + 1)}>{i + 1}</span>
                  </td>
                  <td>{s.classId}</td>
                  <td>{s.name}</td>
                  <td>{s.mainPercent}</td>
                  <td>{s.challengeBonus != null ? '+' + s.challengeBonus : '—'}</td>
                  <td>
                    <b>{s.composite}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            暂无已交主卷的学生。
          </p>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div>
            <b>学生明细</b>{' '}
            <span className="muted">
              共 {rows.length} 人 · 已选 {selected.size} 人
            </span>
          </div>
          <button
            type="button"
            className="btn-danger"
            onClick={removeSelected}
            disabled={!selected.size || deleting}
          >
            {deleting ? '删除中…' : `删除选中成绩${selected.size ? '（' + selected.size + '）' : ''}`}
          </button>
        </div>
        {notice ? <div className="notice-ok">{notice}</div> : null}
        <div className="table-scroll">
          <table className="teacher-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="全选当前名单"
                  />
                </th>
                <SortTh label="班" k="classId" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="姓名" k="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="进入" k="entered" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="通关站" k="stagesCompleted" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="主卷%" k="mainPercent" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="挑战+" k="challengeBonus" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="综合分" k="composite" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th>分课</th>
                <th>题型</th>
                <th>素养</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className={selected.has(s.id) ? 'row-selected' : ''}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      aria-label={`选择${s.classId}${s.name}`}
                    />
                  </td>
                  <td>{s.classId}</td>
                  <td>{s.name}</td>
                  <td>{s.entered ? '是' : '否'}</td>
                  <td>{s.stagesCompleted}</td>
                  <td>{s.mainPercent != null ? s.mainPercent : '—'}</td>
                  <td>{s.challengeBonus != null ? s.challengeBonus : '—'}</td>
                  <td>{s.composite != null ? s.composite : '—'}</td>
                  <td>{fmtDiag(s.byLesson)}</td>
                  <td>{fmtDiag(s.byType)}</td>
                  <td>{fmtDiag(s.byLiteracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          不设达标线；点击表头可排序，无记录学生始终排在最后。删除会清除作答记录并写入审计日志（操作者 IP、人数、学生）。按课／题型／素养正确率仅供教师诊断，不卡学生。学生端不下发答案。更新于{' '}
          {data && data.updatedAt}
        </p>
      </div>
    </div>
  );
}
