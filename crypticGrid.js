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

        // Initialize guess history
        guessHistory = {};

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

                const cellContent = document.createElement("div");
                cellContent.classList.add("grid-cell-content");

                if (cell !== null) {
                    cellContent.textContent = cell;
                    cellDiv.classList.add("preset");
                } else {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.inputMode = "numeric"; // Hint that the input should be numeric
                    input.maxLength = "1";
                    input.pattern = "[1-9]"; // Allow only digits 1-9
                    input.ariaLabel = "Enter a number between 1 and 9"; // ARIA label for accessibility
                    input.dataset.row = rowIndex;
                    input.dataset.col = colIndex;

                    // Initialize guess history for this cell
                    const cellId = `${rowIndex}-${colIndex}`;
                    guessHistory[cellId] = [];

                    // Ensure the input is a valid digit between 1 and 9 and has not been guessed already
                    input.addEventListener('input', (e) => {
                        const value = e.target.value;
                        if (!/^[1-9]$/.test(value) || guessHistory[cellId].includes(value)) {
                            e.target.value = ''; // Clear the input if it's not a valid digit or has been guessed already
                            if (guessHistory[cellId].includes(value)) {
                                const cellDiv = e.target.closest(".grid-cell");
                                cellDiv.style.outline = '2px solid red'; // Show feedback for duplicate guess
                                const duplicateMessage = document.createElement('div');
                                duplicateMessage.className = 'duplicate-message';
                                duplicateMessage.textContent = 'Already guessed!';
                                cellDiv.appendChild(duplicateMessage);
                                setTimeout(() => {
                                    cellDiv.style.outline = '2px solid transparent'; // Clear feedback after a short delay
                                    cellDiv.removeChild(duplicateMessage);
                                }, 2000);
                            }
                        }
                    });

                    input.addEventListener('input', (e) => handleInput(e, rowIndex, colIndex));

                    cellContent.appendChild(input);
                }

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

        const userSolution = getUserSolution(); // Use getUserSolution to get the current state of the solution
        highlightCells(currentPuzzle.answerGrid, userSolution);
        const allCorrect = checkAllCellsCorrect(userSolution, currentPuzzle.answerGrid);

        // Populate guess history
        document.querySelectorAll("input").forEach(input => {
            const rowIndex = input.dataset.row;
            const colIndex = input.dataset.col;
            const cellId = `${rowIndex}-${colIndex}`;
            guessHistory[cellId].push(input.value);
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
