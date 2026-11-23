/**
 * Cryptographic utility functions
 */

/**
 * Generates a random secure temporary password using the Web Crypto API
 * with uppercase, lowercase, numbers, and symbols shuffled with Fisher-Yates.
 * 
 * @param {number} length 
 * @returns {string}
 */
export function generateSecurePassword(length = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "@$!%*?&#";
  const allChars = upper + lower + numbers + symbols;

  const getRandomChar = (charset) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return charset[array[0] % charset.length];
  };

  const passwordChars = [
    getRandomChar(upper),
    getRandomChar(lower),
    getRandomChar(numbers),
    getRandomChar(symbols),
  ];

  for (let i = passwordChars.length; i < length; i++) {
    passwordChars.push(getRandomChar(allChars));
  }

  // Cryptographic Fisher-Yates shuffle
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const j = array[0] % (i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join("");
}
