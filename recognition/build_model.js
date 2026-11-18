const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 1600 } });
  await p.emulateMedia({ media: 'print' });
  await p.goto('file:///mnt/user-data/outputs/handwriting-template.html');
  await p.waitForTimeout(600);

  const model = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('.page').forEach((page, i) => {
      const pr = page.getBoundingClientRect();
      const rel = e => { const r = e.getBoundingClientRect();
        return { x: r.x - pr.x, y: r.y - pr.y, w: r.width, h: r.height }; };
      const fid = {};
      ['tl','tr','bl','br'].forEach(k => {
        const r = rel(page.querySelector('.fid.' + k));
        fid[k] = [r.x + r.w / 2, r.y + r.h / 2];
      });
      const cells = [...page.querySelectorAll('.cell')].map(c => {
        const r = rel(c.querySelector('.write'));
        return { label: c.querySelector('.tag').textContent.trim(),
                 x: r.x, y: r.y, w: r.w, h: r.h };
      });
      const lines = [...page.querySelectorAll('.line-box')].map(e => rel(e));
      out.push({ page: i + 1, pw: pr.width, ph: pr.height, fid, cells, lines });
    });
    return out;
  });

  fs.writeFileSync('template_model.json', JSON.stringify(model, null, 1));
  for (const m of model)
    console.log(`page ${m.page}: ${m.pw.toFixed(0)}x${m.ph.toFixed(0)}px  cells=${m.cells.length}  lines=${m.lines.length}  fid.tl=${m.fid.tl.map(v=>v.toFixed(0))}`);
  await b.close();
})();
