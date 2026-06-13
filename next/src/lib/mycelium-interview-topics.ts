/**
 * Thématiques d'entretien bien-être pro — cadre QVT / prévention RPS.
 * Ton : écoute active, non médical, non disciplinaire.
 */
export type MyceliumInterviewTopic = {
  slug: string
  labelFr: string
  labelKey: string
  introFr: string
  introKey: string
  /** Dimensions Mycelium (lexique B) principalement sollicitées */
  dimensions: string[]
  /** Questions de repli si l'IA est indisponible */
  fallbackQuestions: string[]
}

export const MYCELIUM_INTERVIEW_TOPICS: MyceliumInterviewTopic[] = [
  {
    slug: 'charge-travail',
    labelFr: 'Charge & rythme',
    labelKey: 'mycelium.interview.topicCharge',
    introFr:
      'Parlons de votre charge de travail et de votre rythme — sans jugement, pour repérer ce qui soutient ou ce qui pèse.',
    introKey: 'mycelium.interview.topicChargeIntro',
    dimensions: ['Alignement / Intégrité', 'Intensité / Risque'],
    fallbackQuestions: [
      'Comment décririez-vous votre charge cette semaine, sur une échelle de légère à très intense ?',
      'Qu’est-ce qui vous a le plus demandé d’énergie — et qu’est-ce qui vous a au contraire facilité la semaine ?',
      'Y a-t-il un ajustement concret (priorisation, délai, appui) qui vous aiderait dès la semaine prochaine ?',
      'Si vous deviez nommer une chose à préserver dans votre quotidien pro, ce serait quoi ?',
    ],
  },
  {
    slug: 'reconnaissance',
    labelFr: 'Reconnaissance & feedback',
    labelKey: 'mycelium.interview.topicRecognition',
    introFr:
      'La reconnaissance influence fortement le climat social. Explorons ce qui vous nourrit — ou ce qui manque.',
    introKey: 'mycelium.interview.topicRecognitionIntro',
    dimensions: ['Contribution / Sens', 'Alliance / Coopération'],
    fallbackQuestions: [
      'Quand vous vous sentez reconnu(e) au travail, qu’est-ce qui se passe concrètement ?',
      'Cette semaine, avez-vous eu un moment où votre contribution a été vue — ou au contraire passée inaperçue ?',
      'Quel type de reconnaissance compte le plus pour vous (feedback, confiance, visibilité, autonomie) ?',
      'Y a-t-il un geste simple qu’un manager ou un pair pourrait faire pour vous soutenir ?',
    ],
  },
  {
    slug: 'relations-equipe',
    labelFr: 'Relations d’équipe',
    labelKey: 'mycelium.interview.topicTeam',
    introFr:
      'Les relations de travail sont un levier majeur de prévention. Partagez ce que vous vivez dans votre équipe.',
    introKey: 'mycelium.interview.topicTeamIntro',
    dimensions: ['Alliance / Coopération', 'Sécurité / Appartenance'],
    fallbackQuestions: [
      'Comment qualifieriez-vous le climat dans votre équipe en ce moment ?',
      'Y a-t-il eu un échange récent qui vous a particulièrement marqué(e) — positivement ou difficilement ?',
      'Vous sentez-vous à l’aise pour demander de l’aide ou exprimer un désaccord ?',
      'Qu’est-ce qui renforcerait la coopération dans votre équipe selon vous ?',
    ],
  },
  {
    slug: 'sens-mission',
    labelFr: 'Sens & contribution',
    labelKey: 'mycelium.interview.topicMeaning',
    introFr:
      'Le sens au travail protège contre l’usure. Prenons un moment pour reconnecter votre métier à ce qui compte pour vous.',
    introKey: 'mycelium.interview.topicMeaningIntro',
    dimensions: ['Contribution / Sens', 'Expansion / Impact'],
    fallbackQuestions: [
      'Qu’est-ce qui donne du sens à votre travail en ce moment ?',
      'Y a-t-il une tâche ou un projet récent dont vous êtes particulièrement fier(ère) ?',
      'Où sentez-vous un décalage entre ce qui compte pour vous et ce que vous faites au quotidien ?',
      'Si vous pouviez orienter 10 % de votre temps vers quelque chose de plus significatif, ce serait quoi ?',
    ],
  },
  {
    slug: 'equilibre-vie',
    labelFr: 'Équilibre vie pro / perso',
    labelKey: 'mycelium.interview.topicBalance',
    introFr:
      'L’équilibre n’est pas parfait — l’idée est d’identifier ce qui bascule et ce qui vous aide à reprendre votre souffle.',
    introKey: 'mycelium.interview.topicBalanceIntro',
    dimensions: ['Alignement / Intégrité', 'Sécurité / Appartenance'],
    fallbackQuestions: [
      'Comment votre vie pro influence-t-elle votre énergie en dehors du travail cette semaine ?',
      'Avez-vous pu vous déconnecter suffisamment — ou sentez-vous le travail “coller” ?',
      'Qu’est-ce qui vous aide à recharger vos batteries en ce moment ?',
      'Y a-t-il une frontière (horaire, rituel, communication) qui vous manque ?',
    ],
  },
  {
    slug: 'securite-psychologique',
    labelFr: 'Sécurité psychologique',
    labelKey: 'mycelium.interview.topicSafety',
    introFr:
      'Pouvoir parler sans crainte est essentiel. Cet espace est confidentiel ; seuls des agrégats anonymes alimentent les indicateurs RH.',
    introKey: 'mycelium.interview.topicSafetyIntro',
    dimensions: ['Sécurité / Appartenance', 'Gouvernance / Contrat'],
    fallbackQuestions: [
      'Vous sentez-vous en sécurité pour dire quand quelque chose ne va pas ?',
      'Y a-t-il un sujet que vous hésitez à aborder — et qu’est-ce qui vous freine ?',
      'Qu’est-ce qui, dans l’organisation ou l’équipe, vous fait confiance — ou l’inverse ?',
      'Qu’est-ce qui rendrait l’environnement plus sûr pour exprimer une difficulté ?',
    ],
  },
]

export const MYCELIUM_INTERVIEW_MAX_TURNS = 5

export function getInterviewTopic(slug: string): MyceliumInterviewTopic | undefined {
  return MYCELIUM_INTERVIEW_TOPICS.find((t) => t.slug === slug)
}
