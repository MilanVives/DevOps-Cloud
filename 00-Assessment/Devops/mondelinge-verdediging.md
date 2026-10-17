# Mondelinge Verdediging — Devops & Cloud Computing

> ⚠️ **Doelgroep:** deze evaluatievorm geldt enkel voor studenten **Devops & Cloud Computing** (softwareontwikkeling). Studenten **Cloud Infrastructure** (Cybersecurity & Infrastructure) volgen een eigen verdediging, zie [Mondelinge Verdediging — Cloud Infrastructure](../CloudInfrastructure/mondelinge-verdediging.md).

---

## Waarom een mondelinge verdediging?

Met AI-tools (ChatGPT, Copilot, Claude, …) is het vandaag erg eenvoudig om een volledig werkend project te laten genereren zonder de onderliggende concepten te begrijpen. Een perfect ogende `docker-compose.yml` of een correct draaiende deployment zegt niets over of de student weet **wat** hij/zij heeft opgeleverd en **waarom** het zo werkt.

Daarom wordt **niet elke PE afzonderlijk mondeling verdedigd** — enkel het volledige eindproject (zie ECTS-fiche, 80% van het eindcijfer: cloud deployment, documentatie en **mondelinge verdediging**, zie [Final Assessment](3-Final-Assessment.md)) wordt aan het einde van het semester, tijdens de examenperiode, één keer individueel mondeling verdedigd. PE1 en PE1 worden dus niet apart verdedigd. Een technisch perfect eindproject dat de student niet kan uitleggen, of waarbij de student de meest basale commando's niet kent, **kan niet slagen** — ongeacht de kwaliteit van de code.

---

## Format

|             |                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| **Wie**     | Individueel — elke student wordt apart ondervraagd (dit vak wordt individueel uitgevoerd)                           |
| **Duur**    | 10 à maximum 15 minuten per student                                                                                 |
| **Wanneer** | Tijdens de examenperiode, na afloop van het volledige eindproject (PE1-2 + eindopdracht)                            |
| **Waar**    | Standaard op de campus. Uitzonderingen (bv. online) enkel na motivatie per mail aan de docent                       |
| **Vereist** | Laptop met werkend project (lokaal en/of live deployment bereikbaar), terminal-toegang. Live demo's zijn aangeraden |

---

## Structuur van de verdediging (± 10-15 min)

0. **Clustercontrole** (± 1 min)
   Student toont live `kubectl get nodes -o wide` en `kubectl get pods -o wide -A` op de cloudcluster. Draait alles op één machine (zie het **uitsluitingscriterium** in de [Final Assessment](3-Final-Assessment.md)), dan stopt de verdediging hier.

1. **Live command demo** (± 4-5 min)
   Student voert live een opdracht uit of past iets aan op zijn/haar project (bv. "voeg een volume/ConfigMap toe", "toon de logs van de backend", "schaal deze service", "trigger een herdeployment via de CI/CD pipeline").

2. **Uitleg ontwerpkeuzes** (± 4-5 min)
   Waarom deze netwerkconfiguratie? Waarom deze environment variables/secrets? Waarom deze cloud-architectuur (aantal nodes, provider)? Waarom deze base images?

3. **Basisbegrippen** (± 3-4 min)
   Korte conceptvragen over Docker, Compose, Kubernetes/Minikube, Helm, CI/CD en monitoring — afhankelijk van wat de student effectief gebruikt heeft.

4. **Troubleshooting van een ingebouwde fout** (± 4-5 min)
   De lesgever verandert live iets in de configuratie (bv. hernoemt een environment variable, stopt een service/pod, wijzigt een poort of Helm-value) en vraagt de student om het probleem te diagnosticeren en op te lossen.

---

## Scoring — gating-multiplier

