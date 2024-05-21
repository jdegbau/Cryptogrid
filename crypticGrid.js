document.addEventListener("DOMContentLoaded", function () {
    let currentPuzzle;
    let guessesLeft = 5;
    let guessesTaken = 0;
    let startTime;
    let timerInterval;
    const puzzleID = 1; // Example ID, you can change this to dynamically load different puzzles

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

    function displayPuzzle(grid) {
        const gridContainer = document.getElementById("grid-container");
        gridContainer.innerHTML = '';

        const size = grid.length;
        gridContainer.style.gridTemplateColumns = `repeat(${size}, 1fr)`;  // Ensure the correct number of columns

        grid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                const cellDiv = document.createElement("div");
                cellDiv.classList.add("grid-cell");
                cellDiv.setAttribute("data-row", rowIndex);
                cellDiv.setAttribute("data-col", colIndex);

                const cellContent = document.createElement("div");
                cellContent.classList.add("grid-cell-content");

                if (cell !== null) {
                    cellContent.textContent = cell;
                    cellDiv.classList.add("preset");
                } else {
                    const input = document.createElement("input");
                    input.setAttribute("type", "number");
                    input.setAttribute("min", "1");
                    input.setAttribute("max", "9");
                    input.setAttribute("inputmode", "decimal")
                    input.setAttribute("pattern", "\\d*");
                    input.setAttribute("data-row", rowIndex);
                    input.setAttribute("data-col", colIndex);
                    cellContent.appendChild(input);
                }

                cellDiv.appendChild(cellContent);
                gridContainer.appendChild(cellDiv);
            });
        });

        updateResultMessage(`You have ${guessesLeft} guesses left.`);
        updateErrorCount();
    }

    function displayClues(puzzle) {
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
    }

    function getReadableRule(rule) {
        switch (rule.rule) {
            case 'palindromic':
                return 'Numbers form a palindrome';
            case 'sum_even':
                return 'Sum of numbers is even';
            case 'sum_odd':
                return 'Sum of numbers is odd';
            case 'above_threshold':
                return `All numbers are greater than ${rule.target}`;
            case 'below_threshold':
                return `All numbers are less than ${rule.target}`;
            case 'even':
                return 'All numbers are even';
            case 'odd':
                return 'All numbers are odd';
            case 'increasing':
                return 'Numbers are in increasing order';
            case 'decreasing':
                return 'Numbers are in decreasing order';
            case 'sum':
                return `Sum of numbers is ${rule.target}`;
            default:
                return 'Unknown rule';
        }
    }

    function updateResultMessage(message) {
        document.getElementById("result").textContent = message;
    }

    function updateErrorCount() {
        const totalGuesses = 5;
        const correctGuesses = totalGuesses - guessesTaken;
        const errorsLeft = totalGuesses - guessesLeft;
        const checkmarkEmoji = '✅';
        const errorEmoji = '❌';
        document.getElementById("errors").textContent = `Errors: ${checkmarkEmoji.repeat(correctGuesses)}${errorEmoji.repeat(errorsLeft)}`;
    }

    window.checkSolution = function () {
        const inputs = document.querySelectorAll("input");
        const userSolution = Array.from({ length: currentPuzzle.displayGrid.length }, () => Array(currentPuzzle.displayGrid.length).fill(null));
        guessesTaken++;

        inputs.forEach(input => {
            const row = input.getAttribute("data-row");
            const col = input.getAttribute("data-col");
            userSolution[row][col] = parseInt(input.value);
        });

        const grid = userSolution.map((row, rowIndex) =>
            row.map((cell, colIndex) => cell !== null ? cell : currentPuzzle.answerGrid[rowIndex][colIndex])
        );

        const allCellsCorrect = checkAllCellsCorrect(userSolution, currentPuzzle.answerGrid);
        const isValid = validateGrid(grid, currentPuzzle.rowRules, currentPuzzle.colRules);

        highlightCells(grid, currentPuzzle.answerGrid, userSolution);

        if (allCellsCorrect && isValid) {
            updateResultMessage("Congratulations! You've solved the puzzle!");
            showEndGameMessage("Congratulations! You've solved the puzzle!", guessesTaken);
        } else {
            guessesLeft--;
            updateErrorCount();
            if (guessesLeft > 0) {
                updateResultMessage(`Incorrect! You have ${guessesLeft} guesses left.`);
            } else {
                updateResultMessage("No more guesses left. Try again tomorrow!");
                showEndGameMessage("No more guesses left. Try again tomorrow!", guessesTaken);
            }
        }
    };

    function validateGrid(grid, rowRules, colRules) {
        const rules = {
            sum: (arr, target) => arr.reduce((a, b) => a + b, 0) === target,
            increasing: arr => arr.every((val, i, a) => !i || val >= a[i - 1]),
            decreasing: arr => arr.every((val, i, a) => !i || val <= a[i - 1]),
            even: arr => arr.every(val => val % 2 === 0),
            odd: arr => arr.every(val => val % 2 !== 0),
            palindromic: arr => arr.join('') === arr.slice().reverse().join(''),
            above_threshold: (arr, target) => arr.every(val => val > target),
            below_threshold: (arr, target) => arr.every(val => val < target),
        };

        return grid.every((row, i) => {
            const rule = rowRules[i];
            return rules[rule.rule] ? rules[rule.rule](row, rule.target) : true;
        }) && grid[0].map((_, colIndex) => grid.map(row => row[colIndex]))
            .every((col, i) => {
                const rule = colRules[i];
                return rules[rule.rule] ? rules[rule.rule](col, rule.target) : true;
            });
    }

    function checkAllCellsCorrect(userSolution, correctGrid) {
        return userSolution.every((row, rowIndex) => row.every((cell, colIndex) => cell === correctGrid[rowIndex][colIndex]));
    }

    function highlightCells(userGrid, correctGrid, userSolution) {
        userGrid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                const input = document.querySelector(`input[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                const cellDiv = document.querySelector(`.grid-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                if (input) {
                    if (userSolution[rowIndex][colIndex] === correctGrid[rowIndex][colIndex]) {
                        cellDiv.querySelector(".grid-cell-content").textContent = userSolution[rowIndex][colIndex];
                        cellDiv.classList.add("correct");
                        cellDiv.classList.remove("incorrect");
                        input.remove();
                    } else {
                        cellDiv.classList.add("incorrect");
                    }
                }
            });
        });
    }

    function showEndGameMessage(message, guessesTaken) {
        clearInterval(timerInterval);

        const formattedTime = formatTime(Math.floor((new Date() - startTime) / 1000));

        replaceIncorrectCells();

        const gridEmojis = generateGridEmojis();
        const guessesEmoji = '❌'.repeat(guessesTaken);
        const timeEmoji = `⏱️${formattedTime}`;

        const shareText = `${message}\nGrid:\n${gridEmojis}\nGuesses: ${guessesEmoji}\nTime: ${timeEmoji}`;

        // Update the footer with the end message
        const resultElement = document.getElementById("result");
        resultElement.textContent = message;

        // Hide the check solution button
        const checkButton = document.getElementById("check-button");
        checkButton.style.display = "none";

        // Show the share button
        const shareButton = document.getElementById("share-button");
        shareButton.style.display = "block";
        shareButton.onclick = function () {
            if (navigator.share) {
                navigator.share({
                    title: "Cryptic Grid Game",
                    text: shareText
                });
            } else {
                navigator.clipboard.writeText(shareText).then(() => {
                    alert("Score copied to clipboard!");
                });
            }
        };
    }

    function replaceIncorrectCells() {
        document.querySelectorAll("input").forEach(input => {
            const row = input.getAttribute("data-row");
            const col = input.getAttribute("data-col");
            const cellDiv = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
            cellDiv.querySelector(".grid-cell-content").textContent = currentPuzzle.answerGrid[row][col];
            cellDiv.classList.add("incorrect");
            input.remove();
        });
    }

    function generateGridEmojis() {
        return currentPuzzle.answerGrid.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
                const cellDiv = document.querySelector(`.grid-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                if (cellDiv.classList.contains("preset")) return '⬛';
                if (cellDiv.classList.contains("correct")) return '🟩';
                if (cellDiv.classList.contains("incorrect")) return '🟥';
            }).join('')
        ).join('\n');
    }

    function startTimer() {
        const timerElement = document.getElementById("timer");
        timerInterval = setInterval(() => {
            const currentTime = new Date();
            const timeTaken = Math.floor((currentTime - startTime) / 1000);
            timerElement.textContent = `Time: ${formatTime(timeTaken)}`;
        }, 1000);
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
});
