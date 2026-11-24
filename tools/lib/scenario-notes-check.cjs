// Shared Playwright check for the combatsbx scenario notes panel: every tab
// fits inside the viewport without clipping or overlapping the board, tapping
// the text collapses it to its title row, and tapping the title expands it.
const { findLayoutDefects } = require('./layout-check.cjs');

const BOARD = '.battle-foe, .battle-field__rack, .battle-field__team[data-team="party"] > .battle-field__slot, .battle-momentum-overlay, .battle-field__header > :not(.scenario-notes), .tableau-plan-legend, .battle-field__solver-dock';
const TABS = ['Intent', 'How to solve it', 'Why it exists'];

async function checkScenarioNotes(page, tag, width, height, screenshot) {
  const failures = [], notes = page.locator('.scenario-notes');
  if (!(await notes.count())) return [`${tag}: scenario notes missing`];
  if (await notes.getAttribute('data-collapsed')) await notes.locator('.scenario-notes__title').click();
  for (const tab of TABS) {
    await notes.getByRole('tab', { name: tab }).click();
    if (screenshot) await screenshot(tab.split(' ')[0].toLowerCase());
    const defects = await findLayoutDefects(page, '.scenario-notes', { parts: '.scenario-notes__title, .scenario-notes__tabs, .scenario-notes__panel, .scenario-notes__tabs button' });
    failures.push(...defects.map(defect => `${tag} notes/${tab}: ${defect}`));
    failures.push(...(await page.evaluate(({ board }) => {
      const out = [], panel = document.querySelector('.scenario-notes').getBoundingClientRect();
      if (panel.left < 0 || panel.top < 0 || panel.right > innerWidth + 0.5 || panel.bottom > innerHeight + 0.5) out.push('outside the viewport');
      for (const el of document.querySelectorAll(board)) {
        const r = el.getBoundingClientRect();
        if (r.width && Math.min(r.right, panel.right) - Math.max(r.left, panel.left) > 0.5 && Math.min(r.bottom, panel.bottom) - Math.max(r.top, panel.top) > 0.5) out.push(`overlaps ${el.className.split(' ')[0]}`);
      }
      return out;
    }, { board: BOARD })).map(defect => `${tag} notes/${tab}: ${defect}`));
  }
  await notes.locator('.scenario-notes__panel').click();
  if (!(await notes.getAttribute('data-collapsed')) || await notes.locator('.scenario-notes__panel').count()) failures.push(`${tag}: tapping the notes did not collapse them`);
  const title = await notes.boundingBox();
  if (title && title.height > 60) failures.push(`${tag}: collapsed notes are ${Math.round(title.height)}px tall, not one title row`);
  await notes.locator('.scenario-notes__title').click();
  if (await notes.getAttribute('data-collapsed') || !(await notes.locator('.scenario-notes__panel').count())) failures.push(`${tag}: tapping the title did not expand the notes`);
  return failures;
}

module.exports = { checkScenarioNotes };
