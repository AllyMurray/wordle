import type { BoggleWordResult } from '../../../types';

interface BoggleWordFeedbackProps {
  result: BoggleWordResult | null;
}

export function BoggleWordFeedback({ result }: BoggleWordFeedbackProps) {
  if (!result) return null;

  return (
    <div
      className={`boggle-word-feedback boggle-word-feedback--${result.accepted ? 'accepted' : 'rejected'}`}
      role={result.accepted ? 'status' : 'alert'}
    >
      {result.accepted
        ? `${result.word} accepted`
        : `${result.word}: ${result.reason || 'Word rejected'}`}
    </div>
  );
}
