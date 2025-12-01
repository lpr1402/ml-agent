/**
 * Sistema de Personagens ML Agent 2.0
 * 10 Personagens - 1 a cada 10 níveis
 *
 * Cada personagem representa uma era de evolução do vendedor
 * com bônus de XP progressivo e visual único
 *
 * Usando DiceBear Pixel Art avatars para visual clean e diferenciado
 */

// Avatar generator using DiceBear Pixel Art
export const getCharacterAvatar = (seed: string, size: number = 64) =>
  `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(seed)}&scale=100&radius=0&backgroundColor=transparent&size=${size}`

export interface Character {
  code: string
  name: string
  title: string
  avatarSeed: string
  minLevel: number
  maxLevel: number
  xpMultiplier: number
  // Brand colors (gold/gray palette)
  primaryColor: string
  secondaryColor: string
  gradientClass: string
  glowColor: string
  borderColor: string
  description: string
  unlockMessage: string
  motivation: string
  traits: string[]
}

export const CHARACTERS: Character[] = [
  {
    code: 'ROOKIE',
    name: 'Iniciante',
    title: 'O Aprendiz',
    avatarSeed: 'mlagent-rookie-starter-v1',
    minLevel: 1,
    maxLevel: 10,
    xpMultiplier: 1.0,
    primaryColor: '#9CA3AF', // gray-400
    secondaryColor: '#6B7280', // gray-500
    gradientClass: 'from-gray-500 to-gray-600',
    glowColor: 'rgba(156, 163, 175, 0.3)',
    borderColor: 'rgba(156, 163, 175, 0.3)',
    description: 'Todo gigante começa pequeno',
    unlockMessage: 'Sua jornada começa agora! Bem-vindo ao ML Agent!',
    motivation: 'Cada resposta te aproxima da grandeza!',
    traits: ['Curioso', 'Determinado', 'Aprendiz']
  },
  {
    code: 'WARRIOR',
    name: 'Guerreiro',
    title: 'O Combatente',
    avatarSeed: 'mlagent-warrior-fighter-v1',
    minLevel: 11,
    maxLevel: 20,
    xpMultiplier: 1.05,
    primaryColor: '#60A5FA', // blue-400
    secondaryColor: '#3B82F6', // blue-500
    gradientClass: 'from-blue-500 to-blue-600',
    glowColor: 'rgba(96, 165, 250, 0.3)',
    borderColor: 'rgba(96, 165, 250, 0.3)',
    description: 'Batalhas são vencidas com persistência',
    unlockMessage: 'Guerreiro desbloqueado! Você provou seu valor em combate!',
    motivation: 'A espada do conhecimento é invencível!',
    traits: ['Destemido', 'Persistente', 'Estrategista']
  },
  {
    code: 'BEAST',
    name: 'Predador',
    title: 'A Fera',
    avatarSeed: 'mlagent-beast-predator-v1',
    minLevel: 21,
    maxLevel: 30,
    xpMultiplier: 1.10,
    primaryColor: '#34D399', // emerald-400
    secondaryColor: '#10B981', // emerald-500
    gradientClass: 'from-emerald-500 to-emerald-600',
    glowColor: 'rgba(52, 211, 153, 0.3)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
    description: 'Instinto predador ativado!',
    unlockMessage: 'A Fera despertou! Seus instintos estão afiados!',
    motivation: 'Cace cada oportunidade como um predador!',
    traits: ['Instintivo', 'Feroz', 'Dominante']
  },
  {
    code: 'MYTH',
    name: 'Lenda',
    title: 'O Mito',
    avatarSeed: 'mlagent-myth-legend-v1',
    minLevel: 31,
    maxLevel: 40,
    xpMultiplier: 1.15,
    primaryColor: '#A78BFA', // violet-400
    secondaryColor: '#8B5CF6', // violet-500
    gradientClass: 'from-violet-500 to-violet-600',
    glowColor: 'rgba(167, 139, 250, 0.3)',
    borderColor: 'rgba(167, 139, 250, 0.3)',
    description: 'Lendas são criadas aqui',
    unlockMessage: 'O Mito nasce! Você transcendeu o comum!',
    motivation: 'Lendas não pedem permissão para voar!',
    traits: ['Lendário', 'Misterioso', 'Poderoso']
  },
  {
    code: 'SIGMA',
    name: 'Sigma',
    title: 'O Focado',
    avatarSeed: 'mlagent-sigma-focused-v1',
    minLevel: 41,
    maxLevel: 50,
    xpMultiplier: 1.20,
    primaryColor: '#FBBF24', // amber-400
    secondaryColor: '#F59E0B', // amber-500
    gradientClass: 'from-amber-500 to-amber-600',
    glowColor: 'rgba(251, 191, 36, 0.3)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    description: 'Mindset sigma ativado',
    unlockMessage: 'Sigma Mode! Você opera em outra dimensão!',
    motivation: 'Enquanto outros descansam, você domina!',
    traits: ['Independente', 'Focado', 'Imparável']
  },
  {
    code: 'PRO',
    name: 'Pro Player',
    title: 'O Expert',
    avatarSeed: 'mlagent-pro-expert-v1',
    minLevel: 51,
    maxLevel: 60,
    xpMultiplier: 1.25,
    primaryColor: '#4ADE80', // green-400
    secondaryColor: '#22C55E', // green-500
    gradientClass: 'from-green-500 to-green-600',
    glowColor: 'rgba(74, 222, 128, 0.3)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
    description: 'Nível profissional alcançado!',
    unlockMessage: 'Pro Player desbloqueado! GG! Você está dominando!',
    motivation: 'Cada resposta é um combo perfeito!',
    traits: ['Competitivo', 'Estratégico', 'Clutch']
  },
  {
    code: 'TYCOON',
    name: 'Magnata',
    title: 'O Empresário',
    avatarSeed: 'mlagent-tycoon-business-v1',
    minLevel: 61,
    maxLevel: 70,
    xpMultiplier: 1.30,
    primaryColor: '#D4AF37', // gold
    secondaryColor: '#B8962B', // darker gold
    gradientClass: 'from-yellow-500 to-amber-600',
    glowColor: 'rgba(212, 175, 55, 0.4)',
    borderColor: 'rgba(212, 175, 55, 0.4)',
    description: 'Dinheiro chama dinheiro',
    unlockMessage: 'Magnata! Você construiu um império de excelência!',
    motivation: 'Cada resposta é um investimento no seu sucesso!',
    traits: ['Visionário', 'Próspero', 'Influente']
  },
  {
    code: 'COSMIC',
    name: 'Cósmico',
    title: 'O Explorador',
    avatarSeed: 'mlagent-cosmic-explorer-v1',
    minLevel: 71,
    maxLevel: 80,
    xpMultiplier: 1.35,
    primaryColor: '#818CF8', // indigo-400
    secondaryColor: '#6366F1', // indigo-500
    gradientClass: 'from-indigo-500 to-indigo-600',
    glowColor: 'rgba(129, 140, 248, 0.3)',
    borderColor: 'rgba(129, 140, 248, 0.3)',
    description: 'Além das estrelas',
    unlockMessage: 'Cósmico! Você transcendeu os limites terrestres!',
    motivation: 'O universo inteiro é seu campo de vendas!',
    traits: ['Transcendente', 'Infinito', 'Explorador']
  },
  {
    code: 'DIVINE',
    name: 'Divino',
    title: 'O Supremo',
    avatarSeed: 'mlagent-divine-supreme-v1',
    minLevel: 81,
    maxLevel: 90,
    xpMultiplier: 1.40,
    primaryColor: '#FCD34D', // amber-300
    secondaryColor: '#F59E0B', // amber-500
    gradientClass: 'from-amber-400 to-yellow-500',
    glowColor: 'rgba(252, 211, 77, 0.5)',
    borderColor: 'rgba(252, 211, 77, 0.5)',
    description: 'Poder absoluto',
    unlockMessage: 'Divino! Você atingiu o poder dos deuses!',
    motivation: 'Raios de excelência a cada resposta!',
    traits: ['Onipotente', 'Iluminado', 'Supremo']
  },
  {
    code: 'GOAT',
    name: 'GOAT',
    title: 'O Maior de Todos',
    avatarSeed: 'mlagent-goat-greatest-v1',
    minLevel: 91,
    maxLevel: 100,
    xpMultiplier: 1.50,
    primaryColor: '#D4AF37', // gold
    secondaryColor: '#FFFFFF', // white
    gradientClass: 'from-gold via-yellow-400 to-amber-500',
    glowColor: 'rgba(212, 175, 55, 0.6)',
    borderColor: 'rgba(212, 175, 55, 0.6)',
    description: 'Greatest Of All Time',
    unlockMessage: 'GOAT! Você é o MAIOR DE TODOS OS TEMPOS!',
    motivation: 'Você é a lenda que outros sonham ser!',
    traits: ['Absoluto', 'Imortal', 'GOAT']
  }
]

