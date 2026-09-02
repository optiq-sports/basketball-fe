import React from 'react';
import type { TeamSide } from '../types';
import type { ActiveShotFlow, ReboundOutcomeId, ShotTypeId } from '../shotRecordingUtils';
import { opponentOf, type ActiveFoulFlow, type FoulTypeId, type PanelFoulPick } from '../foulRecordingUtils';
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
  onSelectReboundOutcome: (outcome: ReboundOutcomeId) => void;
  onFoulFlowBack: () => void;
  onFoulFlowCancel: () => void;
  onFoulPickFouler: (side: TeamSide, jersey: number) => void;
  onFoulSelectType: (type: FoulTypeId) => void;
  onFoulPickFouled: (jersey: number) => void;
  onFoulSelectFtCount: (count: 0 | 1 | 2 | 3) => void;
  onFoulFtAssistSelect: (assist: number | 'none') => void;
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
  homeRosterByJersey?: Map<number, string>;
  awayRosterByJersey?: Map<number, string>;
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

  /** Roster/stats drawer trigger, shown as a button next to each team's players */
  onToggleRoster?: (side: TeamSide) => void;
  activeRosterSide?: TeamSide | null;

  /** Rendered directly above the court, sharing its width (e.g. <GameHeader />) */
  headerSlot?: React.ReactNode;
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
  onSelectReboundOutcome,
  onFoulFlowBack,
  onFoulFlowCancel,
  onFoulPickFouler,
  onFoulSelectType,
  onFoulPickFouled,
  onFoulSelectFtCount,
  onFoulFtAssistSelect,
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
  homeRosterByJersey,
  awayRosterByJersey,
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
  onToggleRoster,
  activeRosterSide = null,
  headerSlot,
}) => {
  const shotActive = shotFlow !== 'idle';
  const foulActive = foulFlow !== 'idle';
  const turnoverActive = turnoverFlow !== 'idle';
  const flowActive = shotActive || foulActive || turnoverActive;
  const courtOverlayActive =
    flowActive || foulPickerOpen || timeoutModalOpen || jumpBallModalOpen;
  const foulPickerIdleSelectingFouler = foulPickerOpen && foulFlow === 'idle';
  const allowSideJerseySelection =
    foulPickerIdleSelectingFouler ||
    (shotActive &&
      (shotFlow.step === 'pickShooter' ||
        shotFlow.step === 'assist' ||
        shotFlow.step === 'pickRebounder' ||
        shotFlow.step === 'pickBlocker')) ||
    (foulActive &&
      (foulFlow.step === 'pickFouler' ||
        foulFlow.step === 'pickFouled' ||
        foulFlow.step === 'ftAssist' ||
        foulFlow.step === 'rebounder')) ||
    (turnoverActive && (turnoverFlow.step === 'pickPlayer' || turnoverFlow.step === 'steal'));
  const playerInteractionsLocked = !allowSideJerseySelection;

  const tipPickShooterOffensiveSide: TeamSide | null =
    shotActive &&
    shotFlow.step === 'pickShooter' &&
    shotFlow.draft.tipInCommit &&
    shotFlow.draft.rebounderSide !== null
      ? shotFlow.draft.rebounderSide
      : null;

  const pickBlockerOffenseSide: TeamSide | null =
    shotActive && shotFlow.step === 'pickBlocker'
      ? (shotFlow.draft.side ?? shotFlow.draft.priorMiss?.side ?? null)
      : null;
  const pickBlockerDefenseSide: TeamSide | null =
    pickBlockerOffenseSide !== null ? opponentOf(pickBlockerOffenseSide) : null;

  const homePanelLocked =
    playerInteractionsLocked ||
    (tipPickShooterOffensiveSide !== null && tipPickShooterOffensiveSide !== 'home') ||
    (pickBlockerDefenseSide !== null && pickBlockerDefenseSide !== 'home');
  const awayPanelLocked =
    playerInteractionsLocked ||
    (tipPickShooterOffensiveSide !== null && tipPickShooterOffensiveSide !== 'away') ||
    (pickBlockerDefenseSide !== null && pickBlockerDefenseSide !== 'away');

  const homePanel = (
    <PlayerPanel
      side="home"
      accentColor={homeColor}
      playerNumbers={homeActivePlayers}
      rosterByJersey={homeRosterByJersey}
      interactionsLocked={homePanelLocked}
      onPlayerFoulClick={onPlayerFoulClick}
      onPlayerShotContextMenu={onPlayerShotContextMenu}
      onFoul={onFoul}
      onTurnover={onTurnover}
      onToggleRoster={onToggleRoster ? () => onToggleRoster('home') : undefined}
      rosterOpen={activeRosterSide === 'home'}
    />
  );
  const awayPanel = (
    <PlayerPanel
      side="away"
      accentColor={awayColor}
      playerNumbers={awayActivePlayers}
      rosterByJersey={awayRosterByJersey}
      interactionsLocked={awayPanelLocked}
      onPlayerFoulClick={onPlayerFoulClick}
      onPlayerShotContextMenu={onPlayerShotContextMenu}
      onFoul={onFoul}
      onTurnover={onTurnover}
      onToggleRoster={onToggleRoster ? () => onToggleRoster('away') : undefined}
      rosterOpen={activeRosterSide === 'away'}
    />
  );

  return (
    <div className={`${STAT_DASH_MAIN_OUTER} min-h-0 flex-1 font-sans`}>
      <div
        className={STAT_DASH_MAIN_INNER}
        style={{
          gridTemplateColumns: 'auto minmax(0,1fr) auto',
          gridTemplateRows: 'auto 1fr',
          gap: cl('10px', '1vw', '18px'),
        }}
      >
        <div aria-hidden />
        <div className="mx-auto flex w-full max-w-[800px] flex-col">{headerSlot}</div>
        <div aria-hidden />

        {reverseSides ? awayPanel : homePanel}

        <div className="flex min-h-0 min-w-0 items-center justify-center px-0 sm:px-0.5">
          <div className="relative aspect-[620/380] w-full max-w-[800px] shrink-0">
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
                className="h-full w-full cursor-pointer overflow-hidden border-[3px] border-[#0F172A]/70 bg-[#F8FAFC] p-0 text-left hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
                aria-label="Court. Left-click: missed shot. Shift+left-click: foul at spot. Right-click: made shot."
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
                onSelectReboundOutcome={onSelectReboundOutcome}
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
                  onFtAssistSelect={onFoulFtAssistSelect}
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
                  homeBench={homeBench}
                  awayBench={awayBench}
                  onPick={onFoulPanelPick}
                  onCancel={onFoulPanelCancel}
                />
              )}
            </div>
          </div>
        </div>

        {reverseSides ? homePanel : awayPanel}
      </div>
    </div>
  );
};

export default GameCenter;
