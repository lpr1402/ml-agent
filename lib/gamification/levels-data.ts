/**
 * Sistema de Gamificacao ML Agent 2.0
 * 100 Niveis com Curva S (~1.000.000 XP total)
 * ~10.000 perguntas para atingir nivel maximo
 *
 * Formula: XP segue uma curva logistica modificada
 * - Niveis 1-30: Progressao rapida (facil)
 * - Niveis 31-70: Progressao moderada (medio)
 * - Niveis 71-100: Progressao desafiadora (dificil)
 */

export interface Level {
  level: number
  xpRequired: number
  name: string
  emoji: string
  era: number
  color: string
  description: string
}

export interface Era {
  number: number
  name: string
  character: string
  characterEmoji: string
  minLevel: number
  maxLevel: number
  colorFrom: string
  colorTo: string
  theme: string
  xpMultiplier: number
}

// 10 Eras - cada uma com 10 niveis e um personagem
export const ERAS: Era[] = [
  {
    number: 1,
    name: 'Despertar do Vendedor',
    character: 'O Filhote',
    characterEmoji: '🐣',
    minLevel: 1,
    maxLevel: 10,
    colorFrom: 'gray-400',
    colorTo: 'blue-400',
    theme: 'Comecando a jornada',
    xpMultiplier: 1.0
  },
  {
    number: 2,
    name: 'Ascensao do Guerreiro',
    character: 'O Guerreiro',
    characterEmoji: '⚔️',
    minLevel: 11,
    maxLevel: 20,
    colorFrom: 'blue-500',
    colorTo: 'cyan-400',
    theme: 'Batalhas do mercado',
    xpMultiplier: 1.05
  },
  {
    number: 3,
    name: 'Despertar da Fera',
    character: 'A Fera',
    characterEmoji: '🦁',
    minLevel: 21,
    maxLevel: 30,
    colorFrom: 'green-500',
    colorTo: 'emerald-400',
    theme: 'Instinto predador',
    xpMultiplier: 1.10
  },
  {
    number: 4,
    name: 'Era dos Mitos',
    character: 'O Mito',
    characterEmoji: '🐉',
    minLevel: 31,
    maxLevel: 40,
    colorFrom: 'purple-500',
    colorTo: 'violet-400',
    theme: 'Lendas nascem aqui',
    xpMultiplier: 1.15
  },
  {
    number: 5,
    name: 'Dimensao Sigma',
    character: 'O Sigma',
    characterEmoji: '😎',
    minLevel: 41,
    maxLevel: 50,
    colorFrom: 'yellow-500',
    colorTo: 'amber-400',
    theme: 'Mindset diferenciado',
    xpMultiplier: 1.20
  },
  {
    number: 6,
    name: 'Universo Gamer',
    character: 'O Gamer',
    characterEmoji: '🎮',
    minLevel: 51,
    maxLevel: 60,
    colorFrom: 'lime-500',
    colorTo: 'green-400',
    theme: 'Level up constante',
    xpMultiplier: 1.25
  },
  {
    number: 7,
    name: 'Imperio Financeiro',
    character: 'O Magnata',
    characterEmoji: '💰',
    minLevel: 61,
    maxLevel: 70,
    colorFrom: 'yellow-600',
    colorTo: 'yellow-400',
    theme: 'Dinheiro chama dinheiro',
    xpMultiplier: 1.30
  },
  {
    number: 8,
    name: 'Cosmo Infinito',
    character: 'O Cosmico',
    characterEmoji: '🚀',
    minLevel: 71,
    maxLevel: 80,
    colorFrom: 'blue-600',
    colorTo: 'indigo-400',
    theme: 'Alem das estrelas',
    xpMultiplier: 1.35
  },
  {
    number: 9,
    name: 'Transcendencia Divina',
    character: 'O Divino',
    characterEmoji: '⚡',
    minLevel: 81,
    maxLevel: 90,
    colorFrom: 'yellow-500',
    colorTo: 'orange-300',
    theme: 'Poder absoluto',
    xpMultiplier: 1.40
  },
  {
    number: 10,
    name: 'Lendas Absolutas',
    character: 'O GOAT',
    characterEmoji: '🐐',
    minLevel: 91,
    maxLevel: 100,
    colorFrom: 'purple-600',
    colorTo: 'pink-400',
    theme: 'Greatest Of All Time',
    xpMultiplier: 1.50
  }
]

