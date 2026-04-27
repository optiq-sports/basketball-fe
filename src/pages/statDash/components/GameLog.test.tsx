import { fireEvent, render, screen } from '@testing-library/react';
import GameLog from './GameLog';

describe('GameLog', () => {
  it('shows empty state message', () => {
    render(<GameLog entries={[]} />);
    expect(
      screen.getByText(/No events yet\. Use player buttons or game actions to log plays\./i),
    ).toBeInTheDocument();
  });

  it('calls onRowClick for selected row', () => {
    const onRowClick = vi.fn();
    render(
      <GameLog
        entries={[
          {
            id: 'e-1',
            period: 'Q1',
            clock: '09:45',
            team: 'Home',
            player: '#8',
            action: 'shot',
            result: 'Jump shot made',
          },
        ]}
        onRowClick={onRowClick}
      />,
    );

    fireEvent.click(screen.getByText('Jump shot made'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0].id).toBe('e-1');
  });
});
