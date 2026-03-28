import React from 'react';
import type { TeamSide } from '../types';
import type { ActiveShotFlow, ShotTypeId } from '../shotRecordingUtils';
import type { ActiveFoulFlow, FoulTypeId } from '../foulRecordingUtils';
import PlayerPanel from './PlayerPanel';
import BasketballCourt from './BasketballCourt';
import ShotRecordingCourtPanel from './ShotRecordingCourtPanel';
import FoulRecordingCourtPanel from './FoulRecordingCourtPanel';
import { cl } from '../utils/cl';
import { STAT_DASH_MAIN_INNER, STAT_DASH_MAIN_OUTER } from '../statDashTheme';

export type ShotFlowState = 'idle' | ActiveShotFlow;
export type FoulFlowState = 'idle' | ActiveFoulFlow;

export interface GameCenterProps {
  homeColor: string;
  awayColor: string;
  homePlayers: number[];
  awayPlayers: number[];
  onPlayerFoulClick: (side: TeamSide, jersey: number) => void;
  onPlayerShotContextMenu: (side: TeamSide, jersey: number, e: React.MouseEvent) => void;
  onFoul: (side: TeamSide) => void;
  onTurnover: (side: TeamSide) => void;
  /** Left-click court: foul flow */
  onCourtFoulClick: () => void;
  /** Right-click court: shot flow */
  onCourtShotContextMenu: (e: React.MouseEvent) => void;
  shotFlow: ShotFlowState;
  foulFlow: FoulFlowState;
  homeName: string;
  awayName: string;
  onShotFlowBack: () => void;
  onShotFlowCancel: () => void;
  onPickShooter: (side: TeamSide, jersey: number) => void;
  onSelectShotType: (type: ShotTypeId) => void;
  onSetFastBreak: (value: boolean) => void;
  onSelectAssist: (assist: number | 'none') => void;
  onFoulFlowBack: () => void;
  onFoulFlowCancel: () => void;
  onFoulPickFouler: (side: TeamSide, jersey: number) => void;
  onFoulSelectType: (type: FoulTypeId) => void;
  onFoulPickFouled: (jersey: number) => void;
  onFoulSelectFtCount: (count: 0 | 1 | 2 | 3) => void;
  onFoulFtShooterSame: () => void;
  onFoulFtResult: (result: 'made' | 'miss') => void;
  onFoulPickRebounder: (side: TeamSide, jersey: number) => void;
}

const GameCenter: React.FC<GameCenterProps> = ({
  homeColor,
  awayColor,
  homePlayers,
  awayPlayers,
  onPlayerFoulClick,
  onPlayerShotContextMenu,
  onFoul,
  onTurnover,
  onCourtFoulClick,
  onCourtShotContextMenu,
  shotFlow,
  foulFlow,
  homeName,
  awayName,
  onShotFlowBack,
  onShotFlowCancel,
  onPickShooter,
  onSelectShotType,
  onSetFastBreak,
  onSelectAssist,
  onFoulFlowBack,
  onFoulFlowCancel,
  onFoulPickFouler,
  onFoulSelectType,
  onFoulPickFouled,
  onFoulSelectFtCount,
  onFoulFtShooterSame,
  onFoulFtResult,
  onFoulPickRebounder,
}) => {
  const shotActive = shotFlow !== 'idle';
  const foulActive = foulFlow !== 'idle';
  const flowActive = shotActive || foulActive;

  return (
    <div className={`${STAT_DASH_MAIN_OUTER} min-h-0 flex-1 items-start font-sans`}>
      <div
        className={`${STAT_DASH_MAIN_INNER} items-start`}
        style={{ gap: cl('12px', '1.4vw', '24px') }}
      >
        <PlayerPanel
          side="home"
          accentColor={homeColor}
          playerNumbers={homePlayers}
          onPlayerFoulClick={onPlayerFoulClick}
          onPlayerShotContextMenu={onPlayerShotContextMenu}
          onFoul={onFoul}
          onTurnover={onTurnover}
        />

        <div className="flex min-h-0 min-w-0 flex-[1.35] justify-center px-0 sm:px-0.5">
          <div className="relative aspect-[620/380] w-full max-w-full shrink-0">
            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                flowActive ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
              aria-hidden={flowActive}
            >
              <button
                type="button"
                onClick={onCourtFoulClick}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onCourtShotContextMenu(e);
                }}
                className="h-full w-full cursor-pointer overflow-hidden rounded-lg border-[3px] border-gray-500 bg-[#d8dce1] p-0 text-left shadow-sm hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
                aria-label="Court. Left-click: foul. Right-click: made shot."
              >
                <BasketballCourt />
              </button>
            </div>
            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                shotActive ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              aria-hidden={!shotActive}
            >
              {shotActive && (
                <ShotRecordingCourtPanel
                  flow={shotFlow}
                  homeName={homeName}
                  awayName={awayName}
                  homePlayers={homePlayers}
                  awayPlayers={awayPlayers}
                  homeColor={homeColor}
                  awayColor={awayColor}
                  onBack={onShotFlowBack}
                  onCancel={onShotFlowCancel}
                  onPickShooter={onPickShooter}
                  onSelectShotType={onSelectShotType}
                  onSetFastBreak={onSetFastBreak}
                  onSelectAssist={onSelectAssist}
                />
              )}
            </div>
            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                foulActive ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              aria-hidden={!foulActive}
            >
              {foulActive && (
                <FoulRecordingCourtPanel
                  flow={foulFlow}
                  homeName={homeName}
                  awayName={awayName}
                  homePlayers={homePlayers}
                  awayPlayers={awayPlayers}
                  homeColor={homeColor}
                  awayColor={awayColor}
                  onBack={onFoulFlowBack}
                  onCancel={onFoulFlowCancel}
                  onPickFouler={onFoulPickFouler}
                  onSelectFoulType={onFoulSelectType}
                  onPickFouled={onFoulPickFouled}
                  onSelectFtCount={onFoulSelectFtCount}
                  onFtShooterSamePlayer={onFoulFtShooterSame}
                  onFtResult={onFoulFtResult}
                  onPickRebounder={onFoulPickRebounder}
                />
              )}
            </div>
          </div>
        </div>

        <PlayerPanel
          side="away"
          accentColor={awayColor}
          playerNumbers={awayPlayers}
          onPlayerFoulClick={onPlayerFoulClick}
          onPlayerShotContextMenu={onPlayerShotContextMenu}
          onFoul={onFoul}
          onTurnover={onTurnover}
        />
      </div>
    </div>
  );
};

export default GameCenter;
