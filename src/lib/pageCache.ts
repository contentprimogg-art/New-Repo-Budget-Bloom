// Dernières données de chaque onglet, gardées en mémoire pendant que l'app est ouverte: un onglet
// s'affiche tout de suite, puis se met à jour discrètement. Rien n'est écrit sur l'appareil,
// et tout est effacé à la déconnexion.

const store = new Map<string, unknown>()

export const peek = <T>(key: string) => store.get(key) as T | undefined

export const remember = (key: string, value: unknown) => {
  store.set(key, value)
}

export const clearPageCache = () => store.clear()

export const homeKey = (householdId: string, month: string) => `home:${householdId}:${month}`
export const balancesKey = (householdId: string, month: string) => `balances:${householdId}:${month}`
export const savingsKey = (householdId: string) => `savings:${householdId}`
export const adviceKey = (householdId: string, month: string) => `advice:${householdId}:${month}`
export const statsMonthsKey = (householdId: string) => `stats-months:${householdId}`
export const statsKey = (householdId: string, months: string) => `stats:${householdId}:${months}`
