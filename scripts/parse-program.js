#!/usr/bin/env node
/**
 * parse-program.js
 * Parses the Calgary Barbell 16-Week Program Excel file into a structured JSON template.
 * 
 * Usage: node scripts/parse-program.js [path-to-xlsx]
 * Output: public/program_template.json
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const INPUT_FILE = process.argv[2] || path.join(__dirname, '..', '..', 'Downloads', 'AhmadZiada 16 Week Complete Program - Calgary Barbell.xlsx');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'program_template.json');

// ── Exercise → Lift mapping ──────────────────────────────────────────────────

function classifyLift(exerciseName) {
  const name = exerciseName.toLowerCase();
  
  // Squat variations
  if (name.includes('squat') || name.includes('ssb') || name.includes('front squat'))
    return 'squat';
  
  // Bench variations
  if (name.includes('bench') || name.includes('close grip') || name.includes('touch and go') ||
      name.includes('feet up') || name.includes('board press') || name.includes('2board') ||
      name.includes('pin press'))
    return 'bench';
  
  // Deadlift variations
  if (name.includes('deadlift') || name.includes('sldl'))
    return 'deadlift';
  
  // Accessories - no computed load
  return null;
}

// ── Parse a multi-week sheet ─────────────────────────────────────────────────

/**
 * Each sheet has weeks laid out in column groups.
 * Weeks 1-4 & 12-15: cols B-H (w1), I-N (w2), O-T (w3), U-Z (w4) — 7 cols each in some sheets, 6 in others
 * The structure is:
 *   - Week header row (gives week label)
 *   - Day sections with header row then exercise rows
 * 
 * We parse by detecting the column layout from the header row.
 */