// 100 Niveis com nomes criativos e XP calculado com curva S
export const LEVELS: Level[] = [
  // === ERA 1: Despertar do Vendedor (1-10) ===
  { level: 1, xpRequired: 0, name: 'Newbie', emoji: '🐣', era: 1, color: 'gray-400', description: 'Primeiro dia no mercado' },
  { level: 2, xpRequired: 500, name: 'Snow Bunny', emoji: '🐰', era: 1, color: 'gray-500', description: 'Fofinho mas determinado' },
  { level: 3, xpRequired: 1200, name: 'Padawan', emoji: '🌟', era: 1, color: 'blue-300', description: 'Aprendiz dedicado' },
  { level: 4, xpRequired: 2000, name: 'Rookie', emoji: '🎒', era: 1, color: 'blue-400', description: 'Pronto pra batalha' },
  { level: 5, xpRequired: 3000, name: 'Trainee', emoji: '📝', era: 1, color: 'blue-400', description: 'Em treinamento intenso' },
  { level: 6, xpRequired: 4200, name: 'Hustler', emoji: '💼', era: 1, color: 'blue-500', description: 'Correria todo dia' },
  { level: 7, xpRequired: 5500, name: 'Go-Getter', emoji: '🚀', era: 1, color: 'blue-500', description: 'Vai atras do que quer' },
  { level: 8, xpRequired: 7000, name: 'Maromba Mental', emoji: '🧠', era: 1, color: 'blue-600', description: 'Mente blindada' },
  { level: 9, xpRequired: 8700, name: 'Esforcado', emoji: '💦', era: 1, color: 'blue-600', description: 'Suor e dedicacao' },
  { level: 10, xpRequired: 10500, name: 'Promessa', emoji: '⭐', era: 1, color: 'blue-700', description: 'Futuro brilhante' },

  // === ERA 2: Ascensao do Guerreiro (11-20) ===
  { level: 11, xpRequired: 12500, name: 'Warrior', emoji: '⚔️', era: 2, color: 'cyan-400', description: 'Nasceu um guerreiro' },
  { level: 12, xpRequired: 14700, name: 'Spartano', emoji: '🛡️', era: 2, color: 'cyan-400', description: 'Disciplina espartana' },
  { level: 13, xpRequired: 17000, name: 'Viking', emoji: '⛵', era: 2, color: 'cyan-500', description: 'Conquistador nato' },
  { level: 14, xpRequired: 19500, name: 'Samurai', emoji: '🗡️', era: 2, color: 'cyan-500', description: 'Honra e precisao' },
  { level: 15, xpRequired: 22200, name: 'Ronin', emoji: '🌙', era: 2, color: 'cyan-500', description: 'Lobo solitario' },
  { level: 16, xpRequired: 25000, name: 'Gladiador', emoji: '🏛️', era: 2, color: 'cyan-600', description: 'Arena de vendas' },
  { level: 17, xpRequired: 28000, name: 'Knight', emoji: '🏰', era: 2, color: 'cyan-600', description: 'Cavaleiro das vendas' },
  { level: 18, xpRequired: 31200, name: 'Crusader', emoji: '✝️', era: 2, color: 'cyan-600', description: 'Missao sagrada' },
  { level: 19, xpRequired: 34500, name: 'Comandante', emoji: '🎖️', era: 2, color: 'cyan-700', description: 'Lidera a tropa' },
  { level: 20, xpRequired: 38000, name: 'Warlord', emoji: '👑⚔️', era: 2, color: 'cyan-700', description: 'Senhor da Guerra' },

  // === ERA 3: Despertar da Fera (21-30) ===
  { level: 21, xpRequired: 41700, name: 'Beast Mode', emoji: '🦁', era: 3, color: 'green-400', description: 'Ativou o modo fera' },
  { level: 22, xpRequired: 45500, name: 'Pantera', emoji: '🐆', era: 3, color: 'green-400', description: 'Agil e letal' },
  { level: 23, xpRequired: 49500, name: 'Lobo Alpha', emoji: '🐺', era: 3, color: 'green-500', description: 'Lider da matilha' },
  { level: 24, xpRequired: 53700, name: 'Tigre', emoji: '🐅', era: 3, color: 'green-500', description: 'Forca bruta' },
  { level: 25, xpRequired: 58000, name: 'Urso', emoji: '🐻', era: 3, color: 'green-500', description: 'Implacavel' },
  { level: 26, xpRequired: 62500, name: 'Tubarao', emoji: '🦈', era: 3, color: 'green-600', description: 'Cheira oportunidade' },
  { level: 27, xpRequired: 67200, name: 'Aguia', emoji: '🦅', era: 3, color: 'green-600', description: 'Visao aguiada' },
  { level: 28, xpRequired: 72000, name: 'Raptor', emoji: '🦖', era: 3, color: 'green-600', description: 'Predador veloz' },
  { level: 29, xpRequired: 77000, name: 'Gorilla', emoji: '🦍', era: 3, color: 'green-700', description: 'Forca descomunal' },
  { level: 30, xpRequired: 82200, name: 'King Kong', emoji: '👑🦍', era: 3, color: 'green-700', description: 'Rei da selva' },

  // === ERA 4: Era dos Mitos (31-40) ===
  { level: 31, xpRequired: 87500, name: 'Minotauro', emoji: '🐂', era: 4, color: 'purple-400', description: 'Forca mitologica' },
  { level: 32, xpRequired: 93000, name: 'Centauro', emoji: '🏹', era: 4, color: 'purple-400', description: 'Velocidade e poder' },
  { level: 33, xpRequired: 98700, name: 'Griffin', emoji: '🦅🦁', era: 4, color: 'purple-500', description: 'Majestoso e feroz' },
  { level: 34, xpRequired: 104500, name: 'Fenix', emoji: '🔥🐦', era: 4, color: 'purple-500', description: 'Renasce mais forte' },
  { level: 35, xpRequired: 110500, name: 'Kraken', emoji: '🐙', era: 4, color: 'purple-500', description: 'Terror dos mares' },
  { level: 36, xpRequired: 116700, name: 'Hydra', emoji: '🐍🐍', era: 4, color: 'purple-600', description: 'Multiplas cabecas' },
  { level: 37, xpRequired: 123000, name: 'Titan', emoji: '🗿', era: 4, color: 'purple-600', description: 'Colosso vendedor' },
  { level: 38, xpRequired: 129500, name: 'Cerberus', emoji: '🐕🐕🐕', era: 4, color: 'purple-600', description: 'Guardiao incansavel' },
  { level: 39, xpRequired: 136200, name: 'Dragao', emoji: '🐉', era: 4, color: 'purple-700', description: 'Fogo e gloria' },
  { level: 40, xpRequired: 143000, name: 'Deus da Guerra', emoji: '⚔️👑', era: 4, color: 'purple-700', description: 'Mito vivo' },

  // === ERA 5: Dimensao Sigma (41-50) ===
  { level: 41, xpRequired: 150000, name: 'Sigma', emoji: '😎', era: 5, color: 'yellow-400', description: 'Mindset sigma' },
  { level: 42, xpRequired: 157200, name: 'NPC Destroyer', emoji: '🎯', era: 5, color: 'yellow-400', description: 'Nao segue o padrao' },
  { level: 43, xpRequired: 164500, name: 'Grindset', emoji: '⚙️', era: 5, color: 'yellow-500', description: 'Hustle culture' },
  { level: 44, xpRequired: 172000, name: 'No Cap', emoji: '🧢', era: 5, color: 'yellow-500', description: 'Sem mentiras' },
  { level: 45, xpRequired: 179700, name: 'Rizz Master', emoji: '✨', era: 5, color: 'yellow-500', description: 'Carisma infinito' },
  { level: 46, xpRequired: 187500, name: 'Chad', emoji: '💪', era: 5, color: 'yellow-600', description: 'Alpha energy' },
  { level: 47, xpRequired: 195500, name: 'Gigachad', emoji: '🗿💪', era: 5, color: 'yellow-600', description: 'Peak performance' },
  { level: 48, xpRequired: 203700, name: 'Ultra Instinct', emoji: '⚡💫', era: 5, color: 'yellow-600', description: 'Reflexos divinos' },
  { level: 49, xpRequired: 212000, name: 'Mogger', emoji: '👔', era: 5, color: 'yellow-700', description: 'Domina qualquer sala' },
  { level: 50, xpRequired: 220500, name: 'Built Different', emoji: '🏗️', era: 5, color: 'yellow-700', description: 'Feito diferente' },

  // === ERA 6: Universo Gamer (51-60) ===
  { level: 51, xpRequired: 229200, name: 'Player One', emoji: '🎮', era: 6, color: 'lime-400', description: 'Jogo comecou' },
  { level: 52, xpRequired: 238000, name: 'Speedrunner', emoji: '⏱️', era: 6, color: 'lime-400', description: 'Recorde de velocidade' },
  { level: 53, xpRequired: 247000, name: 'No-Lifer', emoji: '🌙', era: 6, color: 'lime-500', description: 'Grind 24/7' },
  { level: 54, xpRequired: 256200, name: 'Tryhard', emoji: '😤', era: 6, color: 'lime-500', description: 'Esforco maximo' },
  { level: 55, xpRequired: 265500, name: 'Sweaty', emoji: '💦🎮', era: 6, color: 'lime-500', description: 'Competitivo nato' },
  { level: 56, xpRequired: 275000, name: 'Pro Player', emoji: '🏆', era: 6, color: 'lime-600', description: 'Nivel profissional' },
  { level: 57, xpRequired: 284700, name: 'MVP', emoji: '⭐🎮', era: 6, color: 'lime-600', description: 'Most Valuable Player' },
  { level: 58, xpRequired: 294500, name: 'Goated', emoji: '🐐🎮', era: 6, color: 'lime-600', description: 'Craque absoluto' },
  { level: 59, xpRequired: 304500, name: 'Clutch God', emoji: '🔥🎯', era: 6, color: 'lime-700', description: 'Vira o jogo' },
  { level: 60, xpRequired: 314700, name: 'Final Boss', emoji: '👾👑', era: 6, color: 'lime-700', description: 'Chefe final' },

  // === ERA 7: Imperio Financeiro (61-70) ===
  { level: 61, xpRequired: 325000, name: 'Money Maker', emoji: '💰', era: 7, color: 'yellow-500', description: 'Fabrica de dinheiro' },
  { level: 62, xpRequired: 335500, name: 'Investidor', emoji: '📈', era: 7, color: 'yellow-500', description: 'Visao de futuro' },
  { level: 63, xpRequired: 346200, name: 'Shark Tank', emoji: '🦈💼', era: 7, color: 'yellow-500', description: 'Tubarao dos negocios' },
  { level: 64, xpRequired: 357000, name: 'Wolf of Sales', emoji: '🐺💵', era: 7, color: 'yellow-600', description: 'Lobo das vendas' },
  { level: 65, xpRequired: 368000, name: 'Millionaire', emoji: '💎', era: 7, color: 'yellow-600', description: 'Primeiro milhao' },
  { level: 66, xpRequired: 379200, name: 'Crypto Bro', emoji: '🪙', era: 7, color: 'yellow-600', description: 'To the moon' },
  { level: 67, xpRequired: 390500, name: 'CEO', emoji: '👔💼', era: 7, color: 'yellow-600', description: 'Chief Everything Officer' },
  { level: 68, xpRequired: 402000, name: 'Billionaire', emoji: '💰💰💰', era: 7, color: 'yellow-700', description: 'Liga dos bilionarios' },
  { level: 69, xpRequired: 413700, name: 'Empire Builder', emoji: '🏰💰', era: 7, color: 'yellow-700', description: 'Construtor de imperios' },
  { level: 70, xpRequired: 425500, name: 'Tycoon', emoji: '👑💎', era: 7, color: 'yellow-700', description: 'Magnata supremo' },

  // === ERA 8: Cosmo Infinito (71-80) ===
  { level: 71, xpRequired: 437500, name: 'Astronauta', emoji: '🚀', era: 8, color: 'indigo-400', description: 'Explorando o espaco' },
  { level: 72, xpRequired: 450000, name: 'Stargazer', emoji: '🌟', era: 8, color: 'indigo-400', description: 'Olhos nas estrelas' },
  { level: 73, xpRequired: 463000, name: 'Nebula', emoji: '🌌', era: 8, color: 'indigo-500', description: 'Energia cosmica' },
  { level: 74, xpRequired: 476500, name: 'Supernova', emoji: '💥🌟', era: 8, color: 'indigo-500', description: 'Explosao de poder' },
  { level: 75, xpRequired: 490500, name: 'Black Hole', emoji: '🕳️', era: 8, color: 'indigo-500', description: 'Atrai tudo' },
  { level: 76, xpRequired: 505000, name: 'Galaxy Brain', emoji: '🧠🌌', era: 8, color: 'indigo-600', description: 'Inteligencia galatica' },
  { level: 77, xpRequired: 520000, name: 'Cosmic Entity', emoji: '✨🌌', era: 8, color: 'indigo-600', description: 'Entidade cosmica' },
  { level: 78, xpRequired: 535500, name: 'Multiverse', emoji: '🌀', era: 8, color: 'indigo-600', description: 'Multiplas dimensoes' },
  { level: 79, xpRequired: 551500, name: 'Infinity', emoji: '♾️', era: 8, color: 'indigo-700', description: 'Poder infinito' },
  { level: 80, xpRequired: 568000, name: 'Universe Master', emoji: '🌌👑', era: 8, color: 'indigo-700', description: 'Mestre do universo' },

  // === ERA 9: Transcendencia Divina (81-90) ===
  { level: 81, xpRequired: 585000, name: 'Ascended', emoji: '⚡', era: 9, color: 'orange-400', description: 'Transcendeu' },
  { level: 82, xpRequired: 603000, name: 'Enlightened', emoji: '🔆', era: 9, color: 'orange-400', description: 'Iluminado' },
  { level: 83, xpRequired: 622000, name: 'Ethereal', emoji: '👻✨', era: 9, color: 'orange-500', description: 'Forma eterea' },
  { level: 84, xpRequired: 642000, name: 'Celestial', emoji: '😇', era: 9, color: 'orange-500', description: 'Ser celestial' },
  { level: 85, xpRequired: 663000, name: 'Arcanjo', emoji: '😇🗡️', era: 9, color: 'orange-500', description: 'Guerreiro divino' },
  { level: 86, xpRequired: 685000, name: 'Seraph', emoji: '🔥😇', era: 9, color: 'orange-600', description: 'Serafim ardente' },
  { level: 87, xpRequired: 708000, name: 'Demigod', emoji: '⚡👑', era: 9, color: 'orange-600', description: 'Semi-deus' },
  { level: 88, xpRequired: 732000, name: 'God Tier', emoji: '🏛️⚡', era: 9, color: 'orange-600', description: 'Nivel dos deuses' },
  { level: 89, xpRequired: 757000, name: 'Omnipotent', emoji: '💫', era: 9, color: 'orange-700', description: 'Todo-poderoso' },
  { level: 90, xpRequired: 783000, name: 'Supreme Being', emoji: '👑✨⚡', era: 9, color: 'orange-700', description: 'Ser supremo' },

  // === ERA 10: Lendas Absolutas (91-100) ===
  { level: 91, xpRequired: 810000, name: 'Legend', emoji: '🌟', era: 10, color: 'pink-400', description: 'Lenda viva' },
  { level: 92, xpRequired: 838000, name: 'Icon', emoji: '🎭', era: 10, color: 'pink-400', description: 'Icone do mercado' },
  { level: 93, xpRequired: 867000, name: 'Myth', emoji: '📜', era: 10, color: 'pink-500', description: 'Mito eterno' },
  { level: 94, xpRequired: 897000, name: 'Immortal', emoji: '♾️👑', era: 10, color: 'pink-500', description: 'Imortal' },
  { level: 95, xpRequired: 928000, name: 'Eternal', emoji: '⏳✨', era: 10, color: 'pink-500', description: 'Eterno' },
  { level: 96, xpRequired: 960000, name: 'Transcendent', emoji: '🌈', era: 10, color: 'pink-600', description: 'Transcendente' },
  { level: 97, xpRequired: 993000, name: 'The One', emoji: '1️⃣', era: 10, color: 'pink-600', description: 'O escolhido' },
  { level: 98, xpRequired: 1027000, name: 'Absolute', emoji: '💎👑', era: 10, color: 'pink-600', description: 'Absoluto' },
  { level: 99, xpRequired: 1062000, name: 'Ultimate', emoji: '🎮👑', era: 10, color: 'pink-700', description: 'Definitivo' },
  { level: 100, xpRequired: 1100000, name: 'GOAT', emoji: '🐐👑✨', era: 10, color: 'pink-700', description: 'Greatest Of All Time' }
]

