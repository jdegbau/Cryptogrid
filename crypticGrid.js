document.addEventListener("DOMContentLoaded", () => {
    let currentPuzzle, guessesLeft = 5, startTime, timerInterval;

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
    console.log(daysSinceStart)

    // Total number of puzzle IDs available (assuming 10 in this example)
    const totalPuzzleIds = 10;

    // Set the puzzleID to the number of days since the start date, looping if necessary
    const puzzleID = ((daysSinceStart) % totalPuzzleIds) + 1;
    console.log(puzzleID)

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
                        if (parseInt(input.value) === cell) {
                            cellContent.textContent = cell;
                            cellDiv.classList.add("correct");
                            cellDiv.classList.remove("incorrect");
                            input.remove();
                            userSolution[rowIndex][colIndex] = cell;  // Update correct answer in userSolution
                        } else {
                            cellDiv.classList.add("incorrect");
                        }
                    }
                }
            });
        });
    };

    const showEndGameMessage = (message) => {
        clearInterval(timerInterval);
        document.getElementById("check-button").style.display = "none";
        document.getElementById("share-button").style.display = "block";
        document.getElementById("share-button").classList.add("glow"); // Add the glow effect
        document.getElementById("result").textContent = message;
        document.querySelectorAll("input").forEach(input => input.disabled = true);

        const gridEmojis = generateGridEmojis();
        const timeTaken = Math.floor((new Date() - startTime) / 1000);
        const totalGuesses = 5;
        const guessesUsed = totalGuesses - guessesLeft;
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
        const guessStatus = numberEmojis.map((emoji, index) => index < guessesUsed ? '❌' : emoji).join('');
        const shareText = `Pseudoku — #${puzzleID}\n\n${gridEmojis}\nGuesses: ${guessStatus}\nTime: ${formatTime(timeTaken)}`;

        document.getElementById("share-button").onclick = () => {
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
                if (cellDiv.classList.contains("preset")) return '⬛';
                if (cellDiv.classList.contains("correct")) return '🟩';
                if (cellDiv.classList.contains("incorrect")) return '🟥';
                return '⬜'; // default for not attempted cells
            }).join('')
        ).join('\n');
    };

    const startTimer = () => {
        const timerElement = document.getElementById("timer");
        timerInterval = setInterval(() => {
            const timeTaken = Math.floor((new Date() - startTime) / 1000);
            timerElement.textContent = `Time: ${formatTime(timeTaken)}`;
        }, 1000);
    };

    const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

    const displayPuzzle = (grid) => {
        const gridContainer = document.getElementById("grid-container");
        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateColumns = `repeat(${grid[0].length}, 1fr)`;

        grid.forEach((row, rowIndex) => {
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
                    input.min = "1";
                    input.max = "9";
                    input.inputMode = "decimal";
                    input.maxLength = "1";
                    input.pattern = "\\d*";
                    input.dataset.row = rowIndex;
                    input.dataset.col = colIndex;
                    input.addEventListener('input', (e) => handleInput(e, rowIndex, colIndex));
                    cellContent.appendChild(input);
                }

                cellDiv.appendChild(cellContent);
                gridContainer.appendChild(cellDiv);
            });
        });

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

    window.checkSolution = () => {
        const checkButton = document.getElementById("check-button");
        checkButton.disabled = true;

        const inputs = document.querySelectorAll("input");
        const size = currentPuzzle.displayGrid.length;

        if (!window.userSolution) {
            window.userSolution = Array.from({ length: size }, (_, rowIndex) =>
                currentPuzzle.displayGrid[rowIndex].map((cell, colIndex) =>
                    cell !== null ? cell : null
                )
            );
        }

        inputs.forEach(input => {
            const rowIndex = parseInt(input.dataset.row);
            const colIndex = parseInt(input.dataset.col);
            window.userSolution[rowIndex][colIndex] = parseInt(input.value);
        });

        highlightCells(currentPuzzle.answerGrid, window.userSolution);

        if (checkAllCellsCorrect(window.userSolution, currentPuzzle.answerGrid)) {
            updateResultMessage("Congratulations! You've solved the puzzle!");
            showEndGameMessage("Congratulations! You've solved the puzzle!");
        } else {
            guessesLeft--;
            updateErrorCount();
            if (guessesLeft > 0) {
                updateResultMessage(`Incorrect! You have ${guessesLeft} guesses left.`);
                setTimeout(() => {
                    checkButton.disabled = false;
                }, 3000);
            } else {
                updateResultMessage("No more guesses left. Try again tomorrow!");
                showEndGameMessage("No more guesses left. Try again tomorrow!");
            }
        }
    };

    fetch('grids.json')
        .then(response => response.json())
        .then(puzzles => {
            currentPuzzle = puzzles.find(puzzle => puzzle.id === puzzleID);
            startTime = new Date();
            displayPuzzle(currentPuzzle.displayGrid);
            displayClues(currentPuzzle);
            startTimer();
            console.log(currentPuzzle);
        });

    const displayClues = (puzzle) => {
        const rowCluesContainer = document.getElementById("row-clues");
        const colCluesContainer = document.getElementById("col-clues");
        rowCluesContainer.innerHTML = '';
        colCluesContainer.innerHTML = '';

        puzzle.rowRules.forEach((rule, index) => {
            rowCluesContainer.innerHTML += `<tr><td>Row ${index + 1}</td><td>${getReadableRule(rule)}</td></tr>`;
        });
        puzzle.colRules.forEach((rule, index) => {
            colCluesContainer.innerHTML += `<tr><td>Column ${index + 1}</td><td>${getReadableRule(rule)}</td></tr>`;
        });
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
            increasing: 'Numbers are in increasing order',
            decreasing: 'Numbers are in decreasing order',
            sum: `Sum of numbers is ${rule.target}`
        };
        return rules[rule.rule] || 'Unknown rule';
    };
});