function parseWeekSheet(wb, sheetName, weekNumberStart) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  
  const range = XLSX.utils.decode_range(ws['!ref']);
  const maxRow = range.e.r + 1;
  const maxCol = range.e.c + 1;
  
  // Read all cells into a 2D array (1-indexed to match openpyxl output)
  function getCell(r, c) {
    const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    const cell = ws[addr];
    return cell ? cell.v : null;
  }
  
  // Find the week header row and column positions
  let weekHeaderRow = -1;
  const weekColumns = []; // [{col, weekLabel}]
  
  for (let r = 1; r <= Math.min(10, maxRow); r++) {
    for (let c = 1; c <= maxCol; c++) {
      const val = getCell(r, c);
      if (val && typeof val === 'string' && (val.toLowerCase().includes('week') || val.toLowerCase().includes('week'))) {
        if (weekHeaderRow === -1) weekHeaderRow = r;
        if (r === weekHeaderRow || weekHeaderRow === -1) {
          weekColumns.push({ col: c, label: val.trim() });
        }
      }
    }
    if (weekColumns.length > 0 && weekHeaderRow === r) break;
  }
  
  if (weekColumns.length === 0) return [];
  
  // Determine column structure for each week
  // Find the "Exercise" header row (should be weekHeaderRow + 1)
  const headerRow = weekHeaderRow + 1;
  
  // For each week column group, determine the column offsets
  // The pattern is: Exercise, Sets, Reps, Intensity/Load, [Load computed], Tempo, Rest
  // Some sheets have an extra "Load" column (computed values), some don't
  
  const weekConfigs = [];
  for (let wi = 0; wi < weekColumns.length; wi++) {
    const startCol = weekColumns[wi].col;
    // Find the end column (either next week's start - 1 or maxCol)
    const endCol = wi + 1 < weekColumns.length ? weekColumns[wi + 1].col - 1 : maxCol;
    
    // Identify column roles by reading the header row
    // The Exercise column is at startCol (col B for first week)
    // But Exercise is only in col B — subsequent weeks share the exercise col
    // Actually looking at the data: Exercise name is always in col B (column 2).
    // The Sets/Reps/Intensity/Load/Tempo/Rest repeat per week.
    
    // Check if this week has an "Intensity" column (Weeks 1-4, 5-8, 9-11) 
    // or just "Load" (Weeks 12-15)
    const headerLabels = [];
    for (let c = startCol; c <= endCol; c++) {
      const val = getCell(headerRow, c);
      if (val) headerLabels.push({ col: c, label: String(val).trim().toLowerCase() });
    }
    
    // For week groups after the first, the Exercise col is always col 2
    const hasIntensityCol = headerLabels.some(h => h.label === 'intensity');
    const hasLoadCol = headerLabels.some(h => h.label === 'load');
    
    // Map column roles
    const colMap = {};
    for (const h of headerLabels) {
      if (h.label === 'exercise') colMap.exercise = h.col;
      if (h.label === 'sets') colMap.sets = h.col;
      if (h.label === 'reps') colMap.reps = h.col;
      if (h.label === 'intensity') colMap.intensity = h.col;
      if (h.label === 'load' && !colMap.load) colMap.load = h.col;
      if (h.label === 'tempo') colMap.tempo = h.col;
      if (h.label.startsWith('rest')) colMap.rest = h.col;
    }
    
    // If no exercise column for this week, it uses the first week's exercise column (col 2)
    if (!colMap.exercise) colMap.exercise = 2;
    
    // If this sheet uses "Load" instead of "Intensity", the load column serves the intensity role
    if (!colMap.intensity && colMap.load) {
      colMap.intensity = colMap.load;
      colMap.load = null;
    }
    
    weekConfigs.push({
      weekIndex: wi,
      weekLabel: weekColumns[wi].label,
      colMap,
      startCol,
      endCol
    });
  }
  
  // Now parse day sections
  // Days are identified by "Day X" text in col 2
  const daySections = []; // [{row, dayNumber, dayLabel}]
  for (let r = weekHeaderRow; r <= maxRow; r++) {
    const val = getCell(r, 2);
    if (val && typeof val === 'string') {
      const dayMatch = val.match(/day\s+(\d+)/i);
      if (dayMatch) {
        daySections.push({ row: r, dayNumber: parseInt(dayMatch[1]), dayLabel: val.trim() });
      }
    }
  }
  
  // The first day (Day 1) starts at the header row
  // Insert Day 1 at position weekHeaderRow if not already detected
  if (daySections.length === 0 || daySections[0].dayNumber !== 1) {
    // Day 1 is implicit — the first exercise section after the week header
    daySections.unshift({ row: weekHeaderRow, dayNumber: 1, dayLabel: 'Day 1' });
  }
  
  // Parse exercises for each week/day combination
  const weeks = [];
  
  for (let wi = 0; wi < weekConfigs.length; wi++) {
    const config = weekConfigs[wi];
    const weekNumber = weekNumberStart + wi;
    const days = [];
    
    for (let di = 0; di < daySections.length; di++) {
      const daySection = daySections[di];
      // Exercise rows start 2 rows after the day header (day header, then column labels, then exercises)
      const exerciseStartRow = daySection.row + 2;
      // End at the next day section or end of data
      const exerciseEndRow = di + 1 < daySections.length ? daySections[di + 1].row - 1 : maxRow;
      
      const exercises = [];
      let exerciseIndex = 0;
      
      for (let r = exerciseStartRow; r <= exerciseEndRow; r++) {
        // Check if this row has exercise data for this week
        const exerciseName = getCell(r, config.colMap.exercise) || getCell(r, 2);
        const sets = getCell(r, config.colMap.sets);
        
        if (sets === null && exerciseName === null) continue;
        if (sets === null) continue; // Skip rows without sets data for this week
        
        // Some rows have a name in col 2, some don't (continuation of previous exercise)
        const name = getCell(r, 2) || '';
        if (!name && !sets) continue;
        
        const reps = getCell(r, config.colMap.reps);
        const intensity = config.colMap.intensity ? getCell(r, config.colMap.intensity) : null;
        const tempo = config.colMap.tempo ? getCell(r, config.colMap.tempo) : null;
        const rest = config.colMap.rest ? getCell(r, config.colMap.rest) : null;
        
        const exerciseFinalName = name ? String(name).trim() : '';
        if (!exerciseFinalName) continue;
        
        // Determine load computation rule
        let computedLoadRule = null;
        const liftType = classifyLift(exerciseFinalName);
        
        if (liftType && typeof intensity === 'number' && intensity <= 1) {
          computedLoadRule = { liftType, percent: intensity };
        }
        
        // Check for E1RM-based exercises
        let isE1RM = false;
        if (exerciseFinalName.includes('% of E1RM') || exerciseFinalName.includes('E1RM')) {
          isE1RM = true;
        }
        
        exercises.push({
          id: `w${weekNumber}d${daySection.dayNumber}e${exerciseIndex}`,
          name: exerciseFinalName,
          sets: sets !== null ? (typeof sets === 'number' ? sets : String(sets)) : null,
          reps: reps !== null ? (typeof reps === 'number' ? reps : String(reps)) : null,
          intensity: intensity !== null ? (typeof intensity === 'number' ? intensity : String(intensity)) : null,
          tempo: tempo !== null ? String(tempo) : null,
          restSeconds: rest !== null ? (typeof rest === 'number' ? rest : null) : null,
          computedLoadRule,
          isE1RM
        });
        
        exerciseIndex++;
      }
      
      if (exercises.length > 0) {
        days.push({
          dayNumber: daySection.dayNumber,
          dayLabel: daySection.dayLabel,
          exercises
        });
      }
    }
    
    weeks.push({
      weekNumber,
      weekLabel: config.weekLabel,
      days
    });
  }
  
  return weeks;
}

