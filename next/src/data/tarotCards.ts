import enCards from './tarotCards.en.json'
import esCards from './tarotCards.es.json'
import itCards from './tarotCards.it.json'
import deCards from './tarotCards.de.json'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
export const BACK_IMG = `${basePath}/verso-cartes.webp`

type CardRecord = { desc?: string; synth?: string }
type DoorRecord = { title?: string; subtitle?: string; aspect?: string }
type Card = { name: string; desc?: string; img?: string; synth?: string }
type Door = { key: string; title?: string; subtitle?: string; aspect?: string; [k: string]: unknown }

export function getCardTranslated(
  card: Card | null | undefined,
  locale: string | undefined
): Card | null | undefined {
  if (!card) return card
  if (locale === 'en') {
    const t = (enCards as { cards?: Record<string, CardRecord> })?.cards?.[card.name]
    if (t) return { ...card, desc: t.desc, synth: t.synth }
  }
  if (locale === 'es') {
    const t = (esCards as { cards?: Record<string, CardRecord> })?.cards?.[card.name]
    if (t) return { ...card, desc: t.desc, synth: t.synth }
  }
  if (locale === 'it') {
    const t = (itCards as { cards?: Record<string, CardRecord> })?.cards?.[card.name]
    if (t) return { ...card, desc: t.desc, synth: t.synth }
  }
  if (locale === 'de') {
    const t = (deCards as { cards?: Record<string, CardRecord> })?.cards?.[card.name]
    if (t) return { ...card, desc: t.desc, synth: t.synth }
  }
  return card
}

export function getDoorTranslated(
  door: Door | null | undefined,
  locale: string | undefined
): Door | null | undefined {
  if (!door) return door
  if (locale === 'en') {
    const t = (enCards as { doors?: Record<string, DoorRecord> })?.doors?.[door.key]
    if (t) return { ...door, title: t.title, subtitle: t.subtitle, aspect: t.aspect }
  }
  if (locale === 'es') {
    const t = (esCards as { doors?: Record<string, DoorRecord> })?.doors?.[door.key]
    if (t) return { ...door, title: t.title, subtitle: t.subtitle, aspect: t.aspect }
  }
  if (locale === 'it') {
    const t = (itCards as { doors?: Record<string, DoorRecord> })?.doors?.[door.key]
    if (t) return { ...door, title: t.title, subtitle: t.subtitle, aspect: t.aspect }
  }
  if (locale === 'de') {
    const t = (deCards as { doors?: Record<string, DoorRecord> })?.doors?.[door.key]
    if (t) return { ...door, title: t.title, subtitle: t.subtitle, aspect: t.aspect }
  }
  return door
}

