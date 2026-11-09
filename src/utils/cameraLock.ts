/**
 * Best-effort: freeze the camera's white balance at the value it has settled on, so the colour of an
 * object doesn't drift as auto white balance chases the scene. Exposure stays automatic on purpose:
 * a hunt moves between bright and dark spots and a frozen exposure would clip or crush them.
 * Only some Android Chrome cameras expose this; everywhere else it silently does nothing.
 */
export async function lockWhiteBalance(track: MediaStreamTrack): Promise<boolean> {
  try {
    const caps = track.getCapabilities?.() as { whiteBalanceMode?: string[] } | undefined;
    const settings = track.getSettings() as { colorTemperature?: number };
    if (!caps?.whiteBalanceMode?.includes('manual') || !settings.colorTemperature) return false;
    await track.applyConstraints({ advanced: [{ whiteBalanceMode: 'manual', colorTemperature: settings.colorTemperature } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}
