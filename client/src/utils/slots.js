export const READING_SLOTS = [
  'morning_fasting',
  'after_breakfast',
  'after_lunch',
  'after_dinner',
];

export const SLOT_LABELS = {
  morning_fasting: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

export function getSlotLabel(slot) {
  return SLOT_LABELS[slot] || slot;
}

export function compareReadingsBySlot(a, b) {
  const indexA = READING_SLOTS.indexOf(a?.slot);
  const indexB = READING_SLOTS.indexOf(b?.slot);
  const orderA = indexA === -1 ? READING_SLOTS.length : indexA;
  const orderB = indexB === -1 ? READING_SLOTS.length : indexB;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return (a?.id ?? 0) - (b?.id ?? 0);
}
