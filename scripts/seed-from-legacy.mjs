import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const legacyDir = path.join(root, "data", "legacy");
const outFile = path.join(root, "supabase", "seed-rebuild.sql");

function readJson(file) {
  return JSON.parse(readFileSync(path.join(legacyDir, file), "utf8"));
}

function sql(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const teams = readJson("teams.json");
const players = readJson("players.json");
const games = readJson("games.json");
const articles = readJson("articles.json");
const boxScores = readJson("boxscores.json");
const gamecast = readJson("gamecast.json");

const lines = [
  "-- Generated from current SSN legacy JSON. Review before running in Supabase.",
  "insert into public.seasons (id, name, starts_on, ends_on, is_active) values ('2026-27', '2026-27 Morrison Academy Taipei Athletics', '2026-08-01', '2027-06-15', true) on conflict (id) do nothing;",
  "insert into public.sports (id, slug, name, season, summary) values ('basketball', 'basketball', 'Basketball', 'winter', 'Winter Broncos basketball schedules, rosters, live games, and box-score coverage.'), ('soccer', 'soccer', 'Soccer', 'fall', 'Boys fall soccer and girls spring soccer team pages, schedules, and results.'), ('volleyball', 'volleyball', 'Volleyball', 'fall', 'Girls fall volleyball and boys spring volleyball match schedules, rosters, and updates.'), ('swim', 'swim', 'Swim', 'fall', 'Fall swim meet information, announcements, and results links.'), ('track-field', 'track-field', 'Track and Field', 'spring', 'Spring track and field meet information, athlete lists, and results links.') on conflict (id) do update set slug = excluded.slug, name = excluded.name, season = excluded.season, summary = excluded.summary;",
];

const basketballTeamId = "MAT-BBB-V";
const teamIdAliases = { MAT: basketballTeamId };

function normalizeTeamId(teamId) {
  return teamIdAliases[teamId] || teamId;
}

const morrisonTeams = [
  [basketballTeamId, "basketball", "varsity-boys-basketball", "Broncos", "Morrison", "Varsity", "boys", "active"],
  ["MAT-GBB-V", "basketball", "varsity-girls-basketball", "Broncos", "Morrison", "Varsity", "girls", "active"],
  ["MAT-BSOC-V", "soccer", "varsity-boys-soccer", "Broncos", "Morrison", "Varsity", "boys", "completed"],
  ["MAT-GSOC-V", "soccer", "varsity-girls-soccer", "Broncos", "Morrison", "Varsity", "girls", "upcoming"],
  ["MAT-GVB-V", "volleyball", "varsity-girls-volleyball", "Broncos", "Morrison", "Varsity", "girls", "completed"],
  ["MAT-BVB-V", "volleyball", "varsity-boys-volleyball", "Broncos", "Morrison", "Varsity", "boys", "upcoming"],
  ["MAT-SWIM", "swim", "swim", "Broncos", "Morrison", "Team", "coed", "completed"],
  ["MAT-TRACK", "track-field", "track-and-field", "Broncos", "Morrison", "Team", "coed", "upcoming"],
];

for (const [id, sportId, slug, name, city, level, gender, seasonStatus] of morrisonTeams) {
  lines.push(
    `insert into public.teams (id, sport_id, slug, name, city, level, gender, conference, season_status) values (${sql(id)}, ${sql(sportId)}, ${sql(slug)}, ${sql(name)}, ${sql(city)}, ${sql(level)}, ${sql(gender)}, 'TISSA', ${sql(seasonStatus)}) on conflict (id) do update set sport_id = excluded.sport_id, slug = excluded.slug, name = excluded.name, city = excluded.city, level = excluded.level, gender = excluded.gender, conference = excluded.conference, season_status = excluded.season_status;`,
  );
}

for (const team of teams) {
  if (team.id === "MAT") continue;
  const slug = team.id === "MAT" ? "varsity-boys-basketball" : slugify(`${team.city} ${team.name}`);
  lines.push(
    `insert into public.teams (id, sport_id, slug, name, city, level, gender, conference, season_status) values (${sql(team.id)}, 'basketball', ${sql(slug)}, ${sql(team.name)}, ${sql(team.city)}, 'Opponent', 'opponent', ${sql(team.conference)}, 'active') on conflict (id) do update set slug = excluded.slug, name = excluded.name, city = excluded.city, level = excluded.level, gender = excluded.gender, conference = excluded.conference, season_status = excluded.season_status;`,
  );
}

for (const player of players) {
  const slug = slugify(player.name);
  lines.push(
    `insert into public.athletes (id, slug, full_name, bio) values (${sql(player.id)}, ${sql(slug)}, ${sql(player.name)}, ${sql(`${player.name} is part of the Morrison basketball pilot roster.`)}) on conflict (id) do update set slug = excluded.slug, full_name = excluded.full_name;`,
  );
  lines.push(
    `insert into public.athlete_seasons (athlete_id, season_id, team_id, jersey_number, position, grade, height, weight) values (${sql(player.id)}, '2026-27', ${sql(normalizeTeamId(player.teamId))}, ${player.number ?? "null"}, ${sql(player.position)}, '11', ${sql(player.height)}, ${sql(player.weight)}) on conflict (athlete_id, season_id, team_id) do update set jersey_number = excluded.jersey_number, position = excluded.position, height = excluded.height, weight = excluded.weight;`,
  );
}

const gameDates = ["2026-12-04T10:00:00+08:00", "2026-12-08T17:30:00+08:00", "2026-12-11T18:00:00+08:00"];
for (const [index, game] of games.entries()) {
  const status = game.live ? "live" : String(game.status).toLowerCase().includes("final") ? "final" : "scheduled";
  lines.push(
    `insert into public.games (id, season_id, sport_id, home_team_id, away_team_id, status, starts_at, location, home_score, away_score, clock) values (${sql(game.id)}, '2026-27', 'basketball', ${sql(normalizeTeamId(game.home.teamId))}, ${sql(normalizeTeamId(game.away.teamId))}, '${status}', ${sql(gameDates[index] || gameDates[0])}, ${sql(game.home.teamId === "MAT" ? "Morrison Academy Gym" : `${game.home.team} Gym`)}, ${game.home.score || 0}, ${game.away.score || 0}, '12:00') on conflict (id) do update set status = excluded.status, home_score = excluded.home_score, away_score = excluded.away_score;`,
  );
}

for (const article of articles) {
  lines.push(
    `insert into public.announcements (slug, title, category, summary, body, pinned, published_at, team_id, athlete_id) values (${sql(slugify(article.title))}, ${sql(article.title)}, 'team-news', ${sql(article.summary)}, ${sql(article.body)}, ${article.id === "a1"}, now(), ${sql(article.teamId ? normalizeTeamId(article.teamId) : null)}, ${sql(article.playerId)}) on conflict (slug) do update set title = excluded.title, summary = excluded.summary, body = excluded.body;`,
  );
}

for (const [gameId, plays] of Object.entries(gamecast)) {
  plays.slice(0, 8).forEach((play, index) => {
    lines.push(
      `insert into public.game_events (game_id, team_id, event_type, period, clock, points, description) values (${sql(gameId)}, ${sql(basketballTeamId)}, 'assist', 1, ${sql(`0${Math.max(1, 9 - index)}:00`)}, 0, ${sql(play)});`,
    );
  });
}

for (const [gameId, rows] of Object.entries(boxScores)) {
  for (const row of rows) {
    if ((row.pts || 0) > 0) {
      lines.push(
        `insert into public.game_events (game_id, team_id, athlete_id, event_type, period, clock, points, description) values (${sql(gameId)}, ${sql(normalizeTeamId(row.teamId))}, ${sql(row.playerId)}, 'field_goal_made', 1, '12:00', ${Math.min(row.pts, 2)}, ${sql(`${row.player} scoring event imported from legacy box score.`)});`,
      );
    }
  }
}

writeFileSync(outFile, `${lines.join("\n")}\n`);
console.log(`Wrote ${outFile}`);
