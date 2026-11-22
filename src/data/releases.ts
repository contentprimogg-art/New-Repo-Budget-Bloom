// Notes de mise à jour affichées aux utilisateurs (la plus récente en premier).
// Pour une nouvelle version: ajouter une entrée en haut. Le popup s'affiche alors une fois.
// Style: court, sans jargon technique ni emoji, en parlant de ce que la personne peut faire.

export interface ReleaseItem {
  /** Ce qui compte, affiché en gras. */
  strong: string
  /** Précision, affichée en gris. */
  text: string
}

export interface ReleaseText {
  title: string
  intro: string
  sections: { title: string; items: ReleaseItem[] }[]
}

export interface Release {
  version: string
  /** Date de publication (AAAA-MM-JJ). */
  date: string
  fr: ReleaseText
  en: ReleaseText
}

export const RELEASES: Release[] = [
  {
    version: '1.6',
    date: '2026-11-22',
    fr: {
      title: 'Une sauvegarde de plus',
      intro: 'Gardez une copie complète de vos données dans un fichier simple.',
      sections: [
        {
          title: 'Ce qui est nouveau',
          items: [
            { strong: 'Sauvegarde en CSV', text: 'téléchargez toutes vos données dans un fichier lisible par un tableur.' },
            { strong: 'Restauration sans doublon', text: 'réimportez ce fichier depuis votre profil, le reste de vos données est conservé.' },
          ],
        },
      ],
    },
    en: {
      title: 'One more backup',
      intro: 'Keep a full copy of your data in a simple file.',
      sections: [
        {
          title: 'New',
          items: [
            { strong: 'CSV backup', text: 'download all your data in a file any spreadsheet can read.' },
            { strong: 'Restore without duplicates', text: 'import this file again from your profile; the rest of your data is kept.' },
          ],
        },
      ],
    },
  },
  {
    version: '1.5',
    date: '2026-11-22',
    fr: {
      title: 'Plus clair, plus fiable',
      intro: 'Cette version corrige de nombreux détails signalés pendant les essais et protège mieux vos données.',
      sections: [
        {
          title: 'Ce qui est nouveau',
          items: [
            { strong: 'Mois à venir', text: 'vos revenus, enveloppes et dépenses récurrents apparaissent comme prévus.' },
            { strong: 'Épargne du mois', text: "un dépôt peut être pris sur l'argent du mois et se reflète dans votre solde." },
            { strong: 'Modification complète', text: "changez la date, l'enveloppe ou la devise d'une dépense." },
            { strong: 'Nouveau menu sur ordinateur', text: 'une barre latérale, plus lisible et plus large.' },
          ],
        },
        {
          title: 'Améliorations',
          items: [
            { strong: 'Sauvegardes plus complètes', text: 'elles incluent désormais vos groupes et tout votre historique.' },
            { strong: 'Saisies sans réseau', text: 'elles sont mieux conservées en attendant le retour de la connexion.' },
            { strong: 'Mouvements d’épargne', text: 'une erreur de saisie peut maintenant être corrigée.' },
          ],
        },
      ],
    },
    en: {
      title: 'Clearer and more reliable',
      intro: 'This version fixes many details reported during testing and better protects your data.',
      sections: [
        {
          title: 'New',
          items: [
            { strong: 'Upcoming months', text: 'your recurring income, envelopes and expenses now show as planned.' },
            { strong: 'Monthly savings', text: "a deposit can come from this month's money and is reflected in your balance." },
            { strong: 'Full editing', text: 'change the date, envelope or currency of an expense.' },
            { strong: 'New desktop menu', text: 'a sidebar that is easier to read, with more room.' },
          ],
        },
        {
          title: 'Improvements',
          items: [
            { strong: 'More complete backups', text: 'they now include your groups and your full history.' },
            { strong: 'Offline entries', text: 'they are kept more safely until you are back online.' },
            { strong: 'Savings movements', text: 'a typing mistake can now be corrected.' },
          ],
        },
      ],
    },
  },
  {
    version: '1.4',
    date: '2026-10-31',
    fr: {
      title: 'Notifications et application Android',
      intro: 'Restez informé sans ouvrir Budget Bloom.',
      sections: [
        {
          title: 'Ce qui est nouveau',
          items: [
            { strong: 'Notifications', text: 'dépenses du foyer, enveloppe presque vide, bilan du dimanche et rappels.' },
            { strong: 'Application Android', text: 'à installer directement sur votre téléphone.' },
          ],
        },
      ],
    },
    en: {
      title: 'Notifications and Android app',
      intro: 'Stay informed without opening Budget Bloom.',
      sections: [
        {
          title: 'New',
          items: [
            { strong: 'Notifications', text: 'household expenses, nearly empty envelopes, Sunday review and reminders.' },
            { strong: 'Android app', text: 'install it directly on your phone.' },
          ],
        },
      ],
    },
  },
  {
    version: '1.3',
    date: '2026-10-31',
    fr: {
      title: 'Voici Bloom',
      intro: 'Un compagnon bienveillant pour vous aider à garder le cap.',
      sections: [
        {
          title: 'Ce qui est nouveau',
          items: [
            { strong: 'Conseils personnalisés', text: 'rythme du mois, budgets à ajuster, abonnements et objectifs.' },
            { strong: 'Vos chiffres restent privés', text: 'les conseils sont préparés sur votre appareil.' },
          ],
        },
      ],
    },
    en: {
      title: 'Meet Bloom',
      intro: 'A friendly companion to help you stay on track.',
      sections: [
        {
          title: 'New',
          items: [
            { strong: 'Personal tips', text: 'monthly pace, budgets to adjust, subscriptions and goals.' },
            { strong: 'Your numbers stay private', text: 'tips are prepared on your device.' },
          ],
        },
      ],
    },
  },
  {
    version: '1.2',
    date: '2026-10-31',
    fr: {
      title: 'Le budget à plusieurs',
      intro: 'Gérez votre argent en couple, en famille ou en colocation.',
      sections: [
        {
          title: 'Ce qui est nouveau',
          items: [
            { strong: 'Foyers partagés', text: 'invitez vos proches et passez d’un foyer à l’autre.' },
            { strong: 'Revenus et dépenses récurrentes', text: 'ce qui revient chaque mois se note une seule fois.' },
            { strong: 'Recherche et devises', text: 'retrouvez une opération et saisissez une dépense faite à l’étranger.' },
            { strong: 'Sans réseau', text: 'continuez à noter vos dépenses hors connexion.' },
          ],
        },
      ],
    },
    en: {
      title: 'Budgeting together',
      intro: 'Manage your money as a couple, a family or with flatmates.',
      sections: [
        {
          title: 'New',
          items: [
            { strong: 'Shared households', text: 'invite your loved ones and switch between households.' },
            { strong: 'Income and recurring expenses', text: 'what comes back every month only needs noting once.' },
            { strong: 'Search and currencies', text: 'find any entry and add an expense made abroad.' },
            { strong: 'Offline', text: 'keep noting your expenses without a connection.' },
          ],
        },
      ],
    },
  },
  {
    version: '1.1',
    date: '2026-10-31',
    fr: {
      title: 'Une nouvelle allure',
      intro: 'Budget Bloom adopte son style et devient plus agréable au quotidien.',
      sections: [
        {
          title: 'Ce qui est nouveau',
          items: [
            { strong: 'Style calligraphique', text: 'de nouvelles cartes, couleurs et un mode sombre.' },
            { strong: 'Groupes d’enveloppes', text: 'rangez vos budgets comme vous le souhaitez.' },
            { strong: 'Ajout rapide', text: 'notez une dépense en quelques secondes.' },
          ],
        },
      ],
    },
    en: {
      title: 'A new look',
      intro: 'Budget Bloom gets its own style and becomes nicer to use every day.',
      sections: [
        {
          title: 'New',
          items: [
            { strong: 'Calligraphic style', text: 'new cards, colors and a dark mode.' },
            { strong: 'Envelope groups', text: 'organize your budgets the way you like.' },
            { strong: 'Quick add', text: 'note an expense in seconds.' },
          ],
        },
      ],
    },
  },
  {
    version: '1.0',
    date: '2026-10-30',
    fr: {
      title: 'Bienvenue sur Budget Bloom',
      intro: 'La première version de votre budget par enveloppes.',
      sections: [
        {
          title: 'Au programme',
          items: [
            { strong: 'Enveloppes', text: 'répartissez votre argent et suivez ce qu’il reste.' },
            { strong: 'Épargne', text: 'fixez des objectifs et des paliers.' },
            { strong: 'Bilans', text: 'comparez vos mois et exportez votre historique.' },
          ],
        },
      ],
    },
    en: {
      title: 'Welcome to Budget Bloom',
      intro: 'The first version of your envelope budget.',
      sections: [
        {
          title: 'Included',
          items: [
            { strong: 'Envelopes', text: "share out your money and see what's left." },
            { strong: 'Savings', text: 'set goals and milestones.' },
            { strong: 'Reviews', text: 'compare your months and export your history.' },
          ],
        },
      ],
    },
  },
]

export const LATEST_RELEASE = RELEASES[0]
