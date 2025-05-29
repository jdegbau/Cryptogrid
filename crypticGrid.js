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
    let guessHistory = {}; // Track guesses for each cell
    let timeSpent = 0; // Track elapsed time

    // Set the arbitrary start date (e.g., today)
    const startDate = new Date('Tues May 21 2024 00:00:00 GMT-0500 (Central Daylight Time)'); // Replace with your chosen start date

    // Get the current date and convert it to CST
    const today = new Date();
    const cstOffset = -5 * 60; // CST is UTC-5
    const todayCST = new Date(today.getTime() + (today.getTimezoneOffset() + cstOffset) * 60000);

    // Set the time to the most recent midnight
    todayCST.setHours(0, 0, 0, 0);

    // Calculate the number of days since the start date
    const timeDifference = todayCST.getTime() - startDate.getTime();
    const daysSinceStart = Math.ceil(timeDifference / (1000 * 3600 * 24));
    console.log(daysSinceStart);

    // Total number of puzzle IDs available (assuming 10 in this example)
    const totalPuzzleIds = 10;

    // Set the puzzleID to the number of days since the start date, looping if necessary
    const puzzleID = ((daysSinceStart) % totalPuzzleIds) + 1;
    console.log(puzzleID);

    const updateResultMessage = (message) => {
        document.getElementById("result").textContent = message;
    };

    const updateErrorCount = () => {
        const totalGuesses = 5;
        const guessesUsed = totalGuesses - guessesLeft;
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
        const errorIcons = numberEmojis.map((emoji, index) => {
            return `<span class="guess-icon">${index < guessesUsed ? '❌' : emoji}</span>`;
        }).join('');
        document.getElementById("errors").innerHTML = `Guesses: ${errorIcons}`;
    };

    const checkAllCellsCorrect = (userSolution, correctGrid) => {
        for (let rowIndex = 0; rowIndex < correctGrid.length; rowIndex++) {
            for (let colIndex = 0; colIndex < correctGrid[rowIndex].length; colIndex++) {
                if (correctGrid[rowIndex][colIndex] !== userSolution[rowIndex][colIndex]) {
                    return false;
                }
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

    const showEndGameMessage = (message) => {
        clearInterval(timerInterval);
        document.getElementById("check-button").style.display = "none";
        const shareButton = document.getElementById("share-button");
        shareButton.style.display = "block";
        shareButton.classList.add("glow"); // Add the glow effect
        document.getElementById("result").textContent = message;
        document.querySelectorAll("input").forEach(input => input.disabled = true);

        const gridEmojis = generateGridEmojis();
        const totalGuesses = 5;
        const guessesUsed = totalGuesses - guessesLeft;
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
        const guessStatus = numberEmojis.map((emoji, index) => index < guessesUsed ? '❌' : emoji).join('');
        const shareText = `Pseudoku — #${puzzleID}\n\n${gridEmojis}\nGuesses: ${guessStatus}\nTime: ${formatTime(timeSpent)}`;
        // --- Save daily stats to localStorage ---
        try {
            const todayStr = (new Date()).toISOString().slice(0, 10); // YYYY-MM-DD
            let statsHistory = [];
            try {
                statsHistory = JSON.parse(localStorage.getItem('pseudokuStatsHistory')) || [];
            } catch (e) { }
            // Remove any existing entry for today
            statsHistory = statsHistory.filter(entry => entry.date !== todayStr);
            statsHistory.push({
                date: todayStr,
                win: message.toLowerCase().includes('congrat'),
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

    const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

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

                let isCompletedCorrect = false;
                // Check if this cell is completed and correct (no input, matches answerGrid)
                if (cell !== null) {
                    cellContent.textContent = cell;
                    cellDiv.classList.add("preset");
                } else {
                    // If the cell is correct (no input, correct value shown), mark as completed
                    let completed = false;
                    if (currentPuzzle && currentPuzzle.answerGrid) {
                        const correctValue = currentPuzzle.answerGrid[rowIndex][colIndex];
                        // If the cell is already filled and not an input, it's correct
                        if (typeof correctValue !== 'undefined') {
                            // Check if the cell will be rendered as correct (no input, value matches answer)
                            // This logic matches the highlightCells logic
                            // If the cellContent will be set to correctValue and no input, it's completed
                            // We'll check after restoreUserSolution as well, but for now:
                            // If the cell is not preset and not input, and content matches correctValue
                            // We'll check after DOM is restored, but for now, we only show popover for editable cells
                        }
                    }
                    const input = document.createElement("input");
                    input.type = "text";
                    input.inputMode = "numeric"; // Hint that the input should be numeric
                    input.maxLength = "1";
                    input.pattern = "[1-9]"; // Allow only digits 1-9
                    input.ariaLabel = "Enter a number between 1 and 9"; // ARIA label for accessibility
                    input.dataset.row = rowIndex;
                    input.dataset.col = colIndex;

                    // Ensure the input is a valid digit between 1 and 9 and has not been guessed already
                    // Overwrite value on keydown for digits 1-9
                    input.addEventListener('keydown', (e) => {
                        // Only process single digit keys 1-9 (not numpad)
                        if (/^[1-9]$/.test(e.key)) {
                            // Prevent entering if already guessed
                            if (guessHistory[cellId].includes(e.key)) {
                                e.preventDefault();
                                const cellDiv = e.target.closest(".grid-cell");
                                cellDiv.style.outline = '2px solid red';
                                const duplicateMessage = document.createElement('div');
                                duplicateMessage.className = 'duplicate-message';
                                duplicateMessage.textContent = 'Already guessed!';
                                cellDiv.appendChild(duplicateMessage);
                                setTimeout(() => {
                                    cellDiv.style.outline = '2px solid transparent';
                                    cellDiv.removeChild(duplicateMessage);
                                }, 2000);
                                return;
                            }
                            // Overwrite the value with the new digit
                            e.preventDefault();
                            e.target.value = e.key;
                            // Optionally, trigger input event for downstream logic
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        } else if (
                            // Allow navigation, backspace, delete, tab, arrows, etc.
                            ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)
                        ) {
                            // Allow default
                        } else if (e.ctrlKey || e.metaKey) {
                            // Allow copy/paste/select all
                        } else {
                            // Block all other keys
                            e.preventDefault();
                        }
                    });

                    // Keep input event for pasting and programmatic changes
                    input.addEventListener('input', (e) => {
                        let value = e.target.value;
                        // Always keep only the last character typed
                        if (value.length > 1) {
                            value = value.slice(-1);
                        }
                        // If not a valid digit 1-9, clear
                        if (!/^[1-9]$/.test(value)) {
                            e.target.value = '';
                            return;
                        }
                        // If already guessed, clear and show message
                        if (guessHistory[cellId].includes(value)) {
                            e.target.value = '';
                            const cellDiv = e.target.closest(".grid-cell");
                            cellDiv.style.outline = '2px solid red';
                            const duplicateMessage = document.createElement('div');
                            duplicateMessage.className = 'duplicate-message';
                            duplicateMessage.textContent = 'Already guessed!';
                            cellDiv.appendChild(duplicateMessage);
                            setTimeout(() => {
                                cellDiv.style.outline = '2px solid transparent';
                                cellDiv.removeChild(duplicateMessage);
                            }, 2000);
                            return;
                        }
                        // Set the value to the last valid character
                        e.target.value = value;
                    });

                    input.addEventListener('input', (e) => handleInput(e, rowIndex, colIndex));
                    cellContent.appendChild(input);
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

                // Mobile: show on tap
                cellDiv.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    showPopover();
                });
                // Hide all popovers on touch elsewhere
                document.body.addEventListener('touchstart', (e) => {
                    if (!cellDiv.contains(e.target)) hidePopover();
                });

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
            increasing: 'Numbers are in ascending order',
            decreasing: 'Numbers are in descending order',
            sum: `Sum of numbers is ${rule.target}`,
            unique_digits: 'All numbers are unique',
            alternating_parity: 'Numbers alternate between odd and even',
            majority_even: `3 of the numbers are even numbers`,
            majority_odd: `3 of the numbers are odd numbers`
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

    const saveGameState = () => {
        const gameState = {
            guessesLeft: guessesLeft,
            timeSpent: timeSpent, // Save elapsed time in seconds
            guessHistory: guessHistory,
            currentPuzzle: currentPuzzle,
            userSolution: getUserSolution(), // Function to get the current user solution grid
            cellStates: getCellStates(), // Function to get the current state of each cell
            gameOver: guessesLeft <= 0 || checkAllCellsCorrect(getUserSolution(), currentPuzzle.answerGrid),
            puzzleID: getCurrentPuzzleID() // Save the current puzzle ID
        };
        localStorage.setItem('pseudokuGameState', JSON.stringify(gameState));
    };


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
        const gameState = JSON.parse(localStorage.getItem('pseudokuGameState'));
        const currentPuzzleID = getCurrentPuzzleID(); // Function to get the current puzzle ID
        if (gameState && gameState.puzzleID === currentPuzzleID) {
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
                showEndGameMessage(message);
            }
        } else {
            // No valid saved game state, load the current puzzle
            localStorage.removeItem('pseudokuGameState');
            loadPuzzle(currentPuzzleID);
        }
    };

    const getCurrentPuzzleID = () => {
        const startDate = new Date('Tues May 21 2024 00:00:00 GMT-0500 (Central Daylight Time)'); // Replace with your chosen start date
        const today = new Date();
        const cstOffset = -5 * 60; // CST is UTC-5
        const todayCST = new Date(today.getTime() + (today.getTimezoneOffset() + cstOffset) * 60000);
        todayCST.setHours(0, 0, 0, 0);
        const timeDifference = todayCST.getTime() - startDate.getTime();
        const daysSinceStart = Math.ceil(timeDifference / (1000 * 3600 * 24));
        const totalPuzzleIds = 10;
        return ((daysSinceStart) % totalPuzzleIds) + 1;
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
                                const newInput = document.createElement('input');
                                newInput.type = 'text';
                                newInput.inputMode = 'numeric';
                                newInput.maxLength = '1';
                                newInput.pattern = '[1-9]';
                                newInput.ariaLabel = 'Enter a number between 1 and 9';
                                newInput.value = value;
                                cellContent.appendChild(newInput);
                                newInput.addEventListener('input', (e) => handleInput(e, rowIndex, colIndex));
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

    const loadPuzzle = async (puzzleID) => {
        try {
            const response = await fetch('grids.json');
            const puzzles = await response.json();
            currentPuzzle = puzzles.find(p => p.id === puzzleID);
            if (!currentPuzzle) throw new Error(`Puzzle with ID ${puzzleID} not found`);

            timeSpent = 0; // Reset elapsed time
            startTimer();
            displayPuzzle(currentPuzzle.displayGrid);
            displayClues(currentPuzzle.rowRules, currentPuzzle.colRules);
        } catch (error) {
            console.error('Error loading puzzle:', error);
        }
    };

    document.getElementById("check-button").addEventListener("click", checkSolution);

    // Initialize the game with the current puzzle ID
    loadGameState();

    // Save game state at regular intervals (optional)
    setInterval(saveGameState, 60000); // Save every minute

    // Save game state before the user leaves the page
    window.addEventListener("beforeunload", saveGameState);
});
