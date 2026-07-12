// Renders recent public GitHub activity as a Person of Interest style
// "surveillance log" SVG (dark + light), written to assets/.
// Runs daily via .github/workflows/surveillance.yml. No dependencies.
const fs = require('fs');
const path = require('path');

const USER = 'vale-c';
const OUT_DIR = path.join(__dirname, 'assets');
const FONT_B64 = fs
  .readFileSync(path.join(__dirname, 'assets', 'fonts', 'fm-subset.woff2'))
  .toString('base64');

// dark = the Machine watching; light = Samaritan watching
const THEMES = {
  dark: {
    bg: '#0A0A0C',
    panelEdge: '#1E1E23',
    text: '#EDEDEF',
    dim: '#8A8A92',
    faint: '#5A5A62',
    accent: '#F5C400',
    red: '#E03131',
    rule: '#26262B',
    sweep: '#FFFFFF',
    scanOpacity: '0.022',
    title: 'SURVEILLANCE LOG // LAST INTERCEPTS',
    live: 'LIVE',
  },
  light: {
    bg: '#F3F4F6',
    panelEdge: '#DBDDE2',
    text: '#1B1C1F',
    dim: '#6C6E74',
    faint: '#989AA1',
    accent: '#C1272D',
    red: '#C1272D',
    rule: '#D7D9DE',
    sweep: '#000000',
    scanOpacity: '0.014',
    title: 'THREAT ANALYSIS // RECENT ACTIVITY',
    live: 'TRACKING',
  },
};

const MAX_ROWS = 6;

