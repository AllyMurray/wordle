import { useEffect } from 'react';

const INTERACTIVE_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
].join(',');

const isFromInteractiveElement = (event: KeyboardEvent): boolean => {
  const target = event.target;
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
};

export const useWindowKeyDown = (
  enabled: boolean,
  handler: (event: KeyboardEvent) => void
): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (isFromInteractiveElement(event)) return;
      handler(event);
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [enabled, handler]);
};
