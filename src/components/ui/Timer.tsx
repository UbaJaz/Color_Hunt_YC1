import { useState, useEffect, useRef } from 'react';
import { beep } from '../../utils/sound';

export function Timer({
  durationSeconds = 60,
  onExpire,
}: {
  durationSeconds?: number;
  onExpire: () => void;
}) {
  // Wall-clock deadline, so a locked phone or backgrounded tab can't pause the countdown.
  const deadline = useRef(Date.now() + durationSeconds * 1000);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const expired = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && timeLeft <= 5) beep(timeLeft === 1 ? 1200 : 800, 80);
  }, [timeLeft]);

  useEffect(() => {
    if (timeLeft <= 0 && !expired.current) {
      expired.current = true;
      onExpire();
    }
  }, [timeLeft, onExpire]);

  return (
    <div className={`text-2xl font-mono font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
      00:{timeLeft.toString().padStart(2, '0')}
    </div>
  );
}