const LOVE: Card[] = [
  { name: 'Agapè', desc: "Ouverture du cœur et don relationnel qui relie plutôt qu'il ne possède.\nQuestion racine : Où puis-je aimer sans me sacrifier ?", img: 'https://eludein.art/wp-content/uploads/2026/01/agape.png', synth: "Agapè ouvre le tirage en rappelant un amour qui relie sans se sacrifier, comme une disponibilité du cœur à plus grand que soi." },
  { name: 'Philautia', desc: "Soin de soi, estime, limites justes et présence à sa vulnérabilité.\nQuestion racine : Quel acte de respect envers moi-même est nécessaire ici ?", img: 'https://eludein.art/wp-content/uploads/2026/01/philautia.png', synth: "Philautia montre que la porte d'entrée est l'amour de soi : remettre le respect de tes limites au centre de la dynamique." },
  { name: 'Mania', desc: "Intensité, débordement, attachement fusionnel ou passionnel à réguler.\nQuestion racine : Qu'est-ce qui cherche à être apaisé plutôt qu'amplifié ?", img: 'https://eludein.art/wp-content/uploads/2026/01/mania.png', synth: "Mania signale que le tirage s'ouvre sur une intensité forte, avec un enjeu de régulation plutôt que d'escalade émotionnelle." },
  { name: 'Storgè', desc: "Attachement calme, racines affectives, continuité et sécurité intérieure.\nQuestion racine : Quelle loyauté ancienne influence ce que je vis ici ?", img: 'https://eludein.art/wp-content/uploads/2026/01/storge.png', synth: "Storgè ouvre sur la question des attachements anciens et des habitudes affectives qui teintent encore la situation présente." },
  { name: 'Pragma', desc: "Amour qui se construit dans la durée, choix concrets et engagement.\nQuestion racine : Quel geste simple soutient ce lien dans le temps ?", img: 'https://eludein.art/wp-content/uploads/2026/01/pragma.png', synth: "Pragma introduit un tirage qui parle de durée, de choix concrets et de ce qui soutient réellement le lien dans le temps." },
  { name: 'Philia', desc: "Lien choisi, confiance, amitié vivante et réciproque.\nQuestion racine : Comment nourrir la qualité de mes alliances plutôt que les supposer acquises ?", img: 'https://eludein.art/wp-content/uploads/2026/01/philia.png', synth: "Philia pose le décor d'un tirage centré sur la qualité des liens d'amitié, des alliances et de la réciprocité." },
  { name: 'Ludus', desc: "Jeu, souplesse, expérimentation qui allège la relation.\nQuestion racine : Où remettre du jeu plutôt que du contrôle ?", img: 'https://eludein.art/wp-content/uploads/2026/01/ludus.png', synth: "Ludus indique que la porte d'entrée est le jeu, la légèreté et l'expérimentation plutôt que le contrôle et la crispation." },
  { name: 'Éros', desc: "Désir, élan vital, mouvement créateur qui cherche à prendre forme.\nQuestion racine : Quel désir demande à être reconnu plutôt qu'étouffé ?", img: 'https://eludein.art/wp-content/uploads/2026/01/eros.png', synth: "Éros met en lumière le désir comme porte d'entrée, montrant que quelque chose cherche à prendre forme plutôt qu'à rester refoulé." },
]

