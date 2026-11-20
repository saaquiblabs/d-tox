// Made-up YouTube content for the product page (#27): no real creator, face, title or channel.
// The Home scene's feed (public/feed) and the before/after captures (capture-shots.mjs, which
// swaps it into live YouTube before each screenshot) both come from here. Thumbnails are generated
// SVG: loud on purpose, because they stand for the noise D-Tox hides.

// [title, channel, views, age, duration, thumbnail style, word on the thumbnail]
const V = [
  ['I Survived 7 Days in a Glass Box', 'Daily Dose of Wow', '41M', '3d ago', '24:10', 'burst', 'DAY 7'],
  ['Final Over Thriller | Full Match Highlights', 'Pitchside Highlights', '2.8M', '9h ago', '11:42', 'pitch', 'HIGHLIGHTS'],
  ['Try Not to Laugh: 100 Fails in 10 Minutes', 'Laugh Track Central', '860K', '6h ago', '10:03', 'burst', 'FAILS'],
  ['I Built a Secret Water Park in Blocky World', 'Blocky Builds', '1.4M', '4d ago', '16:20', 'stack', 'SECRET?!'],
  ['Cheap vs Expensive Phone: The Blind Test', 'Tech Tonight', '3.3M', '1w ago', '18:47', 'split', 'VS'],
  ['Last One in the Circle Wins It All', 'Daily Dose of Wow', '92M', '2w ago', '21:36', 'burst', 'WIN'],
  ['Day 1 Extended Highlights | Second Test', 'Pitchside Highlights', '1.2M', '1d ago', '27:50', 'pitch', 'DAY 1'],
  ['Funniest Pets of the Week', 'Laugh Track Central', '2K', '11h ago', '2:01:39', 'burst', 'WEEK 47'],
  ['Rich vs Poor Mini Base Battle', 'Blocky Builds', '329K', '10h ago', '28:05', 'split', 'RICH?'],
  ['I Ate Only Street Food for 30 Days', 'Kitchen Chaos', '5.6M', '3w ago', '19:12', 'burst', '30 DAYS'],
  ['This Gadget Should Not Exist', 'Tech Tonight', '780K', '2d ago', '12:08', 'stack', 'WHY?!'],
  ['Pranking My Roommate for a Whole Week', 'The Prank Lab', '2.1M', '5d ago', '15:44', 'burst', 'PRANK'],
  ['Top 10 Catches Nobody Expected', 'Pitchside Highlights', '4.4M', '1mo ago', '13:31', 'pitch', 'TOP 10'],
  ['Every Level, Blindfolded', 'Speedrun Studio', '640K', '2d ago', '42:18', 'stack', 'BLIND'],
  ['We Tried the Spiciest Noodles Again', 'Kitchen Chaos', '3.9M', '6d ago', '17:55', 'burst', 'LEVEL 9'],
  ['Reacting to My First Ever Video', 'The Prank Lab', '1.7M', '2w ago', '14:22', 'split', 'THEN'],
];
const S = [
  ['Wait for the end', 'burst', 'WAIT'], ['He did not see it coming', 'split', 'OOPS'], ['Fastest catch ever?', 'pitch', 'CATCH'],
  ['1 vs 100 blocks', 'stack', '1 vs 100'], ['This trick should be illegal', 'burst', 'HOW?'], ['POV: Monday morning', 'split', 'POV'],
  ['Rate this build 1 to 10', 'stack', 'RATE'], ['The ending though', 'burst', 'END'],
];
// The search page ("python tutorial") and the watch page: what a Learner came for.
const L = [
  ['Python Full Course for Beginners: Learn It in One Video', 'Code Garden', '12M', '2 years ago', '4:26:51', 'PYTHON'],
  ['Python Basics in 15 Minutes', 'Byte Size Lessons', '3.4M', '1 year ago', '15:02', 'BASICS'],
  ['Learn Python by Building 5 Small Projects', 'Build Along', '2.3M', '1 year ago', '3:02:10', 'PROJECTS'],
  ['Pandas from Zero: Python for Data Analysis', 'Data Desk', '940K', '8 months ago', '1:12:40', 'PANDAS'],
  ['Functions and Loops, Explained Slowly', 'Code Garden', '610K', '5 months ago', '28:33', 'LOOPS'],
  ['Python Tutorial for Absolute Beginners #1', 'Learn With Meera', '1.8M', '3 years ago', '22:16', 'START'],
  ['Object-Oriented Python, Clearly Explained', 'Byte Size Lessons', '720K', '10 months ago', '41:05', 'CLASSES'],
  ['Let Python Do Your Spreadsheets', 'Build Along', '455K', '4 months ago', '33:48', 'EXCEL'],
];

