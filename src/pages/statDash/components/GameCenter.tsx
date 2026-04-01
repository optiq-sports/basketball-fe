import React from 'react';
import type { TeamSide } from '../types';
import type { ActiveShotFlow, ShotTypeId } from '../shotRecordingUtils';
import type { ActiveFoulFlow, FoulTypeId, PanelFoulPick } from '../foulRecordingUtils';
import type { ActiveTurnoverFlow, TurnoverTypeId } from '../turnoverRecordingUtils';
import PlayerPanel from './PlayerPanel';
import BasketballCourt, { type CourtMarker } from './BasketballCourt';
import ShotRecordingCourtPanel from './ShotRecordingCourtPanel';
import FoulRecordingCourtPanel from './FoulRecordingCourtPanel';
import TurnoverRecordingCourtPanel from './TurnoverRecordingCourtPanel';
import FoulPanelPickerModal from './FoulPanelPickerModal';
import TimeoutSelectModal, { type TimeoutChoice } from './TimeoutSelectModal';
import JumpBallModal, { type JumpBallChoice } from './JumpBallModal';
import { cl } from '../utils/cl';
import { STAT_DASH_MAIN_INNER, STAT_DASH_MAIN_OUTER } from '../statDashTheme';

export type ShotFlowState = 'idle' | ActiveShotFlow;
export type FoulFlowState = 'idle' | ActiveFoulFlow;
export type TurnoverFlowState = 'idle' | ActiveTurnoverFlow;

export interface GameCenterProps {
  homeColor: string;
  awayColor: string;
  /** On-court jerseys only — side columns and recording overlays */
  homeActivePlayers: number[];
  awayActivePlayers: number[];
  onPlayerFoulClick: (side: TeamSide, jersey: number) => void;
  onPlayerShotContextMenu: (side: TeamSide, jersey: number, e: React.MouseEvent) => void;
  onFoul: (side: TeamSide) => void;
  onTurnover: (side: TeamSide) => void;
  /** Left-click court: missed-shot flow */
  onCourtFoulClick: (e: React.MouseEvent) => void;
  /** Right-click court: made-shot flow */
  onCourtShotContextMenu: (e: React.MouseEvent) => void;
  shotFlow: ShotFlowState;
  foulFlow: FoulFlowState;
  turnoverFlow: TurnoverFlowState;
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
  onTurnoverFlowBack: () => void;
  onTurnoverFlowCancel: () => void;
  onTurnoverPickCommittingPlayer: (jersey: number) => void;
  onTurnoverSelectType: (type: TurnoverTypeId) => void;
  onTurnoverNoSteal: () => void;
  onTurnoverPickStealer: (side: TeamSide, jersey: number) => void;
  courtShotMarkers: CourtMarker[];
  courtFoulMarkers: CourtMarker[];
  /** FOUL strip: initial picker inside court (same placement as shot flow) */
  foulPickerOpen: boolean;
  homeBench: number[];
  awayBench: number[];
  onFoulPanelPick: (side: TeamSide, pick: PanelFoulPick) => void;
  onFoulPanelCancel: () => void;

  /** Timeout selector panel inside court */
  timeoutModalOpen: boolean;
  onTimeoutSelect: (choice: TimeoutChoice) => void;
  onTimeoutCancel: () => void;

  /** Jump ball panel inside court */
  jumpBallModalOpen: boolean;
  onJumpBallSelect: (choice: JumpBallChoice) => void;
  onJumpBallCancel: () => void;
  reverseSides?: boolean;
}

