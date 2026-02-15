import { useEffect, useRef, useState } from 'react';
import './ExerciseChecklist.css';

function formatRest(restSeconds) {
  const value = Number.isFinite(Number(restSeconds)) ? Math.max(0, Number(restSeconds)) : 0;
  if (value < 60) return `${value}s`;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function ExerciseChecklist({ exercises, progress, onToggleSet, onToggleExercise }) {
  const [expanded, setExpanded] = useState(false);
  const [pendingCheck, setPendingCheck] = useState(null); // exercise index being checked off
  const [pendingSetIdx, setPendingSetIdx] = useState(null); // set index being checked off (last set)
  const pendingTimeoutsRef = useRef(new Set());

  useEffect(() => {
    const pendingTimeouts = pendingTimeoutsRef.current;
    return () => {
      pendingTimeouts.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      pendingTimeouts.clear();
    };
  }, []);

  function scheduleDelayedToggle(callback) {
    const timeoutId = setTimeout(() => {
      pendingTimeoutsRef.current.delete(timeoutId);
      callback();
    }, 500);
    pendingTimeoutsRef.current.add(timeoutId);
  }

  if (!exercises || exercises.length === 0) return null;

  const completedCount = progress.filter((p) => p.completed).length;
  const totalCount = exercises.length;

  // Split into incomplete and completed
  const incomplete = [];
  const completed = [];
  exercises.forEach((ex, idx) => {
    if (progress[idx]?.completed) {
      completed.push({ exercise: ex, originalIdx: idx });
    } else {
      incomplete.push({ exercise: ex, originalIdx: idx });
    }
  });

  const orderedList = [...incomplete, ...completed];
  const collapsedUpcoming = incomplete.length > 0
    ? incomplete.slice(0, 4)
    : completed.slice(0, 4);
  const displayList = expanded ? orderedList : collapsedUpcoming;
  const hasMore = orderedList.length > 4;

  function handleCheckExercise(originalIdx) {
    const currentlyComplete = progress[originalIdx]?.completed;
    if (!currentlyComplete) {
      // Show check animation then complete after delay
      setPendingCheck(originalIdx);
      scheduleDelayedToggle(() => {
        setPendingCheck(null);
        onToggleExercise(originalIdx);
      });
    } else {
      onToggleExercise(originalIdx);
    }
  }

  return (
    <div className="checklist">
      <div className="checklist-header">
        <span className="checklist-title">
          NEXT UP {completedCount}/{totalCount}
        </span>
        {hasMore && (
          <button className="checklist-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      <div className="checklist-list">
        {displayList.map(({ exercise, originalIdx }) => {
          const prog = progress[originalIdx];
          const isComplete = prog?.completed;
          const isPendingCheck = pendingCheck === originalIdx;
          const setsCompleted = prog?.setsCompleted || [];

          return (
            <div
              key={exercise.id + '-' + originalIdx}
              className={`checklist-card ${isComplete ? 'checklist-card-done' : ''} ${exercise._isWarmup ? 'checklist-card-warmup' : ''} ${exercise._isCardio ? 'checklist-card-cardio' : ''} ${isPendingCheck ? 'checklist-card-checking' : ''}`}
            >
              <button
                className={`checklist-main-check ${isComplete || isPendingCheck ? 'checked' : ''}`}
                onClick={() => handleCheckExercise(originalIdx)}
              >
                {(isComplete || isPendingCheck) && <span className="check-mark">✓</span>}
              </button>

              <div className="checklist-card-body">
                <div className="checklist-card-top">
                  <span className={`checklist-exercise-name ${isComplete ? 'strikethrough' : ''}`}>
                    {exercise.name}
                  </span>
                  {exercise._isWarmup && (
                    <span className="checklist-warmup-badge">W/U</span>
                  )}
                  {exercise._isCardio && (
                    <span className="checklist-cardio-badge">CARDIO</span>
                  )}
                  <span className="checklist-rpe-badge">{exercise.rpe}</span>
                </div>
                <div className="checklist-card-bottom">
                  <div className="checklist-metrics">
                    <span className="checklist-reps">{exercise.reps}</span>
                    <span className="checklist-rest">REST {formatRest(exercise.rest)}</span>
                    {exercise.note && (
                      <span className="checklist-note-inline">{exercise.note}</span>
                    )}
                  </div>
                  <div className="checklist-sets">
                    {Array.from({ length: exercise.sets }).map((_, setIdx) => {
                      const willCompleteExercise = !isComplete && !setsCompleted[setIdx] &&
                        setsCompleted.every((done, i) => i === setIdx || done);
                      const isPendingSet = isPendingCheck && pendingSetIdx === setIdx;
                      return (
                        <button
                          key={setIdx}
                          className={`checklist-set-check ${(setsCompleted[setIdx] || isPendingSet) ? 'checked' : ''}`}
                          onClick={() => {
                            if (willCompleteExercise) {
                              // Last set → show green flash, then complete after delay
                              setPendingCheck(originalIdx);
                              setPendingSetIdx(setIdx);
                              scheduleDelayedToggle(() => {
                                setPendingCheck(null);
                                setPendingSetIdx(null);
                                onToggleSet(originalIdx, setIdx);
                              });
                            } else {
                              onToggleSet(originalIdx, setIdx);
                            }
                          }}
                        >
                          {(setsCompleted[setIdx] || isPendingSet) && <span className="check-mark-sm">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!expanded && hasMore && (
        <div className="checklist-fade" />
      )}
    </div>
  );
}
