const startId = 0;

const generateRandomGrid = (size) => {
    const grid = [];
    for (let i = 0; i < size; i++) {
        const row = [];
        for (let j = 0; j < size; j++) {
            row.push(Math.floor(Math.random() * 9) + 1); // Random numbers between 1 and 9
        }
        grid.push(row);
    }
    return grid;
};

const determineRules = (grid) => {
    const rowRules = [];
    const colRules = [];
    const size = grid.length;

    // Determine rules for rows
    for (let i = 0; i < size; i++) {
        const row = grid[i];
        rowRules.push(determineBestRule(row));
    }

    // Determine rules for columns
    for (let i = 0; i < size; i++) {
        const col = grid.map(row => row[i]);
        colRules.push(determineBestRule(col));
    }

    return { rowRules, colRules };
};

const isPalindrome = (arr) => arr.join('') === arr.slice().reverse().join('');
const isSumEven = (arr) => arr.reduce((a, b) => a + b, 0) % 2 === 0;
const isSumOdd = (arr) => arr.reduce((a, b) => a + b, 0) % 2 !== 0;
const isAboveThreshold = (arr, threshold) => arr.every(num => num > threshold);
const isBelowThreshold = (arr, threshold) => arr.every(num => num < threshold);

const determineBestRule = (arr) => {
    const sum = arr.reduce((a, b) => a + b, 0);
    const isEven = arr.every(num => num % 2 === 0);
    const isOdd = arr.every(num => num % 2 !== 0);
    const isIncreasing = arr.every((val, i, a) => !i || (val >= a[i - 1]));
    const isDecreasing = arr.every((val, i, a) => !i || (val <= a[i - 1]));
    const uniqueDigits = new Set(arr).size === arr.length;
    const alternatingOddEven = arr.every((num, i) => i % 2 === 0 ? num % 2 !== 0 : num % 2 === 0);
    const evenCount = arr.filter(num => num % 2 === 0).length;
    const oddCount = arr.filter(num => num % 2 !== 0).length;
    const majorityEven = evenCount > arr.length / 2;
    const majorityOdd = oddCount > arr.length / 2;

    const rules = [
        { rule: 'palindromic', check: () => isPalindrome(arr) },
        { rule: 'sum_even', check: () => isSumEven(arr) },
        { rule: 'sum_odd', check: () => isSumOdd(arr) },
        { rule: 'above_threshold', check: () => isAboveThreshold(arr, 5), target: 5 },
        { rule: 'below_threshold', check: () => isBelowThreshold(arr, 5), target: 5 },
        { rule: 'even', check: () => isEven },
        { rule: 'odd', check: () => isOdd },
        { rule: 'increasing', check: () => isIncreasing },
        { rule: 'decreasing', check: () => isDecreasing },
        { rule: 'unique_digits', check: () => uniqueDigits },
        { rule: 'alternating_parity', check: () => alternatingOddEven },
        { rule: 'majority_even', check: () => majorityEven, target: evenCount },
        { rule: 'majority_odd', check: () => majorityOdd, target: oddCount }
    ];

    const sumRule = { rule: 'sum', check: () => sum <= 30, target: sum };

    // Shuffle the rules array to randomize the order of rule checking
    for (let i = rules.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rules[i], rules[j]] = [rules[j], rules[i]];
    }

    // Randomly select a rule with a weighted probability
    const selectedRule = Math.random() < 0.1 ? sumRule : rules.find(rule => rule.check());

    return selectedRule ? { rule: selectedRule.rule, target: selectedRule.target } : { rule: 'sum', target: sum };
};

const generatePuzzles = (numPuzzles, size) => {
    const puzzles = [];

    for (let i = startId; i < startId + numPuzzles; i++) {
        const answerGrid = generateRandomGrid(size);
        const { rowRules, colRules } = determineRules(answerGrid);
        const displayGrid = generateDisplayGrid(answerGrid);

        puzzles.push({
            id: i + 1, // Simple number ID
            answerGrid,
            displayGrid,
            rowRules,
            colRules
        });
    }

    return puzzles;
};

const generateDisplayGrid = (answerGrid) => {
    const size = answerGrid.length;
    const displayGrid = JSON.parse(JSON.stringify(answerGrid)); // Deep copy
    const numToFill = Math.floor(Math.random() * 3) + 8; // Populate 8-10 cells
    const filledCells = generateFilledCells(size, numToFill);

    for (let rowIndex = 0; rowIndex < size; rowIndex++) {
        for (let colIndex = 0; colIndex < size; colIndex++) {
            if (!filledCells.has(`${rowIndex}-${colIndex}`)) {
                displayGrid[rowIndex][colIndex] = null; // Empty cell
            }
        }
    }

    return displayGrid;
};

const generateFilledCells = (size, numToFill) => {
    const filledCells = new Set();
    const rowFillCount = Array(size).fill(0);
    const colFillCount = Array(size).fill(0);

    // Generate a list of all possible coordinates
    const allCoords = [];
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            allCoords.push({ row, col });
        }
    }

    // Shuffle the coordinates
    allCoords.sort(() => Math.random() - 0.5);

    // Fill the cells while respecting the constraints
    for (const { row, col } of allCoords) {
        if (filledCells.size >= numToFill) break;
        if (rowFillCount[row] < 3 && colFillCount[col] < 3) {
            filledCells.add(`${row}-${col}`);
            rowFillCount[row]++;
            colFillCount[col]++;
        }
    }

    return filledCells;
};

// Generate 10 puzzles of size 4x4
const puzzles = generatePuzzles(10, 4);
console.log(JSON.stringify(puzzles, null, 2));
