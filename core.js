(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ColorShapeMemoryCore = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FIXATION_MS = 500;
  const STIMULUS_MS = 700;
  const GAP_MS = 300;
  const CONDITIONS = [
    { condition: 'A', setSize: 4, retentionMs: 1000 },
    { condition: 'B', setSize: 4, retentionMs: 4000 },
    { condition: 'C', setSize: 6, retentionMs: 1000 },
    { condition: 'D', setSize: 6, retentionMs: 4000 },
  ];
  const MAIN_REPETITIONS_PER_CONDITION = 6;
  const PRACTICE_REPETITIONS = 1;
  const COLORS = [
    { id: 'red', label: '빨강', hex: '#d92d20' },
    { id: 'blue', label: '파랑', hex: '#2563eb' },
    { id: 'green', label: '초록', hex: '#16a34a' },
    { id: 'yellow', label: '노랑', hex: '#eab308' },
    { id: 'purple', label: '보라', hex: '#9333ea' },
    { id: 'orange', label: '주황', hex: '#f97316' },
  ];
  const SHAPES = [
    { id: 'circle', label: '원' },
    { id: 'star', label: '별' },
    { id: 'triangle', label: '삼각형' },
    { id: 'square', label: '사각형' },
    { id: 'heart', label: '하트' },
    { id: 'diamond', label: '다이아몬드' },
  ];
  const FIXED_STIMULI = [
    { id: 'red_circle', color: 'red', shape: 'circle' },
    { id: 'blue_star', color: 'blue', shape: 'star' },
    { id: 'green_triangle', color: 'green', shape: 'triangle' },
    { id: 'yellow_square', color: 'yellow', shape: 'square' },
    { id: 'purple_heart', color: 'purple', shape: 'heart' },
    { id: 'orange_diamond', color: 'orange', shape: 'diamond' },
  ];
  const CSV_COLUMNS = [
    'participant_id',
    'trial_number',
    'practice_or_main',
    'timestamp',
    'condition',
    'set_size',
    'retention_interval_ms',
    'stimulus_sequence',
    'response_sequence',
    'reaction_time_ms',
    'exact_accuracy',
    'partial_accuracy',
    'pos1_correct',
    'pos2_correct',
    'pos3_correct',
    'pos4_correct',
    'pos5_correct',
    'pos6_correct',
  ];

  function shuffleItems(items, random = Math.random) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function buildStimulusPool() {
    return FIXED_STIMULI.map((stimulus) => {
      const color = COLORS.find((entry) => entry.id === stimulus.color);
      const shape = SHAPES.find((entry) => entry.id === stimulus.shape);
      return {
        ...stimulus,
        colorLabel: color.label,
        hex: color.hex,
        shapeLabel: shape.label,
        label: `${color.label} ${shape.label}`,
      };
    });
  }

  function generateStimulusSequence(length, random = Math.random) {
    const pool = buildStimulusPool();
    if (length > pool.length) {
      throw new RangeError('set size cannot exceed the six fixed stimuli');
    }
    return shuffleItems(pool, random).slice(0, length);
  }

  function makeTrial({ condition, setSize, retentionMs, practice = false, random = Math.random }) {
    return {
      condition: practice ? `practice_${setSize}_${retentionMs}` : condition,
      setSize,
      retentionMs,
      practice,
      stimulusMs: STIMULUS_MS,
      gapMs: GAP_MS,
      fixationMs: FIXATION_MS,
      sequence: generateStimulusSequence(setSize, random),
    };
  }

  function buildPracticeTrials({ random = Math.random } = {}) {
    const trials = [];
    CONDITIONS.forEach((condition) => {
      for (let repeat = 0; repeat < PRACTICE_REPETITIONS; repeat += 1) {
        trials.push(makeTrial({ ...condition, practice: true, random }));
      }
    });
    return trials;
  }

  function buildMainTrials({ random = Math.random, shuffle = shuffleItems } = {}) {
    const trials = [];
    CONDITIONS.forEach((condition) => {
      for (let repeat = 0; repeat < MAIN_REPETITIONS_PER_CONDITION; repeat += 1) {
        trials.push(makeTrial({ ...condition, practice: false, random }));
      }
    });
    return shuffle(trials, random);
  }

  function normalizeResponse(responseItems) {
    if (Array.isArray(responseItems)) {
      return responseItems.filter(Boolean);
    }
    return String(responseItems || '')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function scoreResponse(sequence, responseItems) {
    const normalizedResponse = normalizeResponse(responseItems);
    const positionCorrect = sequence.map((item, index) => normalizedResponse[index] === item.id ? 1 : 0);
    const exactAccuracy = normalizedResponse.length === sequence.length && positionCorrect.every(Boolean) ? 1 : 0;
    const partialAccuracy = sequence.length
      ? positionCorrect.reduce((sum, value) => sum + value, 0) / sequence.length
      : 0;
    return { normalizedResponse, exactAccuracy, partialAccuracy, positionCorrect };
  }

  function createResultRow({
    participantId,
    trialNumber,
    practice,
    trial,
    responseItems,
    reactionTimeMs,
    timestamp = new Date().toISOString(),
  }) {
    const score = scoreResponse(trial.sequence, responseItems);
    const row = {
      participant_id: participantId,
      trial_number: trialNumber,
      practice_or_main: practice ? 'practice' : 'main',
      timestamp,
      condition: trial.condition,
      set_size: trial.setSize,
      retention_interval_ms: trial.retentionMs,
      stimulus_sequence: trial.sequence.map((item) => item.id).join('|'),
      response_sequence: score.normalizedResponse.join('|'),
      reaction_time_ms: Math.round(reactionTimeMs),
      exact_accuracy: score.exactAccuracy,
      partial_accuracy: Number(score.partialAccuracy.toFixed(4)),
    };

    for (let index = 0; index < 6; index += 1) {
      row[`pos${index + 1}_correct`] = index < trial.sequence.length ? score.positionCorrect[index] : '';
    }

    return row;
  }

  function summarizeResults(rows) {
    const mainRows = rows.filter((row) => row.practice_or_main === 'main');
    const totalTrials = mainRows.length;
    const exactAccuracy = totalTrials
      ? mainRows.reduce((sum, row) => sum + Number(row.exact_accuracy), 0) / totalTrials
      : 0;
    const partialAccuracy = totalTrials
      ? mainRows.reduce((sum, row) => sum + Number(row.partial_accuracy), 0) / totalTrials
      : 0;
    const byCondition = {};

    mainRows.forEach((row) => {
      const key = row.condition;
      if (!byCondition[key]) {
        byCondition[key] = {
          condition: row.condition,
          setSize: row.set_size,
          retentionMs: row.retention_interval_ms,
          total: 0,
          exact: 0,
          partial: 0,
          rt: 0,
        };
      }
      byCondition[key].total += 1;
      byCondition[key].exact += Number(row.exact_accuracy);
      byCondition[key].partial += Number(row.partial_accuracy);
      byCondition[key].rt += Number(row.reaction_time_ms);
    });

    Object.values(byCondition).forEach((entry) => {
      entry.exactAccuracy = entry.total ? entry.exact / entry.total : 0;
      entry.partialAccuracy = entry.total ? entry.partial / entry.total : 0;
      entry.meanRt = entry.total ? entry.rt / entry.total : 0;
    });

    return { totalTrials, exactAccuracy, partialAccuracy, byCondition };
  }

  function escapeCsv(value) {
    const text = String(value ?? '');
    if (/[",\n\r]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function toCsv(rows) {
    const lines = [CSV_COLUMNS.join(',')];
    rows.forEach((row) => {
      lines.push(CSV_COLUMNS.map((column) => escapeCsv(row[column])).join(','));
    });
    return lines.join('\n');
  }

  function buildSheetsPayload({ participantId, rows }) {
    return {
      participant_id: participantId,
      task_version: 'color_shape_v2',
      row_count: rows.length,
      rows,
    };
  }

  return {
    FIXATION_MS,
    STIMULUS_MS,
    GAP_MS,
    CONDITIONS,
    MAIN_REPETITIONS_PER_CONDITION,
    PRACTICE_REPETITIONS,
    COLORS,
    SHAPES,
    FIXED_STIMULI,
    CSV_COLUMNS,
    shuffleItems,
    buildStimulusPool,
    generateStimulusSequence,
    buildPracticeTrials,
    buildMainTrials,
    scoreResponse,
    createResultRow,
    summarizeResults,
    toCsv,
    buildSheetsPayload,
  };
}));
