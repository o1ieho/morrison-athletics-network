import { cache } from "react";
import { supabase } from "@/lib/supabase";
import { 
  sports as fallbackSports, 
  teams as fallbackTeams,
  athletes as fallbackAthletes,
  games as fallbackGames,
  announcements as fallbackAnnouncements,
  gameEvents as fallbackGameEvents,
  mediaAssets as fallbackMediaAssets,
  coaches as fallbackCoaches,
  season as fallbackSeason
} from "@/lib/data";
import type { Announcement, Athlete, Coach, Game, GameEvent, MediaAsset, Sport, Team, TeamSeasonStatus } from "@/lib/types";
import { formatTeamName, slugify } from "@/lib/utils";

// Helper to format a game from DB format to our UI type
function mapGame(dbGame: any): Game {
  const homeTeamName = dbGame.home_team ? formatTeamName(dbGame.home_team) : dbGame.home_team_id;
  const awayTeamName = dbGame.away_team ? formatTeamName(dbGame.away_team) : dbGame.away_team_id;
  
  return {
    id: dbGame.id,
    slug: dbGame.id,
    seasonId: dbGame.season_id,
    sport: "Basketball",
    status: dbGame.status,
    displayStatus: dbGame.status === "live" ? "Live" : dbGame.status.charAt(0).toUpperCase() + dbGame.status.slice(1),
    startsAt: dbGame.starts_at,
    location: dbGame.location,
    away: { teamId: dbGame.away_team_id, team: awayTeamName, score: dbGame.away_score },
    home: { teamId: dbGame.home_team_id, team: homeTeamName, score: dbGame.home_score },
    leaders: "Game leaders will appear here", // We can compute this later
  };
}

function normalizeSeasonStatus(value?: string | null): TeamSeasonStatus {
  if (value === "upcoming" || value === "active" || value === "completed" || value === "not_offered") return value;
  return "active";
}

// Helper to format a team from DB format to our UI type
function mapTeam(dbTeam: any): Team {
  const sportName = dbTeam.sports?.name || dbTeam.sport?.name || dbTeam.sport_name || "Basketball";
  return {
    id: dbTeam.id,
    slug: dbTeam.slug,
    name: dbTeam.name,
    city: dbTeam.city,
    sportId: dbTeam.sport_id || "basketball",
    sport: sportName,
    level: dbTeam.level,
    gender: dbTeam.gender || undefined,
    conference: dbTeam.conference,
    record: "0-0", // Fetch from standings if needed
    seasonStatus: normalizeSeasonStatus(dbTeam.season_status || (dbTeam.active === false ? "not_offered" : "active")),
    isOpponent: dbTeam.gender === "opponent" || dbTeam.level === "Opponent",
  };
}

export const getSports = cache(async function getSports(): Promise<Sport[]> {
  const { data, error } = await supabase.from("sports").select("*").order("name");
  if (error || !data || data.length === 0) return fallbackSports;
  const dbSports = data.map((sport: any) => ({
    id: sport.id,
    slug: sport.slug || sport.id,
    name: sport.name,
    season: sport.season || "year-round",
    summary: sport.summary || `${sport.name} schedules, rosters, announcements, and results.`,
  }));
  const merged = new Map(fallbackSports.map((sport) => [sport.id, sport]));
  dbSports.forEach((sport) => merged.set(sport.id, sport));
  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
});

export const getTeams = cache(async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from("teams").select("*, sports(name, slug, season, summary)").order("sport_id").order("level");
  if (error || !data || data.length === 0) return fallbackTeams;
  const dbTeams = data.map(mapTeam);
  const merged = new Map(fallbackTeams.map((team) => [team.id, team]));
  dbTeams.forEach((team) => merged.set(team.id, team));
  return Array.from(merged.values());
});

export const getTeamBySlug = cache(async function getTeamBySlug(slug: string): Promise<Team | undefined> {
  const { data, error } = await supabase.from("teams").select("*, sports(name, slug, season, summary)").eq("slug", slug).single();
  if (error || !data) return fallbackTeams.find((team) => team.slug === slug);
  return mapTeam(data);
});

export const getAthletes = cache(async function getAthletes(): Promise<Athlete[]> {
  const { data, error } = await supabase
    .from("athletes")
    .select(`
      id, slug, full_name, bio,
      athlete_seasons(jersey_number, position, grade, height, weight, team_id)
    `);
  
  if (error || !data || data.length === 0) return fallbackAthletes;
  
  return data.map((dbAthlete: any) => {
    const seasonData = dbAthlete.athlete_seasons?.[0] || {};
    return {
      id: dbAthlete.id,
      slug: dbAthlete.slug,
      name: dbAthlete.full_name,
      teamId: seasonData.team_id || "MAT",
      number: seasonData.jersey_number,
      position: seasonData.position || "Unknown",
      grade: seasonData.grade || "11",
      height: seasonData.height,
      weight: seasonData.weight,
      bio: dbAthlete.bio || "",
      points: 0, // Compute later
      rebounds: 0,
      assists: 0,
      recentGames: [],
      teammates: [],
    };
  });
});

export const getAthleteBySlug = cache(async function getAthleteBySlug(slug: string): Promise<Athlete | undefined> {
  const { data, error } = await supabase
    .from("athletes")
    .select(`
      id, slug, full_name, bio,
      athlete_seasons(jersey_number, position, grade, height, weight, team_id)
    `)
    .eq("slug", slug)
    .single();
    
  if (error || !data) return fallbackAthletes.find(a => a.slug === slug);
  
  const seasonData = data.athlete_seasons?.[0] || {};
  return {
    id: data.id,
    slug: data.slug,
    name: data.full_name,
    teamId: seasonData.team_id || "MAT",
    number: seasonData.jersey_number,
    position: seasonData.position || "Unknown",
    grade: seasonData.grade || "11",
    height: seasonData.height,
    weight: seasonData.weight,
    bio: data.bio || "",
    points: 0,
    rebounds: 0,
    assists: 0,
    recentGames: [],
    teammates: [],
  };
});