const GameCenter: React.FC<GameCenterProps> = ({
  homeColor,
  awayColor,
  homeActivePlayers,
  awayActivePlayers,
  onPlayerFoulClick,
  onPlayerShotContextMenu,
  onFoul,
  onTurnover,
  onCourtFoulClick,
  onCourtShotContextMenu,
  shotFlow,
  foulFlow,
  turnoverFlow,
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
  onTurnoverFlowBack,
  onTurnoverFlowCancel,
  onTurnoverPickCommittingPlayer,
  onTurnoverSelectType,
  onTurnoverNoSteal,
  onTurnoverPickStealer,
  courtShotMarkers,
  courtFoulMarkers,
  foulPickerOpen,
  homeBench,
  awayBench,
  onFoulPanelPick,
  onFoulPanelCancel,
  timeoutModalOpen,
  onTimeoutSelect,
  onTimeoutCancel,
  jumpBallModalOpen,
  onJumpBallSelect,
  onJumpBallCancel,
  reverseSides = false,
}) => {
  const shotActive = shotFlow !== 'idle';
  const foulActive = foulFlow !== 'idle';
  const turnoverActive = turnoverFlow !== 'idle';
  const flowActive = shotActive || foulActive || turnoverActive;
  const courtOverlayActive =
    flowActive || foulPickerOpen || timeoutModalOpen || jumpBallModalOpen;
  const allowSideJerseySelection =
    (shotActive && (shotFlow.step === 'pickShooter' || shotFlow.step === 'assist')) ||
    (foulActive &&
      (foulFlow.step === 'pickFouler' ||
        foulFlow.step === 'pickFouled' ||
        foulFlow.step === 'rebounder')) ||
    (turnoverActive && (turnoverFlow.step === 'pickPlayer' || turnoverFlow.step === 'steal')) ||
    foulPickerOpen;
  const playerInteractionsLocked = !allowSideJerseySelection;

  return (
    <div className={`${STAT_DASH_MAIN_OUTER} min-h-0 flex-1 items-start font-sans`}>
      <div
        className={`${STAT_DASH_MAIN_INNER} items-start ${reverseSides ? 'flex-row-reverse' : ''}`}
        style={{ gap: cl('12px', '1.4vw', '24px') }}
      >
        <PlayerPanel
          side="home"
          accentColor={homeColor}
          playerNumbers={homeActivePlayers}
          interactionsLocked={playerInteractionsLocked}
          onPlayerFoulClick={onPlayerFoulClick}
          onPlayerShotContextMenu={onPlayerShotContextMenu}
          onFoul={onFoul}
          onTurnover={onTurnover}
        />

        <div className="flex min-h-0 min-w-0 flex-[1.35] justify-center px-0 sm:px-0.5">
          <div className="relative aspect-[620/380] w-full max-w-full shrink-0">
            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                courtOverlayActive ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
            >
              <button
                type="button"
                onClick={(e) => onCourtFoulClick(e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onCourtShotContextMenu(e);
                }}
                className="h-full w-full cursor-pointer overflow-hidden rounded-lg border-[3px] border-gray-500 bg-[#d8dce1] p-0 text-left shadow-sm hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
                aria-label="Court. Left-click: missed shot. Right-click: made shot."
              >
                <BasketballCourt shotMarkers={courtShotMarkers} foulMarkers={courtFoulMarkers} />
              </button>
            </div>
            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                shotActive ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {shotActive && (
                <ShotRecordingCourtPanel
                  flow={shotFlow}
                  homeName={homeName}
                  awayName={awayName}
                  homePlayers={homeActivePlayers}
                  awayPlayers={awayActivePlayers}
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
            >
              {foulActive && (
                <FoulRecordingCourtPanel
                  flow={foulFlow}
                  homeName={homeName}
                  awayName={awayName}
                  homePlayers={homeActivePlayers}
                  awayPlayers={awayActivePlayers}
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
            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                turnoverActive ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {turnoverActive && (
                <TurnoverRecordingCourtPanel
                  flow={turnoverFlow}
                  homeName={homeName}
                  awayName={awayName}
                  homePlayers={homeActivePlayers}
                  awayPlayers={awayActivePlayers}
                  homeColor={homeColor}
                  awayColor={awayColor}
                  onBack={onTurnoverFlowBack}
                  onCancel={onTurnoverFlowCancel}
                  onPickCommittingPlayer={onTurnoverPickCommittingPlayer}
                  onSelectTurnoverType={onTurnoverSelectType}
                  onSelectNoSteal={onTurnoverNoSteal}
                  onPickStealer={onTurnoverPickStealer}
                />
              )}
            </div>

            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                timeoutModalOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {timeoutModalOpen && (
                <TimeoutSelectModal
                  open={timeoutModalOpen}
                  homeName={homeName}
                  awayName={awayName}
                  homeColor={homeColor}
                  awayColor={awayColor}
                  onSelect={onTimeoutSelect}
                  onCancel={onTimeoutCancel}
                />
              )}
            </div>

            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                jumpBallModalOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {jumpBallModalOpen && (
                <JumpBallModal
                  open={jumpBallModalOpen}
                  homeName={homeName}
                  awayName={awayName}
                  homeColor={homeColor}
                  awayColor={awayColor}
                  onSelect={onJumpBallSelect}
                  onCancel={onJumpBallCancel}
                />
              )}
            </div>

            <div
              className={`absolute inset-0 transition-opacity duration-300 ease-out ${
                foulPickerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {foulPickerOpen && (
                <FoulPanelPickerModal
                  homeName={homeName}
                  awayName={awayName}
                  homeColor={homeColor}
                  awayColor={awayColor}
                  homeOnCourt={homeActivePlayers}
                  awayOnCourt={awayActivePlayers}
                  homeBench={homeBench}
                  awayBench={awayBench}
                  onPick={onFoulPanelPick}
                  onCancel={onFoulPanelCancel}
                />
              )}
            </div>
          </div>
        </div>

        <PlayerPanel
          side="away"
          accentColor={awayColor}
          playerNumbers={awayActivePlayers}
          interactionsLocked={playerInteractionsLocked}
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