const id = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
export const videos = V.map(([title, channel, views, age, dur, style, word]) => ({ id: id(title), title, channel, views, age, dur, style, word }));
export const shorts = S.map(([title, style, word]) => ({ id: 's-' + id(title), title, style, word }));
export const lessons = L.map(([title, channel, views, age, dur, word]) => ({ id: 'l-' + id(title), title, channel, views, age, dur, style: 'lesson', word }));
export const watch = {
  ...lessons[0], subs: '2.4M subscribers', likes: '310K',
  description: 'Everything you need to start with Python, in order: variables, types, loops, functions, files and a first project. Chapters below; the code is linked in the pinned comment.',
};
export const comments = [
  ['Asha R', 'Finally a course that goes slowly enough. Chapter 4 made functions click for me.'],
  ['dev_tomas', 'Watched this with the notes open, did every exercise. Day 6 and I wrote my first script.'],
  ['Priya Learns', 'The project at the end ties it all together. Thank you for no filler.'],
  ['Kenji M', 'Timestamps saved me. Came back for the file handling part twice.'],
];

// Thumbnails. Same seed, same picture.
const PAL = [['#FF3D3D', '#FFB800'], ['#7C3AED', '#22D3EE'], ['#00C853', '#FFEB3B'], ['#FF4081', '#536DFE'], ['#FF6D00', '#00E5FF'], ['#E91E63', '#FFEA00'], ['#2962FF', '#FF1744'], ['#00BFA5', '#FF9100']];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const word = (w, x, y, size, fill = '#fff', anchor = 'middle', rot = -4) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" transform="rotate(${rot} ${x} ${y})" font-family="Impact,'Arial Black',Arial,sans-serif" font-weight="900" font-size="${size}" fill="${fill}" stroke="#000" stroke-width="${(size / 9).toFixed(1)}" paint-order="stroke" letter-spacing="1">${esc(w)}</text>`;

