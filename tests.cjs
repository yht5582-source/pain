// Rule tests for the decision engine embedded in index.html.
// Run: node tests.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//);
if (!m) throw new Error('engine block not found');
const mod = { exports: {} };
new Function('module', m[1])(mod);
const P = mod.exports;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
const BASE = { age: 40, weight: 70, egfr: 100, nrs: 5, cause: 'other', goal: '疼痛明顯下降', flags: {} };
const ev = (o = {}) => P.evaluate(Object.assign({}, BASE, o, { flags: Object.assign({}, o.flags || {}) }));
const all = r => [].concat(r.warnings, r.causeNotes, r.avoid, r.reassess, ...r.tiers.map(x => x.items), r.doses.map(d => d.drug + d.dose + d.note)).join('\n');
const tierKeys = r => r.tiers.map(x => x.key);

console.log('Input validation');
t('blank age → error (was silently treated as a child)', () => assert.ok(ev({ age: null }).errors));
t('blank eGFR → unknown, NOT renal failure', () => { const r = ev({ egfr: null }); assert.equal(r.errors, null); assert.equal(r.renalSevere, false); assert.equal(r.egfrUnknown, true); assert.equal(r.nsaid, 'caution'); });
t('blank weight allowed', () => assert.equal(ev({ weight: null }).errors, null));
t('negative weight → error', () => assert.ok(ev({ weight: -3 }).errors));
t('NRS 11 → error', () => assert.ok(ev({ nrs: 11 }).errors));

console.log('Severity bands (EUSEM Figure 8.2)');
t('0 none, 3 mild, 4 moderate, 6 moderate, 7 severe', () => {
  assert.deepEqual([0, 1, 3, 4, 6, 7, 10].map(P.sevOf), ['none', 'mild', 'mild', 'moderate', 'moderate', 'severe', 'severe']);
});
t('tiers stack by severity', () => {
  assert.deepEqual(tierKeys(ev({ nrs: 2 })), ['mild']);
  assert.deepEqual(tierKeys(ev({ nrs: 5 })), ['mild', 'moderate']);
  assert.deepEqual(tierKeys(ev({ nrs: 8 })), ['mild', 'moderate', 'severe']);
});
t('NRS 0 → no drug tiers, no doses', () => { const r = ev({ nrs: 0 }); assert.deepEqual(tierKeys(r), ['none']); assert.equal(r.doses.length, 0); });

console.log('NSAID gating');
t('healthy adult → ok', () => assert.equal(ev().nsaid, 'ok'));
['aki', 'dialysis', 'bleed', 'liver', 'heart', 'dehydrated', 'pregnant', 'nsaidAllergy', 'nsaid'].forEach(k =>
  t(k + ' → avoid', () => assert.equal(ev({ flags: { [k]: true } }).nsaid, 'avoid')));
t('liver → avoid (was recommended despite liver warning)', () => assert.ok(!/可依病因考慮單一 NSAID|外用或口服 NSAID（例如/.test(all(ev({ flags: { liver: true } })))));
t('eGFR 25 → avoid', () => assert.equal(ev({ egfr: 25 }).nsaid, 'avoid'));
t('eGFR 45 → caution, not plain ok', () => assert.equal(ev({ egfr: 45 }).nsaid, 'caution'));
t('age 70 → caution', () => assert.equal(ev({ age: 70 }).nsaid, 'caution'));
t('IV ketorolac offered only when NSAID not avoided', () => {
  assert.ok(/IV ketorolac/.test(all(ev({ nrs: 5 }))));
  assert.ok(!/IV ketorolac/.test(all(ev({ nrs: 5, flags: { bleed: true } }))));
});

console.log('Opioid / ketamine choice');
t('severe healthy → IV morphine first-choice + dose row', () => { const r = ev({ nrs: 8 }); assert.ok(/IV morphine 為首選/.test(all(r))); assert.ok(r.doses.some(d => d.drug === 'Morphine IV')); });
t('dialysis → morphine avoided, fentanyl preferred, no morphine dose row', () => {
  const r = ev({ nrs: 9, flags: { dialysis: true }, egfr: 5 });
  assert.equal(r.morphineAvoid, true); assert.ok(/fentanyl 為主要 opioid/.test(all(r)));
  assert.ok(!r.doses.some(d => d.drug === 'Morphine IV'));
});
t('AKI alone → morphine avoided', () => assert.equal(ev({ flags: { aki: true } }).morphineAvoid, true));
t('eGFR 45 → morphine not auto-avoided', () => assert.equal(ev({ egfr: 45 }).morphineAvoid, false));
t('pregnancy → ketamine avoided and no ketamine dose', () => { const r = ev({ nrs: 8, flags: { pregnant: true } }); assert.equal(r.ketamineAvoid, true); assert.ok(!r.doses.some(d => d.drug === 'Ketamine')); });
t('ketamine weight-based mg shown', () => { const k = ev({ nrs: 8, weight: 80 }).doses.find(d => d.drug === 'Ketamine'); assert.ok(/8 mg/.test(k.dose) && /56 mg/.test(k.dose)); });
t('fentanyl 50 μg start / max 200 μg', () => { const f = ev({ nrs: 8 }).doses.find(d => /Fentanyl/.test(d.drug)); assert.ok(/50 μg/.test(f.dose) && /200 μg/.test(f.note)); });
t('back pain severe → opioid not first-line message', () => assert.ok(/opioid 不作首選/.test(all(ev({ nrs: 8, cause: 'back' })))));
t('fracture severe → no "opioid not first" message', () => assert.ok(!/此類疼痛 opioid 不作首選/.test(all(ev({ nrs: 8, cause: 'fracture' })))));
t('codeine/tramadol listed as not recommended for adults', () => assert.ok(/Codeine、tramadol、oxycodone/.test(all(ev({ nrs: 5 })))));

