import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useTimerStore } from './timerStore';

describe('useTimerStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTimerStore.getState().stop();
  });

  afterEach(() => {
    useTimerStore.getState().stop();
    vi.useRealTimers();
  });

  it('should start timer with given duration', () => {
    const { start } = useTimerStore.getState();

    start(180);

    expect(useTimerStore.getState().timeRemaining).toBe(180);
    expect(useTimerStore.getState().isRunning).toBe(true);
  });

  it('should tick down every second', () => {
    const { start } = useTimerStore.getState();

    start(180);
    vi.advanceTimersByTime(1000);

    expect(useTimerStore.getState().timeRemaining).toBe(179);
  });

  it('should stop at zero', () => {
    const { start } = useTimerStore.getState();

    start(3);
    vi.advanceTimersByTime(4000);

    expect(useTimerStore.getState().timeRemaining).toBe(0);
    expect(useTimerStore.getState().isRunning).toBe(false);
  });

  it('should catch up from elapsed wall-clock time after suspension', () => {
    const { start } = useTimerStore.getState();
    start(180);

    vi.setSystemTime(Date.now() + 30000);
    vi.advanceTimersByTime(1000);

    expect(useTimerStore.getState().timeRemaining).toBe(149);
  });

  it('should pause correctly', () => {
    const { start, pause } = useTimerStore.getState();

    start(180);
    vi.advanceTimersByTime(2000);
    pause();

    expect(useTimerStore.getState().timeRemaining).toBe(178);
    expect(useTimerStore.getState().isRunning).toBe(false);

    // Time passes but timer is paused
    vi.advanceTimersByTime(5000);
    expect(useTimerStore.getState().timeRemaining).toBe(178);
  });

  it('should resume correctly', () => {
    const { start, pause, resume } = useTimerStore.getState();

    start(180);
    vi.advanceTimersByTime(2000);
    pause();
    resume();
    vi.advanceTimersByTime(3000);

    expect(useTimerStore.getState().timeRemaining).toBe(175);
    expect(useTimerStore.getState().isRunning).toBe(true);
  });

  it('should reset to new duration', () => {
    const { start, reset } = useTimerStore.getState();

    start(180);
    vi.advanceTimersByTime(50000);
    reset(60);

    expect(useTimerStore.getState().timeRemaining).toBe(60);
    expect(useTimerStore.getState().isRunning).toBe(false);
  });
});
