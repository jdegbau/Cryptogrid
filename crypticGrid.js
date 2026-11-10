// Function to show the clues table
const showClues = () => {
    const cluesTable = document.getElementById('clues-table');
    const gameRulesContainer = document.getElementById('game-rules-container');
    const cluesTab = document.getElementById('clues-tab');
    const rulesTab = document.getElementById('rules-tab');

    cluesTable.style.display = 'table';
    gameRulesContainer.style.display = 'none';
    cluesTab.classList.add('active');
    rulesTab.classList.remove('active');
};

// Function to show the game rules section
const showRules = () => {
    const cluesTable = document.getElementById('clues-table');
    const gameRulesContainer = document.getElementById('game-rules-container');
    const cluesTab = document.getElementById('clues-tab');
    const rulesTab = document.getElementById('rules-tab');

    cluesTable.style.display = 'none';
    gameRulesContainer.style.display = 'block';
    cluesTab.classList.remove('active');
    rulesTab.classList.add('active');
};

document.addEventListener("DOMContentLoaded", () => {
    // --- Admin override for resetting game and clearing all saved data ---
    // --- Utility: Debounce function for performance (used for saveGameState) ---
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    window.__PSEUDOKU_ADMIN_RESET = function () {
        // Remove all localStorage for this domain
        localStorage.clear();

        // Reset all in-memory state variables
        if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
        guessesLeft = 5;
        timeSpent = 0;
        guessHistory = {};
        currentPuzzle = undefined;

        // Remove all grid and UI content
        const gridContainer = document.getElementById("grid-cells");
        if (gridContainer) gridContainer.innerHTML = '';
        const result = document.getElementById("result");
        if (result) result.textContent = '';
        const errors = document.getElementById("errors");
        if (errors) errors.textContent = '';
        const timer = document.getElementById("timer");
        if (timer) timer.textContent = 'Time: 0:00';
        const shareButton = document.getElementById("share-button");
        if (shareButton) {
            shareButton.style.display = 'none';
            shareButton.classList.remove('glow');
        }
        const checkButton = document.getElementById("check-button");
        if (checkButton) checkButton.style.display = '';

        // Remove all input disables
        document.querySelectorAll("input").forEach(input => input.disabled = false);

        // Reload the game state and puzzle
        if (typeof loadGameState === 'function') {
            loadGameState();
        } else {
            location.reload();
        }
        console.log('%cPseudoku: FULL game state and all saved data have been reset.', 'color: #6200ea; font-weight: bold;');
    };
    let currentPuzzle, guessesLeft = 5, timerInterval;
    let guessHistory = {};
    let timeSpent = 0;
    let allPuzzles = [];
    let puzzleID, puzzleDate;

    // --- Puzzle day ---
    // Everyone gets the same puzzle on the same calendar day in Chicago,
    // wherever they are and whatever the daylight-saving state.
    const PUZZLE_TIME_ZONE = 'America/Chicago';
    const PUZZLE_EPOCH_UTC = Date.UTC(2024, 4, 21); // 21 May 2024 is puzzle day 0
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    // Today's date in Chicago as "YYYY-MM-DD".
    const getPuzzleDate = () => {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: PUZZLE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        const get = (type) => parts.find(p => p.type === type).value;
        return `${get('year')}-${get('month')}-${get('day')}`;
    };

    // Whole days between the epoch and today's Chicago date. Both are taken
    // as UTC midnights, so time zones and DST can't shift the count.
    const getPuzzleDayIndex = () => {
        const [y, m, d] = getPuzzleDate().split('-').map(Number);
        return Math.round((Date.UTC(y, m - 1, d) - PUZZLE_EPOCH_UTC) / MS_PER_DAY);
    };

    const getCurrentPuzzleID = () => {
        const total = allPuzzles.length;
        return (((getPuzzleDayIndex() % total) + total) % total) + 1;
    };

    const updateResultMessage = (message) => {
        const result = document.getElementById("result");
        if (result.textContent !== message) result.textContent = message;
    };

    const updateErrorCount = () => {
        const totalGuesses = 5;
        const guessesUsed = totalGuesses - guessesLeft;
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
        let errorIcons = '';
        for (let i = 0; i < numberEmojis.length; i++) {
            errorIcons += `<span class="guess-icon">${i < guessesUsed ? '❌' : numberEmojis[i]}</span>`;
        }
        document.getElementById("errors").innerHTML = `Guesses: ${errorIcons}`;
    };

    const checkAllCellsCorrect = (userSolution, correctGrid) => {
        for (let rowIndex = 0; rowIndex < correctGrid.length; rowIndex++) {
            for (let colIndex = 0; colIndex < correctGrid[rowIndex].length; colIndex++) {
                if (correctGrid[rowIndex][colIndex] !== userSolution[rowIndex][colIndex]) return false;
            }
        }
        return true;
    };

    const highlightCells = (correctGrid, userSolution) => {
        correctGrid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                const cellDiv = document.querySelector(`.grid-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                if (cellDiv) {
                    const cellContent = cellDiv.querySelector(".grid-cell-content");
                    const input = cellDiv.querySelector("input");
                    if (input) {
                        const guessedValue = parseInt(input.value);
                        if (guessedValue === cell) {
                            cellContent.textContent = cell;
                            cellDiv.classList.add("correct");
                            cellDiv.classList.remove("incorrect", "hint");
                            input.remove();
                            userSolution[rowIndex][colIndex] = cell;  // Update correct answer in userSolution
                        } else if (Math.abs(guessedValue - cell) <= 2) {
                            cellDiv.classList.add("hint");
                            cellDiv.classList.remove("incorrect");
                        } else {
                            cellDiv.classList.add("incorrect");
                            cellDiv.classList.remove("hint");
                        }
                    }
                }
            });
        });
    };

    // `restoring` is true when reloading a game that already ended: show the
    // final state, but don't replay the animations or record stats again.
    const showEndGameMessage = (message, { restoring = false } = {}) => {
        clearInterval(timerInterval);
        document.getElementById("check-button").style.display = "none";
        const shareButton = document.getElementById("share-button");
        shareButton.style.display = "block";
        if (!restoring) shareButton.classList.add("glow");
        const resultDiv = document.getElementById("result");
        let signifier = '';
        let animClass = '';
        const isWin = message.toLowerCase().includes('congrat');
        const isLose = message.toLowerCase().includes('game over');
        if (isWin) {
            signifier = '🎉';
            animClass = restoring ? '' : 'result-animate-win';
        } else if (isLose) {
            signifier = '❌';
            animClass = restoring ? '' : 'result-animate-lose';
        }
        // Default result message
        resultDiv.innerHTML = `<span class="result-signifier ${animClass}" style="font-size:2em;vertical-align:middle;display:inline-block;">${signifier}</span><span>${message}</span>`;

        // Inject animation CSS for result signifier and overlays (only once)
        if (!document.getElementById('pseudoku-result-animations')) {
            const style = document.createElement('style');
            style.id = 'pseudoku-result-animations';
            style.textContent = `
      .result-animate-win {
        animation: pop-bounce 0.7s cubic-bezier(.23,1.32,.59,.99);
      }
      .result-animate-lose {
        animation: shake-lose 0.6s cubic-bezier(.36,.07,.19,.97);
      }
      @keyframes pop-bounce {
        0% { transform: scale(0.2); opacity: 0; }
        60% { transform: scale(1.3); opacity: 1; }
        80% { transform: scale(0.95); }
        100% { transform: scale(1); }
      }
      @keyframes shake-lose {
        0% { transform: translateX(0); }
        20% { transform: translateX(-10px); }
        40% { transform: translateX(10px); }
        60% { transform: translateX(-8px); }
        80% { transform: translateX(8px); }
        100% { transform: translateX(0); }
      }
      /* Emoji rain for win */
      .emoji-rain {
        pointer-events: none;
        position: fixed;
        left: 0; top: 0; width: 100vw; height: 100vh;
        z-index: 9999;
        overflow: visible;
      }
      .emoji-raindrop {
        position: absolute;
        font-size: 2.2em;
        will-change: transform, opacity;
        user-select: none;
        pointer-events: none;
        animation: emoji-fall 1.5s linear forwards;
      }
      @keyframes emoji-fall {
        0% { transform: translateY(-10vh) scale(0.7) rotate(-10deg); opacity: 0.7; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(100vh) scale(1.1) rotate(10deg); opacity: 0; }
      }
      /* Large emoji overlay for loss */
      .emoji-overlay {
        position: fixed;
        left: 0; top: 0; width: 100vw; height: 100vh;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        background: none;
        animation: overlay-fade 2.2s cubic-bezier(.23,1.32,.59,.99);
      }
      .emoji-overlay-inner {
        font-size: 8em;
        filter: drop-shadow(0 0 16px #b00020cc);
        animation: pop-bounce 0.7s cubic-bezier(.23,1.32,.59,.99);
      }
      @keyframes overlay-fade {
        0% { opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
            document.head.appendChild(style);
        }

        document.querySelectorAll("input").forEach(input => input.disabled = true);

        // --- WIN: Emoji rain effect ---
        if (isWin && !restoring) {
            // Remove any previous rain
            const prevRain = document.querySelector('.emoji-rain');
            if (prevRain) prevRain.remove();
            const rainContainer = document.createElement('div');
            rainContainer.className = 'emoji-rain';
            document.body.appendChild(rainContainer);
            // Rain 24-32 emojis, randomize X position, delay, and speed
            const rainCount = 28;
            for (let i = 0; i < rainCount; i++) {
                const drop = document.createElement('span');
                drop.className = 'emoji-raindrop';
                drop.textContent = '🎉';
                // Randomize horizontal position (5% to 95%)
                drop.style.left = `${Math.random() * 90 + 5}%`;
                // Randomize animation duration (1.2s to 2.1s)
                const duration = 1.2 + Math.random() * 0.9;
                drop.style.animationDuration = `${duration}s`;
                // Randomize animation delay (0 to 0.7s)
                drop.style.animationDelay = `${Math.random() * 0.7}s`;
                // Randomize size (1.5em to 2.7em)
                drop.style.fontSize = `${1.5 + Math.random() * 1.2}em`;
                rainContainer.appendChild(drop);
            }
            // Remove rain after 2.2s
            setTimeout(() => {
                rainContainer.remove();
            }, 2200);
        }

        // --- LOSE: Large emoji overlay ---
        if (isLose && !restoring) {
            // Remove any previous overlay
            const prevOverlay = document.querySelector('.emoji-overlay');
            if (prevOverlay) prevOverlay.remove();
            const overlay = document.createElement('div');
            overlay.className = 'emoji-overlay';
            overlay.innerHTML = `<span class="emoji-overlay-inner">❌</span>`;
            document.body.appendChild(overlay);
            setTimeout(() => {
                overlay.remove();
            }, 2200);
        }

        // --- Share logic and stats ---
        const gridEmojis = generateGridEmojis();
        const totalGuesses = 5;
        const guessesUsed = totalGuesses - guessesLeft;
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
        const guessStatus = numberEmojis.map((emoji, index) => index < guessesUsed ? '❌' : emoji).join('');
        const websiteUrl = window.location.origin + window.location.pathname;
        const shareText = `Pseudoku — #${puzzleID}\n\n${gridEmojis}\nGuesses: ${guessStatus}\nTime: ${formatTime(timeSpent)}\nPlay: ${websiteUrl}`;
        // --- Save daily stats to localStorage (once, when the game ends) ---
        if (!restoring) try {
            const todayStr = puzzleDate; // the day of the puzzle being played (Chicago), YYYY-MM-DD
            let statsHistory = [];
            try {
                statsHistory = JSON.parse(localStorage.getItem('pseudokuStatsHistory')) || [];
            } catch (e) { }
            // Remove any existing entry for today
            statsHistory = statsHistory.filter(entry => entry.date !== todayStr);
            statsHistory.push({
                date: todayStr,
                win: isWin,
                guessesUsed: guessesUsed,
                timeSpent: timeSpent
            });
            localStorage.setItem('pseudokuStatsHistory', JSON.stringify(statsHistory));
        } catch (e) {
            // ignore
        }
        shareButton.onclick = () => {
            if (navigator.share) {
                navigator.share({
                    text: shareText
                }).catch(err => console.error('Error sharing:', err));
            } else {
                navigator.clipboard.writeText(shareText).then(() => alert("Score copied to clipboard!"));
            }
        };
    };
    // --- Stats Modal and Chart.js integration ---
    // Show stats modal
    window.showStatsModal = function () {
        let modal = document.getElementById('stats-modal');
        if (!modal) return;
        modal.style.display = 'block';
        renderStatsCharts();
    };

    // Hide stats modal
    window.hideStatsModal = function () {
        let modal = document.getElementById('stats-modal');
        if (!modal) return;
        modal.style.display = 'none';
    };

    // Render stats charts using Chart.js
    window.renderStatsCharts = function () {
        let statsHistory = [];
        try {
            statsHistory = JSON.parse(localStorage.getItem('pseudokuStatsHistory')) || [];
        } catch (e) { }
        // Sort by date ascending
        statsHistory.sort((a, b) => a.date.localeCompare(b.date));

        // Prepare data
        const dates = statsHistory.map(e => e.date);
        const wins = statsHistory.map(e => e.win ? 1 : 0);
        const guesses = statsHistory.map(e => e.guessesUsed);
        const times = statsHistory.map(e => e.timeSpent);

        // Win rate
        const winRate = statsHistory.length ? (wins.reduce((a, b) => a + b, 0) / statsHistory.length * 100).toFixed(1) : '0';
        // Current streak
        let streak = 0;
        for (let i = statsHistory.length - 1; i >= 0; i--) {
            if (statsHistory[i].win) streak++;
            else break;
        }
        // Average guesses
        const avgGuesses = guesses.length ? (guesses.reduce((a, b) => a + b, 0) / guesses.length).toFixed(2) : '0';
        // Average time
        const avgTime = times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : '0';

        // Update stats summary
        document.getElementById('stats-summary').innerHTML = `
            <b>Games played:</b> ${statsHistory.length}<br>
            <b>Win rate:</b> ${winRate}%<br>
            <b>Current streak:</b> ${streak}<br>
            <b>Avg. guesses used:</b> ${avgGuesses}<br>
            <b>Avg. time (s):</b> ${avgTime}
        `;

        // Render charts
        // Destroy previous charts if any
        if (window.statsWinChart) window.statsWinChart.destroy();
        if (window.statsGuessChart) window.statsGuessChart.destroy();
        if (window.statsTimeChart) window.statsTimeChart.destroy();

        // Win/loss pie chart using official color palette
        // Official palette (from styles.css):
        // --primary: #6200ea; --accent: #03dac6; --error: #b00020; --success: #00c853; --hint: #ffd600;
        const winColor = '#00c853'; // success
        const lossColor = '#b00020'; // error
        const ctxWin = document.getElementById('stats-win-chart').getContext('2d');
        const winCount = wins.reduce((a, b) => a + b, 0);
        const lossCount = wins.length - winCount;
        window.statsWinChart = new Chart(ctxWin, {
            type: 'pie',
            data: {
                labels: ['Wins', 'Losses'],
                datasets: [{
                    data: [winCount, lossCount],
                    backgroundColor: [winColor, lossColor],
                    borderColor: ['#fff', '#fff'],
                    borderWidth: 2
                }]
            },
            options: {
                plugins: {
                    legend: { display: true, position: 'bottom' },
                    tooltip: { enabled: true }
                },
                responsive: false,
                maintainAspectRatio: false,
                layout: { padding: 0 },
            },
        });

        // Guesses used line chart
        const ctxGuess = document.getElementById('stats-guess-chart').getContext('2d');
        window.statsGuessChart = new Chart(ctxGuess, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Guesses Used',
                    data: guesses,
                    borderColor: '#2196f3',
                    backgroundColor: 'rgba(33,150,243,0.2)',
                    fill: true
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 5, ticks: { stepSize: 1 } } }
            }
        });

        // Time spent line chart
        const ctxTime = document.getElementById('stats-time-chart').getContext('2d');
        window.statsTimeChart = new Chart(ctxTime, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Time Spent (s)',
                    data: times,
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255,152,0,0.2)',
                    fill: true
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { min: 0 } }
            }
        });
    };

    const generateGridEmojis = () => {
        return currentPuzzle.answerGrid.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
                const cellDiv = document.querySelector(`.grid-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                if (cellDiv.classList.contains("preset")) return '🟦';
                if (cellDiv.classList.contains("correct")) return '🟩';
                if (cellDiv.classList.contains("incorrect")) return '🟥';
                if (cellDiv.classList.contains("hint")) return '🟨';
                return '⬜'; // default for not attempted cells
            }).join('')
        ).join('\n');
    };

    const startTimer = () => {
        const timerElement = document.getElementById("timer");
        timerInterval = setInterval(() => {
            timeSpent++;
            timerElement.textContent = `Time: ${formatTime(timeSpent)}`;
        }, 1000);
    };

    const formatTime = (seconds) => {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    const displayPuzzle = (grid) => {
        const gridContainer = document.getElementById("grid-cells");
        gridContainer.innerHTML = '';

        // Create a 6x6 grid to accommodate labels
        const columnLabels = ['A', 'B', 'C', 'D'];
        const rowLabels = ['1', '2', '3', '4'];

        // Initialize guess history from localStorage if available
        let loadedGuessHistory = {};
        try {
            const gameState = JSON.parse(localStorage.getItem('pseudokuGameState'));
            if (gameState && gameState.guessHistory) {
                loadedGuessHistory = gameState.guessHistory;
            }
        } catch (e) { }
        guessHistory = loadedGuessHistory;

        // Create the labels in the first and last row and column
        gridContainer.appendChild(document.createElement('div')); // Empty top-left corner
        columnLabels.forEach(label => {
            const colLabel = document.createElement('div');
            colLabel.classList.add('column-label');
            colLabel.textContent = label;
            gridContainer.appendChild(colLabel);
        });
        gridContainer.appendChild(document.createElement('div')); // Empty top-right corner

        grid.forEach((row, rowIndex) => {
            // Add the row label on the left
            const rowLabelLeft = document.createElement('div');
            rowLabelLeft.classList.add('row-label');
            rowLabelLeft.textContent = rowLabels[rowIndex];
            gridContainer.appendChild(rowLabelLeft);

            // Add the grid cells
            row.forEach((cell, colIndex) => {
                const cellDiv = document.createElement("div");
                cellDiv.classList.add("grid-cell");
                cellDiv.dataset.row = rowIndex;
                cellDiv.dataset.col = colIndex;

                // Guess history popover
                const cellId = `${rowIndex}-${colIndex}`;
                guessHistory[cellId] = guessHistory[cellId] || [];
                const guessPopover = document.createElement('div');
                guessPopover.className = 'guess-history-popover';
                guessPopover.style.display = 'none';
                cellDiv.appendChild(guessPopover);

                const cellContent = document.createElement("div");
                cellContent.classList.add("grid-cell-content");

                if (cell !== null) {
                    cellContent.textContent = cell;
                    cellDiv.classList.add("preset");
                } else {
                    cellContent.appendChild(createCellInput(rowIndex, colIndex));
                }

                // --- Guess history popover logic ---
                let popoverTimeout;
                const showPopover = () => {
                    // Only show popover if cell is not completed and correct, and not a preset cell
                    if (cellDiv.classList.contains('correct') || cellDiv.classList.contains('revealed') || cellDiv.classList.contains('preset')) return;
                    guessPopover.innerHTML = '';
                    const guesses = guessHistory[cellId] || [];
                    if (guesses.length === 0) {
                        guessPopover.innerHTML = '<span class="guess-history-empty">No guesses yet</span>';
                    } else {
                        // Get the correct value for this cell
                        let correctValue = undefined;
                        if (currentPuzzle && currentPuzzle.answerGrid) {
                            correctValue = currentPuzzle.answerGrid[rowIndex][colIndex];
                        }
                        // Create a container for two-column layout
                        const chipsContainer = document.createElement('div');
                        chipsContainer.className = 'chips-two-column';
                        guesses.forEach(num => {
                            const chip = document.createElement('span');
                            chip.className = 'guess-chip';
                            chip.textContent = num;
                            if (correctValue !== undefined) {
                                const guessNum = parseInt(num);
                                if (guessNum === correctValue) {
                                    chip.classList.add('chip-correct');
                                } else if (Math.abs(guessNum - correctValue) <= 2) {
                                    chip.classList.add('chip-hint');
                                } else {
                                    chip.classList.add('chip-incorrect');
                                }
                            }
                            chipsContainer.appendChild(chip);
                        });
                        guessPopover.appendChild(chipsContainer);
                    }
                    guessPopover.style.display = 'flex';
                    // Auto-hide after 2.5s on mobile
                    if ('ontouchstart' in window) {
                        clearTimeout(popoverTimeout);
                        popoverTimeout = setTimeout(() => { guessPopover.style.display = 'none'; }, 2500);
                    }
                };
                const hidePopover = () => {
                    guessPopover.style.display = 'none';
                };

                // Desktop: show on mouseenter/focus, hide on mouseleave/blur
                cellDiv.addEventListener('mouseenter', showPopover);
                cellDiv.addEventListener('mouseleave', hidePopover);
                cellDiv.addEventListener('focusin', showPopover);
                cellDiv.addEventListener('focusout', hidePopover);

                // Mobile: show on tap. Taps elsewhere are handled by the single
                // document-level listener (hideOtherPopovers), added once.
                cellDiv.addEventListener('touchstart', showPopover);

                cellDiv.appendChild(cellContent);
                gridContainer.appendChild(cellDiv);
            });

            // Add the row label on the right
            const rowLabelRight = document.createElement('div');
            rowLabelRight.classList.add('row-label');
            rowLabelRight.textContent = rowLabels[rowIndex];
            gridContainer.appendChild(rowLabelRight);
        });

        gridContainer.appendChild(document.createElement('div')); // Empty bottom-left corner
        columnLabels.forEach(label => {
            const colLabel = document.createElement('div');
            colLabel.classList.add('column-label');
            colLabel.textContent = label;
            gridContainer.appendChild(colLabel);
        });
        gridContainer.appendChild(document.createElement('div')); // Empty bottom-right corner

        updateResultMessage(`You have ${guessesLeft} guesses left.`);
        updateErrorCount();
    };

    // Hide every guess popover whose cell wasn't the one tapped.
    const hideOtherPopovers = (e) => {
        document.querySelectorAll('.guess-history-popover').forEach(popover => {
            if (!popover.parentElement.contains(e.target)) popover.style.display = 'none';
        });
    };
    document.addEventListener('touchstart', hideOtherPopovers);

    // Flash a cell and show "Already guessed!" for a repeated value.
    const showDuplicateWarning = (cellDiv) => {
        cellDiv.style.outline = '2px solid red';
        const duplicateMessage = document.createElement('div');
        duplicateMessage.className = 'duplicate-message';
        duplicateMessage.textContent = 'Already guessed!';
        cellDiv.appendChild(duplicateMessage);
        setTimeout(() => {
            cellDiv.style.outline = '2px solid transparent';
            duplicateMessage.remove();
        }, 2000);
    };

    // Build an editable cell input with all of its handlers. Used both when
    // the grid is first drawn and when a saved game is restored.
    const createCellInput = (rowIndex, colIndex) => {
        const cellId = `${rowIndex}-${colIndex}`;
        guessHistory[cellId] = guessHistory[cellId] || [];

        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric"; // Hint that the input should be numeric
        input.maxLength = "1";
        input.pattern = "[1-9]"; // Allow only digits 1-9
        input.ariaLabel = "Enter a number between 1 and 9";
        input.dataset.row = rowIndex;
        input.dataset.col = colIndex;

        // Digits 1-9 overwrite the current value unless already guessed.
        input.addEventListener('keydown', (e) => {
            if (/^[1-9]$/.test(e.key)) {
                e.preventDefault();
                if (guessHistory[cellId].includes(e.key)) {
                    showDuplicateWarning(e.target.closest(".grid-cell"));
                    return;
                }
                e.target.value = e.key;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (
                ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key) ||
                e.ctrlKey || e.metaKey
            ) {
                // Allow navigation, editing and copy/paste
            } else {
                e.preventDefault();
            }
        });

        // Handles paste, mobile keyboards and programmatic changes.
        input.addEventListener('input', (e) => {
            const value = e.target.value.slice(-1);
            if (!/^[1-9]$/.test(value)) {
                e.target.value = '';
                return;
            }
            if (guessHistory[cellId].includes(value)) {
                e.target.value = '';
                showDuplicateWarning(e.target.closest(".grid-cell"));
                return;
            }
            e.target.value = value;
            handleInput(e, rowIndex, colIndex);
        });

        return input;
    };

    const handleInput = (e, rowIndex, colIndex) => {
        if (e.target.value.length === 1) {
            const nextCell = getNextBlankCell(rowIndex, colIndex);
            if (nextCell) {
                nextCell.focus();
            }
        }
    };

    const getNextBlankCell = (rowIndex, colIndex) => {
        const inputs = Array.from(document.querySelectorAll("input"));
        const currentIndex = inputs.findIndex(input => input.dataset.row == rowIndex && input.dataset.col == colIndex);

        for (let i = currentIndex + 1; i < inputs.length; i++) {
            if (inputs[i].value === '') {
                return inputs[i];
            }
        }

        for (let i = 0; i < currentIndex; i++) {
            if (inputs[i].value === '') {
                return inputs[i];
            }
        }

        return null;
    };

    const getReadableRule = (rule) => {
        const rules = {
            palindromic: 'Numbers form a palindrome',
            sum_even: 'Sum of numbers is even',
            sum_odd: 'Sum of numbers is odd',
            above_threshold: `All numbers are greater than ${rule.target}`,
            below_threshold: `All numbers are less than ${rule.target}`,
            even: 'All numbers are even',
            odd: 'All numbers are odd',
            increasing: 'Each number is equal to or greater than the one before',
            decreasing: 'Each number is equal to or less than the one before',
            sum: `Sum of numbers is ${rule.target}`,
            unique_digits: 'All numbers are unique',
            alternating_parity: 'Numbers alternate odd, even, odd, even',
            majority_even: 'At least 3 of the numbers are even',
            majority_odd: 'At least 3 of the numbers are odd'
        };
        return rules[rule.rule] || 'Unknown rule';
    };

    const displayClues = (rowRules, colRules) => {
        const rowCluesContainer = document.getElementById("row-clues");
        const colCluesContainer = document.getElementById("col-clues");

        rowCluesContainer.innerHTML = "";
        colCluesContainer.innerHTML = "";

        rowRules.forEach((rule, index) => {
            const row = document.createElement("tr");
            const rowLabel = document.createElement("td");
            rowLabel.textContent = `Row ${index + 1}`;
            const rowClue = document.createElement("td");
            rowClue.textContent = getReadableRule(rule);
            row.appendChild(rowLabel);
            row.appendChild(rowClue);
            rowCluesContainer.appendChild(row);
        });

        const columnLetters = ['A', 'B', 'C', 'D'];
        colRules.forEach((rule, index) => {
            const row = document.createElement("tr");
            const colLabel = document.createElement("td");
            colLabel.textContent = `Column ${columnLetters[index]}`;
            const colClue = document.createElement("td");
            colClue.textContent = getReadableRule(rule);
            row.appendChild(colLabel);
            row.appendChild(colClue);
            colCluesContainer.appendChild(row);
        });
    };

    const checkSolution = () => {
        const submitButton = document.getElementById("check-button");
        // Disable the submit button
        submitButton.disabled = true;

        // Every cell must be filled before a guess can be submitted.
        const emptyInputs = Array.from(document.querySelectorAll(".grid-cell input")).filter(input => input.value === '');
        if (emptyInputs.length > 0) {
            emptyInputs.forEach(input => {
                const cellDiv = input.closest('.grid-cell');
                cellDiv.classList.add('shake');
                setTimeout(() => cellDiv.classList.remove('shake'), 500);
            });
            updateResultMessage('Fill in every cell before submitting.');
            emptyInputs[0].focus();
            setTimeout(() => {
                submitButton.disabled = false;
            }, 1000);
            return;
        }

        let hasDuplicate = false;
        let firstDuplicateInput = null;
        document.querySelectorAll("input").forEach(input => {
            const rowIndex = input.dataset.row;
            const colIndex = input.dataset.col;
            const cellId = `${rowIndex}-${colIndex}`;
            const val = input.value;
            if (val && guessHistory[cellId] && guessHistory[cellId].includes(val)) {
                hasDuplicate = true;
                // Add shake class to the cell
                const cellDiv = input.closest('.grid-cell');
                cellDiv.classList.add('shake');
                // Remove shake class after animation
                setTimeout(() => {
                    cellDiv.classList.remove('shake');
                }, 500);
                if (!firstDuplicateInput) firstDuplicateInput = input;
            }
        });

        if (hasDuplicate) {
            updateResultMessage('You cannot submit with a previously guessed value!');
            // Focus the first duplicate input for user convenience
            if (firstDuplicateInput) firstDuplicateInput.focus();
            // Re-enable the submit button after a short delay
            setTimeout(() => {
                submitButton.disabled = false;
            }, 1000);
            return;
        }

        const userSolution = getUserSolution(); // Use getUserSolution to get the current state of the solution
        highlightCells(currentPuzzle.answerGrid, userSolution);
        const allCorrect = checkAllCellsCorrect(userSolution, currentPuzzle.answerGrid);

        // Populate guess history (avoid duplicates, only add if not already present and not empty)
        document.querySelectorAll("input").forEach(input => {
            const rowIndex = input.dataset.row;
            const colIndex = input.dataset.col;
            const cellId = `${rowIndex}-${colIndex}`;
            const val = input.value;
            if (val && !guessHistory[cellId].includes(val)) {
                guessHistory[cellId].push(val);
            }
        });

        if (allCorrect) {
            showEndGameMessage("Congratulations! You've solved the puzzle!");
        } else {
            guessesLeft--;
            updateErrorCount();
            if (guessesLeft <= 0) {
                revealCorrectAnswers();
                showEndGameMessage("Game over! You've used all your guesses.");
            } else {
                updateResultMessage(`Incorrect! You have ${guessesLeft} guesses left.`);
            }
        }

        // Re-enable the submit button after 3 seconds
        setTimeout(() => {
            submitButton.disabled = false;
        }, 3000);

        // Save game state after checking the solution
        saveGameState();
    };

    const revealCorrectAnswers = () => {
        currentPuzzle.answerGrid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                const cellDiv = document.querySelector(`.grid-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                if (cellDiv) {
                    const cellContent = cellDiv.querySelector(".grid-cell-content");
                    const input = cellDiv.querySelector("input");
                    if (input && parseInt(input.value) !== cell) {
                        cellContent.textContent = cell;
                        cellDiv.classList.add("revealed");
                        input.remove();
                    }
                }
            });
        });
    };

    // Snapshot of the game for localStorage. puzzleID and puzzleDate are the
    // puzzle being played, so a page left open past midnight saves correctly.
    const buildGameState = () => ({
        guessesLeft,
        timeSpent,
        guessHistory,
        currentPuzzle,
        userSolution: getUserSolution(),
        cellStates: getCellStates(),
        gameOver: guessesLeft <= 0 || checkAllCellsCorrect(getUserSolution(), currentPuzzle.answerGrid),
        puzzleID,
        puzzleDate
    });

    const writeGameState = () => {
        if (!currentPuzzle) return; // nothing loaded yet
        localStorage.setItem('pseudokuGameState', JSON.stringify(buildGameState()));
    };

    // Debounced save for performance
    const saveGameState = debounce(writeGameState, 300);

    const getUserSolution = () => {
        const userSolution = [];
        document.querySelectorAll('.grid-cell').forEach(cell => {
            const row = cell.dataset.row;
            const col = cell.dataset.col;
            if (!userSolution[row]) userSolution[row] = [];
            const input = cell.querySelector('input');
            userSolution[row][col] = input ? parseInt(input.value) : parseInt(cell.querySelector('.grid-cell-content').textContent);
        });
        return userSolution;
    };

    const getCellStates = () => {
        const cellStates = [];
        document.querySelectorAll('.grid-cell').forEach(cell => {
            const row = cell.dataset.row;
            const col = cell.dataset.col;
            if (!cellStates[row]) cellStates[row] = [];
            cellStates[row][col] = cell.className;
        });
        return cellStates;
    };

    const loadGameState = () => {
        clearInterval(timerInterval); // Ensure any existing timer is cleared
        let gameState = null;
        try {
            gameState = JSON.parse(localStorage.getItem('pseudokuGameState'));
        } catch (e) { }
        // Only resume a save from today's puzzle (same ID and same Chicago date).
        if (gameState && gameState.puzzleID === puzzleID && gameState.puzzleDate === puzzleDate) {
            guessesLeft = gameState.guessesLeft;
            timeSpent = gameState.timeSpent; // Restore elapsed time
            guessHistory = gameState.guessHistory;
            currentPuzzle = gameState.currentPuzzle;

            // Restore the user solution and cell states
            displayPuzzle(currentPuzzle.displayGrid);
            restoreUserSolution(gameState.userSolution);
            restoreCellStates(gameState.cellStates);

            // Update the UI elements
            updateErrorCount();

            if (!gameState.gameOver) {
                startTimer();
            } else {
                // Clear the timer interval and update the timer element manually if the game was over
                document.getElementById("timer").textContent = `Time: ${formatTime(timeSpent)}`;
            }

            // Display clues
            displayClues(currentPuzzle.rowRules, currentPuzzle.colRules);

            // If the game was over, show the end game message
            if (gameState.gameOver) {
                const message = guessesLeft <= 0 ? "Game over! You've used all your guesses." : "Congratulations! You've solved the puzzle!";
                showEndGameMessage(message, { restoring: true });
            }
        } else {
            // No valid saved game state, load the current puzzle
            localStorage.removeItem('pseudokuGameState');
            loadPuzzle(puzzleID);
        }
    };

    const restoreUserSolution = (userSolution) => {
        userSolution.forEach((row, rowIndex) => {
            row.forEach((value, colIndex) => {
                const cell = document.querySelector(`.grid-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                if (cell) {
                    const cellContent = cell.querySelector('.grid-cell-content');
                    if (value && (cell.classList.contains('correct') || cell.classList.contains('revealed'))) {
                        cellContent.textContent = value;
                        const input = cell.querySelector('input');
                        if (input) {
                            input.remove();
                        }
                    } else {
                        const input = cell.querySelector('input');
                        if (value && !cell.classList.contains('preset')) {
                            if (input) {
                                input.value = value;
                            } else {
                                const newInput = createCellInput(rowIndex, colIndex);
                                newInput.value = value;
                                cellContent.appendChild(newInput);
                            }
                        }
                    }
                }
            });
        });
    };

    const restoreCellStates = (cellStates) => {
        cellStates.forEach((row, rowIndex) => {
            row.forEach((state, colIndex) => {
                const cell = document.querySelector(`.grid-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                if (cell) {
                    cell.className = state;
                    if (cell.classList.contains('correct') || cell.classList.contains('revealed')) {
                        const cellContent = cell.querySelector('.grid-cell-content');
                        const input = cell.querySelector('input');
                        if (input) {
                            input.remove();
                        }
                        cellContent.textContent = currentPuzzle.answerGrid[rowIndex][colIndex];
                    }
                }
            });
        });
    };

    const loadPuzzle = (id) => {
        currentPuzzle = allPuzzles.find(p => p.id === id);
        if (!currentPuzzle) {
            console.error(`Puzzle with ID ${id} not found`);
            updateResultMessage("Sorry, today's puzzle couldn't be loaded.");
            return;
        }
        timeSpent = 0; // Reset elapsed time
        startTimer();
        displayPuzzle(currentPuzzle.displayGrid);
        displayClues(currentPuzzle.rowRules, currentPuzzle.colRules);
    };

    // Load the puzzle list first: today's puzzle ID depends on how many there are.
    const initGame = async () => {
        try {
            const response = await fetch('grids.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            allPuzzles = await response.json();
        } catch (error) {
            console.error('Error loading puzzles:', error);
            updateResultMessage("Sorry, today's puzzle couldn't be loaded.");
            return;
        }
        puzzleDate = getPuzzleDate();
        puzzleID = getCurrentPuzzleID();
        loadGameState();
    };

    document.getElementById("check-button").addEventListener("click", checkSolution);

    initGame();

    // Save immediately before the user leaves the page
    window.addEventListener("beforeunload", writeGameState);
});
