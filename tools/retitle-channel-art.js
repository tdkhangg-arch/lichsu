// Put the new channel name "StickDad History" on the owner's banner and logo.
const fs = require("fs");
const { chromium } = require("playwright");
const S = process.argv[2] || __dirname;   // folder holding banner-notext.png
const NAME = "StickDad History";
const b64 = p => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
const fonts = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@700&family=Luckiest+Guy&display=block">`;
const grad = id => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset=".55" stop-color="#ffc21f"/><stop offset="1" stop-color="#f38a12"/></linearGradient>`;

// Banner: title where the old one was, same underline
const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440" viewBox="0 0 2560 1440">
<defs>${grad("g")}<filter id="sh"><feDropShadow dx="0" dy="6" stdDeviation="2" flood-color="#000" flood-opacity=".35"/></filter></defs>
<image href="${b64(S + "/banner-notext.png")}" width="2560" height="1440"/>
<g font-family="Fredoka, sans-serif" font-weight="700" font-size="118" text-anchor="middle" filter="url(#sh)">
  <text x="1515" y="700" fill="none" stroke="#1c1b22" stroke-width="24" stroke-linejoin="round">${NAME}</text>
  <text x="1515" y="700" fill="none" stroke="#d9690e" stroke-width="8" stroke-linejoin="round">${NAME}</text>
  <text x="1515" y="700" fill="url(#g)">${NAME}</text>
</g>
<rect x="1130" y="742" width="745" height="11" rx="5.5" fill="rgb(175,58,49)"/>
</svg>`;

// Logo: curved ribbon over the old arc title, new name on the ribbon
const cx = 1003, cy = 851, rIn = 915, rOut = 1195, a0 = 147, a1 = 33;
const pt = (r, a) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)].map(v => v.toFixed(1)).join(",");
const band = (ri, ro, s, e) => `M${pt(ro, s)} A${ro},${ro} 0 0,0 ${pt(ro, e)} L${pt(ri, e)} A${ri},${ri} 0 0,1 ${pt(ri, s)} Z`;
const tail = (s, dir) => { // notched ribbon end, tucked behind the band
  const e = s + dir * 9, m = s + dir * 6;
  return `M${pt(rOut - 25, s)} L${pt(rOut - 25, e)} L${pt((rIn + rOut) / 2, m)} L${pt(rIn + 25, e)} L${pt(rIn + 25, s)} Z`;
};
const rText = 1098;
const K = 0.82;   // logo scaled into the frame so YouTube's round crop keeps everything
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let STARS = "";
for (let i = 0; i < 70; i++) {
  const x = rnd() * 2000, y = rnd() * 2000;
  if (Math.abs(x - 1000) < 1000 * K - 40 && Math.abs(y - 1000) < 1000 * K - 40) continue;  // only in the new margin
  const r = 2 + rnd() * 5;
  STARS += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="#fff4c2" opacity="${(0.5 + rnd() * 0.5).toFixed(2)}"/>`;
}
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000" viewBox="0 0 2000 2000">
<defs>${grad("g")}<path id="arc" d="M${pt(rText, a0 - 2)} A${rText},${rText} 0 0,0 ${pt(rText, a1 + 2)}"/>
<filter id="sh"><feDropShadow dx="0" dy="10" stdDeviation="6" flood-color="#000" flood-opacity=".45"/></filter></defs>
<radialGradient id="sky" cx="1000" cy="1000" r="1414" gradientUnits="userSpaceOnUse"><stop offset=".5" stop-color="rgb(0,56,82)"/><stop offset="1" stop-color="rgb(1,24,54)"/></radialGradient>
<radialGradient id="fade" cx="1000" cy="1000" r="1000" gradientUnits="userSpaceOnUse"><stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
<mask id="soft"><rect width="2000" height="2000" fill="#000"/><rect x="60" y="60" width="1880" height="1880" rx="120" fill="#fff" filter="url(#blur)"/></mask>
<filter id="blur"><feGaussianBlur stdDeviation="40"/></filter>
<rect width="2000" height="2000" fill="url(#sky)"/>
${STARS}
<g transform="translate(1000 1000) scale(${K}) translate(-1000 -1000)">
<image href="${b64("/home/user/lichsu/channel/history-with-dad-logo.png")}" width="2000" height="2000" mask="url(#soft)"/>
<g filter="url(#sh)">
  <path d="${tail(a0 + 1, 1)}" fill="#7d1d18" stroke="#1c1b22" stroke-width="12" stroke-linejoin="round"/>
  <path d="${tail(a1 - 1, -1)}" fill="#7d1d18" stroke="#1c1b22" stroke-width="12" stroke-linejoin="round"/>
  <path d="${band(rIn, rOut, a0, a1)}" fill="#b8322b" stroke="#1c1b22" stroke-width="14" stroke-linejoin="round"/>
  <path d="${band(rIn + 22, rOut - 22, a0 - 0.8, a1 + 0.8)}" fill="none" stroke="#f2c14e" stroke-width="5"/>
</g>
<g font-family="'Luckiest Guy', sans-serif" font-size="172" letter-spacing="6">
  <text text-anchor="middle" fill="none" stroke="#1c1b22" stroke-width="26" stroke-linejoin="round"><textPath href="#arc" startOffset="50%">${NAME.toUpperCase()}</textPath></text>
  <text text-anchor="middle" fill="url(#g)"><textPath href="#arc" startOffset="50%">${NAME.toUpperCase()}</textPath></text>
</g>
</g>
</svg>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [svg, w, h, out] of [[banner, 2560, 1440, "/home/user/lichsu/channel/stickdad-banner.png"], [logo, 2000, 2000, "/home/user/lichsu/channel/stickdad-logo.png"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><head>${fonts}</head><body style="margin:0">${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
    console.log("wrote", out);
  }
  await browser.close();
})();
