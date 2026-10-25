import { useEffect, useState, useRef } from 'react';

export default function TimelineSlider({
  timeline = [],
  selectedDate,
  onSelectDate,
  onDateChange,
  loading,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const handleSelectRef = useRef(onSelectDate || onDateChange);
  useEffect(() => {
    handleSelectRef.current = onSelectDate || onDateChange;
  }, [onSelectDate, onDateChange]);

  const currentIndex = timeline.findIndex((t) => t.date === selectedDate);
  const currentEntry = timeline[currentIndex] || timeline[0];

  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        if (handleSelectRef.current) {
          handleSelectRef.current((prevDate) => {
            const idx = timeline.findIndex((t) => t.date === prevDate);
            if (idx >= 0 && idx < timeline.length - 1) {
              return timeline[idx + 1].date;
            } else {
              setIsPlaying(false);
              return timeline[0].date;
            }
          });
        }
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, timeline]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      const fn = handleSelectRef.current || onSelectDate || onDateChange;
      if (fn) fn(timeline[currentIndex - 1].date);
    }
  };

  const handleNext = () => {
    if (currentIndex < timeline.length - 1) {
      const fn = handleSelectRef.current || onSelectDate || onDateChange;
      if (fn) fn(timeline[currentIndex + 1].date);
    }
  };

  return (
    <div className="timeline-slider-card">
      <div className="timeline-header">
        <div>
          <span className="timeline-badge">HISTORICAL TIMELINE SCRUBBER</span>
          <h3>{currentEntry?.headline || 'Yamuna River Flood Timeline'}</h3>
          <p className="timeline-summary">{currentEntry?.summary}</p>
        </div>

        <div className="timeline-metrics">
          <div className="gauge-box">
            <span className="gauge-label">Yamuna Level</span>
            <span
              className={`gauge-value ${
                currentEntry?.water_level_m >= 207
                  ? 'gauge-critical'
                  : currentEntry?.water_level_m >= 205.33
                  ? 'gauge-danger'
                  : 'gauge-normal'
              }`}
            >
              {currentEntry?.water_level_m} m
            </span>
            <span className="gauge-subtext">
              {currentEntry?.water_level_m >= 205.33
                ? `+${(currentEntry.water_level_m - 205.33).toFixed(2)}m above danger`
                : 'Below danger mark'}
            </span>
          </div>

          <div className="playback-controls">
            <button
              className="ctrl-btn"
              onClick={handlePrev}
              disabled={currentIndex <= 0 || loading}
              title="Previous Day"
            >
              ◀ Prev
            </button>
            <button
              className="ctrl-btn play-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pause Replay' : 'Play Timeline'}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play Replay'}
            </button>
            <button
              className="ctrl-btn"
              onClick={handleNext}
              disabled={currentIndex >= timeline.length - 1 || loading}
              title="Next Day"
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>

      <div className="timeline-steps">
        {timeline.map((item, index) => {
          const isActive = item.date === selectedDate;
          const isPast = index < currentIndex;
          const isPeak = item.status === 'peak';

          return (
            <button
              key={item.date}
              className={`timeline-step-btn ${isActive ? 'active' : ''} ${
                isPast ? 'completed' : ''
              } ${isPeak ? 'peak-marker' : ''}`}
              onClick={() => {
                setIsPlaying(false);
                onSelectDate(item.date);
              }}
            >
              <span className="step-date">
                {item.date.replace('2023-', '')}
              </span>
              <span className="step-level">{item.water_level_m}m</span>
              <span className="step-tag">
                {isPeak ? '★ PEAK' : item.day_label.split(' - ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