> [!WARNING]
> De mondelinge verdediging levert **geen aparte punten** op, maar werkt als een **vermenigvuldigingsfactor** op de score van de [Final Assessment](3-Final-Assessment.md) (de 80% "project" component uit de ECTS-fiche): `Eindscore = Score rubriek × Factor verdediging`. PE1 en PE1 (de 20% permanente evaluatie) worden **niet** door deze factor beïnvloed — die scores staan al vast vóór de verdediging plaatsvindt. Een student met een perfect eindproject maar zonder begrip kan dus **nooit meer dan 30%** van de eindopdracht-punten behalen.

| Niveau                | Factor | Kenmerken                                                                                                                                                                                                                                                |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sterk begrip**      | 100%   | Vlotte, correcte antwoorden. Kent de gebruikte commando's uit het hoofd en kan variaties live uitvoeren. Kan ontwerpkeuzes onderbouwen met concrete argumenten (niet enkel "omdat de tutorial dat zei"). Lost de ingebouwde fout zelfstandig en vlot op. |
| **Behoorlijk begrip** | 85%    | Kan de meeste vragen correct beantwoorden, af en toe aarzeling of nood aan een hint. Kent de belangrijkste commando's, kleine onzekerheid bij details. Lost de fout op met één beperkte hint.                                                            |
| **Zwak begrip**       | 60%    | Kan enkel oppervlakkig uitleggen wat het project doet. Basiscommando's moeten voorgezegd of herhaaldelijk gehint worden. Kan de ingebouwde fout niet zelfstandig oplossen, ook niet met hints.                                                           |
| **Geen begrip**       | 30%    | Kan niet uitleggen wat de eigen configuratie doet. Kent de basiscommando's niet (bv. weet niet hoe `docker compose up`, `logs` of `exec` werken). Duidelijke aanwijzingen dat het project niet zelf begrepen/geschreven is.                              |

**Berekening:** `Eindscore project = Score beoordelingscriteria × Factor mondelinge verdediging`

---

## Voorbeeldvragenbank

Onderstaande vragen zijn generieke voorbeeldvragen en niet limitatief.

**Live command demo**

- Toon me de logs van de backend service.
- Voeg een volume toe aan de database service en herstart.
- Schaal de frontend naar 2 replica's — wat gebeurt er met de poorten?
- Stop enkel de database container zonder de rest te stoppen.
- Ga een draaiende container binnen (`exec`) en toon de environment variables.

**Ontwerpkeuzes**

- Waarom staat deze service niet rechtstreeks open naar buiten?
- Waarom gebruik je deze specifieke environment variables tussen backend en database?
- Wat zou er gebeuren als je het netwerk uit je compose-bestand verwijdert?
- Waarom deze naamgevingsconventie voor je Docker Hub images?

**Basisbegrippen**

- Wat is het verschil tussen een Docker image en een container?
- Wat doet `depends_on` in Compose — en wat doet het _niet_ (bv. wacht het op een "ready" service)?
- Wat is het verschil tussen een named volume en een bind mount?
- Waarom heb je een `.dockerignore` nodig?
- Wat is het verschil tussen een Kubernetes Deployment en een Service?
- Wat doet een Helm chart dat losse manifests niet doen?
- Wat controleert je CI/CD pipeline, en wat gebeurt er bij een falende build?
- Waarom gebruik je een Cloudflare tunnel in plaats van de poort rechtstreeks open te zetten?

**Troubleshooting (Docent breekt iets)**

- (Docent hernoemt een env var) "Je backend kan niet meer verbinden met de database — zoek uit waarom."
- (Docent stopt een service/pod) "De frontend geeft een fout — diagnosticeer het probleem."
- (Docent wijzigt een poort-mapping) "Je kan de applicatie niet meer bereiken in de browser — los het op."
- (Docent wijzigt een Helm-value of secret) "Je productie-omgeving werkt niet meer — zoek uit waarom en herstel het."
- (Docent stopt de monitoring-stack) "Je Grafana-dashboard toont geen data meer — waar zou je beginnen zoeken?"

---
