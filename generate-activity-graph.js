// Renders the last 31 days of GitHub contributions as a themed line/area
// SVG (dark bg #0A0A0C, yellow #F5C400). Written to assets/.
// Runs daily via .github/workflows/activity-graph.yml. No dependencies.
// Native SVG only: no <script>, onload, or <foreignObject> (GitHub camo-safe).
const fs = require('fs');
const path = require('path');

const USER = 'vale-c';
const DAYS = 31;
const OUT_PATH = path.join(__dirname, 'assets', 'contribution-activity-graph.svg');

const THEME = {
  bg: '#0A0A0C',
  panelEdge: '#1E1E23',
  text: '#EDEDEF',
  dim: '#8A8A92',
  faint: '#5A5A62',
  accent: '#F5C400',
  rule: '#26262B',
  grid: '#1B1B20',
  point: '#EDEDEF',
  areaOpacity: '0.133', // #F5C40022
  title: 'CONTRIBUTION FEED',
};

const QUERY = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

async function fetchContributionDays() {
  const headers = {
    'User-Agent': USER,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map(e => e.message).join('; '));
  }
  const weeks = body.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks) throw new Error('Unexpected GraphQL shape');
  return weeks.flatMap(w => w.contributionDays);
}

function lastNDays(days, n) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.slice(-n);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function labelDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function niceMax(value) {
  if (value <= 0) return 1;
  const padded = Math.ceil(value * 1.15);
  const mag = 10 ** Math.floor(Math.log10(padded));
  const norm = padded / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function linePath(points) {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

function areaPath(points, baselineY) {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return [
    `M${first.x.toFixed(2)},${baselineY.toFixed(2)}`,
    linePath(points).replace(/^M/, 'L'),
    `L${last.x.toFixed(2)},${baselineY.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function pickXTicks(days) {
  const last = days.length - 1;
  const step = Math.max(1, Math.round(last / 5));
  const ticks = [];
  for (let i = 0; i <= last; i += step) ticks.push(i);
  if (ticks[ticks.length - 1] !== last) ticks.push(last);
  return ticks;
}

function render(days) {
  const W = 1000;
  const H = 280;
  const padL = 64;
  const padR = 36;
  const padT = 72;
  const padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const baselineY = padT + plotH;

  const counts = days.map(d => d.contributionCount);
  const rawMax = Math.max(0, ...counts);
  const yMax = niceMax(rawMax);
  const n = Math.max(days.length, 1);

  const points = days.map((d, i) => {
    const x = padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const y = padT + (1 - d.contributionCount / yMax) * plotH;
    return { x, y, count: d.contributionCount, date: d.date };
  });

  const yTicks = [0, yMax / 2, yMax].map(v => Math.round(v));
  const uniqueY = [...new Set(yTicks)];
  const grid = uniqueY
    .map(v => {
      const y = padT + (1 - v / yMax) * plotH;
      return `<line x1="${padL}" y1="${y.toFixed(2)}" x2="${W - padR}" y2="${y.toFixed(2)}" stroke="${THEME.grid}" stroke-width="1"/>
  <text x="${padL - 12}" y="${(y + 4).toFixed(2)}" text-anchor="end" font-size="12" letter-spacing="1" fill="${THEME.faint}">${v}</text>`;
    })
    .join('\n  ');

  const xLabels = pickXTicks(days)
    .map(i => {
      const p = points[i];
      return `<text x="${p.x.toFixed(2)}" y="${H - 16}" text-anchor="middle" font-size="12" letter-spacing="1" fill="${THEME.faint}">${labelDate(days[i].date)}</text>`;
    })
    .join('\n  ');

  const dots = points
    .map(
      p =>
        `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3.2" fill="${THEME.point}"/>`
    )
    .join('\n  ');

  const total = counts.reduce((a, b) => a + b, 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="1000" height="280" role="img" aria-label="contribution activity graph">
<title>${escapeXml(THEME.title)}</title>
<style>text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}</style>
<rect width="${W}" height="${H}" rx="8" fill="${THEME.bg}"/>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="7" fill="none" stroke="${THEME.panelEdge}" stroke-width="1.5"/>
<text x="48" y="40" font-size="13" letter-spacing="3" fill="${THEME.dim}">${escapeXml(THEME.title)}</text>
<text x="${W - 36}" y="40" text-anchor="end" font-size="12" letter-spacing="1" fill="${THEME.faint}">${DAYS}D // ${total}</text>
${grid}
  <path d="${areaPath(points, baselineY)}" fill="${THEME.accent}" fill-opacity="${THEME.areaOpacity}"/>
  <path d="${linePath(points)}" fill="none" stroke="${THEME.accent}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}
  ${xLabels}
</svg>
`;
}

async function main() {
  let days;
  try {
    days = lastNDays(await fetchContributionDays(), DAYS);
  } catch (error) {
    console.error('Contribution fetch failed; keeping previous graph:', error.message);
    return;
  }

  if (days.length === 0) {
    const today = new Date();
    days = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - (DAYS - 1 - i));
      return { date: d.toISOString().slice(0, 10), contributionCount: 0 };
    });
  }

  fs.writeFileSync(OUT_PATH, render(days));
  console.log(`Activity graph rendered with ${days.length} day(s).`);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
