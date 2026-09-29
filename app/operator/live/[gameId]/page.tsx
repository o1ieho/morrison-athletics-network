"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import "@/app/operator-live.css";

// Basketball Actions mapping
const HOME_ACTIONS = [
  // Row 1
  { label: "2PT Made", type: "field_goal_made", pts: 2, class: "op-btn-green-make" },
  { label: "2PT Miss", type: "field_goal_made", pts: 0, class: "op-btn-red-miss" },
  { label: "3PT Made", type: "three_point_made", pts: 3, class: "op-btn-green-make" },
  { label: "3PT Miss", type: "three_point_made", pts: 0, class: "op-btn-red-miss" },
  { label: "FT Made", type: "free_throw_made", pts: 1, class: "op-btn-green-make" },
  { label: "FT Miss", type: "free_throw_made", pts: 0, class: "op-btn-red-miss" },
  { label: "Other", type: "assist", pts: 0, class: "op-btn-blue-gray" },
  // Row 2
  { label: "Steal", type: "steal", pts: 0, class: "op-btn-blue-gray" },
  { label: "Assist", type: "assist", pts: 0, class: "op-btn-blue-gray" },
  { label: "Rebound", type: "rebound", pts: 0, class: "op-btn-blue-gray" },
  { label: "Block", type: "block", pts: 0, class: "op-btn-blue-gray" },
  { label: "Turnover", type: "turnover", pts: 0, class: "op-btn-dark-red" },
  { label: "Foul", type: "foul", pts: 0, class: "op-btn-dark-red" },
  { label: "Timeout", type: "assist", pts: 0, class: "op-btn-blue-gray" }
];

const AWAY_ACTIONS = [
  { label: "Away 2PT Made", type: "field_goal_made", pts: 2, class: "op-btn-green-make" },
  { label: "Away 2PT Miss", type: "field_goal_made", pts: 0, class: "op-btn-red-miss" },
  { label: "Away 3PT Made", type: "three_point_made", pts: 3, class: "op-btn-green-make" },
  { label: "Away 3PT Miss", type: "three_point_made", pts: 0, class: "op-btn-red-miss" },
  { label: "Away FT Made", type: "free_throw_made", pts: 1, class: "op-btn-green-make" },
  { label: "Away FT Miss", type: "free_throw_made", pts: 0, class: "op-btn-red-miss" },
  { label: "Away Foul", type: "foul", pts: 0, class: "op-btn-dark-red" }
];