// ── Parse Taper Week ─────────────────────────────────────────────────────────

function parseTaperWeek(wb) {
  const ws = wb.Sheets['Taper Week'];
  if (!ws) return null;
  
  const range = XLSX.utils.decode_range(ws['!ref']);
  const maxRow = range.e.r + 1;
  
  function getCell(r, c) {
    const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    const cell = ws[addr];
    return cell ? cell.v : null;
  }
  
  // Find day sections (labeled as "X Days from Competition")
  const daySections = [];
  for (let r = 1; r <= maxRow; r++) {
    const val = getCell(r, 2);
    if (val && typeof val === 'string' && val.toLowerCase().includes('days from competition')) {
      daySections.push({ row: r, dayLabel: val.trim() });
    } else if (val && typeof val === 'string' && val.toLowerCase().includes('day from competition')) {
      daySections.push({ row: r, dayLabel: val.trim() });
    }
  }
  
  const days = [];
  
  for (let di = 0; di < daySections.length; di++) {
    const section = daySections[di];
    const exerciseStartRow = section.row + 2; // skip header row
    const exerciseEndRow = di + 1 < daySections.length ? daySections[di + 1].row - 1 : maxRow;
    
    const exercises = [];
    let exerciseIndex = 0;
    
    for (let r = exerciseStartRow; r <= exerciseEndRow; r++) {
      const name = getCell(r, 2);
      const sets = getCell(r, 3);
      const reps = getCell(r, 4);
      const intensity = getCell(r, 5);
      const tempo = getCell(r, 7);
      const rest = getCell(r, 8);
      
      if (sets === null) continue;
      
      const exerciseName = name ? String(name).trim() : '';
      // For rows without an exercise name (continuation), use previous name or blank
      // Actually in taper week, row 23 has no exercise name but has data — it's a continuation of Competition Squat
      let finalName = exerciseName;
      if (!finalName && exercises.length > 0) {
        // Continuation of previous exercise
        finalName = exercises[exercises.length - 1].name;
      }
      if (!finalName) continue;
      
      const liftType = classifyLift(finalName);
      let computedLoadRule = null;
      if (liftType && typeof intensity === 'number' && intensity <= 1) {
        computedLoadRule = { liftType, percent: intensity };
      }
      
      exercises.push({
        id: `w16d${di + 1}e${exerciseIndex}`,
        name: finalName,
        sets: sets !== null ? (typeof sets === 'number' ? sets : String(sets)) : null,
        reps: reps !== null ? (typeof reps === 'number' ? reps : String(reps)) : null,
        intensity: intensity !== null ? (typeof intensity === 'number' ? intensity : String(intensity)) : null,
        tempo: tempo !== null ? String(tempo) : null,
        restSeconds: rest !== null ? (typeof rest === 'number' ? rest : null) : null,
        computedLoadRule,
        isE1RM: false
      });
      
      exerciseIndex++;
    }
    
    days.push({
      dayNumber: di + 1,
      dayLabel: section.dayLabel,
      exercises
    });
  }
  
  return {
    weekNumber: 16,
    weekLabel: 'Taper Week',
    days
  };
}

