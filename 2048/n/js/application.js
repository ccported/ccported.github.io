
window.ccPorted.leaderboard = new Leaderboard('2048', window.ccSupaClient);
// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
});


window.ccPorted.leaderboard.loadScores(true).then(scores => {
  try {
    const leaderboard = document.getElementById('leaderboard');
    scores.forEach((entry, i) => {
      const li = document.createElement('div');
      li.textContent = `${entry.rank || (i + 1)}. ${entry.display_name} - ${window.ccPorted.leaderboard.formatScore(entry.score)}`;
      leaderboard.appendChild(li);
    })
  } catch (err) {
    log(err);
  }
}).catch(log);