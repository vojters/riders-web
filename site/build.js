const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'seasons');
const OUT_DIR = path.join(ROOT, 'docs');

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function seasonLabel(season) {
  const [y, m] = season.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function loadSeasons() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const seasons = fs.readdirSync(DATA_DIR).filter((f) =>
    fs.statSync(path.join(DATA_DIR, f)).isDirectory()
  );

  return seasons
    .map((season) => {
      const dir = path.join(DATA_DIR, season);
      const events = fs.readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          return { ...data, slug: f.replace(/\.json$/, '') };
        })
        .sort((a, b) => a.event_date.localeCompare(b.event_date));

      return { season, label: seasonLabel(season), events };
    })
    .sort((a, b) => b.season.localeCompare(a.season)); // newest first
}

function seasonLeaderboard(events) {
  const players = {}; // name -> { total, byEvent: {slug: points} }

  for (const ev of events) {
    for (const p of ev.players) {
      if (!players[p.name]) players[p.name] = { name: p.name, total: 0, byEvent: {} };
      players[p.name].byEvent[ev.slug] = p.points;
      players[p.name].total += p.points;
    }
  }

  return Object.values(players).sort((a, b) => b.total - a.total);
}

// ---------- templates ----------

function layout({ title, active, body }) {
  const nav = [
    ['/', 'Home'],
    ['/seasons/', 'Seasons'],
  ];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · CZE&SVK Riders</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${relRoot(active)}styles/style.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="${relRoot(active)}">
    <span class="brand-mark">CZE<span class="brand-amp">&amp;</span>SVK</span>
    <span class="brand-sub">Riders — Team Stats</span>
  </a>
  <nav>${nav.map(([href, label]) => `<a href="${relRoot(active)}${href.slice(1)}">${label}</a>`).join('')}</nav>
</header>
<main>
${body}
</main>
<footer class="site-footer">Timing data imported straight from event screenshots.</footer>
</body>
</html>`;
}

function relRoot(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

function scoreCell(score) {
  return score === null || score === undefined ? '<span class="dash">—</span>' : score.toLocaleString();
}

function buildHome(seasons) {
  const latest = seasons[0];
  const latestEvent = latest?.events[latest.events.length - 1];

  let hero;
  if (latestEvent) {
    const top3 = [...latestEvent.players].sort((a, b) => a.position - b.position).slice(0, 3);
    hero = `
    <section class="hero">
      <p class="hero-eyebrow">${latest.label} · Latest event</p>
      <h1>${latestEvent.team_event}</h1>
      <p class="hero-sub">${latestEvent.our_team} ${latestEvent.our_team_score.toLocaleString()} — ${latestEvent.opponent_score.toLocaleString()} ${latestEvent.opponent_team}</p>
      <ol class="podium">
        ${top3.map((p) => `<li><span class="podium-pos">${p.position}</span><span class="podium-name">${p.name}</span><span class="podium-score">${scoreCell(p.score)}</span></li>`).join('')}
      </ol>
      <a class="cta" href="seasons/${latest.season}/${latestEvent.slug}/">Full results</a>
    </section>`;
  } else {
    hero = `<section class="hero"><h1>No events imported yet</h1><p class="hero-sub">Run <code>!import</code> in Discord with a leaderboard screenshot to get started.</p></section>`;
  }

  const seasonList = seasons.slice(0, 6).map((s) => seasonCard(s, 0)).join('');

  return layout({
    title: 'Home',
    active: 0,
    body: `${hero}
    <section class="section">
      <h2>Recent seasons</h2>
      <div class="card-grid">${seasonList}</div>
    </section>`,
  });
}

function seasonCard(s, depth) {
  const link = `${relRoot(depth)}seasons/${s.season}/`;
  return `<a class="card" href="${link}">
    <span class="card-title">${s.label}</span>
    <span class="card-meta">${s.events.length} event${s.events.length === 1 ? '' : 's'}</span>
  </a>`;
}

function buildSeasonsIndex(seasons) {
  const body = `
  <section class="section">
    <h1>Seasons</h1>
    <div class="card-grid">${seasons.map((s) => seasonCard(s, 1)).join('')}</div>
  </section>`;
  return layout({ title: 'Seasons', active: 1, body });
}

function buildSeasonPage(s) {
  const board = seasonLeaderboard(s.events);
  const eventCols = s.events;

  const rows = board.map((p, i) => `
    <tr>
      <td class="rank">${i + 1}</td>
      <td class="name">${p.name}</td>
      ${eventCols.map((ev) => `<td class="num">${p.byEvent[ev.slug] ?? '<span class="dash">—</span>'}</td>`).join('')}
      <td class="num total">${p.total}</td>
    </tr>`).join('');

  const eventList = eventCols.map((ev) => `
    <a class="card" href="${ev.slug}/">
      <span class="card-title">${ev.team_event}</span>
      <span class="card-meta">${ev.event_date} · vs ${ev.opponent_team} · ${ev.our_team_score.toLocaleString()}–${ev.opponent_score.toLocaleString()}</span>
    </a>`).join('');

  const body = `
  <section class="section">
    <p class="hero-eyebrow"><a href="../">Seasons</a></p>
    <h1>${s.label}</h1>
    <div class="card-grid">${eventList}</div>
  </section>
  <section class="section">
    <h2>Season leaderboard</h2>
    <div class="table-wrap">
    <table class="stats-table">
      <thead><tr>
        <th>#</th><th>Player</th>
        ${eventCols.map((ev) => `<th class="num" title="${ev.team_event}">${ev.team_event.length > 12 ? ev.team_event.slice(0, 12) + '…' : ev.team_event}</th>`).join('')}
        <th class="num">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
  </section>`;

  return layout({ title: s.label, active: 2, body });
}

function buildEventPage(s, ev) {
  const players = [...ev.players].sort((a, b) => a.position - b.position);
  const winnerNote =
    ev.winner === 'us' ? 'Won' : ev.winner === 'opponent' ? 'Lost' : 'Result unclear';

  const rows = players.map((p) => `
    <tr>
      <td class="rank">${p.position}</td>
      <td class="name">${p.name}</td>
      <td class="num">${p.points}</td>
      <td class="num score">${scoreCell(p.score)}</td>
    </tr>`).join('');

  const body = `
  <section class="section">
    <p class="hero-eyebrow"><a href="../">${s.label}</a></p>
    <h1>${ev.team_event}</h1>
    <p class="hero-sub">${ev.event_date} · ${ev.our_team} ${ev.our_team_score.toLocaleString()} — ${ev.opponent_score.toLocaleString()} ${ev.opponent_team} · <strong>${winnerNote}</strong></p>
  </section>
  <section class="section">
    <div class="table-wrap">
    <table class="stats-table">
      <thead><tr><th>#</th><th>Player</th><th class="num">Points</th><th class="num">Score</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
  </section>`;

  return layout({ title: ev.team_event, active: 3, body });
}

function write(filePath, html) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html);
}

function build() {
  const seasons = loadSeasons();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'styles', 'style.css'), (() => {
    const dest = path.join(OUT_DIR, 'styles', 'style.css');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    return dest;
  })());

  write(path.join(OUT_DIR, 'index.html'), buildHome(seasons));
  write(path.join(OUT_DIR, 'seasons', 'index.html'), buildSeasonsIndex(seasons));

  for (const s of seasons) {
    write(path.join(OUT_DIR, 'seasons', s.season, 'index.html'), buildSeasonPage(s));
    for (const ev of s.events) {
      write(path.join(OUT_DIR, 'seasons', s.season, ev.slug, 'index.html'), buildEventPage(s, ev));
    }
  }

  console.log(`Built ${seasons.length} season(s) into /docs`);
}

if (require.main === module) build();

module.exports = { build };
