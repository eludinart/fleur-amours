# Fiche Coach (a remplir)

Cette fiche sert de **source unique** pour afficher les infos coach partout dans l'app:
- header du chat utilisateur,
- selection du coach,
- pages d'accompagnement,
- espaces coach/admin utiles a l'utilisateur.

## 1) Fichier a remplir

Utiliser: `config/coach-profile.template.json`

Dupliquer ce fichier en une version finale (ex: `config/coach-profile.json`) puis remplir les champs.

## 2) Regles de redaction

- **Clarte**: phrases courtes, vocabulaire simple.
- **Confiance**: expliquer posture et cadre (confidentialite, limites).
- **Utilite**: indiquer precisement sur quoi le coach aide.
- **Honnetete**: preciser ce qui n'est pas couvert (urgence, medical, juridique, etc.).

## 3) Champs importants pour l'utilisateur

- `identity.display_name`: nom affiche partout.
- `identity.headline`: promesse courte visible immediatement.
- `identity.short_bio`: 1-2 phrases de presentation.
- `expertise.specialties`: tags lisibles.
- `support.response_time.label`: attente realiste de reponse.
- `trust.confidentiality_note`: rassurer l'utilisateur.

## 4) Checklist validation

- [ ] Le coach a valide le texte final.
- [ ] Le ton est coherent avec la marque.
- [ ] Les limites d'accompagnement sont explicites.
- [ ] Les delais et disponibilites sont realistes.
- [ ] Le fichier respecte le schema: `config/coach-profile.schema.json`.

## 5) Exemple de bloc "qui est ce coach ?"

> Coach Eludein accompagne les dynamiques relationnelles, la communication et les phases de transition.
> Son approche est concrete, progressive et sans jugement.
> Reponse sous 24h en moyenne, dans un cadre confidentiel.
