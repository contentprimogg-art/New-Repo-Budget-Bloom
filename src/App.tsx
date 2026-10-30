import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Auth from './components/Auth'
import Home from './components/Home'
import Onboarding from './components/Onboarding'
import SavingsPage from './components/SavingsPage'
import StatsPage from './components/StatsPage'
import { pageOf, useHash } from './lib/route'
import { isConfigured, supabase } from './lib/supabase'
import type { Profile } from './lib/types'

function Pages({ householdId, profile }: { householdId: string; profile: Profile }) {
  const page = pageOf(useHash())
  if (page === 'savings') return <SavingsPage householdId={householdId} />
  if (page === 'stats') return <StatsPage householdId={householdId} />
  return <Home householdId={householdId} profile={profile} />
}

export default function App() {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loadingHousehold, setLoadingHousehold] = useState(false)

  useEffect(() => {
    if (!isConfigured) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const meta = session?.user.user_metadata as { first_name?: string; last_name?: string } | undefined
  const profile: Profile = { firstName: meta?.first_name?.trim() || null, lastName: meta?.last_name?.trim() || null }
  useEffect(() => {
    // L'appareil se souvient du prénom pour saluer la personne sur l'écran de connexion.
    if (!profile.firstName) return
    try {
      localStorage.setItem('bloomName', profile.firstName)
    } catch {
      /* stockage indisponible */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.firstName])
  useEffect(() => {
    if (!userId) {
      setHouseholdId(null)
      return
    }
    setLoadingHousehold(true)
    void supabase
      .from('household_members')
      .select('household_id')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setHouseholdId(data?.household_id ?? null)
        setLoadingHousehold(false)
      })
  }, [userId])

  if (!isConfigured) return <p className="p-6 text-over">{t('missingConfig')}</p>
  if (!ready || loadingHousehold) return <p className="p-6 text-muted">{t('loading')}</p>
  if (!session) return <Auth />
  if (!householdId) return <Onboarding onDone={setHouseholdId} />
  return <Pages householdId={householdId} profile={profile} />
}