// Helper functions
export function getLevelByXP(totalXP: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    const currentLevel = LEVELS[i]
    if (currentLevel && totalXP >= currentLevel.xpRequired) {
      return currentLevel
    }
  }
  return LEVELS[0]!
}

export function getNextLevel(currentLevel: number): Level | null {
  if (currentLevel >= 100) return null
  const next = LEVELS[currentLevel] // LEVELS[0] is level 1, so LEVELS[currentLevel] is next
  return next || null
}

export function getEraByLevel(level: number): Era {
  const eraNumber = Math.ceil(level / 10)
  const era = ERAS[Math.min(eraNumber - 1, ERAS.length - 1)]
  return era || ERAS[0]!
}

export function getProgressToNextLevel(totalXP: number): {
  currentLevel: Level
  nextLevel: Level | null
  xpInCurrentLevel: number
  xpNeededForNext: number
  progressPercent: number
} {
  const currentLevel = getLevelByXP(totalXP)
  const nextLevel = getNextLevel(currentLevel.level)

  if (!nextLevel) {
    return {
      currentLevel,
      nextLevel: null,
      xpInCurrentLevel: totalXP - currentLevel.xpRequired,
      xpNeededForNext: 0,
      progressPercent: 100
    }
  }

  const xpInCurrentLevel = totalXP - currentLevel.xpRequired
  const xpNeededForNext = nextLevel.xpRequired - currentLevel.xpRequired
  const progressPercent = Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForNext) * 100))

  return {
    currentLevel,
    nextLevel,
    xpInCurrentLevel,
    xpNeededForNext,
    progressPercent
  }
}

export function isNewEra(oldLevel: number, newLevel: number): boolean {
  const oldEra = Math.ceil(oldLevel / 10)
  const newEra = Math.ceil(newLevel / 10)
  return newEra > oldEra
}

export function getCharacterForLevel(level: number): {
  character: string
  emoji: string
  era: Era
} {
  const era = getEraByLevel(level)
  return {
    character: era.character,
    emoji: era.characterEmoji,
    era
  }
}

// Statistics
export const LEVEL_STATS = {
  totalLevels: 100,
  totalEras: 10,
  maxXP: 1100000,
  avgQuestionsToMax: 10000, // ~110 XP medio por pergunta
  easyPhase: { start: 1, end: 30 },
  mediumPhase: { start: 31, end: 70 },
  hardPhase: { start: 71, end: 100 }
}