export default function OperatorGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const supabase = createBrowserClient();

  // Primary data states
  const [gamesList, setGamesList] = useState<any[]>([]);
  const [game, setGame] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  
  // Interface interactive states
  const [activePlayer, setActivePlayer] = useState<any>(null);
  const [shotCoords, setShotCoords] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");

  // Game Live Overrides
  const [gameTitle, setGameTitle] = useState("");
  const [gameStatus, setGameStatus] = useState("scheduled");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [homeFouls, setHomeFouls] = useState(0);
  const [awayFouls, setAwayFouls] = useState(0);
  const [homeTimeouts, setHomeTimeouts] = useState(0);
  const [awayTimeouts, setAwayTimeouts] = useState(0);

  // Period / Clock states
  const [period, setPeriod] = useState(1);
  const [minutes, setMinutes] = useState(12);
  const [seconds, setSeconds] = useState(0);
  const [clockRunning, setClockRunning] = useState(false);
  const [minPerQtr, setMinPerQtr] = useState(12);

  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load baseline game and lists
  const loadData = async () => {
    // Load all games for top dropdown selector
    const { data: allGames } = await supabase
      .from("games")
      .select("id, status, starts_at, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)")
      .order("starts_at", { ascending: false });
    
    if (allGames) setGamesList(allGames);

    // Load active game details
    const { data: activeGame, error: gameErr } = await supabase
      .from("games")
      .select("*, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)")
      .eq("id", gameId)
      .single();

    if (gameErr || !activeGame) {
      setLoading(false);
      return;
    }

    setGame(activeGame);
    setHomeScore(activeGame.home_score);
    setAwayScore(activeGame.away_score);
    setGameStatus(activeGame.status);
    setPeriod(activeGame.current_period);
    setGameTitle(`${activeGame.away_team?.name} @ ${activeGame.home_team?.name}`);

    // Parse existing clock string
    if (activeGame.clock) {
      const parts = activeGame.clock.split(":");
      if (parts.length === 2) {
        setMinutes(parseInt(parts[0]) || 12);
        setSeconds(parseInt(parts[1]) || 0);
      }
    }

    // Load home team roster athletes
    const { data: roster } = await supabase
      .from("athlete_seasons")
      .select("jersey_number, position, athletes(id, full_name, slug)")
      .eq("team_id", activeGame.home_team_id);
    
    if (roster) {
      const mapped = roster
        .map((r: any) => ({
          id: r.athletes.id,
          full_name: r.athletes.full_name,
          jersey_number: r.jersey_number || 0,
          position: r.position || "Player"
        }))
        .sort((a, b) => a.jersey_number - b.jersey_number);
      setAthletes(mapped);
    }

    // Load latest event logs (non-voided)
    const { data: eventLogs } = await supabase
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .is("voided_at", null)
      .order("created_at", { ascending: false });
    
    if (eventLogs) {
      setEvents(eventLogs);
      
      // Calculate team fouls and timeouts from events in current period
      const currentPeriodEvents = eventLogs.filter(e => e.period === activeGame.current_period);
      
      const hFouls = currentPeriodEvents.filter(e => e.team_id === activeGame.home_team_id && e.event_type === "foul").length;
      const aFouls = currentPeriodEvents.filter(e => e.team_id === activeGame.away_team_id && e.event_type === "foul").length;
      
      setHomeFouls(hFouls);
      setAwayFouls(aFouls);

      const hTimeouts = currentPeriodEvents.filter(e => e.team_id === activeGame.home_team_id && e.description.includes("Timeout")).length;
      const aTimeouts = currentPeriodEvents.filter(e => e.team_id === activeGame.away_team_id && e.description.includes("Timeout")).length;

      setHomeTimeouts(hTimeouts);
      setAwayTimeouts(aTimeouts);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (gameId) {
      loadData();
    }
  }, [gameId]);

  // Live countdown timer execution
  useEffect(() => {
    if (clockRunning) {
      clockIntervalRef.current = setInterval(() => {
        setSeconds((prevSec) => {
          if (prevSec === 0) {
            setMinutes((prevMin) => {
              if (prevMin === 0) {
                // Period expired
                setClockRunning(false);
                if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
                triggerPeriodEnd();
                return 0;
              }
              return prevMin - 1;
            });
            return 59;
          }
          return prevSec - 1;
        });
      }, 1000);
    } else {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    }

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    };
  }, [clockRunning]);

  const triggerPeriodEnd = async () => {
    if (!game) return;
    showToast(`Period Q${period} ended.`);
    await insertEventRaw({
      team_id: game.home_team_id,
      event_type: "assist",
      pts: 0,
      description: `End of Period Q${period}`,
      clockStr: "00:00"
    });
  };

  const getClockString = (min = minutes, sec = seconds) => {
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(""), 3000);
  };

  // Base raw event insertion
  const insertEventRaw = async (options: {
    team_id: string;
    athlete_id?: string | null;
    event_type: string;
    pts: number;
    description: string;
    clockStr?: string;
    x?: number | null;
    y?: number | null;
  }) => {
    if (!game) return;

    const currentClock = options.clockStr || getClockString();

    const { data: newEvent, error } = await supabase.from("game_events").insert({
      game_id: game.id,
      team_id: options.team_id,
      athlete_id: options.athlete_id || null,
      event_type: options.event_type,
      period: period,
      clock: currentClock,
      points: options.pts,
      description: options.description,
      shot_x: options.x || null,
      shot_y: options.y || null
    }).select().single();

    if (error) {
      showToast(`Error: ${error.message}`);
      return null;
    }

    // Refresh local events list
    const { data: eventLogs } = await supabase
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .is("voided_at", null)
      .order("created_at", { ascending: false });
    
    if (eventLogs) setEvents(eventLogs);
    return newEvent;
  };

  // Handle Home Team Action
  const handleHomeAction = async (action: typeof HOME_ACTIONS[0]) => {
    if (!game) return;

    const isShot = action.label.includes("2PT") || action.label.includes("3PT") || action.label.includes("FT");
    const isMiss = action.label.includes("Miss");

    let playerDesc = "Taipei Academy Tigers";
    if (activePlayer) {
      playerDesc = `#${activePlayer.jersey_number} ${activePlayer.full_name}`;
    }

    const description = `${playerDesc} - ${action.label}`;

    const newEvent = await insertEventRaw({
      team_id: game.home_team_id,
      athlete_id: activePlayer?.id || null,
      event_type: action.type,
      pts: action.pts,
      description,
      x: isShot ? shotCoords?.x : null,
      y: isShot ? shotCoords?.y : null
    });

    if (newEvent) {
      // Optimistic + Database score update
      if (action.pts > 0) {
        const nextScore = homeScore + action.pts;
        setHomeScore(nextScore);
        await supabase.from("games").update({ home_score: nextScore }).eq("id", game.id);
      }

      // Check for stats totals overrides (timeouts, fouls)
      if (action.label === "Foul") {
        setHomeFouls(prev => prev + 1);
      } else if (action.label === "Timeout") {
        setHomeTimeouts(prev => prev + 1);
      }

      showToast(`Logged: ${description}`);
      
      // Reset contextual states on action log
      setShotCoords(null);
      setActivePlayer(null);
    }
  };

  // Handle Away Team Action
  const handleAwayAction = async (action: typeof AWAY_ACTIONS[0]) => {
    if (!game) return;

    const description = `Away Team - ${action.label.replace("Away ", "")}`;

    const newEvent = await insertEventRaw({
      team_id: game.away_team_id,
      athlete_id: null,
      event_type: action.type,
      pts: action.pts,
      description
    });

    if (newEvent) {
      if (action.pts > 0) {
        const nextScore = awayScore + action.pts;
        setAwayScore(nextScore);
        await supabase.from("games").update({ away_score: nextScore }).eq("id", game.id);
      }

      if (action.label.includes("Foul")) {
        setAwayFouls(prev => prev + 1);
      }

      showToast(`Logged Away: ${action.label}`);
    }
  };

  // Manual Adjustments Scoreboard Row
  const handleScoreAdjust = async (team: "home" | "away", delta: number) => {
    if (!game) return;

    const teamId = team === "home" ? game.home_team_id : game.away_team_id;
    const teamName = team === "home" ? game.home_team?.name : game.away_team?.name;
    const currentScore = team === "home" ? homeScore : awayScore;
    const nextScore = Math.max(0, currentScore + delta);

    if (team === "home") setHomeScore(nextScore);
    else setAwayScore(nextScore);

    // Save update to games
    await supabase.from("games").update({
      [team === "home" ? "home_score" : "away_score"]: nextScore
    }).eq("id", game.id);

    // Insert correction log event
    await insertEventRaw({
      team_id: teamId,
      event_type: "assist",
      pts: 0,
      description: `Score correction: ${teamName} adjusted by ${delta > 0 ? "+" : ""}${delta}`
    });

    showToast(`${teamName} score adjusted.`);
  };

  // Period / Clock control button clicked
  const handlePeriodBtn = async (action: string) => {
    if (!game) return;

    if (action.includes("Start")) {
      const qNum = parseInt(action.match(/\d+/)?.join("") || "1");
      const isOT = action.includes("OT");
      const activeQ = isOT ? 5 : qNum;

      setPeriod(activeQ);
      setMinutes(minPerQtr);
      setSeconds(0);
      setGameStatus("live");
      setClockRunning(true);

      const periodLabel = isOT ? "Overtime" : `Quarter ${qNum}`;
      await insertEventRaw({
        team_id: game.home_team_id,
        event_type: "assist",
        pts: 0,
        description: `${periodLabel} Started`,
        clockStr: getClockString(minPerQtr, 0)
      });
      showToast(`${periodLabel} Started.`);
    } else if (action === "Pause") {
      setClockRunning(prev => !prev);
      showToast(clockRunning ? "Clock Paused." : "Clock Resumed.");
    } else if (action === "Reset") {
      setClockRunning(false);
      setMinutes(minPerQtr);
      setSeconds(0);
      showToast("Quarter Clock reset.");
    }
  };

  // Save full game state
  const handleSaveScore = async () => {
    if (!game) return;

    const { error } = await supabase.from("games").update({
      home_score: homeScore,
      away_score: awayScore,
      status: gameStatus,
      current_period: period,
      clock: getClockString()
    }).eq("id", game.id);

    if (error) {
      showToast(`Error saving: ${error.message}`);
    } else {
      showToast("Score & Game status updated successfully!");
    }
  };

  // Undo last action (void event & rollback points)
  const handleUndo = async () => {
    if (!game || events.length === 0) {
      showToast("No events to undo.");
      return;
    }

    const latestEvent = events[0];

    const { error } = await supabase
      .from("game_events")
      .update({ voided_at: new Date().toISOString() })
      .eq("id", latestEvent.id);

    if (error) {
      showToast(`Undo failed: ${error.message}`);
      return;
    }

    // Rollback score changes
    if (latestEvent.points > 0) {
      const isHome = latestEvent.team_id === game.home_team_id;
      if (isHome) {
        const nextScore = Math.max(0, homeScore - latestEvent.points);
        setHomeScore(nextScore);
        await supabase.from("games").update({ home_score: nextScore }).eq("id", game.id);
      } else {
        const nextScore = Math.max(0, awayScore - latestEvent.points);
        setAwayScore(nextScore);
        await supabase.from("games").update({ away_score: nextScore }).eq("id", game.id);
      }
    }

    showToast(`Undone: ${latestEvent.description}`);
    await loadData();
  };

  // Handle visual court click
  const handleCourtClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const xRaw = ((e.clientX - box.left) / box.width) * 100;
    const yRaw = ((e.clientY - box.top) / box.height) * 100;
    
    // Set mapped percentages
    setShotCoords({
      x: parseFloat(xRaw.toFixed(1)),
      y: parseFloat(yRaw.toFixed(1))
    });
    showToast(`Shot coordinates recorded: (${xRaw.toFixed(0)}%, ${yRaw.toFixed(0)}%)`);
  };

  if (loading) {
    return (
      <main className="operator-shell">
        <section style={{ textAlign: "center", padding: "100px 0" }}>
          <h2>Loading Game Operator...</h2>
        </section>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="operator-shell">
        <section style={{ textAlign: "center", padding: "100px 0" }}>
          <h2>Active game dashboard not found.</h2>
          <button className="op-btn-gray" onClick={() => router.push("/operator/live")}>Return to games list</button>
        </section>
      </main>
    );
  }

  return (
    <main className="operator-shell">
      {/* Top Notification Toast */}
      {statusMsg && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 1000,
          background: "#1e293b", border: "1px solid #3b82f6", color: "#f8fafc",
          padding: "10px 16px", borderRadius: 6, fontWeight: 700, fontSize: "0.85rem",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
        }}>
          {statusMsg}
        </div>
      )}

      {/* Header bar controls */}
      <header className="op-header-bar">
        <div className="op-header-brand" onClick={() => router.push("/operator/live")} style={{ cursor: "pointer" }}>
          Unified Live Dashboard
        </div>
        
        <div className="op-header-item">
          <label>Game:</label>
          <select 
            value={game.id} 
            onChange={(e) => router.push(`/operator/live/${e.target.value}`)}
            className="op-select"
          >
            {gamesList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.id}: {g.away_team?.name} @ {g.home_team?.name}
              </option>
            ))}
          </select>
        </div>

        <div className="op-header-item">
          <label>Game Label:</label>
          <input 
            type="text" 
            value={gameTitle} 
            onChange={(e) => setGameTitle(e.target.value)} 
            placeholder="Type game title"
            className="op-input"
            style={{ width: 160 }}
          />
        </div>

        <div className="op-header-item">
          <label>Status:</label>
          <select 
            value={gameStatus} 
            onChange={(e) => setGameStatus(e.target.value)}
            className="op-select"
          >
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="final">Final</option>
            <option value="postponed">Postponed</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

        <div className="op-header-item">
          <label>Clock:</label>
          <input 
            type="text" 
            value={getClockString()} 
            onChange={(e) => {
              const parts = e.target.value.split(":");
              if (parts.length === 2) {
                setMinutes(parseInt(parts[0]) || 0);
                setSeconds(parseInt(parts[1]) || 0);
              }
            }} 
            className="op-input op-input-clock"
          />
        </div>

        <div className="op-header-item">
          <label>Min/Qtr:</label>
          <input 
            type="number" 
            value={minPerQtr} 
            onChange={(e) => setMinPerQtr(parseInt(e.target.value) || 12)}
            className="op-input op-input-min"
          />
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="op-btn-red" onClick={handleSaveScore}>Save Score</button>
          <button className="op-btn-gray" onClick={handleUndo}>Undo</button>
        </div>
      </header>

      {/* Period start buttons */}
      <section className="op-period-bar">
        <button className={`op-period-btn ${period === 1 ? "active" : ""}`} onClick={() => handlePeriodBtn("Q1 Start")}>Q1 Start</button>
        <button className={`op-period-btn ${period === 2 ? "active" : ""}`} onClick={() => handlePeriodBtn("Q2 Start")}>Q2 Start</button>
        <button className={`op-period-btn ${period === 3 ? "active" : ""}`} onClick={() => handlePeriodBtn("Q3 Start")}>Q3 Start</button>
        <button className={`op-period-btn ${period === 4 ? "active" : ""}`} onClick={() => handlePeriodBtn("Q4 Start")}>Q4 Start</button>
        <button className={`op-period-btn ${period === 5 ? "active" : ""}`} onClick={() => handlePeriodBtn("OT Start")}>OT Start</button>
        <button className="op-period-btn" onClick={() => handlePeriodBtn("Pause")}>
          {clockRunning ? "Pause" : "Resume"}
        </button>
        <button className="op-period-btn" onClick={() => handlePeriodBtn("Reset")}>Reset/Quarter Stats</button>
        <span className="op-period-hint">Click to adjust Quarter / Status / OT starts</span>
      </section>

      {/* Scoreboard and Event Log grid */}
      <div className="op-scoreboard-row">
        {/* Core widget card */}
        <section className="op-score-card">
          {/* Home team */}
          <div className="op-team-score-block">
            <h3 className="op-team-name">{game.home_team?.name}</h3>
            <div className="op-team-score-num">{homeScore}</div>
            
            <div className="op-score-adjust-group">
              <button className="op-score-adjust-btn" onClick={() => handleScoreAdjust("home", -1)}>-1</button>
              <button className="op-score-adjust-btn" onClick={() => handleScoreAdjust("home", 1)}>+1</button>
              <button className="op-score-adjust-btn" onClick={() => handleScoreAdjust("home", 2)}>+2</button>
              <button className="op-score-adjust-btn" onClick={() => handleScoreAdjust("home", 3)}>+3</button>
            </div>

            <div className="op-team-stat-row">
              <div className="op-team-stat-item">
                <label>Fouls: {homeFouls}</label>
                <button className="op-stat-arrow-btn" onClick={() => setHomeFouls(prev => Math.max(0, prev - 1))}>−</button>
                <button className="op-stat-arrow-btn" onClick={() => setHomeFouls(prev => prev + 1)}>+</button>
              </div>
              <div className="op-team-stat-item">
                <label>TO: {homeTimeouts}</label>
                <button className="op-stat-arrow-btn" onClick={() => setHomeTimeouts(prev => Math.max(0, prev - 1))}>−</button>
                <button className="op-stat-arrow-btn" onClick={() => setHomeTimeouts(prev => prev + 1)}>+</button>
              </div>
            </div>
          </div>

          {/* Clock tracker center */}
          <div className="op-center-clock-widget">
            <div className="op-clock-huge">{getClockString()}</div>
            <div className="op-clock-period-label">
              {period === 5 ? "OT" : `Q${period}`}
            </div>
            <div className="op-clock-game-id">{game.id}</div>
            <div className="op-clock-status-txt">
              {clockRunning ? "Clock Active" : "Clock Paused"}
            </div>
          </div>

          {/* Away team */}
          <div className="op-team-score-block">
            <h3 className="op-team-name">{game.away_team?.name}</h3>
            <div className="op-team-score-num">{awayScore}</div>
            
            <div className="op-score-adjust-group">
              <button className="op-score-adjust-btn" onClick={() => handleScoreAdjust("away", -1)}>-1</button>
              <button className="op-score-adjust-btn" onClick={() => handleScoreAdjust("away", 1)}>+1</button>
              <button className="op-score-adjust-btn" onClick={() => handleScoreAdjust("away", 2)}>+2</button>
              <button className="op-score-adjust-btn" onClick={() => handleScoreAdjust("away", 3)}>+3</button>
            </div>

            <div className="op-team-stat-row">
              <div className="op-team-stat-item">
                <label>Fouls: {awayFouls}</label>
                <button className="op-stat-arrow-btn" onClick={() => setAwayFouls(prev => Math.max(0, prev - 1))}>−</button>
                <button className="op-stat-arrow-btn" onClick={() => setAwayFouls(prev => prev + 1)}>+</button>
              </div>
              <div className="op-team-stat-item">
                <label>TO: {awayTimeouts}</label>
                <button className="op-stat-arrow-btn" onClick={() => setAwayTimeouts(prev => Math.max(0, prev - 1))}>−</button>
                <button className="op-stat-arrow-btn" onClick={() => setAwayTimeouts(prev => prev + 1)}>+</button>
              </div>
            </div>
          </div>
        </section>

        {/* Live play log */}
        <section className="op-pbp-card">
          <h2 className="op-card-title">Play-by-Play (Live)</h2>
          <div className="op-pbp-container">
            <table className="op-pbp-table">
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="op-pbp-time">Q{e.period} {e.clock}</td>
                    <td className="op-pbp-desc">{e.description}</td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td style={{ color: "#64748b", textAlign: "center", padding: "20px 0" }}>
                      No events logged for this game yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Home Actions Grid (Action First) */}
      <section className="op-panel-card">
        <h2 className="op-card-title">Home Actions (Action-First)</h2>
        <div className="op-panel-grid">
          {HOME_ACTIONS.map((action) => (
            <button 
              key={action.label}
              className={`op-act-btn ${action.class}`}
              onClick={() => handleHomeAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      {/* Away Team Quick Actions */}
      <section className="op-panel-card">
        <h2 className="op-card-title">Away Team Quick Actions (No Player Select)</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {AWAY_ACTIONS.map((action) => (
            <button
              key={action.label}
              className={`op-act-btn ${action.class}`}
              style={{ flex: 1, minWidth: 100 }}
              onClick={() => handleAwayAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      {/* Split panel: Home Players & Visual Shot Court */}
      <div className="op-bottom-row">
        {/* Home Players */}
        <section className="op-panel-card" style={{ display: "flex", flexDirection: "column" }}>
          <h2 className="op-card-title">Home Players</h2>
          <div className="op-pbp-container">
            <div className="op-roster-list">
              {athletes.map((p) => (
                <div 
                  key={p.id}
                  className={`op-roster-item ${activePlayer?.id === p.id ? "active" : ""}`}
                  onClick={() => setActivePlayer(activePlayer?.id === p.id ? null : p)}
                >
                  #{p.jersey_number} {p.full_name} <span style={{ float: "right", fontSize: "0.75rem", opacity: 0.6 }}>{p.position}</span>
                </div>
              ))}
              {athletes.length === 0 && (
                <div style={{ color: "#64748b", padding: "10px 0" }}>No roster athletes added to home team.</div>
              )}
            </div>
          </div>
        </section>

        {/* Shot Location tap court */}
        <section className="op-panel-card op-court-wrapper">
          <h2 className="op-card-title" style={{ width: "100%" }}>Shot Location (Tap-Court)</h2>
          
          <div className="op-court-canvas-box" onClick={handleCourtClick}>
            {/* SVG Lines illustrating half court */}
            <svg className="op-court-lines-svg" viewBox="0 0 50 47">
              {/* Perimeter Boundary */}
              <rect x="0" y="0" width="50" height="47" />
              
              {/* Center line (division line) at the bottom */}
              <line x1="0" y1="47" x2="50" y2="47" />
              
              {/* Center Circle Restraining Arc */}
              <path d="M 19 47 A 6 6 0 0 1 31 47" />
              
              {/* Three-Point Arc (radius: 23.75 ft scaled to standard 50x47 half court dimensions) */}
              <path d="M 3 0 L 3 14 A 22 22 0 0 0 47 14 L 47 0" />
              
              {/* Free Throw Lane (Key: 12ft wide, 15ft to free throw line) */}
              <rect x="19" y="0" width="12" height="19" />
              
              {/* Free Throw Circle Top Arc */}
              <path d="M 19 19 A 6 6 0 0 1 31 19" />
              {/* Free Throw Circle Bottom Arc (Dashed) */}
              <path d="M 19 19 A 6 6 0 0 0 31 19" strokeDasharray="1,1" />
              
              {/* Backboard & Goal */}
              <line x1="22" y1="4" x2="28" y2="4" strokeWidth="2" /> {/* Backboard */}
              <line x1="25" y1="4" x2="25" y2="5" /> {/* Neck */}
              <circle cx="25" cy="5.8" r="0.8" /> {/* Rim */}
            </svg>

            {/* Glowing coordinate dot */}
            {shotCoords && (
              <div 
                className="op-court-dot-indicator" 
                style={{ left: `${shotCoords.x}%`, top: `${shotCoords.y}%` }}
              />
            )}
          </div>

          <p className="op-court-hint-text">
            Tap on the half-court after selecting an action, corresponding player, & whether missed/made.
            <br />
            Court marker is saved with your next shot event insert and clears automatically.
          </p>
        </section>
      </div>
    </main>
  );
}
