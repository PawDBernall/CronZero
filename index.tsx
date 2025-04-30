import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- Tipos y Constantes ---
type Difficulty = 'centiseconds' | 'milliseconds';
type GameState = 'MENU' | 'CONFIG' | 'PLAYING' | 'GAME_OVER';

interface PauseRecord {
  time: number;
  formattedTime: string;
  isHit: boolean;
}

const DURATION_OPTIONS = [10, 23, 42];
const TIMER_TICK_MS = 10;
// Pequeño margen DESPUÉS del tiempo objetivo para que el juego termine oficialmente.
// Esto asegura que el momento exacto (ej: 10.000) sea jugable.
const GAME_END_BUFFER_MS = 50;

// --- Componente Principal ---
const App: React.FC = () => {
  // --- Estados ---
  const [difficulty, setDifficulty] = useState<Difficulty>('milliseconds');
  const [gameDurationSeconds, setGameDurationSeconds] = useState<number>(23);
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [tempDifficulty, setTempDifficulty] = useState<Difficulty>(difficulty);
  const [tempGameDurationSeconds, setTempGameDurationSeconds] = useState<number>(gameDurationSeconds);

  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [pauseHistory, setPauseHistory] = useState<PauseRecord[]>([]);
  const [showScoreAnimation, setShowScoreAnimation] = useState<boolean>(false);

  // --- Refs ---
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // --- Cálculos Derivados ---
  const currentGameDurationMs = gameDurationSeconds * 1000; // Tiempo objetivo exacto
  // Momento real en que el intervalo se detiene y el juego termina
  const actualEndTimeMs = currentGameDurationMs + GAME_END_BUFFER_MS;

  // --- Funciones de Formato y Renderizado ---
  const formatTime = useCallback((timeMs: number, currentDifficulty: Difficulty): string => {
    // Una vez terminado el juego, no mostramos más allá del tiempo objetivo.
    // Mientras corre, mostramos el tiempo real.
    const displayTimeMs = gameOver ? Math.min(timeMs, currentGameDurationMs) : timeMs;

    const totalSeconds = Math.floor(displayTimeMs / 1000);
    const milliseconds = Math.floor(displayTimeMs % 1000);
    const centiseconds = Math.floor(milliseconds / 10);
    const seconds = totalSeconds % 60; // Solo segundos y fracción

    const formattedSeconds = String(seconds).padStart(2, '0');

    if (currentDifficulty === 'centiseconds') {
      const formattedCentiseconds = String(centiseconds).padStart(2, '0');
      return `${formattedSeconds}.${formattedCentiseconds}`;
    } else {
      const formattedMilliseconds = String(milliseconds).padStart(3, '0');
      return `${formattedSeconds}.${formattedMilliseconds}`;
    }
  }, [gameOver, currentGameDurationMs]);

  const renderTimerDigits = (displayTime: string) => (
    <div className="timer-digits">
      {displayTime.split('').map((char, index) => (
        <span key={`${char}-${index}`} className={char === '.' ? 'separator' : 'digit-box'}>
          {char}
        </span>
      ))}
    </div>
  );

  // --- Lógica del Timer ---
  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING' && isRunning) {
      startTimeRef.current = Date.now() - time;
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const totalElapsedTime = now - startTimeRef.current;

        // Comprobar si se ha alcanzado o superado el final REAL del juego
        if (totalElapsedTime >= actualEndTimeMs) {
          // Al terminar, fijamos el tiempo VISUAL al objetivo exacto
          setTime(currentGameDurationMs);
          setIsRunning(false);
          setGameOver(true);
          setGameState('GAME_OVER');
          clearTimerInterval();
        } else {
          // Mientras no se alcance el final, actualizamos el tiempo
          setTime(totalElapsedTime);
        }
      }, TIMER_TICK_MS);
    } else {
      clearTimerInterval();
    }
    return () => clearTimerInterval();
    // Dependencias clave: estado de juego, si corre, tiempo actual (para reanudación),
    // función de limpieza, tiempo final real y tiempo objetivo (para el setTime final).
  }, [gameState, isRunning, time, clearTimerInterval, actualEndTimeMs, currentGameDurationMs]);

  // --- Funciones de Control del Juego ---
  const resetGameCoreState = useCallback(() => {
    clearTimerInterval(); setIsRunning(false); setTime(0); setScore(0); setGameOver(false); setPauseHistory([]); setShowScoreAnimation(false);
  }, [clearTimerInterval]);

  const startTimerInternal = useCallback(() => {
    if (time > 0 || gameOver) {
      resetGameCoreState();
      setTimeout(() => {
        setIsRunning(true); setGameState('PLAYING');
      }, 50);
    } else {
      setIsRunning(true); setGameState('PLAYING');
    }
  }, [resetGameCoreState, time, gameOver]);

  const handleStartGameFromMenu = () => {
    setGameState('PLAYING'); startTimerInternal();
  };

  const handleStartOrRestartGame = () => {
    setGameState('PLAYING'); startTimerInternal();
  };

  const handleChangeDifficultyFromGame = (newDifficulty: Difficulty) => {
    if (isRunning) return;
    setDifficulty(newDifficulty);
    resetGameCoreState();
    setGameState('PLAYING');
    // NO inicia el timer
  };

  const handleTogglePauseResume = () => {
    // Permitir pausar incluso si el tiempo es >= currentGameDurationMs
    // pero SOLO si gameOver aún no es true (es decir, estamos en ese pequeño buffer)
    if (gameState !== 'PLAYING' || gameOver) return;

    if (isRunning) { // PAUSAR
      setIsRunning(false);
      const pauseTimeExact = time;
      const ms = Math.floor(pauseTimeExact % 1000), cs = Math.floor(ms / 10);
      const hit = difficulty === 'milliseconds' ? ms === 0 : cs === 0;
      setPauseHistory(prev => [...prev, { time: pauseTimeExact, formattedTime: formatTime(pauseTimeExact, difficulty), isHit: hit }]);
      if (hit) { setScore(prev => prev + 1); setShowScoreAnimation(true); setTimeout(() => setShowScoreAnimation(false), 500); }
    } else { // REANUDAR
      // Solo permite reanudar si el tiempo actual es estrictamente menor
      // que el tiempo final REAL del juego (actualEndTimeMs).
      // No tiene sentido reanudar si ya estamos en o más allá del punto final.
      if (time < actualEndTimeMs && !gameOver) {
        setIsRunning(true);
      }
    }
  };

  // --- Funciones de Configuración ---
  const handleGoToConfig = () => {
    setTempDifficulty(difficulty); setTempGameDurationSeconds(gameDurationSeconds); setGameState('CONFIG');
  };
  const handleSaveChanges = () => {
    setDifficulty(tempDifficulty); setGameDurationSeconds(tempGameDurationSeconds); resetGameCoreState(); setGameState('MENU');
  };
  const handleCancelChanges = () => {
    resetGameCoreState(); setGameState('MENU');
  };

  // --- Texto Dinámico de Botón ---
  const getGameStartButtonText = () => {
    if (!isRunning && time === 0) { return "Empezar"; }
    return "Reiniciar";
  }

  // --- Renderizado Condicional de Pantallas ---

  const renderMenu = () => (
    <div className="app-container menu-container">
      <div className="menu-icon">⏱️</div>
      <h1 className="menu-title">Cronómetro Cero</h1>
      <div style={{ fontSize: '0.9em', color: '#ccc', marginBottom: '15px' }}>
        Modo: {difficulty === 'centiseconds' ? 'Normal' : 'Experto'} | Duración: {gameDurationSeconds} seg
      </div>
      <div className="menu-buttons">
        <button className="start-button" onClick={handleStartGameFromMenu}>Empezar Juego</button>
        <button className="config-button" onClick={handleGoToConfig}>Configuración</button>
      </div>
    </div>
  );

  const renderConfig = () => (
    <div className="app-container config-container">
      <h1 className="config-title">Configuración</h1>
      <div className="config-options">
        <h3>Modo de Juego</h3>
        <div className="difficulty-selector">
          <button onClick={() => setTempDifficulty('centiseconds')} className={tempDifficulty === 'centiseconds' ? 'active' : ''}>Modo Normal</button>
          <button onClick={() => setTempDifficulty('milliseconds')} className={tempDifficulty === 'milliseconds' ? 'active' : ''}>Modo Experto</button>
        </div>
      </div>
      <div className="config-options">
        <h3>Duración de Partida</h3>
        <div className="config-buttons">
          {DURATION_OPTIONS.map(duration => (
            <button key={duration} className={`duration-button ${tempGameDurationSeconds === duration ? 'active' : ''}`} onClick={() => setTempGameDurationSeconds(duration)}>
              {duration} seg
            </button>
          ))}
        </div>
      </div>
      <div className="config-footer-buttons">
        <button className="save-button" onClick={handleSaveChanges}>Guardar</button>
        <button className="cancel-button" onClick={handleCancelChanges}>Cancelar</button>
      </div>
    </div>
  );

  const renderGameOverReport = () => {
    if (!gameOver) return null;
    let title = "", message = "", specialClass = "";
    if (score === 0) { title = "¡Fin del Juego!"; message = `No has conseguido ningún acierto. ¡Vuelve a intentarlo!`; }
    else if (score === 1) { title = "¡Buen Trabajo!"; message = `¡Has conseguido 1 acierto!`; }
    else { title = "¡¡MAESTRÍA!!"; message = `¡Increíble! ¡Has conseguido ${score} aciertos!`; specialClass = "special-win"; }
    return (
      <div className="game-report">
        <h2 className={specialClass}>{title}</h2><p>{message}</p>
        {pauseHistory.length > 0 && (<><h3>Historial de Pausas:</h3><ul className="history-list">{pauseHistory.map((record, index) => (<li key={index} className="history-item"><span className="time">Intento {index + 1}: {record.formattedTime}</span><span className={`result ${record.isHit ? 'hit' : 'miss'}`}>{record.isHit ? '¡ACIERTO!' : 'Fallo'}</span></li>))}</ul></>)}
        {pauseHistory.length === 0 && <p>No realizaste ninguna pausa.</p>}
        <button className="back-button" onClick={handleCancelChanges}>Volver al Menú</button>
      </div>
    );
  };

  const renderGame = () => (
    <div className="app-container game-container">
      <div className="game-difficulty-selector">
        <button onClick={() => handleChangeDifficultyFromGame('centiseconds')} className={difficulty === 'centiseconds' ? 'active' : ''} disabled={isRunning}>Modo Normal</button>
        <button onClick={() => handleChangeDifficultyFromGame('milliseconds')} className={difficulty === 'milliseconds' ? 'active' : ''} disabled={isRunning}>Modo Experto</button>
      </div>
      {renderTimerDigits(formatTime(time, difficulty))}
      <div className={`score ${showScoreAnimation ? 'score-increase-animation' : ''}`}>Aciertos: <span>{score}</span></div>
      <div className="game-buttons">
        <button className="start-button" onClick={handleStartOrRestartGame} disabled={isRunning}>
          {getGameStartButtonText()}
        </button>
        <button className={isRunning ? 'pause-button' : 'resume-button'} onClick={handleTogglePauseResume} disabled={gameOver || (!isRunning && time === 0)}>
          {isRunning ? 'Pausar' : 'Reanudar'}
        </button>
      </div>
      {gameOver && renderGameOverReport()}
    </div>
  );

  // --- Renderizado Principal ---
  switch (gameState) {
    case 'MENU': return renderMenu();
    case 'CONFIG': return renderConfig();
    case 'PLAYING': return renderGame();
    case 'GAME_OVER': return renderGame(); // Muestra la misma pantalla de juego, pero el reporte se renderizará dentro
    default: setGameState('MENU'); return renderMenu(); // Fallback seguro
  }
};

// --- Montaje de la App ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
} else { console.error("Fatal Error: Elemento con id 'root' no encontrado en el DOM."); }