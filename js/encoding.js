// Light obfuscation for puzzle answers, so they can't be read at a glance
// in grids.json or localStorage. This is not security: anyone who reads this
// file can decode them. It only stops casual peeking.

const SALT = 'pseudoku';

const keyByte = (id, i) => (SALT.charCodeAt(i % SALT.length) + id * 31 + i * 7) & 0xff;

// [[1,2],[3,4]] -> "2:<base64>"
export const encodeAnswer = (grid, id) => {
    const bytes = grid.flat().map((v, i) => String.fromCharCode((v ^ keyByte(id, i)) & 0xff)).join('');
    return `${grid.length}:${btoa(bytes)}`;
};

export const decodeAnswer = (encoded, id) => {
    const [sizeText, data] = encoded.split(':');
    const size = Number(sizeText);
    const flat = Array.from(atob(data), (ch, i) => (ch.charCodeAt(0) ^ keyByte(id, i)) & 0xff);
    return Array.from({ length: size }, (_, r) => flat.slice(r * size, (r + 1) * size));
};

// Puzzles store `answer` (encoded). Games saved before encoding was added
// stored `answerGrid` in plain form; accept either.
export const getAnswerGrid = (puzzle) =>
    puzzle.answerGrid ? puzzle.answerGrid : decodeAnswer(puzzle.answer, puzzle.id);
