import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './lib/api.js';
import ExplorerCampMap from './components/ExplorerCampMap.jsx';
import StageClearBanner from './components/StageClearBanner.jsx';
import QuestionView from './components/QuestionView.jsx';
import TeacherPage from './components/TeacherPage.jsx';

const CLASS_IDS = ['601', '602', '603', '604', '605', '606'];

function isTeacherPath() {
  return typeof location !== 'undefined' && location.pathname.indexOf('/teacher') === 0;
}

function answeredEnough(answer, question) {
  if (!question) return false;
  if (answer === undefined || answer === null || answer === '') return false;
  const key = question.interactionSpecKey || question.type;
  if (
    key === 'matching' ||
    key === 'matching_one_to_one' ||
    key === 'flowchart_order_cards' ||
    key === 'flowchart_fill_slots' ||
    key === 'flowchart_fill_triple' ||
    key === 'flowchart_pick_plan'
  ) {
    if (typeof answer !== 'object') return false;
    const need = question.left
      ? question.left.length
      : question.slots
        ? question.slots.length
        : 0;
    const filled = Object.keys(answer).filter((k) => answer[k] != null && answer[k] !== '').length;
    return need > 0 ? filled >= need : filled > 0;
  }
  return true;
}

function LoginPage({ onLoggedIn }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('601');
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.roster().then((d) => setClasses(d.classes || [])).catch((e) => setError(e.message));
  }, []);

  const students = useMemo(() => {
    const g = (classes || []).find((c) => c.id === classId);
    const list = (g && g.students) || [];
    const qq = q.trim();
    if (!qq) return list;
    return list.filter((s) => s.name.indexOf(qq) >= 0);
  }, [classes, classId, q]);

  async function doLogin(studentId) {
    setLoading(true);
    setError('');
    try {
      const data = await api.login({ studentId });
      onLoggedIn(data);
    } catch (e) {
      setError(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell login-shell">
      <div className="login-hero">
        <div className="login-badge">过程与控制 · 期中闯关</div>
        <h1>控制探秘营·八站通行证</h1>
        <p className="muted">六年级《过程与控制》期中 · 选班级和姓名进入</p>
      </div>
      <div className="card login-card">
        <div className="class-pills">
          {CLASS_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={'class-pill' + (classId === id ? ' active' : '')}
              onClick={() => {
                setClassId(id);
                setSelected(null);
              }}
            >
              {id} 班
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索姓名（可点选，不必打字）"
          className="text-input"
        />
        <div className="name-list">
          {students.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'name-btn' + (selected && selected.id === s.id ? ' selected' : '')}
              onClick={() => setSelected(s)}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn-primary"
            disabled={!selected || loading}
            onClick={() => doLogin(selected.id)}
          >
            {loading ? '进入中…' : '确认进入探秘营'}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          名单里没有名字？请联系老师登记，不能自行输入姓名进入。
        </p>
        {error ? <div className="error-box">{error}</div> : null}
      </div>
    </div>
  );
}

function ResultPanel({ progress, onMap, onChallenge, onSkipChallenge, onSubmitMain, submitting }) {
  const main = progress.firstSubmitMain;
  const ch = progress.firstSubmitChallenge;
  const mainPending = progress.mainReady && !progress.mainSubmitted;
  return (
    <div className="card">
      <h2 className="panel-title">闯关结果</h2>
      {progress.mainSubmitted ? (
        <p className="muted" style={{ marginTop: 0 }}>
          本卷已交卷，整卷锁定，不能再次作答；成绩以首次交卷为准。
        </p>
      ) : null}
      {mainPending ? (
        <p className="muted" style={{ marginTop: 0 }}>
          先做挑战不会自动交主卷。主卷百分要点「提交主卷」后才计入。
        </p>
      ) : null}
      <div className="stat-row">
        <div className="stat">
          <span className="muted">主卷百分</span>
          <b>{main ? main.percent : '—'}</b>
          <span className="muted">{main ? main.correct + '/' + main.total + ' 题对' : '尚未交卷'}</span>
        </div>
        <div className="stat">
          <span className="muted">挑战加分</span>
          <b>{ch ? '+' + ch.bonus : progress.challengeSkipped ? '已跳过' : '—'}</b>
          <span className="muted">{ch ? ch.correct + '/' + ch.total + ' 题对' : '每对 +2，满分 +10'}</span>
        </div>
        <div className="stat">
          <span className="muted">综合分</span>
          <b>{main ? main.percent + (ch ? ch.bonus : 0) : '—'}</b>
          <span className="muted">主卷百分＋挑战加分</span>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn-ghost" onClick={onMap}>
          回到探秘营地图
        </button>
        {mainPending && onSubmitMain ? (
          <button type="button" className="btn-primary" onClick={onSubmitMain} disabled={!!submitting}>
            {submitting ? '提交中…' : '提交主卷 · 查看百分'}
          </button>
        ) : null}
        {progress.mainReady && !progress.challengeSubmitted && !progress.challengeSkipped ? (
          <>
            <button type="button" className={mainPending ? 'btn-ghost' : 'btn-primary'} onClick={onChallenge}>
              进入加分挑战关
            </button>
            <button type="button" className="btn-ghost" onClick={onSkipChallenge}>
              跳过挑战
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function StudentApp() {
  const [student, setStudent] = useState(null);
  const [paper, setPaper] = useState(null);
  const [progress, setProgress] = useState(null);
  const [view, setView] = useState('map');
  const [activeStageId, setActiveStageId] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [localAnswers, setLocalAnswers] = useState({});
  const [clearFeedback, setClearFeedback] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const qById = useMemo(() => {
    const m = {};
    if (paper && paper.questions) {
      for (const q of paper.questions) m[q.id] = q;
    }
    return m;
  }, [paper]);

  const activeStage = useMemo(() => {
    if (!paper || !activeStageId) return null;
    return (paper.stages || []).find((s) => s.stageId === activeStageId) || null;
  }, [paper, activeStageId]);

  const stageQuestions = useMemo(() => {
    if (!activeStage) return [];
    return activeStage.questionIds.map((id) => qById[id]).filter(Boolean);
  }, [activeStage, qById]);

  const currentQ = stageQuestions[pageIndex] || null;

  const stageAnsweredCount = useMemo(() => {
    let n = 0;
    for (const q of stageQuestions) {
      if (answeredEnough(localAnswers[q.id], q)) n += 1;
    }
    return n;
  }, [stageQuestions, localAnswers]);

  function onLoggedIn(data) {
    setStudent(data.student);
    setPaper(data.paper);
    setProgress(data.progress);
    setLocalAnswers(Object.assign({}, data.progress.draftAnswers || {}));
    setView('map');
  }

  function enterStage(node) {
    const closed =
      node.stageId === 'gate_bonus'
        ? !!(progress && (progress.challengeSubmitted || progress.challengeSkipped))
        : !!(progress && progress.mainSubmitted);
    if (closed) return;
    setActiveStageId(node.stageId);
    // 地图节点（progress.stageProgress）不带题目列表，需从试卷定义取，才能定位首个未答题
    const stageDef = paper && paper.stages ? paper.stages.find((s) => s.stageId === node.stageId) : null;
    const ids = (stageDef && stageDef.questionIds) || node.questionIds || [];
    let start = 0;
    for (let i = 0; i < ids.length; i++) {
      if (!answeredEnough(localAnswers[ids[i]], qById[ids[i]])) {
        start = i;
        break;
      }
    }
    setPageIndex(start);
    setClearFeedback('');
    setError('');
    setView('stage');
  }

  const saveAnswer = useCallback(
    async (questionId, answer) => {
      setLocalAnswers((prev) => ({ ...prev, [questionId]: answer }));
      if (!student) return;
      try {
        const data = await api.answer({ studentId: student.id, questionId, answer });
        setProgress(data.progress);
      } catch (e) {
        setError(e.message);
      }
    },
    [student]
  );

  async function submitStage() {
    if (!student || !activeStage) return;
    setSubmitting(true);
    setError('');
    try {
      const answers = {};
      for (const q of stageQuestions) answers[q.id] = localAnswers[q.id];
      const data = await api.submitStage({
        studentId: student.id,
        stageId: activeStage.stageId,
        answers,
      });
      setProgress(data.progress);
      setClearFeedback(data.stageClearFeedback || '');
      setView('clear');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMain() {
    if (!student) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await api.submitMain({ studentId: student.id });
      setProgress(data.progress);
      setView('result');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitChallenge() {
    if (!student || !activeStage) return;
    setSubmitting(true);
    setError('');
    try {
      const answers = {};
      for (const q of stageQuestions) answers[q.id] = localAnswers[q.id];
      const data = await api.submitChallenge({ studentId: student.id, answers });
      setProgress(data.progress);
      setClearFeedback(data.stageClearFeedback || '');
      setView('result');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function skipChallenge() {
    if (!student) return;
    const data = await api.skipChallenge({ studentId: student.id });
    setProgress(data.progress);
    setView('result');
  }

  if (!student) return <LoginPage onLoggedIn={onLoggedIn} />;

  const showResultOnMap =
    progress && (progress.mainSubmitted || progress.challengeSubmitted || progress.challengeSkipped);

  const activeStageClosed = !!(
    activeStage &&
    (activeStage.stageId === 'gate_bonus'
      ? progress && (progress.challengeSubmitted || progress.challengeSkipped)
      : progress && progress.mainSubmitted)
  );

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">控制探秘营·八站通行证</div>
        <div className="chip">
          {student.classId} · {student.name}
          {paper ? ' · ' + paper.version.replace(/^\d{4}-\d{2}-\d{2}-g6-midterm-/, '') : ''}
        </div>
      </div>
      {error ? <div className="error-box">{error}</div> : null}

      {view === 'map' ? (
        <ExplorerCampMap
          stageProgress={progress && progress.stageProgress}
          onEnter={enterStage}
          onSubmitMain={submitMain}
          mainReady={progress && progress.mainReady}
          mainSubmitted={progress && progress.mainSubmitted}
          challengeSubmitted={progress && progress.challengeSubmitted}
          challengeSkipped={progress && progress.challengeSkipped}
        />
      ) : null}

      {view === 'map' && showResultOnMap ? (
        <div style={{ marginTop: 8 }}>
          <ResultPanel
            progress={progress}
            onMap={() => setView('map')}
            onChallenge={() => {
              const bonus = (progress.stageProgress || []).find((s) => s.stageId === 'gate_bonus');
              if (bonus) enterStage(bonus);
            }}
            onSkipChallenge={skipChallenge}
            onSubmitMain={submitMain}
            submitting={submitting}
          />
        </div>
      ) : null}

      {view === 'clear' ? (
        <StageClearBanner
          feedback={clearFeedback}
          onBackMap={() => {
            setView('map');
            setClearFeedback('');
          }}
        />
      ) : null}

      {view === 'stage' && currentQ ? (
        <QuestionView
          question={currentQ}
          value={localAnswers[currentQ.id]}
          onChange={(ans) => {
            if (!activeStageClosed) saveAnswer(currentQ.id, ans);
          }}
          stageName={activeStage && activeStage.stageName}
          answeredCount={stageAnsweredCount}
          questionCount={stageQuestions.length}
          pageIndex={pageIndex}
          pageTotal={stageQuestions.length}
          onPrev={() => setPageIndex((i) => Math.max(0, i - 1))}
          onNext={() => setPageIndex((i) => Math.min(stageQuestions.length - 1, i + 1))}
          onJump={(i) => setPageIndex(i)}
          onBackMap={() => {
            setView('map');
            setError('');
          }}
          answeredFlags={stageQuestions.map((q) => answeredEnough(localAnswers[q.id], q))}
          onSubmitStage={
            activeStage && activeStage.stageId === 'gate_bonus' ? submitChallenge : submitStage
          }
          canSubmitStage={stageQuestions.length > 0}
          submitting={submitting}
          locked={activeStageClosed}
          seed={student.id}
        />
      ) : null}

      {view === 'result' ? (
        <ResultPanel
          progress={progress}
          onMap={() => setView('map')}
          onChallenge={() => {
            const bonus = (progress.stageProgress || []).find((s) => s.stageId === 'gate_bonus');
            if (bonus) enterStage(bonus);
          }}
          onSkipChallenge={skipChallenge}
          onSubmitMain={submitMain}
          submitting={submitting}
        />
      ) : null}

      {view === 'map' ? (
        <p className="muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>
          所有关卡一开始即可进入，可自由选关、跳题作答。关内可改选至本关提交。学生端不显示答案与解析。
        </p>
      ) : null}
    </div>
  );
}

export default function App() {
  if (isTeacherPath()) return <TeacherPage />;
  return <StudentApp />;
}