console.log('Paracetamol limits');
t('70 kg → 4 g', () => assert.equal(ev().para.maxG, 4));
t('48 kg → Taiwan label: 15 mg/kg 720 mg q6h / 12.5 mg/kg 600 mg q4h, max 75 mg/kg = 3.6 g', () => { const p = ev({ weight: 48 }).para; assert.ok(/720 mg q6h/.test(p.dose) && /600 mg q4h/.test(p.dose)); assert.equal(p.maxG, 3.6); });
t('single dose capped at 750 mg (49.9 kg)', () => assert.ok(/≈ 749 mg q6h/.test(ev({ weight: 49.9 }).para.dose)));
t('40 kg → 3 g/day', () => assert.equal(ev({ weight: 40 }).para.maxG, 3));
t('40 kg + liver → keeps weight-based dose, cap 2 g', () => { const p = ev({ weight: 40, flags: { liver: true } }).para; assert.ok(/600 mg q6h/.test(p.dose)); assert.equal(p.maxG, 2); });
t('48 kg + dehydrated → 3 g', () => assert.equal(ev({ weight: 48, flags: { dehydrated: true } }).para.maxG, 3));
t('liver → IV paracetamol contraindicated (Taiwan label), PO only', () => { const r = ev({ nrs: 5, flags: { liver: true } }); assert.equal(r.para.ivContra, true); assert.ok(/PO（IV 禁用）/.test(r.doses[0].drug)); assert.ok(/緩熱痛）：重度肝功能不全/.test(all(r))); assert.ok(!/IV paracetamol（無法口服/.test(all(r))); });
t('liver warning states EUSEM vs Taiwan label disagreement', () => assert.ok(/兩者不一致/.test(all(ev({ flags: { liver: true } })))));
t('eGFR 30 / dialysis / AKI → paracetamol renal adjustment', () => { [{ egfr: 30 }, { egfr: 5, flags: { dialysis: true } }, { flags: { aki: true } }].forEach(o => assert.equal(ev(o).para.renalAdjust, true)); assert.ok(/延長給藥間隔/.test(all(ev({ egfr: 25 })))); });
t('eGFR 31 → no paracetamol renal adjustment', () => assert.equal(ev({ egfr: 31 }).para.renalAdjust, false));
t('combination products reminder', () => assert.ok(/複方/.test(ev().para.why)));
t('liver → 2 g', () => assert.equal(ev({ flags: { liver: true } }).para.maxG, 2));
t('dehydrated → 3 g', () => assert.equal(ev({ flags: { dehydrated: true } }).para.maxG, 3));
t('weight unknown → warn to confirm ≥50 kg', () => assert.ok(/未填體重/.test(all(ev({ weight: null })))));

console.log('Populations');
t('child 10 y → no adult doses, codeine contraindicated', () => { const r = ev({ age: 10, nrs: 8 }); assert.equal(r.child, true); assert.equal(r.doses.length, 0); assert.ok(/Codeine 禁用於兒童/.test(all(r))); });
t('age 16 → adult', () => assert.equal(ev({ age: 16 }).adult, true));
t('infant → out of scope', () => { const r = ev({ age: 0.5, nrs: 6 }); assert.equal(r.infant, true); assert.equal(r.doses.length, 0); });
t('major trauma adult → NICE NG39 IV morphine first-line', () => assert.ok(/NICE NG39/.test(all(ev({ nrs: 8, flags: { majortrauma: true } })))));
t('major trauma → nitrous oxide warning', () => assert.ok(/禁用 nitrous oxide/.test(all(ev({ nrs: 5, flags: { majortrauma: true } })))));
t('renal colic → NSAID preferred note', () => assert.ok(/NSAID 優於 opioid/.test(all(ev({ cause: 'renal' })))));

