import { CaptureScreen } from './screens/CaptureScreen';

// Screen-index state machine: a union type signals more screens are coming
// (Days 2-8 add TargetColor, Results, Leaderboard, Calibration, Collection...)
// without pulling in react-router for what is currently a linear flow.
type ScreenId = 'capture';

function App() {
  const currentScreen: ScreenId = 'capture';

  return (
    <div className="h-dvh w-dvw overflow-hidden bg-black" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {currentScreen === 'capture' && <CaptureScreen />}
    </div>
  );
}

export default App;