// Helper functions
export function getCharacterByCode(code: string): Character | null {
  return CHARACTERS.find(c => c.code === code) || null
}

export function getCharacterByLevel(level: number): Character {
  for (const character of CHARACTERS) {
    if (level >= character.minLevel && level <= character.maxLevel) {
      return character
    }
  }
  // Return GOAT for level 100+
  const goat = CHARACTERS[CHARACTERS.length - 1]
  return goat || CHARACTERS[0]!
}

export function getNextCharacter(currentCharacterCode: string): Character | null {
  const currentIndex = CHARACTERS.findIndex(c => c.code === currentCharacterCode)
  if (currentIndex === -1 || currentIndex === CHARACTERS.length - 1) {
    return null
  }
  return CHARACTERS[currentIndex + 1] || null
}

export function getPreviousCharacter(currentCharacterCode: string): Character | null {
  const currentIndex = CHARACTERS.findIndex(c => c.code === currentCharacterCode)
  if (currentIndex <= 0) {
    return null
  }
  return CHARACTERS[currentIndex - 1] || null
}

export function isCharacterUnlockLevel(level: number): boolean {
  // Character unlocks at levels: 1, 11, 21, 31, 41, 51, 61, 71, 81, 91
  return level === 1 || (level > 1 && level % 10 === 1)
}