console.log('Reassessment (EUSEM Figure 8.1 / ch.3)');
t('severe → 15 min', () => assert.ok(/15 分鐘第一次複評/.test(ev({ nrs: 8 }).reassess[0])));
t('mild → 30–60 min', () => assert.ok(/30–60/.test(ev({ nrs: 2 }).reassess[0])));
t('8 → 3 = 63% & mild → relieved', () => assert.equal(P.followup(8, 3, 'iv').status, 'relieved'));
t('8 → 5 = 38% → partial', () => assert.equal(P.followup(8, 5, 'iv').status, 'partial'));
t('8 → 7 = 13% → not relieved', () => assert.equal(P.followup(8, 7, 'iv').status, 'notRelieved'));
t('6 → 8 → worse', () => assert.equal(P.followup(6, 8, 'po').status, 'worse'));
t('PO next check 30 min, IV 15 min', () => { assert.equal(P.followup(6, 5, 'po').next, 30); assert.equal(P.followup(6, 5, 'iv').next, 15); });

console.log('Demo cases');
t('Case B (dialysis hip fracture) matches teaching text', () => {
  const r = ev({ age: 68, weight: 60, egfr: 5, nrs: 9, cause: 'fracture', flags: { dialysis: true } });
  assert.equal(r.nsaid, 'avoid'); assert.equal(r.morphineAvoid, true); assert.ok(/fascia iliaca/.test(all(r)));
});
t('Case C (83 y, 48 kg, GI bleed) matches teaching text', () => {
  const r = ev({ age: 83, weight: 48, egfr: 38, nrs: 6, cause: 'muscle', flags: { bleed: true } });
  assert.equal(r.sev, 'moderate'); assert.equal(r.nsaid, 'avoid'); assert.equal(r.para.maxG, 3.6);
});

console.log('Alternative pain scales');
const sc = (id, a, m) => P.scoreScale(id, a, m);
t('all six scales defined', () => assert.deepEqual(Object.keys(P.SCALES).sort(), ['BPS', 'CPOT', 'CRIES', 'FACES', 'FLACC', 'PAINAD']));
t('incomplete → total null', () => { const r = sc('FLACC', { face: 2 }); assert.equal(r.complete, false); assert.equal(r.total, null); assert.equal(r.answered, 1); });
t('FLACC 2+1+1+1+1 = 6 moderate, maps to NRS bands', () => { const r = sc('FLACC', { face: 2, legs: 1, activity: 1, cry: 1, consol: 1 }); assert.equal(r.total, 6); assert.equal(r.level, 'moderate'); assert.equal(r.mapNRS, true); });
t('FLACC all 0 → not pain', () => assert.equal(sc('FLACC', { face: 0, legs: 0, activity: 0, cry: 0, consol: 0 }).pain, false));
t('FACES only even values 0–10', () => { assert.equal(sc('FACES', { face: 8 }).total, 8); assert.equal(sc('FACES', { face: 7 }).complete, false); assert.equal(sc('FACES', { face: 8 }).level, 'severe'); });
t('CRIES threshold >4', () => { assert.equal(sc('CRIES', { c: 1, r: 1, i: 1, e: 1, s: 0 }).pain, false); assert.equal(sc('CRIES', { c: 1, r: 1, i: 1, e: 1, s: 1 }).pain, true); assert.equal(P.SCALES.CRIES.mapNRS, false); });
t('PAINAD 7 → severe', () => assert.equal(sc('PAINAD', { breath: 1, vocal: 2, face: 2, body: 1, consol: 1 }).level, 'severe'));
t('CPOT: ventilator vs vocalization item, max 8, threshold >2', () => {
  assert.deepEqual(P.scaleItems('CPOT', 'vent').map(i => i.key), ['face', 'body', 'vent', 'tension']);
  assert.deepEqual(P.scaleItems('CPOT', 'vocal').map(i => i.key), ['face', 'body', 'vocal', 'tension']);
  assert.equal(sc('CPOT', { face: 1, body: 1, vent: 0, tension: 0 }, 'vent').pain, false);
  assert.equal(sc('CPOT', { face: 1, body: 1, vocal: 1, tension: 0 }, 'vocal').pain, true);
  assert.equal(sc('CPOT', { face: 2, body: 2, vent: 2, tension: 2 }, 'vent').total, 8);
  assert.equal(sc('CPOT', { face: 1, body: 1, vent: 1, tension: 0 }, 'vocal').complete, false);
});
t('BPS 3–12, 0 is not a valid option, threshold >5', () => {
  assert.equal(sc('BPS', { face: 1, limb: 1, vent: 1 }, 'vent').total, 3);
  assert.equal(sc('BPS', { face: 0, limb: 1, vent: 1 }, 'vent').complete, false);
  assert.equal(sc('BPS', { face: 2, limb: 2, vent: 1 }, 'vent').pain, false);
  assert.equal(sc('BPS', { face: 2, limb: 2, vocal: 2 }, 'vocal').pain, true);
  assert.equal(sc('BPS', { face: 4, limb: 4, vent: 4 }, 'vent').total, 12);
});
t('every option score within scale range', () => Object.keys(P.SCALES).forEach(id => (P.SCALES[id].items || []).forEach(it => it.opts.forEach(o => assert.ok(o[0] >= 0 && o[0] <= 4, id)))));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
