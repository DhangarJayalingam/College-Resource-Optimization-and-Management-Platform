import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

export type ThemeName =
  | 'Dark'
  | 'Light'
  | 'Ocean Blue'
  | 'Neon Purple'
  | 'Sunset Orange'
  | 'Emerald Green'
  | 'Custom';

export interface AppearanceState {
  theme: ThemeName | string;
  customThemeName: string | null;
  backgroundGradient: string | null;
  cardColor: string | null;
  accentColor: string | null;
  textColor: string | null;
  animationEnabled: boolean;
  glassEffectEnabled: boolean;
  autoThemeEnabled: boolean;
}

export interface ThemePalette {
  name: ThemeName;
  backgroundGradient: string;
  cardColor: string;
  accentColor: string;
  textColor: string;
  borderColor: string;
  mutedTextColor: string;
  panelShadow: string;
  spotlightColor: string;
}

interface ThemeContextValue {
  appearance: AppearanceState;
  themeName: string;
  resolvedPalette: ThemePalette;
  presets: ThemePalette[];
  setThemeByName: (theme: ThemeName | string) => void;
  updateAppearance: (updates: Partial<AppearanceState>) => void;
  syncAppearance: (next: Partial<AppearanceState>) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'cop_theme_v2';

const themePresets: ThemePalette[] = [
  {
    name: 'Dark',
    backgroundGradient: 'linear-gradient(135deg, #07111f 0%, #10182d 52%, #1a1034 100%)',
    cardColor: 'rgba(12, 18, 33, 0.72)',
    accentColor: '#6ee7f9',
    textColor: '#ecfeff',
    borderColor: 'rgba(148, 163, 184, 0.2)',
    mutedTextColor: 'rgba(207, 250, 254, 0.72)',
    panelShadow: '0 24px 80px rgba(2, 6, 23, 0.45)',
    spotlightColor: 'rgba(110, 231, 249, 0.18)'
  },
  {
    name: 'Light',
    backgroundGradient: 'linear-gradient(135deg, #f7fbff 0%, #eaf2ff 54%, #fff6ea 100%)',
    cardColor: 'rgba(255, 255, 255, 0.72)',
    accentColor: '#2563eb',
    textColor: '#0f172a',
    borderColor: 'rgba(148, 163, 184, 0.28)',
    mutedTextColor: 'rgba(51, 65, 85, 0.72)',
    panelShadow: '0 24px 80px rgba(15, 23, 42, 0.08)',
    spotlightColor: 'rgba(37, 99, 235, 0.15)'
  },
  {
    name: 'Ocean Blue',
    backgroundGradient: 'linear-gradient(135deg, #031c33 0%, #0a4f74 48%, #4cc9f0 100%)',
    cardColor: 'rgba(3, 28, 51, 0.62)',
    accentColor: '#7dd3fc',
    textColor: '#effcff',
    borderColor: 'rgba(125, 211, 252, 0.22)',
    mutedTextColor: 'rgba(207, 250, 254, 0.78)',
    panelShadow: '0 24px 90px rgba(3, 28, 51, 0.36)',
    spotlightColor: 'rgba(76, 201, 240, 0.22)'
  },
  {
    name: 'Neon Purple',
    backgroundGradient: 'linear-gradient(135deg, #12071f 0%, #3b0764 48%, #ec4899 100%)',
    cardColor: 'rgba(35, 9, 55, 0.64)',
    accentColor: '#f472b6',
    textColor: '#fff7ff',
    borderColor: 'rgba(244, 114, 182, 0.24)',
    mutedTextColor: 'rgba(250, 232, 255, 0.8)',
    panelShadow: '0 24px 90px rgba(59, 7, 100, 0.42)',
    spotlightColor: 'rgba(236, 72, 153, 0.2)'
  },
  {
    name: 'Sunset Orange',
    backgroundGradient: 'linear-gradient(135deg, #331306 0%, #9a3412 45%, #fdba74 100%)',
    cardColor: 'rgba(69, 26, 3, 0.58)',
    accentColor: '#fb923c',
    textColor: '#fff7ed',
    borderColor: 'rgba(251, 146, 60, 0.24)',
    mutedTextColor: 'rgba(255, 237, 213, 0.82)',
    panelShadow: '0 24px 90px rgba(124, 45, 18, 0.34)',
    spotlightColor: 'rgba(251, 146, 60, 0.2)'
  },
  {
    name: 'Emerald Green',
    backgroundGradient: 'linear-gradient(135deg, #03261f 0%, #065f46 46%, #6ee7b7 100%)',
    cardColor: 'rgba(3, 38, 31, 0.62)',
    accentColor: '#34d399',
    textColor: '#ecfdf5',
    borderColor: 'rgba(52, 211, 153, 0.24)',
    mutedTextColor: 'rgba(209, 250, 229, 0.82)',
    panelShadow: '0 24px 90px rgba(6, 95, 70, 0.34)',
    spotlightColor: 'rgba(52, 211, 153, 0.2)'
  }
];

const defaultAppearance: AppearanceState = {
  theme: 'Ocean Blue',
  customThemeName: null,
  backgroundGradient: null,
  cardColor: null,
  accentColor: null,
  textColor: null,
  animationEnabled: true,
  glassEffectEnabled: true,
  autoThemeEnabled: false
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getPreset(name: string): ThemePalette {
  return themePresets.find((preset) => preset.name === name) ?? themePresets[2];
}

function getResolvedThemeName(appearance: AppearanceState): ThemeName | string {
  if (!appearance.autoThemeEnabled) {
    return appearance.theme;
  }
  const currentHour = new Date().getHours();
  return currentHour >= 18 || currentHour < 6 ? 'Dark' : 'Light';
}

function buildPalette(appearance: AppearanceState): ThemePalette {
  const baseTheme = getPreset(String(getResolvedThemeName(appearance)));
  if (appearance.theme !== 'Custom') {
    return baseTheme;
  }

  return {
    ...baseTheme,
    name: 'Custom',
    backgroundGradient: appearance.backgroundGradient || baseTheme.backgroundGradient,
    cardColor: appearance.cardColor || baseTheme.cardColor,
    accentColor: appearance.accentColor || baseTheme.accentColor,
    textColor: appearance.textColor || baseTheme.textColor
  };
}

function applyPalette(appearance: AppearanceState, palette: ThemePalette) {
  const root = document.documentElement;
  root.style.setProperty('--bg-color', palette.backgroundGradient);
  root.style.setProperty('--card-color', palette.cardColor);
  root.style.setProperty('--accent-color', palette.accentColor);
  root.style.setProperty('--text-color', palette.textColor);
  root.style.setProperty('--border-color', palette.borderColor);
  root.style.setProperty('--muted-text-color', palette.mutedTextColor);
  root.style.setProperty('--panel-shadow', palette.panelShadow);
  root.style.setProperty('--spotlight-color', palette.spotlightColor);
  root.style.setProperty('--glass-blur', appearance.glassEffectEnabled ? '26px' : '0px');
  root.classList.toggle('theme-animations-off', !appearance.animationEnabled);
  root.classList.toggle('dark', palette.name !== 'Light');
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [appearance, setAppearance] = useState<AppearanceState>(() => {
    if (typeof window === 'undefined') {
      return defaultAppearance;
    }

    const persisted = window.localStorage.getItem(STORAGE_KEY);
    if (!persisted) {
      return defaultAppearance;
    }

    try {
      const parsed = JSON.parse(persisted) as Partial<AppearanceState>;
      return {
        ...defaultAppearance,
        ...parsed
      };
    } catch {
      return defaultAppearance;
    }
  });

  const resolvedPalette = useMemo(() => buildPalette(appearance), [appearance]);

  useEffect(() => {
    applyPalette(appearance, resolvedPalette);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  }, [appearance, resolvedPalette]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance,
      themeName: String(getResolvedThemeName(appearance)),
      resolvedPalette,
      presets: themePresets,
      setThemeByName: (theme) => {
        setAppearance((current) => ({
          ...current,
          theme
        }));
      },
      updateAppearance: (updates) => {
        setAppearance((current) => ({
          ...current,
          ...updates
        }));
      },
      syncAppearance: (next) => {
        setAppearance((current) => ({
          ...current,
          ...next
        }));
      },
      toggleTheme: () => {
        setAppearance((current) => ({
          ...current,
          autoThemeEnabled: false,
          theme: String(getResolvedThemeName(current)) === 'Light' ? 'Dark' : 'Light'
        }));
      }
    }),
    [appearance, resolvedPalette]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('Theme context is not available.');
  }
  return context;
}