// ── Parse Training Maxes ─────────────────────────────────────────────────────

function parseTrainingMaxes(wb) {
  const ws = wb.Sheets['Training Maxes'];
  if (!ws) return null;
  
  function getCell(r, c) {
    const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    const cell = ws[addr];
    return cell ? cell.v : null;
  }
  
  return {
    squat: getCell(7, 6),    // Row 7, Col F
    bench: getCell(8, 6),    // Row 8, Col F
    deadlift: getCell(9, 6), // Row 9, Col F
    roundTo: getCell(7, 8),  // Row 7, Col H
    units: 'lbs'
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Reading: ${INPUT_FILE}`);
  const wb = XLSX.readFile(INPUT_FILE);
  console.log('Sheets:', wb.SheetNames);
  
  const trainingMaxes = parseTrainingMaxes(wb);
  console.log('Training Maxes:', trainingMaxes);
  
  let allWeeks = [];
  
  // Parse each sheet
  const weeks1_4 = parseWeekSheet(wb, 'Weeks 1-4', 1);
  console.log(`Weeks 1-4: ${weeks1_4.length} weeks parsed`);
  allWeeks = allWeeks.concat(weeks1_4);
  
  const weeks5_8 = parseWeekSheet(wb, 'Weeks 5-8', 5);
  console.log(`Weeks 5-8: ${weeks5_8.length} weeks parsed`);
  allWeeks = allWeeks.concat(weeks5_8);
  
  const weeks9_11 = parseWeekSheet(wb, 'Weeks 9-11', 9);
  console.log(`Weeks 9-11: ${weeks9_11.length} weeks parsed`);
  allWeeks = allWeeks.concat(weeks9_11);
  
  const weeks12_15 = parseWeekSheet(wb, 'Weeks 12-15', 12);
  console.log(`Weeks 12-15: ${weeks12_15.length} weeks parsed`);
  allWeeks = allWeeks.concat(weeks12_15);
  
  const taperWeek = parseTaperWeek(wb);
  if (taperWeek) {
    console.log(`Taper Week: ${taperWeek.days.length} days parsed`);
    allWeeks.push(taperWeek);
  }
  
  // Summary
  console.log('\n=== Summary ===');
  for (const week of allWeeks) {
    const totalExercises = week.days.reduce((sum, d) => sum + d.exercises.length, 0);
    console.log(`Week ${week.weekNumber} (${week.weekLabel}): ${week.days.length} days, ${totalExercises} exercise rows`);
  }
  
  const output = {
    meta: {
      source: 'AhmadZiada 16 Week Complete Program - Calgary Barbell.xlsx',
      parsedAt: new Date().toISOString(),
      defaultTrainingMaxes: trainingMaxes,
      e1rmFormula: 'epley',
      e1rmFormulaDescription: 'E1RM = weight × (1 + reps / 30)'
    },
    weeks: allWeeks
  };
  
  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nWritten to: ${OUTPUT_FILE}`);
  console.log(`Total weeks: ${allWeeks.length}`);
}

main();
