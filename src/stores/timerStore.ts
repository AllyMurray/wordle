import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface TimerState {
  timeRemaining: number;
  isRunning: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
  deadline: number | null;

  // Actions
  start: (durationSeconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: (durationSeconds: number) => void;
  stop: () => void;
}

export const useTimerStore = create<TimerState>()(
  subscribeWithSelector((set, get) => {
    const beginCountdown = (durationSeconds: number): void => {
      const { intervalId } = get();
      if (intervalId) clearInterval(intervalId);

      const deadline = Date.now() + durationSeconds * 1000;
      const newIntervalId = setInterval(() => {
        const state = get();
        if (!state.isRunning || state.deadline === null) return;

        const timeRemaining = Math.max(
          0,
          Math.ceil((state.deadline - Date.now()) / 1000)
        );

        if (timeRemaining === 0) {
          if (state.intervalId) clearInterval(state.intervalId);
          set({
            timeRemaining: 0,
            isRunning: false,
            intervalId: null,
            deadline: null,
          });
        } else if (timeRemaining !== state.timeRemaining) {
          set({ timeRemaining });
        }
      }, 1000);

      set({
        timeRemaining: durationSeconds,
        isRunning: true,
        intervalId: newIntervalId,
        deadline,
      });
    };

    return {
      timeRemaining: 0,
      isRunning: false,
      intervalId: null,
      deadline: null,

      start: beginCountdown,

      pause: () => {
        const { deadline, intervalId, timeRemaining } = get();
        if (intervalId) clearInterval(intervalId);
        const pausedTime = deadline === null
          ? timeRemaining
          : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        set({
          timeRemaining: pausedTime,
          isRunning: false,
          intervalId: null,
          deadline: null,
        });
      },

      resume: () => {
        const { timeRemaining } = get();
        if (timeRemaining > 0) beginCountdown(timeRemaining);
      },

      reset: (durationSeconds: number) => {
        const { intervalId } = get();
        if (intervalId) clearInterval(intervalId);
        set({
          timeRemaining: durationSeconds,
          isRunning: false,
          intervalId: null,
          deadline: null,
        });
      },

      stop: () => {
        const { intervalId } = get();
        if (intervalId) clearInterval(intervalId);
        set({
          timeRemaining: 0,
          isRunning: false,
          intervalId: null,
          deadline: null,
        });
      },
    };
  })
);
