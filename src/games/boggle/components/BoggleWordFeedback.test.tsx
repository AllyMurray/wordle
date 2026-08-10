import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoggleWordFeedback } from './BoggleWordFeedback';

describe('BoggleWordFeedback', () => {
  it('announces an accepted viewer word', () => {
    render(<BoggleWordFeedback result={{ word: 'TEST', accepted: true }} />);

    expect(screen.getByRole('status')).toHaveTextContent('TEST accepted');
  });

  it('explains why the host rejected a viewer word', () => {
    render(
      <BoggleWordFeedback
        result={{ word: 'TEST', accepted: false, reason: 'Already found' }}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('TEST: Already found');
  });
});
