import { useState, useEffect } from 'react';

export function Timer({ 
  durationSeconds = 60, 
  onExpire 
}: { 
  durationSeconds?: number; 
  onExpire: () => void; 
}) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onExpire]);

  return (
    <div className={`text-2xl font-mono font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
      00:{timeLeft.toString().padStart(2, '0')}
    </div>
  );
}
