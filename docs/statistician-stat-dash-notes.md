# Statistician app — Stat Dash & related work

Short reference for features and behavior added or changed on the statistician flow (Match Key → Starters → Stat Dash, etc.).

## Game log — assists

- **Made shots with an assist** write **two** log rows (newest first after each prepend):  
  - **Assist** row: `action: assist`, player = assister, `result` like `To #<shooter>`.  
  - **Shot** row: `action: shot`, player = shooter, `result` = make type + optional fast break only (no assist text in this row).  
- **No assist**: one shot row only (no “No assist” in `result`).  
- Log editor includes **`assist`** in the action dropdown.

## Missed shot → rebound flow

- **Select rebounder** supports simple rebound, offensive tip-in (made/miss), block, and dead ball options.  
- **State updates** use functional `setShotFlow(prev => …)` for rebound outcome, pick rebounder, and pick blocker so the UI does not read a stale `reboundBranch` when tapping jerseys quickly.  
- **Tip-in after rebounder**: `pickShooter` with `tipInCommit`; **made** ends the flow; **miss** returns to **Select rebounder**.  
- **Block**: offensive rebounder → **Select blocker** (defense only) → back to **Select rebounder**.  
- Rebound panel copy was shortened; long hint blocks under “Select rebounder” were removed.

## Tip-in — side panels

- During **Tip-in (made)** / **Tip-in (miss)** shooter pick, only the **offensive** team column (jerseys + FOUL/TURNOVER) is enabled; the other column is disabled.  
- The court panel explains made vs miss and that rebound after a miss uses the side panels again.

## Fouls — player columns

- While the **FOUL** picker modal is open (after tapping FOUL on a side), **side jersey columns stay disabled** so users pick the fouler from the modal only. After a pick, normal foul steps unlock columns when needed.

## Menu — Starters

- **GAME → Starters** opens a **modal** on Stat Dash (same overlay idea as Switch Team Side), with the **same Starters UI** as `/starters` (colors, Playing, First 5).  
- **Apply** updates team colors (context / storage) and **home/away lineups** in Stat Dash. **Cancel** closes without saving.  
- **Continue** on the full **Starters page** still goes to choose sides; lineups on that route are unchanged unless you use Apply from Stat Dash.

## Starters — first five before leaving

- **Continue** (Starters page) and **Apply** (Stat Dash modal) only complete when **each** team has **≥5 Playing** and **exactly 5** First 5 starters.  
- If the user tries too early, a **modal** explains what’s missing (bullets per team) with a single dismiss button (“OK, I’ll update the lineups”).  
- The page **Continue** button calls `StartersFlow` via ref: `attemptContinue()` returns `true` only when valid, so navigation runs only then.

## Files to peek at (not exhaustive)

| Area | Main files |
|------|------------|
| Shot / rebound / assist | `src/pages/statDash/StatDash.tsx`, `shotRecordingUtils.ts`, `ShotRecordingCourtPanel.tsx`, `GameCenter.tsx` |
| Foul panel lock | `GameCenter.tsx`, `PlayerPanel.tsx` |
| Starters modal + flow | `StartersModal.tsx`, `StartersFlow.tsx`, `Starters.tsx`, `startersLineupBridge.ts`, `startersFirstFiveGate.ts`, `FirstFiveIncompleteModal.tsx` |
| Game log table | `GameLog.tsx`, `types.ts` (log entry shape) |

---

*Internal note doc — keep in sync when behavior changes.*