export function thumb({ id: seed, style, word: w }, tall = false) {
  const W = tall ? 360 : 640, H = tall ? 640 : 360, h = hash(seed), [a, b] = PAL[h % PAL.length], k = W / 640;
  let art = '';
  if (style === 'lesson') {
    // A calm one: an editor with code, a word, a small accent.
    const lines = Array.from({ length: 9 }, (_, i) => `<rect x="${60 + ((i * 7 + h) % 3) * 28}" y="${92 + i * 26}" width="${90 + ((h >>> i) % 7) * 34}" height="10" rx="5" fill="${['#7DD3FC', '#C4B5FD', '#86EFAC', '#FDE68A'][(i + h) % 4]}" opacity=".75"/>`).join('');
    return svg(W, H, `<rect width="${W}" height="${H}" fill="#0F172A"/><rect x="36" y="56" width="${W - 72}" height="${H - 92}" rx="14" fill="#1E293B"/>`
      + `<circle cx="62" cy="76" r="6" fill="#F87171"/><circle cx="82" cy="76" r="6" fill="#FBBF24"/><circle cx="102" cy="76" r="6" fill="#34D399"/>${lines}`
      + `<rect x="${W - 300}" y="${H - 132}" width="250" height="78" rx="12" fill="${a}"/>`
      + `<text x="${W - 175}" y="${H - 78}" text-anchor="middle" font-family="'Arial Black',Arial,sans-serif" font-weight="900" font-size="${w.length > 7 ? 34 : 44}" fill="#fff">${esc(w)}</text>`);
  }
  if (style === 'burst') {
    const rays = Array.from({ length: 16 }, (_, i) => { const t = (i / 16) * Math.PI * 2, u = t + Math.PI / 16; return `<path d="M${W / 2} ${H / 2}L${W / 2 + Math.cos(t) * W} ${H / 2 + Math.sin(t) * W}L${W / 2 + Math.cos(u) * W} ${H / 2 + Math.sin(u) * W}Z" fill="${b}" opacity=".55"/>`; }).join('');
    art = `<rect width="${W}" height="${H}" fill="${a}"/>${rays}<circle cx="${W * (.25 + (h % 5) / 10)}" cy="${H * .55}" r="${90 * k + 30}" fill="#fff" opacity=".9"/><circle cx="${W * (.25 + (h % 5) / 10)}" cy="${H * .55}" r="${60 * k + 20}" fill="${b}"/>`
      + `<path d="M${W * .8} ${H * .6}l${40 * k} ${70 * k}h${-80 * k}z" fill="#FFF" stroke="#000" stroke-width="6"/>`;
  } else if (style === 'split') {
    art = `<rect width="${W}" height="${H}" fill="${a}"/><path d="M${W * .58} 0H${W}V${H}H${W * .42}Z" fill="${b}"/><rect x="${W * .14}" y="${H * .3}" width="${W * .22}" height="${H * .5}" rx="18" fill="#000" opacity=".35"/><rect x="${W * .64}" y="${H * .24}" width="${W * .22}" height="${H * .56}" rx="18" fill="#fff" opacity=".5"/>`;
  } else if (style === 'pitch') {
    const stripes = Array.from({ length: 8 }, (_, i) => `<rect x="0" y="${i * H / 8}" width="${W}" height="${H / 16}" fill="#000" opacity=".08"/>`).join('');
    art = `<rect width="${W}" height="${H}" fill="#1B8F3A"/>${stripes}<ellipse cx="${W / 2}" cy="${H * .62}" rx="${W * .38}" ry="${H * .16}" fill="none" stroke="#fff" stroke-width="5" opacity=".6"/><rect x="0" y="0" width="${W * .42}" height="${H}" fill="${a}" opacity=".85"/><circle cx="${W * .7}" cy="${H * .42}" r="${26 * k + 8}" fill="#E53935" stroke="#fff" stroke-width="4"/>`;
  } else {
    const blocks = Array.from({ length: 14 }, (_, i) => `<rect x="${((i * 97 + h) % 12) * W / 12}" y="${H * .45 + ((i * 53 + h) % 5) * H / 10}" width="${W / 12}" height="${W / 12}" fill="${i % 3 ? b : '#6D4C41'}" stroke="#000" stroke-opacity=".3" stroke-width="3"/>`).join('');
    art = `<rect width="${W}" height="${H}" fill="#4FC3F7"/><rect y="${H * .6}" width="${W}" height="${H * .4}" fill="#43A047"/>${blocks}<rect x="${W * .62}" y="${H * .22}" width="${W * .16}" height="${W * .16}" fill="${a}" stroke="#000" stroke-width="5"/>`;
  }
  const size = (tall ? 78 : 92) * (w.length > 7 ? .7 : 1);
  return svg(W, H, art + word(w, tall ? W / 2 : W * .5, tall ? H * .3 : H * .36, size, '#FFF') + `<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#000" stroke-opacity=".15" stroke-width="2"/>`);
}

export function avatar(name, size = 88) {
  const c = ['#E5484D', '#7C3AED', '#0EA5E9', '#F59E0B', '#22C55E', '#EC4899', '#14B8A6', '#F97316'][hash(name) % 8];
  return svg(size, size, `<rect width="${size}" height="${size}" fill="${c}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Roboto,Arial,sans-serif" font-size="${size * .45}" fill="#fff">${esc(name[0].toUpperCase())}</text>`);
}

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
export const dataUrl = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
