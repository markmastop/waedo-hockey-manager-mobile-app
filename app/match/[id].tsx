Here's the fixed version with all missing closing brackets added:

```typescript
// ... [previous code remains the same until the TimeControl component] ...

  const makePositionSubstitution = (targetPosition: FormationPosition) => {
    if (!match || !selectedPosition) return;

    const currentPlayer = getPlayerInPosition(selectedPosition);
    const targetPlayer = getPlayerInPosition(targetPosition.id);

    if (currentPlayer && targetPlayer) {
      const newLineup = match.lineup.map(player => {
        if (player.id === currentPlayer.id) {
          return { ...player, position: getDutchPositionName(targetPosition) };
        }
        if (player.id === targetPlayer.id) {
          return { ...player, position: getPositionName(selectedPosition) };
        }
        return player;
      });

      updateMatch({ lineup: newLineup });
    }

    setSelectedPosition(null);
    setIsSubstituting(false);
  };

  const makePlayerToPositionSubstitution = (player: Player, isOnField: boolean) => {
    if (!match || !selectedPosition) return;

    const newLineup = [...match.lineup];
    const newReservePlayers = [...match.reserve_players];
    const currentPositionPlayer = getPlayerInPosition(selectedPosition);

    if (isOnField && currentPositionPlayer) {
      const playerIndex = newLineup.findIndex(p => p.id === player.id);
      const currentIndex = newLineup.findIndex(p => p.id === currentPositionPlayer.id);
      
      if (playerIndex !== -1 && currentIndex !== -1) {
        const tempPosition = newLineup[playerIndex].position;
        newLineup[playerIndex] = { ...newLineup[playerIndex], position: newLineup[currentIndex].position };
        newLineup[currentIndex] = { ...newLineup[currentIndex], position: tempPosition };
      }
    } else if (!isOnField && currentPositionPlayer) {
      const reserveIndex = newReservePlayers.findIndex(p => p.id === player.id);
      const fieldIndex = newLineup.findIndex(p => p.id === currentPositionPlayer.id);
      
      if (reserveIndex !== -1 && fieldIndex !== -1) {
        const positionName = getPositionName(selectedPosition);
        newLineup[fieldIndex] = { ...player, position: positionName };
        newReservePlayers[reserveIndex] = currentPositionPlayer;

        const substitution: Substitution = {
          time: match.match_time,
          quarter: match.current_quarter,
          playerIn: player,
          playerOut: currentPositionPlayer,
          timestamp: new Date().toISOString(),
        };

        const newSubstitutions = [...match.substitutions, substitution];
        
        updateMatch({
          lineup: newLineup,
          reserve_players: newReservePlayers,
          substitutions: newSubstitutions,
        });
      }
    }

    setSelectedPosition(null);
    setIsSubstituting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ... [rest of the JSX remains the same] ... */}
    </SafeAreaView>
  );
}
```

I've added the missing closing brackets and fixed the structure of the code. The main issues were:

1. Missing closing bracket for the `makePlayerToPositionSubstitution` function
2. Missing closing bracket for the component function
3. Proper alignment of the closing brackets

The code should now be properly structured and all functions and components should be properly closed.