async function fetchEvents() {
  const headers = { 'User-Agent': USER, Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(
    `https://api.github.com/users/${USER}/events/public?per_page=60`,
    { headers }
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

function classify(event) {
  const repo = event.repo.name.replace(`${USER}/`, '');
  const hour = new Date(event.created_at).getUTCHours();
  const nocturnal = hour >= 23 || hour < 6;

  switch (event.type) {
    case 'PushEvent': {
      const n = event.payload.size || 1;
      return {
        push: { repo, commits: n },
        action: `PUSHED ${n} COMMIT${n === 1 ? '' : 'S'} TO ${repo}`,
        tag: nocturnal ? 'NOCTURNAL' : n >= 3 ? 'PRODUCTIVE' : 'BENIGN',
      };
    }
    case 'PullRequestEvent': {
      const pr = event.payload.pull_request;
      if (event.payload.action === 'closed' && pr.merged) {
        return { action: `MERGED PR #${pr.number} — ${repo}`, tag: 'ASSET CONFIRMED' };
      }
      if (event.payload.action === 'opened') {
        return { action: `OPENED PR #${pr.number} — ${repo}`, tag: 'PRODUCTIVE' };
      }
      return null;
    }
    case 'IssuesEvent':
      if (event.payload.action !== 'opened') return null;
      return { action: `FILED INTEL REPORT — ${repo}`, tag: 'NOTED' };
    case 'IssueCommentEvent':
    case 'PullRequestReviewEvent':
      return { action: `TRANSMISSION SENT — ${repo}`, tag: 'BENIGN' };
    case 'WatchEvent':
      return { action: `FLAGGED TARGET ${event.repo.name}`, tag: 'CURIOSITY' };
    case 'ForkEvent':
      return { action: `CLONED ASSET ${event.repo.name}`, tag: 'ACQUISITION' };
    case 'CreateEvent':
      if (event.payload.ref_type === 'repository') {
        return { action: `NEW OPERATION: ${repo}`, tag: 'MONITORING' };
      }
      return null;
    case 'ReleaseEvent':
      return {
        action: `DEPLOYED ${event.payload.release.tag_name} — ${repo}`,
        tag: 'CLEARED',
      };
    default:
      return null;
  }
}

function timestamp(iso) {
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function truncate(s, max) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Fragment Mono advance width ~0.6em
const adv = (chars, size, ls = 0) => chars * (size * 0.6 + ls);

function render(t, rows) {
  const W = 1000;
  const rowStart = 92;
  const rowStep = 30;
  const H = rowStart + rows.length * rowStep + 12;
  const fontFace = `@font-face{font-family:'FM';src:url(data:font/woff2;base64,${FONT_B64}) format('woff2');}`;

  const rowSvg = rows
    .map((r, i) => {
      const delay = 0.2 + i * 0.15;
      const total = delay + 0.35;
      const k = (delay / total).toFixed(3);
      const y = rowStart + i * rowStep;
      return `<g><animate attributeName="opacity" values="0;0;1" keyTimes="0;${k};1" dur="${total}s" begin="0s" fill="freeze"/>
  <text x="48" y="${y}" font-size="13" letter-spacing="1" fill="${t.faint}">${r.time}</text>
  <text x="192" y="${y}" font-size="13" letter-spacing="1" fill="${t.text}">${escapeXml(truncate(r.action, 54))}</text>
  <text x="952" y="${y}" text-anchor="end" font-size="13" letter-spacing="1" fill="${t.accent}">[ ${r.tag} ]</text>
</g>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Surveillance log of recent GitHub activity">
<title>SURVEILLANCE LOG</title>
<style>${fontFace}text{font-family:'FM',ui-monospace,Menlo,monospace}</style>
<rect width="${W}" height="${H}" rx="8" fill="${t.bg}"/>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="7" fill="none" stroke="${t.panelEdge}" stroke-width="1.5"/>
<defs>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="1.5" fill="${t.sweep}" opacity="${t.scanOpacity}"/>
  </pattern>
</defs>
<rect width="${W}" height="${H}" rx="8" fill="url(#scan)"/>
<text x="48" y="46" font-size="13" letter-spacing="3" fill="${t.dim}">${t.title}</text>
<g>
  <animate attributeName="opacity" values="1;0" keyTimes="0;0.55" calcMode="discrete" dur="1.5s" begin="0s" repeatCount="indefinite"/>
  <circle cx="${952 - adv(t.live.length, 13, 3) - 16}" cy="41.5" r="4.5" fill="${t.red}"/>
  <text x="952" y="46" text-anchor="end" font-size="13" letter-spacing="3" fill="${t.red}">${t.live}</text>
</g>
<line x1="48" y1="62" x2="952" y2="62" stroke="${t.rule}" stroke-width="1.5"/>
${rowSvg}
</svg>`;
}

async function main() {
  let rows;
  try {
    const events = await fetchEvents();
    rows = events
      .map(e => {
        const c = classify(e);
        return c && { time: timestamp(e.created_at), ...c };
      })
      .filter(Boolean)
      // consecutive pushes to the same repo collapse into one intercept
      .reduce((acc, r) => {
        const prev = acc[acc.length - 1];
        if (r.push && prev?.push && prev.push.repo === r.push.repo) {
          prev.push.commits += r.push.commits;
          const n = prev.push.commits;
          prev.action = `PUSHED ${n} COMMIT${n === 1 ? '' : 'S'} TO ${prev.push.repo}`;
          if (prev.tag === 'BENIGN' && n >= 3) prev.tag = 'PRODUCTIVE';
          return acc;
        }
        acc.push(r);
        return acc;
      }, [])
      .slice(0, MAX_ROWS);
  } catch (error) {
    console.error('Event fetch failed; keeping previous log:', error.message);
    return;
  }

  if (rows.length === 0) {
    rows = [{ time: '--.-- --:--', action: 'NO ACTIVITY INTERCEPTED. SUBJECT DARK.', tag: 'SEARCHING' }];
  }

  for (const [mode, theme] of Object.entries(THEMES)) {
    fs.writeFileSync(path.join(OUT_DIR, `surveillance-log-${mode}.svg`), render(theme, rows));
  }
  console.log(`Surveillance log rendered with ${rows.length} intercept(s).`);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
