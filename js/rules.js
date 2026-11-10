// What each clue means and how it is worded. The generator, the solver and
// the game all use this file, so the wording always matches the check.

export const THRESHOLD = 5;

const sumOf = (arr) => arr.reduce((a, b) => a + b, 0);
const countEven = (arr) => arr.filter(n => n % 2 === 0).length;

export const ruleChecks = {
    palindromic: (arr) => arr.every((v, i) => v === arr[arr.length - 1 - i]),
    sum_even: (arr) => sumOf(arr) % 2 === 0,
    sum_odd: (arr) => sumOf(arr) % 2 === 1,
    above_threshold: (arr, t) => arr.every(n => n > t),
    below_threshold: (arr, t) => arr.every(n => n < t),
    even: (arr) => arr.every(n => n % 2 === 0),
    odd: (arr) => arr.every(n => n % 2 === 1),
    increasing: (arr) => arr.every((v, i) => i === 0 || v >= arr[i - 1]),
    decreasing: (arr) => arr.every((v, i) => i === 0 || v <= arr[i - 1]),
    unique_digits: (arr) => new Set(arr).size === arr.length,
    // First number odd, then alternating: odd, even, odd, even.
    alternating_parity: (arr) => arr.every((n, i) => n % 2 === (i % 2 === 0 ? 1 : 0)),
    // "At least 3 of the 4" (a strict majority).
    majority_even: (arr) => countEven(arr) > arr.length / 2,
    majority_odd: (arr) => arr.length - countEven(arr) > arr.length / 2,
    sum: (arr, t) => sumOf(arr) === t
};

export const checkRule = (arr, rule) => {
    const check = ruleChecks[rule.rule];
    return check ? check(arr, rule.target) : false;
};

export const describeRule = (rule) => {
    switch (rule.rule) {
        case 'palindromic': return 'Numbers form a palindrome';
        case 'sum_even': return 'Sum of numbers is even';
        case 'sum_odd': return 'Sum of numbers is odd';
        case 'above_threshold': return `All numbers are greater than ${rule.target}`;
        case 'below_threshold': return `All numbers are less than ${rule.target}`;
        case 'even': return 'All numbers are even';
        case 'odd': return 'All numbers are odd';
        case 'increasing': return 'Each number is equal to or greater than the one before';
        case 'decreasing': return 'Each number is equal to or less than the one before';
        case 'sum': return `Sum of numbers is ${rule.target}`;
        case 'unique_digits': return 'All numbers are unique';
        case 'alternating_parity': return 'Numbers alternate odd, even, odd, even';
        case 'majority_even': return 'At least 3 of the numbers are even';
        case 'majority_odd': return 'At least 3 of the numbers are odd';
        default: return 'Unknown rule';
    }
};
