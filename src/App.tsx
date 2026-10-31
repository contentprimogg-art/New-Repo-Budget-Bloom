import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Auth from './components/Auth'
import Home from './components/Home'
import InstallPrompt from './components/InstallPrompt'
import Onboarding from './components/Onboarding'
import ResetPassword from './components/ResetPassword'
import Splash from './components/ui/Splash'
import ProfilePage from './components/ProfilePage'
import SavingsPage from './components/SavingsPage'
import StatsPage from './components/StatsPage'
import { ProfileProvider } from './lib/profile'
import { HouseholdProvider } from './lib/household'
import { HouseholdsContext, loadHouseholds, storeActive, storedActive, type HouseholdRef } from './lib/households'
import { DataProvider } from './lib/realtime'
import { pageOf, useHash } from './lib/route'
import { isConfigured, supabase } from './lib/supabase'

function Pages({ householdId }: { householdId: string }) {
  const page = pageOf(useHash())
  if (page === 'savings') return <SavingsPage householdId={householdId} />
  if (page === 'stats') return <StatsPage householdId={householdId} />
  if (page === 'profile') return <ProfilePage householdId={householdId} />
  return <Home householdId={householdId} />
}

export default function App() {
  return (
    <InstallPrompt>
      <AppContent />
    </InstallPrompt>
  )
}

function AppContent() {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(() => new URLSearchParams(window.location.search).has('reset-password'))
  const [households, setHouseholds] = useState<HouseholdRef[]>([])
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loadingHousehold, setLoadingHousehold] = useState(false)

  useEffect(() => {
    if (!isConfigured) return
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setPasswordRecovery(false)
      setSession(nextSession)
    })
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      setSession(sessionData.session)
      setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  // Foyers dont on est membre; le foyer affiché est celui choisi sur cet appareil (sinon le premier).
  const refresh = useCallback(
    async (prefer?: string) => {
      if (!userId) return
      const { list } = await loadHouseholds(userId)
      setHouseholds(list)
      const wanted = prefer ?? storedActive()
      const active = list.find((h) => h.id === wanted)?.id ?? list[0]?.id ?? null
      storeActive(active)
      setHouseholdId(active)
    },
    [userId],
  )

  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHouseholdId(null)
      setHouseholds([])
      return
    }
    setLoadingHousehold(true)
    void refresh().then(() => setLoadingHousehold(false))
  }, [userId, refresh])

  const switcher = useMemo(
    () =>
      householdId
        ? {
            list: households,
            activeId: householdId,
            switchTo: async (id: string) => {
              window.location.hash = ''
              await refresh(id)
            },
            refresh: () => refresh(householdId),
          }
        : null,
    [households, householdId, refresh],
  )

  if (!isConfigured) return <p className="p-6 text-over">{t('missingConfig')}</p>
  if (!ready) return <Splash />
  if (passwordRecovery && session) {
    return (
      <ResetPassword
        onComplete={() => {
          const url = new URL(window.location.href)
          url.searchParams.delete('reset-password')
          window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
          setPasswordRecovery(false)
        }}
      />
    )
  }
  if (loadingHousehold) return <Splash />
  if (!session) return <Auth />
  if (!householdId || !switcher) return <Onboarding onDone={(id) => void refresh(id)} />
  return (
    <ProfileProvider session={session}>
      <HouseholdsContext.Provider value={switcher}>
        {/* Changer de foyer remonte tout l'arbre: aucune donnée de l'ancien foyer ne subsiste. */}
        <DataProvider key={householdId} householdId={householdId}>
          <HouseholdProvider householdId={householdId} userId={session.user.id}>
            <Pages householdId={householdId} />
          </HouseholdProvider>
        </DataProvider>
      </HouseholdsContext.Provider>
    </ProfileProvider>
  )
}