const VEGETAL: Card[] = [
  { name: 'Les Racines', desc: "Origines, fondations, besoins essentiels, ancrage du processus.\nQuestion racine : De quoi cette situation a-t-elle réellement besoin pour tenir debout ?", img: 'https://eludein.art/wp-content/uploads/2026/01/les-racines.png', synth: "Les Racines indiquent que tout se joue dans les fondations : là où sont les besoins essentiels, le sentiment de sécurité et d'ancrage." },
  { name: 'La Tige', desc: "Croissance en cours, orientation, effort de structuration.\nQuestion racine : Quelle direction je soutiens par mes actes ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-tige.png', synth: "La Tige montre une croissance en cours : la question porte sur la direction réelle que prennent les actes, plus que sur les intentions." },
  { name: 'Les Feuilles', desc: "Ouverture, échange, respiration, mise en relation avec l'extérieur.\nQuestion racine : Qu'est-ce que j'absorbe et qu'ai-je besoin de laisser partir ?", img: 'https://eludein.art/wp-content/uploads/2026/01/les-feuilles.png', synth: "Les Feuilles insistent sur les échanges : ce qui est absorbé de l'environnement et ce qui aurait besoin d'être relâché." },
  { name: 'Le Bouton', desc: "Promesse, potentiel prêt à éclore, délicatesse du pas-encore.\nQuestion racine : Qu'ai-je intérêt à protéger avant d'exposer ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-bouton.png', synth: "Le Bouton rappelle que quelque chose est en gestation et demande encore protection avant d'être pleinement exposé." },
  { name: 'La Fleur', desc: "Expression, sens, beauté qui se révèle au monde.\nQuestion racine : Qu'est-ce qui cherche à être nommé ou partagé maintenant ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-fleur.png', synth: "La Fleur montre un moment d'expression : le tirage souligne ce qui veut être montré, nommé et partagé au grand jour." },
  { name: 'Le Fruit', desc: "Résultat provisoire, maturation, conséquences visibles.\nQuestion racine : Qu'est-ce que cette expérience produit réellement aujourd'hui ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-fruit.png', synth: "Le Fruit met l'accent sur les résultats concrets, sur ce qui est déjà récolté, qu'on le reconnaisse ou non." },
  { name: 'Le Pollen', desc: "Transmission, diffusion, circulation du vécu vers d'autres espaces.\nQuestion racine : Qu'est-ce qui doit être partagé plutôt que retenu ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-pollen.png', synth: "Le Pollen insiste sur la circulation : ce qui est appelé à être transmis et non gardé pour soi." },
  { name: 'Le Nectar', desc: "Essence, sens profond, récolte intérieure.\nQuestion racine : Quelle vérité intérieure j'extrais de ce chemin ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-nectar.png', synth: "Le Nectar ramène à l'essence : ce que cette expérience distille comme compréhension intime et singulière." },
  { name: 'La Graine Endormie', desc: "Repos, latence, mémoire d'un futur en gestation.\nQuestion racine : Qu'est-ce qui n'a pas encore l'énergie d'éclore et mérite patience ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-graine-endormie.png', synth: "La Graine Endormie signale un temps de latence : quelque chose existe déjà en potentiel, mais sans énergie pour éclore tout de suite." },
  { name: 'La Germination', desc: "Redémarrage, émergence fragile, premier passage à l'acte.\nQuestion racine : Quel petit mouvement suffit pour lancer le processus ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-germination.png', synth: "La Germination parle du tout premier pas : un mouvement modeste mais décisif, qui enclenche vraiment le cycle." },
]

const ELEMENTS: Card[] = [
  { name: 'Le Feu', desc: "Énergie, intensité, volonté, transformation active.\nQuestion racine : Où canaliser mon feu plutôt que le laisser brûler partout ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-feu.png', synth: "Le Feu colore le tirage d'une intensité forte, invitant à canaliser cette énergie plutôt qu'à la laisser se disperser." },
  { name: "L'Éther", desc: "Lien invisible, cohérence globale, sens du cycle.\nQuestion racine : Quelle perspective plus large change ma façon de voir cette situation ?", img: 'https://eludein.art/wp-content/uploads/2026/01/lether.png', synth: "L'Éther rappelle la cohérence globale : la situation gagne à être regardée dans un cadre plus vaste que le seul enjeu immédiat." },
  { name: "L'Eau", desc: "Émotions, mémoire, sensibilité intérieure.\nQuestion racine : Quelle émotion demande à être ressentie plutôt que contenue ?", img: 'https://eludein.art/wp-content/uploads/2026/01/leau.png', synth: "L'Eau met l'accent sur le climat émotionnel : accueillir ce qui est ressenti devient une clé du mouvement." },
  { name: "L'Air", desc: "Souffle, pensée, communication, clarté mentale.\nQuestion racine : Quelle croyance rigidifie mon expérience ?", img: 'https://eludein.art/wp-content/uploads/2026/01/lair.png', synth: "L'Air souligne l'importance des pensées et de la parole : ce sont les représentations mentales qui ont besoin de bouger." },
  { name: 'La Terre', desc: "Matière, incarnation, stabilité, patience.\nQuestion racine : Comment faire descendre mon idée dans une action concrète ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-terre.png', synth: "La Terre ramène au concret : ce qui compte, ce sont les gestes tangibles, incarnés, plutôt que les intentions abstraites." },
  { name: 'Le Minéral', desc: "Stabilité, sagesse lente, fondations qui soutiennent.\nQuestion racine : Sur quoi puis-je m'appuyer solidement ici ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-mineral.png', synth: "Le Minéral indique une ressource de stabilité profonde, sur laquelle il est possible de s'adosser pour traverser la situation." },
  { name: "L'Argile", desc: "Malléabilité, adaptation, capacité à prendre forme.\nQuestion racine : Où gagnerais-je à me laisser remodeler par l'expérience ?", img: 'https://eludein.art/wp-content/uploads/2026/01/largile.png', synth: "L'Argile suggère de se laisser un peu modeler : la souplesse devient une force plutôt qu'une faiblesse." },
  { name: "L'Humus", desc: "Fertilité du passé, recyclage du vécu.\nQuestion racine : Quelle perte peut devenir ressource aujourd'hui ?", img: 'https://eludein.art/wp-content/uploads/2026/01/lhumus.png', synth: "L'Humus montre que les expériences passées, même douloureuses, peuvent nourrir le présent si elles sont digérées." },
  { name: 'Le Cristal', desc: "Clarté, structure fine, vérité épurée.\nQuestion racine : Quelle part de cette situation demande transparence et précision ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-cristal.png', synth: "Le Cristal appelle à plus de clarté : nommer les choses avec précision permet d'éviter les malentendus." },
  { name: 'La Roche-Mère', desc: "Profondeur, racines ancestrales, base originelle.\nQuestion racine : Quelle histoire ancienne agit ici en silence ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-roche-mere.png', synth: "La Roche-Mère pointe l'influence de couches très anciennes, familiales ou collectives, qui travaillent la situation en arrière-plan." },
  { name: 'La Cendre Fertile', desc: "Fin transformée, matière rendue au cycle.\nQuestion racine : Qu'est-ce qu'il est temps de laisser mourir pour que la vie continue ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-cendre-fertile.png', synth: "La Cendre Fertile parle d'une fin qui devient engrais : quelque chose peut être réellement clos pour nourrir une suite." },
  { name: 'La Source Profonde', desc: "Origine émotionnelle, puits intérieur, vérité sensible.\nQuestion racine : D'où vient vraiment ce mouvement en moi ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-sourse-profonde.png', synth: "La Source Profonde invite à revenir à l'origine émotionnelle : là où tout commence à l'intérieur." },
  { name: 'La Pluie', desc: "Libération, décharge émotionnelle, retour à la fluidité.\nQuestion racine : Qu'ai-je besoin de laisser couler sans résistance ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-pluie.png', synth: "La Pluie parle de décharge et de libération : autoriser un lâcher-prise émotionnel pour retrouver du mouvement." },
  { name: 'La Brume', desc: "Flou, suspension, écoute subtile.\nQuestion racine : Que m'invite-t-on à ressentir plutôt qu'à comprendre immédiatement ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-brume.png', synth: "La Brume reconnaît une zone de flou : l'enjeu n'est pas de tout comprendre, mais de rester à l'écoute fine de ce qui se passe." },
  { name: 'La Vague', desc: "Mouvement puissant, cycle émotionnel en action.\nQuestion racine : Où suis-je porté par une dynamique plus grande que moi ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-vague.png', synth: "La Vague signale une dynamique émotionnelle forte, presque collective, dans laquelle tu es pris autant que tu y participes." },
  { name: "L'Estuaire", desc: "Transition, rencontre des mondes, passage.\nQuestion racine : Qu'est-ce qui cherche à se réconcilier ou se mélanger ici ?", img: 'https://eludein.art/wp-content/uploads/2026/01/lestuaire.png', synth: "L'Estuaire met en jeu une rencontre de mondes : deux réalités, deux espaces, deux histoires qui se rejoignent." },
  { name: "L'Océan", desc: "Immersion, profondeur collective, dissolution des frontières.\nQuestion racine : Où ai-je besoin d'élargir mon identité ?", img: 'https://eludein.art/wp-content/uploads/2026/01/locean.png', synth: "L'Océan emmène vers quelque chose de plus grand que la personne : une appartenance à un champ collectif ou transpersonnel." },
  { name: 'Le Souffle', desc: "Respiration, espace intérieur, présence simple.\nQuestion racine : Qu'ai-je besoin d'alléger pour laisser circuler la vie ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-souffle.png', synth: "Le Souffle invite à simplifier, à alléger : créer de l'espace intérieur pour que la situation respire." },
  { name: 'Le Vent Solaire', desc: "Impulsion lumineuse, énergie mentale expansive.\nQuestion racine : Quelle idée cherche à prendre son plein élan ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-vent-solaire.png', synth: "Le Vent Solaire souligne une idée forte, lumineuse, qui cherche déjà à se déployer." },
  { name: "L'Écho", desc: "Résonance, message renvoyé par l'environnement.\nQuestion racine : Qu'est-ce que la situation me renvoie de moi-même ?", img: 'https://eludein.art/wp-content/uploads/2026/01/lecho.png', synth: "L'Écho insiste sur le feedback : ce qui revient vers toi raconte quelque chose de ta propre posture." },
  { name: "L'Alizé", desc: "Courant porteur, mouvement régulier et soutenant.\nQuestion racine : Quelle dynamique douce soutient déjà mon chemin ?", img: 'https://eludein.art/wp-content/uploads/2026/01/lalize.png', synth: "L'Alizé pointe une aide déjà présente : un courant porteur discret mais constant." },
  { name: 'Le Verbe', desc: "Parole créatrice, nommer pour transformer.\nQuestion racine : Quel mot juste change la relation à ce que je vis ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-verbe.png', synth: "Le Verbe rappelle que la manière de nommer l'expérience transforme la façon de la vivre." },
  { name: 'Le Messager', desc: "Transmission d'information, signal à entendre.\nQuestion racine : Quel message essentiel suis-je invité à recevoir maintenant ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-messager.png', synth: "Le Messager signale qu'un signal important est déjà là, peut-être discret, mais déterminant." },
  { name: 'Les Braises', desc: "Chaleur intérieure, énergie disponible mais contenue.\nQuestion racine : Où mes ressources sont-elles prêtes à se rallumer ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-braise.png', synth: "Les Braises montrent une énergie disponible mais encore contenue : il y a quelque chose à ranimer doucement." },
  { name: 'Le Cœur du Feu', desc: "Centre brûlant, intensité transformatrice consciente.\nQuestion racine : Quelle vérité brûlante demande courage d'être regardée ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-coeur-de-feu.png', synth: "Le Cœur du Feu pose la question d'une vérité brûlante à regarder en face, même si elle bouscule." },
  { name: 'La Flamme', desc: "Élan direct, affirmation, passage à l'action.\nQuestion racine : Quel geste clair doit être posé maintenant ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-flamme.png', synth: "La Flamme appelle à un geste net, une décision assumée qui marque un avant/après." },
  { name: 'La Lumière', desc: "Révélation, mise en clarté, compréhension vive.\nQuestion racine : Que devient visible grâce à cette situation ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-lumiere.png', synth: "La Lumière éclaire un point aveugle : quelque chose devient enfin visible et compréhensible." },
  { name: 'Le Soleil Intérieur', desc: "Puissance intime, rayonnement personnel juste.\nQuestion racine : Où puis-je briller sans écraser ni me cacher ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-soleil-interieur.png', synth: "Le Soleil Intérieur met en jeu ton rayonnement propre, ni écrasant ni effacé, simplement juste." },
  { name: 'Le Volcan', desc: "Force volcanique, rupture nécessaire, vérité qui éclate.\nQuestion racine : Qu'est-ce qui ne peut plus rester retenu ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-volcan.png', synth: "Le Volcan parle d'une rupture ou d'une expression forte qui ne peut plus être contenue." },
  { name: "L'Harmonie des Cycles", desc: "Intégration des phases, cohérence d'ensemble.\nQuestion racine : Quelle boucle suis-je en train de compléter ?", img: 'https://eludein.art/wp-content/uploads/2026/01/lhamonie-des-cycles.png', synth: "L'Harmonie des Cycles souligne que plusieurs phases trouvent leur cohérence, comme un cycle qui se boucle." },
  { name: "L'Invisible", desc: "Ce qui agit hors champ, profondeur subtile.\nQuestion racine : Qu'est-ce qui œuvre en silence derrière les apparences ?", img: 'https://eludein.art/wp-content/uploads/2026/01/linvisible.png', synth: "L'Invisible rappelle qu'une partie du processus se joue hors de portée du regard, dans les coulisses." },
  { name: 'Le Mandala Cosmique', desc: "Ordre vivant, interconnexion, appartenance au tout.\nQuestion racine : Où cette histoire s'inscrit-elle dans un système plus vaste ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-mandala-cosmique.png', synth: "Le Mandala Cosmique situe la situation dans un réseau plus large, où les liens et résonances sont multiples." },
  { name: "L'Unité", desc: "Réconciliation des polarités, retour au centre.\nQuestion racine : Quelle séparation intérieure demande à être réunifiée ?", img: 'https://eludein.art/wp-content/uploads/2026/01/lunite.png', synth: "L'Unité met l'accent sur une réconciliation intérieure : cesser de se vivre en morceaux opposés." },
  { name: 'La Source Lumineuse', desc: "Inspiration intérieure, orientation stable.\nQuestion racine : Quelle lumière guide vraiment mon choix ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-source-lumineuse.png', synth: "La Source Lumineuse renvoie à une boussole intime, plus stable que les fluctuations du mental." },
  { name: 'Le Silence Étoilé', desc: "Repos fécond, vacance consciente, écoute profonde.\nQuestion racine : Quel espace de silence permet à la réponse d'émerger ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-silence-etoile.png', synth: "Le Silence Étoilé invite à suspendre l'agitation : la réponse se prépare dans un espace de calme conscient." },
]

const LIFE: Card[] = [
  { name: "L'Abeille", desc: "Travail partagé, contribution au collectif, service vivant.\nQuestion racine : Quelle part de moi œuvre pour plus grand que moi ?", img: 'https://eludein.art/wp-content/uploads/2026/01/labeille.png', synth: "L'Abeille conclut sur la contribution : ce tirage questionne ta façon de mettre ton énergie au service du collectif." },
  { name: "L'Âme du Monde", desc: "Lien transpersonnel, résonance avec le vivant.\nQuestion racine : Comment ce que je vis dépasse-t-il ma seule histoire ?", img: 'https://eludein.art/wp-content/uploads/2026/01/lame-du-monde.png', synth: "L'Âme du Monde élargit le propos : ce que tu traverses parle aussi du vivant en général, pas seulement de toi." },
  { name: "L'Offrande", desc: "Don conscient, lâcher-prise sur le résultat.\nQuestion racine : Qu'ai-je à offrir sans attente de retour ?", img: 'https://eludein.art/wp-content/uploads/2026/01/loffrande.png', synth: "L'Offrande invite à poser un geste gratuit, sans garantie ni contrôle sur la manière dont il sera reçu." },
  { name: 'La Spirale de la Vie', desc: "Répétition évolutive, franchissement de seuils.\nQuestion racine : Où suis-je en train de revivre autrement une ancienne étape ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-spirale-de-la-vie.png', synth: "La Spirale de la Vie montre un motif qui revient, mais à un autre niveau : c'est une répétition qui permet de passer un seuil." },
  { name: 'La Danse du Monde', desc: "Participation au mouvement global, interaction des forces.\nQuestion racine : Comment bouger avec la situation plutôt que contre elle ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-danse-du-monde.png', synth: "La Danse du Monde insiste sur la manière de se coordonner au mouvement global, plutôt que de lutter contre lui." },
  { name: 'La Mémoire de la Sève', desc: "Héritage vivant, continuité intérieure.\nQuestion racine : Quelle mémoire ancienne soutient ou freine ce moment ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-memoire-de-la-seve_.png', synth: "La Mémoire de la Sève rappelle l'héritage vivant : ce qui s'est transmis jusqu'à toi et que tu peux transformer." },
  { name: 'La Naissance', desc: "Commencement, entrée dans un nouveau plan d'existence.\nQuestion racine : Qu'est-ce qui est réellement en train de naître ici ?", img: 'https://eludein.art/wp-content/uploads/2025/12/la-naissance.png', synth: "La Naissance clôt en pointant le début de quelque chose : un nouveau plan de vie, encore fragile." },
  { name: 'La Transmission', desc: "Passage de relais, savoir vécu qui circule.\nQuestion racine : Qu'ai-je reçu et que suis-je prêt à transmettre ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-transmission.png', synth: "La Transmission met l'accent sur le relais : ce que tu choisis d'achever, de transmettre ou de transformer en enseignement." },
  { name: 'La Conscience Collective', desc: "Dimension partagée, responsabilité relationnelle.\nQuestion racine : De quoi suis-je co-responsable dans ce système ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-conscience-collective.png', synth: "La Conscience Collective montre la part de responsabilité partagée, là où chacun contribue au climat global." },
  { name: 'La Présence', desc: "Ancrage dans l'instant, lucidité incarnée.\nQuestion racine : Que change le fait d'être pleinement ici et maintenant ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-presence.png', synth: "La Présence invite à revenir dans l'instant : c'est ici et maintenant que quelque chose peut réellement changer." },
  { name: 'La Métamorphose', desc: "Transformation profonde de forme et d'identité.\nQuestion racine : Quelle partie de moi ne peut plus rester comme avant ?", img: 'https://eludein.art/wp-content/uploads/2026/01/la-metamorphose.png', synth: "La Métamorphose indique un changement profond d'identité ou de posture : il ne s'agit plus de simple ajustement." },
  { name: 'Le Grand Passage', desc: "Seuil existentiel, clôture d'un cycle majeur.\nQuestion racine : Qu'ai-je besoin d'honorer pour traverser ce passage en conscience ?", img: 'https://eludein.art/wp-content/uploads/2026/01/le-grand-passage.png', synth: "Le Grand Passage vient clore un cycle majeur : la question est de le traverser avec conscience plutôt qu'en mode automatique." },
]

export const ALL_CARDS: Card[] = [
  ...LOVE,
  ...VEGETAL,
  ...ELEMENTS.filter((c) => !LOVE.find((l) => l.name === c.name) && !VEGETAL.find((v) => v.name === c.name)),
  ...LIFE.filter((c) => !LOVE.find((l) => l.name === c.name) && !VEGETAL.find((v) => v.name === c.name) && !ELEMENTS.find((e) => e.name === c.name)),
]

export type LandingCardText = { desc: string; synth: string }

/** Paires [nom canonique, textes] pour la landing publique — aligné sur la locale UI (fr = données TS). */
export function getLandingCardEntries(locale: string | undefined): [string, LandingCardText][] {
  const loc = (locale || 'fr').toLowerCase().split('-')[0]
  if (loc === 'en') {
    return Object.entries((enCards as { cards: Record<string, LandingCardText> }).cards)
  }
  if (loc === 'es') {
    return Object.entries((esCards as { cards: Record<string, LandingCardText> }).cards)
  }
  return ALL_CARDS.map((c) => [c.name, { desc: c.desc ?? '', synth: c.synth ?? '' }])
}

/** URL illustration (même jeu que TarotPage) — clé = nom canonique FR dans les JSON. */
export function getCardImageByName(name: string): string | undefined {
  return ALL_CARDS.find((c) => c.name === name)?.img
}

export const FOUR_DOORS = [
  { key: 'love', group: LOVE, title: "Cycle de la Fleur d'amour", subtitle: 'La Porte du Cœur', aspect: "L'Essence", color: 'text-rose-600', border: 'border-rose-300 dark:border-rose-800', glowColor: '#f43f5e', shadowColor: 'rgba(244,63,94,0.2)', bgFrom: 'rgba(254,226,226,1)', bgTo: 'rgba(253,242,248,1)' },
  { key: 'vegetal', group: VEGETAL, title: 'Cycle du végétal', subtitle: 'La Porte du Temps', aspect: 'Le Processus', color: 'text-emerald-600', border: 'border-emerald-300 dark:border-emerald-800', glowColor: '#10b981', shadowColor: 'rgba(16,185,129,0.2)', bgFrom: 'rgba(209,250,229,1)', bgTo: 'rgba(236,253,245,1)' },
  { key: 'elements', group: ELEMENTS, title: 'Cycle des éléments', subtitle: 'La Porte du Climat', aspect: "L'Environnement", color: 'text-sky-600', border: 'border-sky-300 dark:border-sky-800', glowColor: '#0ea5e9', shadowColor: 'rgba(14,165,233,0.2)', bgFrom: 'rgba(224,242,254,1)', bgTo: 'rgba(240,249,255,1)' },
  { key: 'life', group: LIFE, title: "Cycle de la vie", subtitle: "La Porte de l'Histoire", aspect: "L'Expérience", color: 'text-violet-600', border: 'border-violet-300 dark:border-violet-800', glowColor: '#8b5cf6', shadowColor: 'rgba(139,92,246,0.2)', bgFrom: 'rgba(237,233,254,1)', bgTo: 'rgba(245,243,255,1)' },
]