export function getCharacterProgress(level: number): {
  current: Character
  next: Character | null
  progressInEra: number
  levelsToNext: number
} {
  const current = getCharacterByLevel(level)
  const next = getNextCharacter(current.code)

  const levelsInEra = level - current.minLevel
  const totalLevelsInEra = current.maxLevel - current.minLevel + 1
  const progressInEra = Math.round((levelsInEra / totalLevelsInEra) * 100)

  const levelsToNext = next ? next.minLevel - level : 0

  return {
    current,
    next,
    progressInEra,
    levelsToNext
  }
}

export function getAllUnlockedCharacters(level: number): Character[] {
  return CHARACTERS.filter(c => level >= c.minLevel)
}

export function getCharacterXPMultiplier(level: number): number {
  const character = getCharacterByLevel(level)
  return character.xpMultiplier
}

// Color utilities for UI
export function getCharacterGradient(characterCode: string): string {
  const character = getCharacterByCode(characterCode)
  return character?.gradientClass || 'from-gray-400 to-gray-600'
}

export function getCharacterGlow(characterCode: string): string {
  const character = getCharacterByCode(characterCode)
  return character?.glowColor || 'rgba(156, 163, 175, 0.3)'
}

// Get avatar URL for a character
export function getCharacterAvatarUrl(characterCode: string, size: number = 64): string {
  const character = getCharacterByCode(characterCode)
  return character
    ? getCharacterAvatar(character.avatarSeed, size)
    : getCharacterAvatar('mlagent-default-v1', size)
}

// Statistics
export const CHARACTER_STATS = {
  totalCharacters: 10,
  maxXPMultiplier: 1.50,
  minXPMultiplier: 1.0,
  avgMultiplier: 1.23
}
