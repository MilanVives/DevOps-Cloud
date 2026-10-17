# Mondelinge Verdediging — Cloud Infrastructure

> ⚠️ **Doelgroep:** deze verdediging geldt voor studenten **Cloud Infrastructure** (Cybersecurity & Infrastructure). Studenten **Devops & Cloud Computing** volgen [hun eigen verdediging](../Devops/mondelinge-verdediging.md).

---

## Waarom een mondelinge verdediging?

Met AI-tools (ChatGPT, Copilot, Claude, …) is het vandaag erg eenvoudig om Terraform-code, playbooks of Helm charts te laten genereren zonder de onderliggende concepten te begrijpen. Een correct draaiende cluster zegt niets over of de student weet **wat** hij/zij heeft opgezet en **waarom** het zo werkt.

Daarom wordt het volledige eindproject (zie [Final Assessment](2-Final-Assessment-CloudInfra.md)) aan het einde van het semester, tijdens de examenperiode, één keer individueel mondeling verdedigd. PE1 wordt niet apart verdedigd. Een technisch perfect eindproject dat de student niet kan uitleggen, of waarbij de student de meest basale commando's niet kent, **kan niet slagen**.

---

## Format

|             |                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| **Wie**     | Individueel — elke student wordt apart ondervraagd                                                                  |
| **Duur**    | 15 à 20 minuten per student                                                                                         |
| **Wanneer** | Tijdens de examenperiode, na afloop van het volledige eindproject                                                   |
| **Waar**    | Standaard op de campus. Uitzonderingen (bv. online) enkel na motivatie per mail aan de docent                       |
| **Vereist** | Laptop met toegang tot je cluster (`kubectl`), je Terraform- en Ansible-omgeving en je monitoring. Live demo's zijn aangeraden |

---

## Structuur van de verdediging (± 15-20 min)

0. **Clustercontrole** (± 1 min)
   Student toont live `kubectl get nodes -o wide` en `kubectl get pods -o wide -A` op de cloudcluster. Draait alles op één machine (zie het **uitsluitingscriterium** in de [Final Assessment](2-Final-Assessment-CloudInfra.md)), dan stopt de verdediging hier.

1. **Live demo** (± 5 min)
   Student voert live een opdracht uit op zijn/haar infrastructuur (bv. "schaal de nodepool via Terraform", "voer je playbook opnieuw uit — wat verandert er?", "deploy een nieuwe versie naar test", "toon je monitoringdashboard en een alert").

2. **Uitleg ontwerpkeuzes en onderzoek** (± 5 min)
   Waarom deze provider en node-sizing? Welke extra features heb je gekozen en waarom (niet)? Waarom deze monitoringtool? Hoe is je netwerk afgeschermd?

3. **Basisbegrippen** (± 3-4 min)
   Korte conceptvragen over Terraform, Ansible, Kubernetes, Helm, ingress/HTTPS, secrets en monitoring — afhankelijk van wat de student effectief gebruikt heeft.

4. **Troubleshooting van een ingebouwde fout** (± 4-5 min)
   De lesgever verandert live iets (bv. wijzigt een Helm-value of Secret, stopt een pod, past een firewallregel aan) en vraagt de student om het probleem te diagnosticeren en op te lossen.

---

## Scoring — gating-multiplier

> [!WARNING]
> De mondelinge verdediging levert **geen aparte punten** op, maar werkt als een **vermenigvuldigingsfactor** op de score van de [Final Assessment](2-Final-Assessment-CloudInfra.md) (de 80% "project" component): `Eindscore = Score rubriek × Factor verdediging`. PE1 (de 20% permanente evaluatie) worden **niet** door deze factor beïnvloed. Een student met een perfect eindproject maar zonder begrip kan dus **nooit meer dan 30%** van de eindopdracht-punten behalen.

| Niveau                | Factor | Kenmerken                                                                                                                                                                                                                                                |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sterk begrip**      | 100%   | Vlotte, correcte antwoorden. Kent de gebruikte commando's uit het hoofd en kan variaties live uitvoeren. Kan ontwerpkeuzes onderbouwen met concrete argumenten (niet enkel "omdat de tutorial dat zei"). Lost de ingebouwde fout zelfstandig en vlot op. |
| **Behoorlijk begrip** | 85%    | Kan de meeste vragen correct beantwoorden, af en toe aarzeling of nood aan een hint. Kent de belangrijkste commando's, kleine onzekerheid bij details. Lost de fout op met één beperkte hint.                                                            |
| **Zwak begrip**       | 60%    | Kan enkel oppervlakkig uitleggen wat het project doet. Basiscommando's moeten voorgezegd of herhaaldelijk gehint worden. Kan de ingebouwde fout niet zelfstandig oplossen, ook niet met hints.                                                           |
| **Geen begrip**       | 30%    | Kan niet uitleggen wat de eigen configuratie doet. Kent de basiscommando's niet (bv. `tofu plan`, `ansible-playbook`, `kubectl logs`/`describe`). Duidelijke aanwijzingen dat het project niet zelf begrepen/geschreven is.                             |

**Berekening:** `Eindscore project = Score beoordelingscriteria × Factor mondelinge verdediging`

---

## Voorbeeldvragenbank

Onderstaande vragen zijn generieke voorbeeldvragen en niet limitatief.

**Live demo**

- Voeg via Terraform een extra worker node toe. Wat toont `tofu plan` vóór je `apply` doet?
- Voer je Ansible-playbook twee keer uit. Waarom is de tweede run `changed=0`?
- Schaal de backend in productie naar 4 replicas via Helm. Op welke nodes landen ze?
- Toon de logs van een pod die niet start en leg uit wat er mis is.
- Toon in je monitoring wat er gebeurt als ik deze node stop.

**Ontwerpkeuzes en onderzoek**

- Waarom deze cloudprovider en deze node-grootte? Wat kost je opstelling per maand?
- Waar staat je Terraform-state, en waarom hoort die niet in Git?
- Waarom monitor je van buiten de cluster?
- Waarom heb je voor (of tegen) Vault / WireGuard / Cloudflare gekozen?
- Hoe zijn je nodes afgeschermd van het internet? Welke poorten staan open, en waarom?

**Basisbegrippen**

- Wat is het verschil tussen declaratief (Terraform) en procedureel/configuratiebeheer (Ansible)?
- Wat doet `tofu destroy` precies, en hoe weet Terraform wat er bestaat?
- Wat betekent idempotent, en waarom is dat belangrijk voor een playbook?
- Hoe veilig is een Kubernetes Secret (base64)? Wat doet Vault beter?
- Wat is het verschil tussen een Deployment, een Service en een Ingress?
- Wat doet een HPA, en wat heeft hij nodig om te werken?
- Wat doet `topologySpreadConstraints`?
- Wat doet een Helm chart dat losse manifests niet doen?

**Troubleshooting (Docent breekt iets)**

- (Docent wijzigt een Secret) "Je backend kan niet meer verbinden met de database — zoek uit waarom."
- (Docent verwijdert een pod/schaalt naar 0) "Je applicatie geeft een fout — diagnosticeer het probleem."
- (Docent wijzigt een Helm-value) "Je testomgeving werkt niet meer — zoek uit waarom en herstel het."
- (Docent past een firewallregel aan) "Je monitoring ziet een node niet meer — waar begin je te zoeken?"
- (Docent cordont een node) "Nieuwe pods landen niet meer op deze node — waarom?"