export const getTeamAthletes = cache(async function getTeamAthletes(teamId: string): Promise<Athlete[]> {
  const { data, error } = await supabase
    .from("athlete_seasons")
    .select(`
      team_id, jersey_number, position, grade, height, weight,
      athletes(id, slug, full_name, bio)
    `)
    .eq("team_id", teamId);
    
  if (error || !data || data.length === 0) return fallbackAthletes.filter(a => a.teamId === teamId);
  
  return data.map((item: any) => ({
    id: item.athletes.id,
    slug: item.athletes.slug,
    name: item.athletes.full_name,
    teamId: item.team_id,
    number: item.jersey_number,
    position: item.position || "Unknown",
    grade: item.grade || "11",
    height: item.height,
    weight: item.weight,
    bio: item.athletes.bio || "",
    points: 0,
    rebounds: 0,
    assists: 0,
    recentGames: [],
    teammates: [],
  }));
});

export const getGames = cache(async function getGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select(`
      *,
      home_team:teams!home_team_id(name, city),
      away_team:teams!away_team_id(name, city)
    `)
    .order("starts_at", { ascending: true });
    
  if (error || !data || data.length === 0) return fallbackGames;
  return data.map(mapGame);
});

export const getGameById = cache(async function getGameById(gameId: string): Promise<Game | undefined> {
  const { data, error } = await supabase
    .from("games")
    .select(`
      *,
      home_team:teams!home_team_id(name, city),
      away_team:teams!away_team_id(name, city)
    `)
    .eq("id", gameId)
    .single();
    
  if (error || !data) return fallbackGames.find(g => g.id === gameId);
  return mapGame(data);
});

export const getTeamGames = cache(async function getTeamGames(teamId: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select(`
      *,
      home_team:teams!home_team_id(name, city),
      away_team:teams!away_team_id(name, city)
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("starts_at", { ascending: true });
    
  if (error || !data || data.length === 0) return fallbackGames.filter(g => g.home.teamId === teamId || g.away.teamId === teamId);
  return data.map(mapGame);
});

export const getAnnouncements = cache(async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });
    
  if (error || !data || data.length === 0) return fallbackAnnouncements;
  
  return data.map((a: any) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category as Announcement["category"],
    author: "Morrison Academy Taipei Athletics", // Placeholder, could map from created_by user
    summary: a.summary,
    body: a.body,
    publishedAt: a.published_at,
    pinned: a.pinned,
    coverImage: a.cover_image_url || "/media/basketball-court.svg",
    teamId: a.team_id,
    athleteId: a.athlete_id,
  }));
});

export const getAnnouncementBySlug = cache(async function getAnnouncementBySlug(slug: string): Promise<Announcement | undefined> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("slug", slug)
    .single();
    
  if (error || !data) return fallbackAnnouncements.find(a => a.slug === slug);
  
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    category: data.category as Announcement["category"],
    author: "Morrison Academy Taipei Athletics",
    summary: data.summary,
    body: data.body,
    publishedAt: data.published_at,
    pinned: data.pinned,
    coverImage: data.cover_image_url || "/media/basketball-court.svg",
    teamId: data.team_id,
    athleteId: data.athlete_id,
  };
});

export const getGameEvents = cache(async function getGameEvents(gameId: string): Promise<GameEvent[]> {
  const { data, error } = await supabase
    .from("game_events")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });
    
  if (error || !data || data.length === 0) return fallbackGameEvents.filter(e => e.gameId === gameId);
  
  return data.map((e: any) => ({
    id: e.id,
    gameId: e.game_id,
    teamId: e.team_id,
    athleteId: e.athlete_id,
    type: e.event_type,
    period: e.period,
    clock: e.clock,
    points: e.points,
    description: e.description,
    x: e.shot_x,
    y: e.shot_y,
  }));
});

export const getMediaAssets = cache(async function getMediaAssets(): Promise<MediaAsset[]> {
  const { data, error } = await supabase
    .from("media_assets")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (error || !data || data.length === 0) return fallbackMediaAssets;
  
  return data.map((m: any) => ({
    id: m.id,
    title: m.title,
    type: m.media_type as MediaAsset["type"],
    url: m.url,
    caption: m.caption,
    featured: m.featured,
    teamId: m.team_id,
    gameId: m.game_id,
    athleteId: m.athlete_id,
  }));
});

export const getCoaches = cache(async function getCoaches(): Promise<Coach[]> {
  const { data, error } = await supabase
    .from("coaches")
    .select(`*, coach_teams(team_id)`);
    
  if (error || !data || data.length === 0) return fallbackCoaches;
  
  return data.map((c: any) => ({
    id: c.id,
    name: c.full_name,
    title: c.title,
    teamIds: c.coach_teams?.map((ct: any) => ct.team_id) || [],
  }));
});

export const getAthleteStats = cache(async function getAthleteStats(athleteId: string) {
  // Aggregate from game_events or just return empty for now
  const source = fallbackAthletes.find((athlete) => athlete.id === athleteId);
  return {
    points: source?.points || 0,
    rebounds: source?.rebounds || 0,
    assists: source?.assists || 0,
  };
});

export const getSeason = cache(async function getSeason() {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .single();
  return data || fallbackSeason;
});
