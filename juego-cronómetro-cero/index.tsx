import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

const GAME_DURATION_SECONDS = 23;
const GAME_DURATION_MS = GAME_DURATION_SECONDS * 1000;

type Difficulty = 'centiseconds' | 'milliseconds';

interface PauseRecord {
  time: number;
  formattedTime: string;
  isHit: boolean;
}

const App: React.FC = () => {
  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('milliseconds');
  const [pauseHistory, setPauseHistory] = useState<PauseRecord[]>([]);
  const [showScoreAnimation, setShowScoreAnimation] = useState<boolean>(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  // CORRECCIÓN: Usaremos el estado 'time' directamente al pausar,
  // y ajustaremos startTimeRef al reanudar para que represente el inicio "efectivo".
  // No necesitamos 'timeAccumulatedBeforePauseRef' si lo hacemos así.

  const formatTime = useCallback((timeMs: number, currentDifficulty: Difficulty): string => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const milliseconds = Math.floor(timeMs % 1000);
    const centiseconds = Math.floor(milliseconds / 10);
    const seconds = totalSeconds % 60;

    const formattedSeconds = String(seconds).padStart(2, '0');

    if (currentDifficulty === 'centiseconds') {
      const formattedCentiseconds = String(centiseconds).padStart(2, '0');
      return `${formattedSeconds}.${formattedCentiseconds}`;
    } else {
      const formattedMilliseconds = String(milliseconds).padStart(3, '0');
      return `${formattedSeconds}.${formattedMilliseconds}`;
    }
  }, []);

  const renderTimerDigits = (displayTime: string) => {
    const parts = displayTime.split('');
    return (
      <div className="timer-digits">
        {parts.map((char, index) => {
          const isSeparator = char === '.';
          const key = `${char}-${index}`;
          return (
            <span key={key} className={isSeparator ? 'separator' : 'digit-box'}>
              {char}
            </span>
          );
        })}
      </div>
    );
  };

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      // Al reanudar (o empezar), startTimeRef debe reflejar el punto de inicio
      // tal que Date.now() - startTimeRef nos dé el tiempo correcto.
      // Si time = 5000ms, queremos que el nuevo startTime sea Date.now() - 5000.
      startTimeRef.current = Date.now() - time;

      intervalRef.current = setInterval(() => {
        const now = Date.now();
        // CORRECCIÓN CLAVE: El tiempo total transcurrido es simplemente
        // la diferencia entre ahora y el punto de inicio efectivo.
        const totalElapsedTime = now - startTimeRef.current;

        if (totalElapsedTime >= GAME_DURATION_MS) {
          setTime(GAME_DURATION_MS);
          setIsRunning(false);
          setGameOver(true);
          clearTimerInterval();
        } else {
          setTime(totalElapsedTime);
        }
      }, 10); // Intervalo de actualización
    } else {
      // Cuando se pausa (isRunning pasa a false), limpiamos el intervalo.
      // No necesitamos guardar el tiempo acumulado aquí, porque el estado 'time'
      // ya tiene el valor correcto en el momento de la pausa.
      clearTimerInterval();
    }

    // Limpieza al desmontar o cuando isRunning cambia
    return () => clearTimerInterval();
  }, [isRunning, clearTimerInterval, time]); // Añadimos 'time' como dependencia por si acaso, aunque el cambio principal es la lógica interna.

  const handleStart = () => {
    clearTimerInterval();
    setTime(0); // Reinicia tiempo a 0
    setScore(0);
    setGameOver(false);
    setIsRunning(true); // Pone el crono en marcha
    setPauseHistory([]);
    // startTimeRef se establecerá correctamente en el useEffect
  };

  const handleTogglePauseResume = () => {
    if (gameOver) return;

    if (isRunning) {
      // --- PAUSAR ---
      setIsRunning(false); // Detiene el intervalo via useEffect
      // El estado 'time' ya tiene el valor preciso en el momento de la pausa
      const pauseTimeExact = time;

      // Comprobar acierto
      const milliseconds = Math.floor(pauseTimeExact % 1000);
      const centiseconds = Math.floor(milliseconds / 10);
      let hit = false;
      if (difficulty === 'milliseconds') {
        hit = milliseconds === 0;
      } else {
        hit = centiseconds === 0;
      }

      setPauseHistory(prevHistory => [
        ...prevHistory,
        {
          time: pauseTimeExact,
          formattedTime: formatTime(pauseTimeExact, difficulty),
          isHit: hit
        }
      ]);

      if (hit) {
        setScore(prevScore => prevScore + 1);
        setShowScoreAnimation(true);
        setTimeout(() => setShowScoreAnimation(false), 500);
      }

      // Comprobación de fin de juego si se pausa justo en el límite
      if (pauseTimeExact >= GAME_DURATION_MS) {
          setTime(GAME_DURATION_MS); // Asegura el valor máximo
          setGameOver(true); // Marca como terminado
          setIsRunning(false); // Asegura que esté parado
      }

    } else {
      // --- REANUDAR ---
      // Solo reanudar si no ha terminado el juego
      if (time < GAME_DURATION_MS) {
        setIsRunning(true); // Reactiva el intervalo via useEffect
        // El useEffect ahora calculará el startTimeRef correcto usando el 'time' actual
      }
    }
  };

  const selectDifficulty = (newDifficulty: Difficulty) => {
    if (!isRunning && !gameOver) {
      setDifficulty(newDifficulty);
      // Reiniciar al cambiar dificultad para evitar confusiones con tiempos/hits
      handleStart();
    }
  }

  const renderGameOverReport = () => {
    if (!gameOver) return null;

    let title = "";
    let message = "";
    let specialClass = "";

    if (score === 0) {
      title = "¡Fin del Juego!";
      message = `No has conseguido ningún acierto esta vez. ¡Inténtalo de nuevo!`;
    } else if (score === 1) {
      title = "¡Buen Trabajo!";
      message = `¡Has conseguido 1 acierto!`;
    } else {
      title = "¡¡MAESTRÍA!!";
      message = `¡Increíble! ¡Has conseguido ${score} aciertos!`;
      specialClass = "special-win";
    }

    return (
      <div className="game-report">
        <h2 className={specialClass}>{title}</h2>
        <p>{message}</p>
        {pauseHistory.length > 0 && (
          <>
            <h3>Historial de Pausas:</h3>
            <ul className="history-list">
              {pauseHistory.map((record, index) => (
                <li key={index} className="history-item">
                  <span className="time">Intento {index + 1}: {record.formattedTime}</span>
                  <span className={`result ${record.isHit ? 'hit' : 'miss'}`}>
                    {record.isHit ? '¡ACIERTO!' : 'Fallo'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {pauseHistory.length === 0 && time >= GAME_DURATION_MS && <p>No realizaste ninguna pausa.</p>}
      </div>
    );
  };

  return (
    <div className="game-container">
      <h1>Cronómetro Cero</h1>

      <div className="difficulty-selector">
          <button
            onClick={() => selectDifficulty('centiseconds')}
            className={difficulty === 'centiseconds' ? 'active' : ''}
            disabled={isRunning || gameOver}
            title="Modo normal: parar en .00"
          >
              Centésimas
          </button>
          <button
            onClick={() => selectDifficulty('milliseconds')}
            className={difficulty === 'milliseconds' ? 'active' : ''}
            disabled={isRunning || gameOver}
            title="Modo difícil: parar en .000"
            >
              Milésimas
          </button>
      </div>

      {renderTimerDigits(formatTime(time, difficulty))}

      <div className={`score ${showScoreAnimation ? 'score-increase-animation' : ''}`}>
        Aciertos: <span>{score}</span>
      </div>

      <div className="buttons">
        <button
            className="start-button"
            onClick={handleStart}
            // Se puede reiniciar si NO está corriendo O si ya terminó
            disabled={isRunning && !gameOver}
        >
           {/* Si NO corre Y hay tiempo O si terminó -> Reiniciar, si no -> Empezar */}
           {(!isRunning && time > 0) || gameOver ? 'Reiniciar' : 'Empezar'}
        </button>

        <button
            className={isRunning ? 'pause-button' : 'resume-button'}
            onClick={handleTogglePauseResume}
            // Deshabilitado si no hay tiempo inicial Y no está corriendo, O si ya terminó
            disabled={(!isRunning && time === 0) || gameOver}
        >
          {isRunning ? 'Pausar' : 'Reanudar'}
        </button>
      </div>

      {gameOver && renderGameOverReport()}

    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Error: No se encontró el elemento con id 'root'.");
}