export interface NotionColorToken {
  id: string;
  name: string;
  hex: string;
  timeText: string;      // Tinted time prefix (e.g. light blue, sage green, warm amber)
  bannerBg: string;      // All-day event subtle translucent background
  bannerBorder: string;  // Subtle border for banners
  selectedBg: string;    // Solid vivid background when selected
  selectedText: string;  // Crisp high-contrast text on selection
  ring: string;          // Focus glow ring
}

export const NOTION_COLORS: Record<string, NotionColorToken> = {
  blue: {
    id: 'blue',
    name: 'Blue',
    hex: '#3b82f6',
    timeText: '#60a5fa',
    bannerBg: 'rgba(59, 130, 246, 0.22)',
    bannerBorder: 'rgba(59, 130, 246, 0.5)',
    selectedBg: '#2563eb',
    selectedText: '#ffffff',
    ring: 'rgba(59, 130, 246, 0.6)'
  },
  green: {
    id: 'green',
    name: 'Green',
    hex: '#10b981',
    timeText: '#34d399',
    bannerBg: 'rgba(16, 185, 129, 0.22)',
    bannerBorder: 'rgba(16, 185, 129, 0.5)',
    selectedBg: '#059669',
    selectedText: '#ffffff',
    ring: 'rgba(16, 185, 129, 0.6)'
  },
  amber: {
    id: 'amber',
    name: 'Amber',
    hex: '#f59e0b',
    timeText: '#fbbf24',
    bannerBg: 'rgba(245, 158, 11, 0.22)',
    bannerBorder: 'rgba(245, 158, 11, 0.5)',
    selectedBg: '#d97706',
    selectedText: '#ffffff',
    ring: 'rgba(245, 158, 11, 0.6)'
  },
  orange: {
    id: 'orange',
    name: 'Orange',
    hex: '#f97316',
    timeText: '#fb923c',
    bannerBg: 'rgba(249, 115, 22, 0.22)',
    bannerBorder: 'rgba(249, 115, 22, 0.5)',
    selectedBg: '#ea580c',
    selectedText: '#ffffff',
    ring: 'rgba(249, 115, 22, 0.6)'
  },
  red: {
    id: 'red',
    name: 'Red',
    hex: '#ef4444',
    timeText: '#f87171',
    bannerBg: 'rgba(239, 68, 68, 0.22)',
    bannerBorder: 'rgba(239, 68, 68, 0.5)',
    selectedBg: '#dc2626',
    selectedText: '#ffffff',
    ring: 'rgba(239, 68, 68, 0.6)'
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    hex: '#8b5cf6',
    timeText: '#a78bfa',
    bannerBg: 'rgba(139, 92, 246, 0.22)',
    bannerBorder: 'rgba(139, 92, 246, 0.5)',
    selectedBg: '#7c3aed',
    selectedText: '#ffffff',
    ring: 'rgba(139, 92, 246, 0.6)'
  },
  charcoal: {
    id: 'charcoal',
    name: 'Default',
    hex: '#71717a',
    timeText: '#a1a1aa',
    bannerBg: 'rgba(113, 113, 122, 0.25)',
    bannerBorder: 'rgba(113, 113, 122, 0.5)',
    selectedBg: '#52525b',
    selectedText: '#ffffff',
    ring: 'rgba(113, 113, 122, 0.6)'
  }
};

export function resolveEventColorToken(hexOrId?: string): NotionColorToken {
  if (!hexOrId) return NOTION_COLORS.blue;
  const match = Object.values(NOTION_COLORS).find(
    (c) => c.hex.toLowerCase() === hexOrId.toLowerCase() || c.id === hexOrId
  );
  return match || {
    id: 'custom',
    name: 'Custom',
    hex: hexOrId,
    timeText: hexOrId,
    bannerBg: `${hexOrId}33`,
    bannerBorder: `${hexOrId}66`,
    selectedBg: hexOrId,
    selectedText: '#ffffff',
    ring: `${hexOrId}88`
  };
}