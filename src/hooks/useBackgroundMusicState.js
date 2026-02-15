import { useEffect, useState } from 'react';
import {
  getBackgroundMusicState,
  initBackgroundMusic,
  subscribeBackgroundMusic,
} from '../utils/audioManager';

export function useBackgroundMusicState() {
  const [bgmState, setBgmState] = useState(() => getBackgroundMusicState());

  useEffect(() => {
    initBackgroundMusic();
    return subscribeBackgroundMusic((nextState) => {
      setBgmState(nextState);
    });
  }, []);

  return bgmState;
}
