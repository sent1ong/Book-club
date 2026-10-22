// Claim synchronously before React commits a dialog to avoid competing auto popups.
let owner: object | null = null;
export const autoModal = {
  available: () => owner === null,
  claim(token: object) { if (owner && owner !== token) return false; owner = token; return true; },
  release(token: object) { if (owner === token) owner = null; },
};
