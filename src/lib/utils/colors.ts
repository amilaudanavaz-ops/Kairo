export interface CalendarColorToken {
  id: string;
  name: string;
  hex: string;
  timeText: string;      // Lighter than base event color
  titleText: string;     // Lighter than time text for soft readable title
  bannerBg: string;      // Translucent banner fill
  bannerBorder: string;  // Banner border accent
  selectedBg: string;    // Solid accent on selection
  selectedText: string;  // Text color on selection
  ring: string;          // Selection focus ring
}

export function lightenHex(hex: string, amount: number): string {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return '#ededed';

  const r = Math.min(255, Math.round(((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * amount));
  const g = Math.min(255, Math.round(((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * amount));
  const b = Math.min(255, Math.round((num & 255) + (255 - (num & 255)) * amount));

  return `rgb(${r}, ${g}, ${b})`;
}

// Complete palette of standard & Google Calendar colors
export const KAIRO_COLORS: Record<string, CalendarColorToken> = {
  blue: {
    id: 'blue',
    name: 'Blue',
    hex: '#3b82f6',
    timeText: '#60a5fa',
    titleText: '#bfdbfe',
    bannerBg: 'rgba(59, 130, 246, 0.22)',
    bannerBorder: 'rgba(59, 130, 246, 0.5)',
    selectedBg: '#2563eb',
    selectedText: '#ffffff',
    ring: 'rgba(59, 130, 246, 0.6)'
  },
  tangerine: {
    id: 'tangerine',
    name: 'Tangerine',
    hex: '#f4511e',
    timeText: '#fb923c',
    titleText: '#fed7aa',
    bannerBg: 'rgba(244, 81, 30, 0.22)',
    bannerBorder: 'rgba(244, 81, 30, 0.5)',
    selectedBg: '#ea580c',
    selectedText: '#ffffff',
    ring: 'rgba(244, 81, 30, 0.6)'
  },
  red: {
    id: 'red',
    name: 'Red',
    hex: '#d50000',
    timeText: '#f87171',
    titleText: '#fecaca',
    bannerBg: 'rgba(213, 0, 0, 0.22)',
    bannerBorder: 'rgba(213, 0, 0, 0.5)',
    selectedBg: '#b71c1c',
    selectedText: '#ffffff',
    ring: 'rgba(213, 0, 0, 0.6)'
  },
  banana: {
    id: 'banana',
    name: 'Banana',
    hex: '#f6bf26',
    timeText: '#fde047',
    titleText: '#fef08a',
    bannerBg: 'rgba(246, 191, 38, 0.22)',
    bannerBorder: 'rgba(246, 191, 38, 0.5)',
    selectedBg: '#eab308',
    selectedText: '#ffffff',
    ring: 'rgba(246, 191, 38, 0.6)'
  },
  basil: {
    id: 'basil',
    name: 'Basil',
    hex: '#0b8043',
    timeText: '#34d399',
    titleText: '#a7f3d0',
    bannerBg: 'rgba(11, 128, 67, 0.22)',
    bannerBorder: 'rgba(11, 128, 67, 0.5)',
    selectedBg: '#059669',
    selectedText: '#ffffff',
    ring: 'rgba(11, 128, 67, 0.6)'
  },
  peacock: {
    id: 'peacock',
    name: 'Peacock',
    hex: '#039be5',
    timeText: '#38bdf8',
    titleText: '#bae6fd',
    bannerBg: 'rgba(3, 155, 229, 0.22)',
    bannerBorder: 'rgba(3, 155, 229, 0.5)',
    selectedBg: '#0284c7',
    selectedText: '#ffffff',
    ring: 'rgba(3, 155, 229, 0.6)'
  },
  graphite: {
    id: 'graphite',
    name: 'Graphite',
    hex: '#616161',
    timeText: '#f4f4ff',
    titleText: '#e4e4e7',
    bannerBg: 'rgba(97, 97, 97, 0.22)',
    bannerBorder: 'rgba(97, 97, 97, 0.5)',
    selectedBg: '#52525b',
    selectedText: '#ffffff',
    ring: 'rgba(97, 97, 97, 0.6)'
  },
  grape: {
    id: 'grape',
    name: 'Grape',
    hex: '#8e24aa',
    timeText: '#c084fc',
    titleText: '#e9d5ff',
    bannerBg: 'rgba(142, 36, 170, 0.22)',
    bannerBorder: 'rgba(142, 36, 170, 0.5)',
    selectedBg: '#7e22ce',
    selectedText: '#ffffff',
    ring: 'rgba(142, 36, 170, 0.6)'
  },
  flamingo: {
    id: 'flamingo',
    name: 'Flamingo',
    hex: '#e67c73',
    timeText: '#fca5a5',
    titleText: '#fed7d7',
    bannerBg: 'rgba(230, 124, 115, 0.22)',
    bannerBorder: 'rgba(230, 124, 115, 0.5)',
    selectedBg: '#e11d48',
    selectedText: '#ffffff',
    ring: 'rgba(230, 124, 115, 0.6)'
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    hex: '#33b679',
    timeText: '#6ee7b7',
    titleText: '#d1fae5',
    bannerBg: 'rgba(51, 182, 121, 0.22)',
    bannerBorder: 'rgba(51, 182, 121, 0.5)',
    selectedBg: '#10b981',
    selectedText: '#ffffff',
    ring: 'rgba(51, 182, 121, 0.6)'
  },
  charcoal: {
    id: 'charcoal',
    name: 'Default',
    hex: '#71717a',
    timeText: '#d4d4d8',
    titleText: '#fafafa',
    bannerBg: 'rgba(113, 113, 122, 0.25)',
    bannerBorder: 'rgba(113, 113, 122, 0.5)',
    selectedBg: '#52525b',
    selectedText: '#ffffff',
    ring: 'rgba(113, 113, 122, 0.6)'
  }
};

// Export alias for backward compatibility
export const NOTION_COLORS = KAIRO_COLORS;

export function resolveEventColorToken(hexOrId?: string): CalendarColorToken {
  if (!hexOrId) return KAIRO_COLORS.blue;
  const match = Object.values(KAIRO_COLORS).find(
    (c) => c.hex.toLowerCase() === hexOrId.toLowerCase() || c.id === hexOrId
  );
  if (match) return match;

  // Custom colors: Time is 18% lighter than base, Title is 52% lighter
  const timeTint = lightenHex(hexOrId, 0.18);
  const titleTint = lightenHex(hexOrId, 0.52);

  return {
    id: 'custom',
    name: 'Custom',
    hex: hexOrId,
    timeText: timeTint,
    titleText: titleTint,
    bannerBg: `${hexOrId}33`,
    bannerBorder: `${hexOrId}66`,
    selectedBg: hexOrId,
    selectedText: '#ffffff',
    ring: `${hexOrId}88`
  };
}