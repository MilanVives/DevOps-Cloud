# 5 - Infrastructure as Code (IAC): Ansible en Terraform/OpenTofu

## Inleiding: Van handmatig naar automatisch infrastructuur beheer

**Het probleem van handmatige infrastructuur:**
Stel je voor: je moet 50 servers configureren, elk met dezelfde software, gebruikers, en instellingen. Handmatig zou dit dagen kosten, foutgevoelig zijn, en niet reproduceerbaar. Infrastructure as Code (IAC) lost dit op.

**Wat je zult leren:**
- Waarom Infrastructure as Code de toekomst is van IT-beheer
- Ansible: Configuratie management en automatisering
- Terraform/OpenTofu: Infrastructure provisioning en beheer
- Praktische hands-on ervaring met beide tools
- Best practices voor IAC in productie omgevingen

> **📖 Hoe lees je dit hoofdstuk?**
> De gewone secties bevatten de **basis** die je nodig hebt voor de les en de labo's.
> Secties met **🔍 Deep Dive** in de titel zijn **verdieping**: interessant als je verder wilt gaan, maar je hebt ze niet nodig om mee te kunnen. Sla ze gerust over bij een eerste lezing.

---

## Wat is Infrastructure as Code?

### Definitie
Infrastructure as Code (IAC) is het proces van het beheren en inrichten van computerhardware via machine-leesbare definitiebestanden, in plaats van fysieke hardwareconfiguratie of interactieve configuratietools.

### Voordelen van IAC
1. **Versiecontrole**: Infrastructuur wordt getrackt zoals code
2. **Reproduceerbaar**: Identieke omgevingen maken
3. **Schaalbaarheid**: Duizenden servers even gemakkelijk als één
4. **Documentatie**: De code ÍS de documentatie
5. **Testing**: Infrastructuur kan getest worden
6. **Samenwerking**: Teams kunnen samen aan infrastructuur werken

### IAC Tools categorieën

Er bestaan vijf grote categorieën van IaC tools:

| # | Categorie | Voorbeeld | Wat doet het? |
|---|-----------|-----------|---------------|
| 1 | **Ad hoc scripts** | Bash/shell script | Een reeks commando's automatisch na elkaar uitvoeren |
| 2 | **Configuration management** | Ansible, Puppet, Chef | Bestaande servers configureren (software, users, instellingen) |
| 3 | **Server templating** | Packer, VM images van de cloud provider | Een "kant-en-klare" image maken waarvan je servers start |
| 4 | **Orchestration** | Kubernetes | Containers verdelen en beheren over meerdere machines |
| 5 | **Provisioning** | Terraform, OpenTofu, CloudFormation | Nieuwe infrastructuur aanmaken (VMs, netwerken, databases) |

In dit hoofdstuk focussen we op de twee belangrijkste:

#### 1. **Configuration Management** (Ansible, Chef, Puppet)
- Configureert bestaande servers
- Installeert software, wijzigt instellingen
- Zorgt voor consistency tussen servers

#### 2. **Infrastructure Provisioning** (Terraform, OpenTofu, CloudFormation)
- Maakt nieuwe infrastructuur aan
- Beheert cloud resources (VMs, netwerken, databases)
- Lifecycle management van infrastructuur

**Declaratief vs imperatief** (komt later uitgebreid terug):
- **Declaratief** = je beschrijft de *gewenste eindtoestand*, de tool zorgt dat die bereikt wordt (Terraform)
- **Imperatief** = je beschrijft het *stappenplan* dat uitgevoerd moet worden (Ansible playbook, shell script)

---

## Deel 1: Ansible - Configuration Management

### Wat is Ansible?

Ansible is een open-source automatiseringstool voor:
- **Configuration management**: Servers configureren
- **Application deployment**: Software uitrollen
- **Task automation**: Repetitieve taken automatiseren
- **Orchestration**: Complexe workflows beheren

### Ansible Architectuur

```
Control Node (je laptop/server)
├── Ansible Installation
├── Playbooks (YAML files)
├── Inventory (hosts file)
└── SSH Verbindingen
    ├── → Managed Node 1
    ├── → Managed Node 2
    └── → Managed Node 3
```

**Belangrijke kenmerken:**
- **Agentless**: Geen software nodig op doelservers
- **Idempotent**: Meerdere keren uitvoeren geeft zelfde resultaat
- **SSH-based**: Gebruikt bestaande SSH verbindingen
- **YAML syntax**: Gemakkelijk leesbaar en schrijfbaar

**Begrippen die je moet kennen:**

| Begrip | Betekenis |
|--------|-----------|
| **Control node** | De machine waarop Ansible geïnstalleerd is en van waaruit je alles start (je laptop, een VM, WSL) |
| **Managed node** | Een server die door Ansible beheerd wordt. Daar moet enkel **SSH** en **Python** op staan |
| **Inventory** | Het bestand met de lijst van managed nodes (de "hosts") |
| **Module** | Een klein stukje code met één beperkte taak (bv. `apt`, `copy`, `user`). Ansible kopieert het naar de server, voert het uit en verwijdert het daarna weer |
| **Task** | Eén stap die één module aanroept |
| **Play** | Een groep tasks met een specifiek doel, uitgevoerd op bepaalde hosts |
| **Playbook** | Een YAML bestand met één of meerdere plays: **Playbook > Plays > Tasks** |

> **💡 Windows gebruikers:** Ansible draait **niet** rechtstreeks op Windows als control node. Gebruik **WSL** (Windows Subsystem for Linux) of een Linux VM en installeer Ansible daarin.

### Ansible Installatie

Je installeert Ansible **enkel op de control node**, niet op de servers die je beheert (agentless!).

```bash
# Ubuntu/Debian (ook in WSL)
sudo apt update
sudo apt install ansible

# macOS
brew install ansible

# Verificatie
ansible --version
```

De output van `ansible --version` toont ook welk configuratiebestand Ansible gebruikt:

```text
ansible [core 2.16.3]
  config file = None          ← er wordt (nog) geen ansible.cfg gebruikt
  ...
```

Die regel `config file = ...` is later handig om te controleren of jouw `ansible.cfg` wel gevonden wordt.

### Ansible Componenten

#### 1. Inventory File (hosts)
Het inventory bestand definieert welke servers Ansible moet beheren.

##### 📍 Waar staat het inventory bestand?

**De locatie is belangrijk!** Ansible zoekt niet zomaar overal naar een bestand met de naam `hosts`. Er zijn drie manieren om Ansible te vertellen waar je inventory staat:

| Manier | Locatie | Hoe gebruik je het? |
|--------|---------|---------------------|
| **1. Standaard locatie** | `/etc/ansible/hosts` | Niets extra nodig: `ansible all -m ping` |
| **2. Met de `-i` optie** | Eender waar, bv. `./hosts` in je projectmap | Altijd `-i` meegeven: `ansible all -i hosts -m ping` |
| **3. Via `ansible.cfg`** | Eender waar, ingesteld met `inventory = hosts` | Niets extra nodig: `ansible all -m ping` |

**Manier 1 - De standaard locatie `/etc/ansible/hosts`** (zoals in de slides)

Als je niets opgeeft, kijkt Ansible **altijd** in `/etc/ansible/hosts`. Dit bestand is systeembreed, dus je hebt `sudo` nodig om het aan te passen:

```bash
# Map aanmaken als ze nog niet bestaat (bv. na installatie via brew)
sudo mkdir -p /etc/ansible

# Inventory bewerken
sudo nano /etc/ansible/hosts

# Controleren welke hosts Ansible ziet
ansible all --list-hosts
```

**Manier 2 - Een eigen bestand met `-i`** (zoals in de bestanden van deze cursus)

Je kan het inventory bestand ook gewoon in je projectmap zetten, naast je playbooks. Dan moet je bij **elk** commando met `-i` zeggen waar het staat:

```bash
cd 05-IaC/iac-files/ansible
ansible all -i hosts --list-hosts
ansible-playbook -i hosts playbook-createfile.yml
```

> **⚠️ Veelgemaakte fout:** Een bestand `hosts` in je huidige map wordt **niet** automatisch gebruikt! Vergeet je `-i hosts`, dan kijkt Ansible gewoon naar `/etc/ansible/hosts`. Is dat bestand leeg of bestaat het niet, dan krijg je:
> ```text
> [WARNING]: Unable to parse /etc/ansible/hosts as an inventory source
> [WARNING]: No inventory was parsed, only implicit localhost is available
> [WARNING]: provided hosts list is empty, only localhost is available. Note that
> the implicit localhost does not match 'all'
> ```
> Zie je deze melding? Controleer dan waar je inventory staat en of je `-i` vergeten bent.

**Manier 3 - Instellen in `ansible.cfg`**

Wil je `-i hosts` niet telkens typen? Zet dan een `ansible.cfg` in je projectmap met:

```ini
[defaults]
inventory = hosts
```

Nu gebruikt Ansible automatisch de `hosts` file uit die map, **zolang je de commando's vanuit die map uitvoert**. Meer over `ansible.cfg` in de volgende sectie.

**Welke kies je?**
- Eén machine, voor jezelf, snel testen → `/etc/ansible/hosts` is prima
- Project dat je in Git bijhoudt en deelt → inventory in de projectmap + `ansible.cfg` (of `-i`)

Controleer altijd wat Ansible ziet met:

```bash
ansible all --list-hosts        # lijst van alle hosts
ansible-inventory --graph       # hosts per groep, als boomstructuur
```

##### Inhoud van het inventory bestand

```ini
# 05-IaC/iac-files/ansible/hosts
[mycloudvms]
141.144.203.33
projectwerk.vives.be
linux.vives.live

[mycloudvms:vars]
ansible_user=root
ansible_password=P@ssword123

[ubuntu-servers]
141.148.235.108

[ubuntu-servers:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/id_rsa
```

**Inventory groepen:**
- `[mycloudvms]`: Groep van cloud VMs
- `[ubuntu-servers]`: Groep Ubuntu servers
- `:vars`: Variabelen voor de groep
- `all`: Speciale groep die **automatisch** alle hosts bevat

##### 🎯 Alleen bepaalde hosts aanspreken (via de groepen)

De namen tussen `[ ]` zijn **labels**: je gebruikt ze in je commando om te kiezen op **welke** servers iets moet gebeuren. Je hoeft dus niet altijd alles aan te spreken.

Met het `hosts` bestand hierboven:

| Commando | Welke hosts? |
|----------|--------------|
| `ansible all -i hosts -m ping` | Alle 4 de hosts |
| `ansible mycloudvms -i hosts -m ping` | Enkel de 3 hosts uit `[mycloudvms]` |
| `ansible ubuntu-servers -i hosts -m ping` | Enkel `141.148.235.108` |
| `ansible linux.vives.live -i hosts -m ping` | Eén enkele host (die wel in de inventory moet staan) |
| `ansible 'mycloudvms:ubuntu-servers' -i hosts -m ping` | Beide groepen samen (`:` = "en ook") |
| `ansible 'all:!mycloudvms' -i hosts -m ping` | Alles **behalve** `mycloudvms` (`!` = "niet") |

> **💡 Eerst controleren, dan uitvoeren:** vervang `-m ping` door `--list-hosts` om te zien welke hosts een commando zou raken, zonder iets uit te voeren:
> ```bash
> ansible mycloudvms -i hosts --list-hosts
>   hosts (3):
>     141.144.203.33
>     projectwerk.vives.be
>     linux.vives.live
> ```

Hetzelfde werkt in een **playbook**: `hosts: mycloudvms` voert het playbook enkel uit op die groep. Wil je een playbook dat op `all` staat toch maar op één groep uitvoeren, gebruik dan `--limit`:

```bash
ansible-playbook -i hosts playbook.yaml --limit ubuntu-servers
```

> **⚠️ Typfout in de groepsnaam?** Dan geeft Ansible geen fout, maar enkel een waarschuwing en gebeurt er niets:
> ```text
> [WARNING]: Could not match supplied host pattern, ignoring: mycloudvm
> [WARNING]: No hosts matched, nothing to do
> ```

> **💡 Waarschuwing over "Invalid characters"?** Bij het voorbeeldbestand zie je:
> `[WARNING]: Invalid characters were found in group names but not replaced`.
> Dat komt door het streepje in `ubuntu-servers`. Het werkt wel, maar Ansible raadt aan om in groepsnamen enkel letters, cijfers en **underscores** te gebruiken: `ubuntu_servers`.

> **⚠️ Wachtwoorden in de inventory zijn géén best practice!** Het voorbeeld met `ansible_password` dient enkel als demo. Beter: werk met **SSH keys** en **niet** met de root gebruiker (zie het stappenplan hieronder).
> Wil je toch met wachtwoorden werken, dan moet het programma `sshpass` op je control node staan (`sudo apt install sshpass`), anders faalt de verbinding.

#### 2. Ansible Configuration (ansible.cfg)

> **🗂️ Kaart: `ansible.cfg` in 5 vragen**
>
> **1. Wat is het?**
> Een tekstbestand met **standaardinstellingen** voor Ansible. Alles wat je anders bij elk commando zou typen (welke inventory, welke gebruiker, welke SSH key, ...) zet je er één keer in.
>
> | Zonder `ansible.cfg` | Met `ansible.cfg` |
> |----------------------|-------------------|
> | `ansible all -i hosts -u ubuntu --private-key ~/.ssh/id_ed25519 -m ping` | `ansible all -m ping` |
>
> **2. Is het verplicht?**
> **Nee.** Ansible werkt perfect zonder: dan gebruikt het zijn ingebouwde standaardwaarden (bv. inventory = `/etc/ansible/hosts`). Je ziet dat aan `config file = None` in de output van `ansible --version`.
>
> **3. Moet ik het zelf aanmaken?**
> **Ja.** Na de installatie bestaat er meestal **geen** `ansible.cfg`. Je maakt het zelf aan, als gewoon tekstbestand:
> ```bash
> cd ~/ansible-project       # je projectmap
> nano ansible.cfg           # bestand aanmaken en instellingen toevoegen
> ansible --version          # controle: config file = /home/.../ansible-project/ansible.cfg
> ```
> Wil je een voorbeeld met **alle** mogelijke instellingen (allemaal uitgeschakeld, met uitleg erbij)?
> ```bash
> ansible-config init --disabled > ansible.cfg
> ```
> Dat zijn er wel een paar honderd, dus voor beginners is een klein bestand met enkel wat je nodig hebt duidelijker.
>
> **4. Waar moet het staan?**
> Ansible zoekt op 4 plaatsen, **in deze volgorde**, en gebruikt het **eerste** bestand dat het vindt. De andere worden volledig genegeerd (ze worden **niet** samengevoegd!):
>
> | Volgorde | Locatie | Wanneer gebruiken? |
> |----------|---------|--------------------|
> | 1 | Pad in de variabele `ANSIBLE_CONFIG` | Zelden, enkel als je dat expliciet wilt |
> | 2 | `./ansible.cfg` in de **huidige map** | ✅ **Aanbevolen**: één per project, naast je `hosts` en playbooks |
> | 3 | `~/.ansible.cfg` in je **home map** (let op het puntje!) | Persoonlijke instellingen voor al je projecten |
> | 4 | `/etc/ansible/ansible.cfg` | Systeembreed, voor alle gebruikers (`sudo` nodig) |
>
> ⚠️ "Huidige map" betekent: de map waar je **staat** als je het commando typt. Sta je in een andere map, dan wordt je project-`ansible.cfg` niet gevonden.
>
> **5. Wat kan je er allemaal in zetten?**
> Het bestand is opgedeeld in **secties** tussen `[ ]`. Dit zijn de nuttigste instellingen:
>
> | Sectie | Instelling | Wat doet het? | Vervangt optie |
> |--------|------------|---------------|----------------|
> | `[defaults]` | `inventory = hosts` | Welk inventory bestand gebruikt wordt | `-i hosts` |
> | `[defaults]` | `remote_user = ubuntu` | Met welke gebruiker Ansible inlogt via SSH | `-u ubuntu` |
> | `[defaults]` | `private_key_file = ~/.ssh/id_ed25519` | Welke SSH key gebruikt wordt | `--private-key` |
> | `[defaults]` | `host_key_checking = False` | Niet vragen om de SSH fingerprint te bevestigen bij een nieuwe server (handig in een labo, minder veilig) | |
> | `[defaults]` | `forks = 10` | Op hoeveel servers tegelijk Ansible werkt (standaard 5) | `-f 10` |
> | `[defaults]` | `timeout = 30` | Hoeveel seconden wachten op een SSH verbinding | `-T 30` |
> | `[defaults]` | `interpreter_python = auto_silent` | Zelf Python zoeken op de server, zonder waarschuwing daarover | |
> | `[defaults]` | `log_path = ./ansible.log` | Alle output ook naar een logbestand schrijven | |
> | `[defaults]` | `roles_path = ./roles` | Waar Ansible je roles zoekt | |
> | `[privilege_escalation]` | `become = True` | Taken standaard met `sudo` uitvoeren | `--become` / `-b` |
> | `[privilege_escalation]` | `become_ask_pass = True` | Vragen naar je sudo wachtwoord | `-K` |
>
> **Wat hoort er NIET in?** Je lijst met servers (die staat in de **inventory**), je taken (die staan in een **playbook**) en wachtwoorden.

##### Voorbeeld: een typisch ansible.cfg voor een project

```ini
[defaults]
# gebruik de hosts file uit deze map (geen -i meer nodig)
inventory = hosts
# standaard SSH gebruiker
remote_user = ubuntu
# welke SSH key gebruikt wordt
private_key_file = ~/.ssh/id_ed25519
# niet vragen om SSH fingerprints te bevestigen (enkel voor labo's)
host_key_checking = False

[privilege_escalation]
# taken standaard met sudo uitvoeren
become = True
```

Met dit bestand in je projectmap ziet die map er zo uit:

```
ansible-project/          ← hier voer je je commando's uit
├── ansible.cfg           ← instellingen (dit bestand)
├── hosts                 ← inventory: welke servers
└── playbook.yml          ← playbook: wat moet er gebeuren
```

En werkt alles zonder extra opties:

```bash
ansible all --list-hosts
ansible all -m ping
ansible-playbook playbook.yml
```

**Goed om te weten:**
- Relatieve paden (zoals `inventory = hosts`) worden gelezen **vanaf de map waar `ansible.cfg` staat**.
- Opties op de command line en instellingen in je playbook winnen van `ansible.cfg`. Met `ansible all -u root -m ping` log je dus in als `root`, ook al staat `remote_user = ubuntu` in je `ansible.cfg`.
- Controleer welke instellingen je effectief veranderd hebt met:
  ```bash
  ansible-config dump --only-changed
  ```

> **⚠️ Commentaar altijd op een aparte regel!** Commentaar achter een waarde (`inventory = hosts  # uitleg`) wordt gelezen als deel van de waarde, en dan vindt Ansible je inventory niet meer.

> **⚠️ WSL tip:** Werk je in WSL in een map op je Windows schijf (`/mnt/c/...`)? Dan negeert Ansible een `ansible.cfg` in die map om veiligheidsredenen (de map is "world-writable"). Werk daarom in je Linux home map, bv. `~/ansible-project`.

De versie in `05-IaC/iac-files/ansible/ansible.cfg` bevat enkel `host_key_checking = False`. Daar moet je de inventory dus nog met `-i hosts` meegeven.

#### Stappenplan: van installatie tot eerste ping

Dit is de volgorde die je volgt om met Ansible te starten:

```bash
# 1. Installeer Ansible op je control node
sudo apt install ansible

# 2. Maak je inventory aan (standaard locatie, of in je projectmap - zie hierboven)
sudo nano /etc/ansible/hosts

# 3. Controleer of Ansible je hosts ziet
ansible all --list-hosts

# 4. Zet je SSH public key op elke host (vraagt eenmalig het wachtwoord)
ssh-keygen -t ed25519               # enkel als je nog geen SSH key hebt
ssh-copy-id ubuntu@141.148.235.108  # herhaal voor elke host

# 5. Ping test: kan Ansible alle hosts bereiken?
ansible all -m ping
```

Een succesvolle ping ziet er zo uit:

```text
141.148.235.108 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
```

> **💡** De Ansible `ping` is geen gewone netwerk-ping: Ansible logt in via SSH en controleert of Python werkt op de server. `SUCCESS` betekent dus dat Ansible echt klaar is om taken uit te voeren.

#### 3. Ad-hoc Commands
Snelle commando's zonder playbooks. De basis structuur is:

```bash
ansible <hosts of groep> -m <module> -a "<argumenten>"
ansible <hosts of groep> -a "<linux commando>"      # zonder -m wordt de command module gebruikt
```

> In de voorbeelden hieronder staat `-i hosts` omdat de inventory in de projectmap staat. Gebruik je `/etc/ansible/hosts` of staat `inventory = hosts` in je `ansible.cfg`, dan mag je `-i hosts` weglaten.

```bash
# Test connectiviteit
ansible all -i hosts -m ping

# Systeem informatie
ansible mycloudvms -i hosts -a "cat /etc/os-release"

# Package installatie
ansible ubuntu-servers -i hosts -m apt -a "name=htop state=present" --become

# Service beheer
ansible all -i hosts -m systemd -a "name=nginx state=started enabled=yes" --become

# File operaties
ansible all -i hosts -m copy -a "src=/tmp/test.txt dest=/tmp/test.txt" 

# User management
ansible all -i hosts -m user -a "name=devops shell=/bin/bash groups=sudo" --become
```

**Veel gebruikte modules:**
- `ping`: Test connectiviteit
- `command`/`shell`: Commando's uitvoeren
- `apt`/`yum`: Package management
- `copy`/`file`: File operaties
- `user`/`group`: User management
- `systemd`/`service`: Service management

### Ansible Playbooks

Playbooks zijn YAML bestanden die complexe taken definiëren. Bij complexere configuraties heb je meerdere modules nodig die **sequentieel** (na elkaar, van boven naar onder) uitgevoerd worden. Die stappen groepeer je in een playbook.

#### Basis Playbook structuur
```yaml
---
- name: Playbook naam        # ← begin van een Play
  hosts: doelgroep           # op welke hosts/groep uit de inventory?
  remote_user: ubuntu        # met welke gebruiker inloggen? (optioneel)
  become: yes                # taken uitvoeren met sudo
  vars:
    variabele: waarde

  tasks:
    - name: Task beschrijving  # ← één Task
      module:                  # ← de module die de Task gebruikt
        parameter: waarde
```

**Waar komen de `hosts` vandaan?** De waarde bij `hosts:` is de naam van een groep (of host) uit je **inventory**. `hosts: ubuntu-servers` werkt dus alleen als de groep `[ubuntu-servers]` in het inventory bestand staat dat Ansible gebruikt (zie [Waar staat het inventory bestand?](#-waar-staat-het-inventory-bestand)).

> **⚠️ YAML = strikte indentatie!** Gebruik altijd **spaties**, nooit tabs, en lijn alles netjes uit. Eén spatie te veel of te weinig en je playbook werkt niet.

#### Praktisch voorbeeld: Server Setup

```yaml
# 05-IaC/iac-files/ansible/playbook.yaml
---
- name: Example Playbook for Ubuntu Servers
  hosts: all
  become: yes
  vars:
    new_user: devopsuser
    ssh_pub_key: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQD..."

  tasks:
    - name: Update apt cache
      apt:
        update_cache: yes

    - name: Upgrade all packages
      apt:
        upgrade: dist

    - name: Install essential packages
      apt:
        name:
          - git
          - curl
          - htop
          - vim
          - docker.io
        state: present

    - name: Create a new user
      user:
        name: "{{ new_user }}"
        shell: /bin/bash
        state: present
        groups: sudo

    - name: Add SSH key for new user
      authorized_key:
        user: "{{ new_user }}"
        key: "{{ ssh_pub_key }}"

    - name: Ensure UFW is installed
      apt:
        name: ufw
        state: present

    - name: Allow SSH through firewall
      ufw:
        rule: allow
        name: OpenSSH

    - name: Enable UFW
      ufw:
        state: enabled
        enabled: yes

    - name: Start and enable Docker
      systemd:
        name: docker
        state: started
        enabled: yes
```

#### Simpel Playbook voorbeeld

```yaml
# 05-IaC/iac-files/ansible/playbook-createfile.yml
---
- name: My playbook
  hosts: all
  tasks:
     - name: Leaving a mark
       command: "touch /tmp/ansible_automated_file"
```

### Playbook uitvoeren

```bash
# Basis uitvoering
ansible-playbook -i hosts playbook.yaml

# Met verhoogde verbosity (debugging)
ansible-playbook -i hosts playbook.yaml -vvv

# Dry run (test zonder wijzigingen)
ansible-playbook -i hosts playbook.yaml --check

# Specifieke hosts
ansible-playbook -i hosts playbook.yaml --limit ubuntu-servers

# Met extra variabelen
ansible-playbook -i hosts playbook.yaml -e "new_user=milan"
```

### 🔍 Deep Dive: Geavanceerde Ansible Concepten

> **🔍 Deep Dive (optioneel):** Deze sectie gaat verder dan de basis. Je hebt dit niet nodig voor de les of de labo's.

#### 1. Variables en Templates
```yaml
vars:
  packages:
    - nginx
    - mysql-server
  mysql_root_password: "secure123"

tasks:
  - name: Install packages
    apt:
      name: "{{ packages }}"
      state: present

  - name: Configure nginx
    template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
    notify: restart nginx
```

#### 2. Handlers (Event-driven tasks)
```yaml
tasks:
  - name: Copy nginx config
    copy:
      src: nginx.conf
      dest: /etc/nginx/nginx.conf
    notify: restart nginx

handlers:
  - name: restart nginx
    systemd:
      name: nginx
      state: restarted
```

#### 3. Conditionals
```yaml
tasks:
  - name: Install Apache on Ubuntu
    apt:
      name: apache2
      state: present
    when: ansible_distribution == "Ubuntu"

  - name: Install httpd on CentOS
    yum:
      name: httpd
      state: present
    when: ansible_distribution == "CentOS"
```

#### 4. Loops
```yaml
tasks:
  - name: Create multiple users
    user:
      name: "{{ item }}"
      state: present
    loop:
      - alice
      - bob
      - charlie

  - name: Install multiple packages
    apt:
      name: "{{ item.name }}"
      state: "{{ item.state }}"
    loop:
      - { name: nginx, state: present }
      - { name: apache2, state: absent }
```

### 🔍 Deep Dive: Ansible Best Practices

> **🔍 Deep Dive (optioneel):** Deze sectie gaat verder dan de basis. Je hebt dit niet nodig voor de les of de labo's.

#### 1. Directory structuur
```
project/
├── ansible.cfg
├── hosts
├── group_vars/
│   ├── all.yml
│   └── webservers.yml
├── host_vars/
│   └── server1.yml
├── roles/
│   ├── webserver/
│   │   ├── tasks/main.yml
│   │   ├── handlers/main.yml
│   │   ├── templates/
│   │   └── vars/main.yml
│   └── database/
├── playbooks/
│   ├── site.yml
│   └── webserver.yml
└── inventory/
    ├── production
    └── staging
```

#### 2. Roles gebruiken
```bash
# Role aanmaken
ansible-galaxy init roles/webserver

# Role structuur
roles/webserver/
├── tasks/main.yml       # Hoofdtaken
├── handlers/main.yml    # Handlers
├── templates/          # Jinja2 templates
├── files/             # Statische bestanden
├── vars/main.yml      # Role variabelen
├── defaults/main.yml  # Default waarden
└── meta/main.yml      # Role metadata
```

#### 3. Vault voor gevoelige data
```bash
# Encrypted file aanmaken
ansible-vault create secret.yml

# Playbook met vault
ansible-playbook -i hosts playbook.yml --ask-vault-pass

# Vault password file
ansible-playbook -i hosts playbook.yml --vault-password-file ~/.vault_pass
```

---

## Deel 2: Terraform/OpenTofu - Infrastructure Provisioning

### Wat is Terraform?

Terraform is een open-source Infrastructure as Code tool van HashiCorp voor:
- **Infrastructure provisioning**: Cloud resources aanmaken
- **Multi-cloud**: Werkt met AWS, Azure, GCP, VMware, etc.
- **State management**: Houdt bij wat bestaat
- **Dependency management**: Begrijpt resource afhankelijkheden

### OpenTofu: Open Source Alternatief

OpenTofu is een community-driven fork van Terraform:
- **100% compatibel** met Terraform
- **Open source** under MPL-2.0 license
- **Community governance**
- **Actieve development**

### Declaratief vs Imperatief: Het Fundamentele Verschil

#### **Terraform: Declaratieve Benadering**

Terraform gebruikt een **declaratieve** programmeertaal (HCL - HashiCorp Configuration Language). Dit betekent dat je **beschrijft WAT je wilt**, niet HOE je het wilt bereiken.

```hcl
# Declaratief: "Ik wil 3 web servers"
resource "google_compute_instance" "web" {
  count        = 3
  name         = "web-server-${count.index}"
  machine_type = "e2-micro"
  
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
    }
  }
}
```

**Kenmerken van declaratieve taal:**
- ✅ **Gewenste eindtoestand**: Je beschrijft hoe de infrastructuur eruit moet zien
- ✅ **Idempotent**: Meerdere keren uitvoeren geeft hetzelfde resultaat
- ✅ **State-aware**: Terraform weet wat er al bestaat
- ✅ **Dependency resolution**: Automatische volgorde van resource creation
- ✅ **Drift detection**: Kan wijzigingen buiten Terraform detecteren

#### **Ansible: Imperatieve Benadering**

Ansible gebruikt een **imperatieve** benadering via YAML playbooks. Je beschrijft **HOE je stappen uitvoert** om tot het gewenste resultaat te komen.

```yaml
# Imperatief: "Voer deze stappen uit"
- name: Install and configure web servers
  hosts: all
  tasks:
    - name: Update package cache
      apt:
        update_cache: yes
        
    - name: Install nginx
      apt:
        name: nginx
        state: present
        
    - name: Start nginx service
      systemd:
        name: nginx
        state: started
        enabled: yes
        
    - name: Copy configuration file
      copy:
        src: nginx.conf
        dest: /etc/nginx/nginx.conf
      notify: restart nginx
      
  handlers:
    - name: restart nginx
      systemd:
        name: nginx
        state: restarted
```

> **Nuance:** veel Ansible modules beschrijven op zich wel een gewenste toestand (bv. `state: present` = "zorg dat nginx geïnstalleerd is"). Daardoor kan je een playbook veilig meerdere keren uitvoeren (idempotent). Maar het playbook als geheel blijft een **stappenplan** dat van boven naar onder uitgevoerd wordt.

**Kenmerken van imperatieve benadering:**
- ✅ **Stap-voor-stap**: Duidelijke volgorde van acties
- ✅ **Flexibiliteit**: Conditie logica en loops
- ✅ **Fijnmazige controle**: Exacte controle over elk detail
- ✅ **Geschikt voor configuratie**: Perfect voor software instellingen
- ⚠️ **Volgorde belangrijk**: Stappen moeten in juiste volgorde uitgevoerd worden

#### **Praktisch Verschil: Server Creation**

**Terraform (Declaratief):**
```hcl
# Je zegt: "Ik wil 2 servers met deze specificaties"
resource "google_compute_instance" "app" {
  count = 2
  name  = "app-server-${count.index}"
  # ... configuratie
}

# Terraform bepaalt automatisch:
# - Of servers al bestaan
# - Welke moeten aangemaakt worden
# - In welke volgorde (dependencies)
# - Wat moet gewijzigd worden bij updates
```

**Ansible (Imperatief):**
```yaml
# Je zegt: "Voer deze acties uit op deze servers"
- name: Configure application servers
  hosts: app_servers
  tasks:
    - name: Check if application is installed
      stat:
        path: /opt/myapp
      register: app_installed
      
    - name: Download application
      get_url:
        url: "{{ app_download_url }}"
        dest: /tmp/app.tar.gz
      when: not app_installed.stat.exists
      
    - name: Extract application
      unarchive:
        src: /tmp/app.tar.gz
        dest: /opt/
      when: not app_installed.stat.exists
```

#### **Waarom Beide Benaderingen Waardevol Zijn**

| Aspect | Terraform (Declaratief) | Ansible (Imperatief) |
|--------|-------------------------|----------------------|
| **Best voor** | Infrastructure provisioning | Configuration management |
| **Mindset** | "Wat wil ik hebben?" | "Hoe ga ik het doen?" |
| **State** | Houdt state bij | Stateless (meestal) |
| **Dependencies** | Automatisch berekend | Handmatig gedefinieerd |
| **Updates** | Plan → Apply workflow | Playbook execution |
| **Rollback** | Via state management | Via reverse playbooks |
| **Learning curve** | Steiler voor beginners | Meer intuïtief |

#### **Wanneer Welke Benadering?**

**Gebruik Terraform (Declaratief) voor:**
- 🏗️ Infrastructure provisioning (VMs, netwerken, storage)
- 🔄 Lifecycle management van resources
- 🌐 Multi-cloud deployments
- 📊 Infrastructure die vaak wijzigt
- 🎯 Wanneer je wilt beschrijven "wat je wilt"

**Gebruik Ansible (Imperatief) voor:**
- ⚙️ Software configuratie en deployment
- 🔧 Complex multi-step procedures
- 🎭 Orchestration van bestaande systemen
- 📝 Wanneer je exacte controle over stappen nodig hebt
- 🔄 Wanneer je "hoe je het doet" belangrijk is

#### **Best Practice: Combinatie van Beide**

```bash
# 1. Declaratief: Maak infrastructuur met Terraform
tofu apply

# 2. Imperatief: Configureer servers met Ansible  
ansible-playbook site.yml
```

Dit combineert de kracht van beide benaderingen voor complete automation workflows!

### Terraform/OpenTofu Installatie

```bash
# OpenTofu installatie (aanbevolen)
# Ubuntu/Debian
curl --proto '=https' --tlsv1.2 -fsSL https://get.opentofu.org/install-opentofu.sh -o install-opentofu.sh
chmod +x install-opentofu.sh
sudo ./install-opentofu.sh

# macOS
brew install opentofu

# Verificatie
tofu version

# Terraform installatie (alternatief)
# Ubuntu/Debian
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

> **💡 Terraform of OpenTofu?** De commando's zijn identiek, enkel de naam verschilt: `terraform plan` = `tofu plan`. In deze cursus gebruiken we `tofu`, maar alles werkt ook met `terraform`.

### 📍 Waar staan de bestanden? (De projectmap)

Net zoals bij Ansible is de **locatie belangrijk**. Terraform/OpenTofu werkt altijd met de **map waarin je het commando uitvoert**:

- **Alle** `.tf` bestanden in die map worden samen ingelezen (de naam `main.tf` is een afspraak, geen verplichting)
- Bestanden in submappen worden **niet** ingelezen
- Een bestand met de naam `terraform.tfvars` wordt **automatisch** geladen

Na `tofu init` en `tofu apply` ziet je projectmap er zo uit:

```
demoGCE/                      ← hier voer je alle tofu commando's uit
├── main.tf                   ← jij schrijft: de infrastructuur
├── terraform.tfvars          ← jij schrijft: jouw waarden voor de variabelen
├── .terraform/               ← aangemaakt door tofu init: gedownloade providers
├── .terraform.lock.hcl       ← aangemaakt door tofu init: vaste provider versies
└── terraform.tfstate         ← aangemaakt door tofu apply: wat er effectief bestaat
```

> **⚠️ Veelgemaakte fout:** `tofu plan` uitvoeren in de verkeerde map. Je krijgt dan een foutmelding dat er geen configuratie is, of (erger) Terraform kijkt naar een **ander** project. Controleer met `pwd` en `ls` of je in de juiste map staat.

> **⚠️ Niet in Git zetten:** `terraform.tfstate` en je service account key (`.json`) kunnen gevoelige gegevens bevatten. Zet ze in je `.gitignore`. Verwijder ook **nooit** handmatig je `terraform.tfstate` zolang je infrastructuur nog bestaat: dan weet Terraform niet meer wat het aangemaakt heeft.

### Terraform/OpenTofu Workflow

```
1. WRITE → 2. PLAN → 3. APPLY → 4. DESTROY
   ↓         ↓         ↓         ↓
  .tf files  tofu plan tofu apply tofu destroy
```

Voordat je kan beginnen moet je de projectmap **eenmalig initialiseren** met `tofu init`. Dat downloadt de providers (bv. de Google provider) die in je code staan.

#### 1. **Write**: Infrastructure definiëren
```hcl
# main.tf
resource "google_compute_instance" "web" {
  name         = "web-server"
  machine_type = "e2-micro"
  zone         = "us-central1-a"
  
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
    }
  }
}
```

#### 2. **Plan**: Wijzigingen vooruitkijken
```bash
tofu plan
# Shows: 1 to add, 0 to change, 0 to destroy
```

#### 3. **Apply**: Wijzigingen uitvoeren
```bash
tofu apply
# Creates the actual infrastructure
```

#### 4. **Destroy**: Infrastructuur opruimen

**⚠️ KRITIEK: Waarom NOOIT handmatig verwijderen in cloud dashboards!**

**❌ Verkeerde manier - Handmatig verwijderen:**
```bash
# DOE DIT NOOIT:
# - Ga naar GCP Console
# - Verwijder VM instances handmatig
# - Verwijder VPC handmatig  
# - Verwijder firewall rules handmatig
```

**Problemen met handmatig verwijderen:**
1. **State drift**: Terraform state klopt niet meer met realiteit
2. **Orphaned resources**: Vergeten resources blijven bestaan → kosten geld
3. **Dependency issues**: Resources zijn vaak afhankelijk van elkaar
4. **No rollback**: Geen manier om terug te gaan
5. **Team confusion**: Anderen weten niet wat er gewijzigd is
6. **Lost tracking**: Geen audit trail van wijzigingen

**✅ Juiste manier - Terraform destroy:**
```bash
# Plan de destruction (veiligheidscheck)
tofu plan -destroy

# Output toont wat er verwijderd wordt:
# Plan: 0 to add, 0 to change, 5 to destroy.
#
# Changes to Outputs:
#   - ip = "34.78.123.45" -> null
#
# Do you want to perform these actions?

# Voer destroy uit
tofu destroy

# Bevestig met: yes
```

**Waarom Terraform destroy beter is:**
- ✅ **Intelligente volgorde**: Verwijdert resources in juiste volgorde (reverse dependencies)
- ✅ **State synchronisatie**: Houdt state file bij
- ✅ **Rollback mogelijkheid**: Kan altijd opnieuw tofu apply doen
- ✅ **Audit trail**: Alle wijzigingen zijn gedocumenteerd
- ✅ **Team-friendly**: Iedereen kan zien wat er gebeurd is
- ✅ **Kostenbesparing**: Geen vergeten resources

#### 🔍 Deep Dive: Gedetailleerd Destroy Proces

> **🔍 Deep Dive (optioneel):** Deze sectie gaat verder dan de basis. Je hebt dit niet nodig voor de les of de labo's. Voor de basis volstaat `tofu destroy`.

**1. Destroy planning (veilig):**
```bash
# Bekijk wat er vernietigd wordt zonder het te doen
tofu plan -destroy

# Output voorbeeld:
# Terraform will perform the following actions:
#
#   # google_compute_firewall.ssh-server will be destroyed
#   - resource "google_compute_firewall" "ssh-server" {
#       - name = "default-allow-ssh-terraform" -> null
#       # ... more details
#     }
#
#   # google_compute_instance.vm_instance will be destroyed  
#   - resource "google_compute_instance" "vm_instance" {
#       - name = "opentofu-instance" -> null
#       # ... more details
#     }
#
# Plan: 0 to add, 0 to change, 4 to destroy.
```

**2. Selective destroy (specifieke resources):**
```bash
# Verwijder alleen specifieke resource
tofu destroy -target=google_compute_instance.vm_instance

# Verwijder meerdere specifieke resources
tofu destroy -target=google_compute_instance.vm_instance -target=google_compute_firewall.ssh-server
```

**3. Force destroy (zonder confirmatie - GEVAARLIJK):**
```bash
# Automatisch destroy zonder "yes" prompt
tofu destroy -auto-approve

# ⚠️ ALLEEN GEBRUIKEN IN AUTOMATION/CI/CD!
# NOOIT HANDMATIG IN PRODUCTIE!
```

**4. Destroy met variable files:**
```bash
# Als je custom tfvars gebruikt
tofu destroy -var-file="production.tfvars"

# Met specifieke variables
tofu destroy -var="environment=staging"
```

#### 🔍 Deep Dive: Best Practices voor Resource Cleanup

**1. Altijd plan eerst:**
```bash
# Workflow voor veilige cleanup
tofu plan -destroy              # 1. Bekijk wat er gebeurt
tofu destroy                    # 2. Voer uit na review
```

**2. State backup voor destroy:**
```bash
# Backup state voor grote destroys
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d)
tofu destroy
```

**3. Environment-specific destroy:**
```bash
# Per environment
tofu workspace select staging
tofu destroy

tofu workspace select production  
tofu plan -destroy  # EXTRA VOORZICHTIG IN PRODUCTIE!
```

**4. Protect kritieke resources:**
```hcl
# In je .tf files - voorkom accidental destroy
resource "google_compute_instance" "critical_database" {
  name = "prod-database"
  
  # Voorkom destroy via Terraform
  lifecycle {
    prevent_destroy = true
  }
}
```

**5. Gradual destroy voor complexe setups:**
```bash
# Stap-voor-stap destroy van grote infrastructuur
tofu destroy -target=google_compute_instance.web_servers
tofu destroy -target=google_compute_instance.app_servers  
tofu destroy -target=google_sql_database_instance.db
tofu destroy  # Rest van infrastructure
```

#### 🔍 Deep Dive: Troubleshooting Destroy Issues

**1. Resource dependencies:**
```bash
# Als destroy faalt door dependencies
tofu destroy -target=dependent_resource
tofu destroy  # Dan de rest
```

**2. External changes (drift):**
```bash
# Als resources handmatig gewijzigd zijn
tofu refresh    # Update state met echte situatie
tofu destroy    # Dan destroy
```

**3. Stuck resources:**
```bash
# Als resources niet kunnen worden verwijderd
tofu state list                                    # Bekijk state
tofu state rm google_compute_instance.stuck       # Remove van state
# Handmatig opruimen in cloud console (als laatste redmiddel)
```

**4. Import vergeten resources:**
```bash
# Als je vergeten resources hebt
tofu import google_compute_instance.existing projects/PROJECT/zones/ZONE/instances/INSTANCE
tofu destroy  # Dan kan destroy ze vinden
```

#### 🔍 Deep Dive: Cost Monitoring & Cleanup Automation

**1. Automated cleanup scripts:**
```bash
#!/bin/bash
# cleanup-dev-environment.sh

echo "Cleaning up development environment..."
cd terraform/environments/dev
tofu destroy -auto-approve
echo "Dev environment cleaned up!"
```

**2. Scheduled cleanup (cron):**
```bash
# Automatisch dev environments opruimen elke vrijdag
0 18 * * 5 /home/user/scripts/cleanup-dev-environment.sh
```

**3. Cost alerts integratie:**
```hcl
# Monitoring resource om kosten bij te houden
resource "google_billing_budget" "dev_budget" {
  billing_account = var.billing_account
  display_name    = "Dev Environment Budget"
  
  budget_filter {
    projects = ["projects/${var.project_id}"]
  }
  
  amount {
    specified_amount {
      currency_code = "EUR"
      units         = "100"  # 100 EUR budget
    }
  }
}
```

**🎯 Onthoud: Terraform destroy is je veiligheidsnet tegen kostbare vergissingen en orphaned resources!**

### HCL (HashiCorp Configuration Language)

#### Basis syntax
```hcl
# Comments start with #

# Variables
variable "instance_name" {
  description = "Name of the instance"
  type        = string
  default     = "my-instance"
}

# Resources
resource "resource_type" "resource_name" {
  argument1 = "value1"
  argument2 = var.instance_name
  
  nested_block {
    nested_argument = "nested_value"
  }
}

# Outputs
output "instance_ip" {
  value = resource_type.resource_name.public_ip
}
```

Je verwijst naar een resource met `<type>.<naam>.<attribuut>`, bv. `google_compute_instance.vm_instance.name`, en naar een variabele met `var.<naam>`.

### Praktisch voorbeeld: Google Cloud Platform

#### Basis GCP setup

```hcl
# 05-IaC/iac-files/opentofu/demoGCE/main.tf

# Settings: welke providers heeft dit project nodig?
terraform {
  required_providers {
    google = {
      source = "hashicorp/google"   # verwijst naar de provider in de registry
    }
  }
}

variable "gce_ssh_user" {
  description = "SSH user for GCE instances"
}

variable "gce_ssh_pub_key_file" {
  description = "Path to SSH public key file"
}

variable "gcp_project" {
  description = "GCP Project ID"
}

variable "gcp_region" {
  description = "GCP Region"
  default     = "us-central1"
}

variable "gcp_zone" {
  description = "GCP Zone"
  default     = "us-central1-a"
}

variable "gcp_key_file" {
  description = "Path to GCP service account key file"
}

# Provider configuratie
provider "google" {
  credentials = file(var.gcp_key_file)
  project     = var.gcp_project
  region      = var.gcp_region
  zone        = var.gcp_zone
}

# Static IP address
resource "google_compute_address" "static" {
  name = "ipv4-address"
}

# VPC Network
resource "google_compute_network" "vpc_network" {
  name                    = "vpc-network"
  auto_create_subnetworks = "true"
}

# Firewall rule
resource "google_compute_firewall" "ssh-server" {
  name    = "default-allow-ssh-terraform"
  network = google_compute_network.vpc_network.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ssh-server"]
}

# VM Instance
resource "google_compute_instance" "vm_instance" {
  name         = "opentofu-instance"
  machine_type = "e2-micro"

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
    }
  }

  network_interface {
    network = google_compute_network.vpc_network.self_link
    access_config {
      nat_ip = google_compute_address.static.address
    }
  }

  metadata = {
    sshKeys = "${var.gce_ssh_user}:${file(var.gce_ssh_pub_key_file)}"
  }

  tags = ["ssh-server"]
}

# Output values
output "ip" {
  description = "Public IP address of the instance"
  value       = google_compute_instance.vm_instance.network_interface.0.access_config.0.nat_ip
}

output "instance_name" {
  description = "Name of the instance"
  value       = google_compute_instance.vm_instance.name
}
```

#### Variables file

Het bestand `terraform.tfvars` staat **in dezelfde map** als `main.tf` en wordt automatisch ingelezen. Hierin vul je de waarden in voor de `variable` blokken uit `main.tf`:

```hcl
# terraform.tfvars (in dezelfde map als main.tf)
gce_ssh_user         = "ubuntu"
gce_ssh_pub_key_file = "~/.ssh/id_rsa.pub"
gcp_project          = "my-gcp-project"
gcp_region           = "europe-west1"
gcp_zone             = "europe-west1-b"
gcp_key_file         = "path/to/service-account-key.json"
```

> **💡** Een relatief pad zoals `../accesskeyGCE/service-account.json` is relatief ten opzichte van de map waarin je `tofu` uitvoert.

### Terraform/OpenTofu Commando's

De basis commando's, in de volgorde waarin je ze gebruikt (voer ze uit **in je projectmap**):

```bash
tofu init        # map initialiseren: providers downloaden (eenmalig, of na het toevoegen van een provider)
tofu fmt         # je .tf bestanden netjes formatteren
tofu validate    # syntax controleren
tofu plan        # bekijken wat er zal veranderen (verandert nog niets!)
tofu apply       # wijzigingen effectief uitvoeren (bevestigen met: yes)
tofu show        # de huidige state bekijken
tofu output      # de outputs tonen (bv. het IP adres van je VM)
tofu destroy     # alles wat dit project aangemaakt heeft opruimen (bevestigen met: yes)
```

#### 🔍 Deep Dive: Meer Terraform/OpenTofu commando's

> **🔍 Deep Dive (optioneel):** Handig om te kennen, maar niet nodig voor de basis.

```bash
# Plan opslaan en later exact dat plan uitvoeren
tofu plan -out=plan.tfplan
tofu apply plan.tfplan

# State list
tofu state list

# Resource importeren (bestaande resource onder beheer van Terraform brengen)
tofu import google_compute_instance.web my-instance

# Plan destroy (safety check)
tofu plan -destroy

# Destroy specific resources
tofu destroy -target=google_compute_instance.vm_instance

# Auto-approve destroy (automation only!)
tofu destroy -auto-approve

# Destroy with variables
tofu destroy -var-file="staging.tfvars"

# Specifieke resource targeten
tofu apply -target=google_compute_instance.vm_instance

# Workspace management
tofu workspace new production
tofu workspace select staging
tofu workspace list
```

### State Management

#### Terraform State file

Terraform onthoudt in het bestand `terraform.tfstate` **wat het allemaal aangemaakt heeft**. Zo kan het bij een volgende `tofu plan` vergelijken:

- **gewenste toestand** = wat in je `.tf` bestanden staat
- **huidige toestand** = wat in de state file staat (en in de cloud bestaat)

Het verschil tussen die twee is precies wat `tofu plan` je toont. Dit bestand staat in je projectmap en wordt automatisch beheerd: **pas het nooit met de hand aan**.

Zo ziet een (vereenvoudigde) state file eruit:

```json
{
  "version": 4,
  "terraform_version": "1.0.0",
  "serial": 1,
  "lineage": "uuid",
  "outputs": {},
  "resources": [
    {
      "mode": "managed",
      "type": "google_compute_instance",
      "name": "vm_instance",
      "instances": [...]
    }
  ]
}
```

#### 🔍 Deep Dive: Remote State (Productie)

> **🔍 Deep Dive (optioneel):** Deze sectie gaat verder dan de basis. Je hebt dit niet nodig voor de les of de labo's. In de labo's werk je alleen en is de lokale `terraform.tfstate` prima.

**Het probleem: de state staat op jouw laptop**

Standaard staat `terraform.tfstate` gewoon in je projectmap. Werk je alleen, dan is dat geen probleem. In een team wel:

- Iedereen heeft zijn **eigen kopie** van de state. Die lopen uit elkaar, en Terraform denkt dan dat resources ontbreken en probeert ze opnieuw aan te maken.
- Laptop kwijt of map verwijderd? Dan weet Terraform niet meer wat het gemaakt heeft en kan je niet meer netjes `destroy` doen.
- Doen twee mensen **tegelijk** `apply`, dan kan de state beschadigd raken.

**De oplossing: de state centraal in de cloud bewaren**

Met een `backend` blok zeg je tegen Terraform: "bewaar de state niet lokaal, maar in deze opslag in de cloud". Iedereen in het team gebruikt dan **hetzelfde** state bestand.

```hcl
# backend.tf (in dezelfde projectmap als main.tf)
terraform {
  backend "gcs" {                          # gcs = Google Cloud Storage
    bucket = "my-terraform-state-bucket"   # de bucket waarin de state bewaard wordt
    prefix = "terraform/state"             # de "map" binnen die bucket
  }
}
```

Bij de GCS backend wordt de state ook **vergrendeld** (locking) zolang iemand `apply` uitvoert. Een tweede persoon moet dan wachten.

Werk je met AWS in plaats van Google Cloud, dan gebruik je de `s3` backend. Dit is een **alternatief**, niet iets dat je erbij zet. Een project heeft maar **één** backend:

```hcl
terraform {
  backend "s3" {                  # s3 = opslag bij AWS
    bucket = "my-terraform-state"
    key    = "terraform.tfstate"  # bestandsnaam binnen de bucket
    region = "us-west-2"
  }
}
```

**Goed om te weten:**
- De bucket moet **al bestaan**. Terraform maakt hem niet zelf aan; je maakt hem één keer aan, bv. via de GCP console.
- Na het toevoegen of wijzigen van een backend voer je opnieuw `tofu init` uit. Terraform stelt dan voor om je bestaande lokale state naar de bucket te verplaatsen.

### 🔍 Deep Dive: Geavanceerde Terraform Concepten

> **🔍 Deep Dive (optioneel):** Deze sectie gaat verder dan de basis. Je hebt dit niet nodig voor de les of de labo's.

#### 1. Modules

**Wat is een module?**

Een module is een **herbruikbaar bouwblok**: een stuk Terraform code dat je één keer schrijft en daarna meerdere keren kan gebruiken, telkens met andere waarden. Vergelijk het met een **functie** in een programmeertaal.

Een module is gewoon een **map met `.tf` bestanden**. Ook je eigen projectmap is eigenlijk een module (de "root module").

```
mijn-project/                 ← root module: hier voer je tofu uit
├── main.tf                   ← gebruikt de module
└── modules/
    └── webserver/            ← de module: een gewone map met .tf bestanden
        └── main.tf
```

Een module heeft:
- **inputs**: `variable` blokken, de waarden die je meegeeft
- **resources**: wat de module aanmaakt
- **outputs**: `output` blokken, wat de module teruggeeft

**De module schrijven:**

```hcl
# modules/webserver/main.tf

# Inputs: deze waarden geef je mee als je de module gebruikt
variable "name_prefix" {
  description = "Begin van de naam van de servers"
}

variable "instance_count" {
  description = "Aantal servers"
  default     = 1
}

# Wat de module aanmaakt
resource "google_compute_instance" "web" {
  count        = var.instance_count
  name         = "${var.name_prefix}-web-${count.index}"
  machine_type = "e2-micro"
  # ... rest van de configuratie (zone, disk, netwerk)
}

# Output: wat de module teruggeeft
output "ips" {
  value = google_compute_instance.web[*].network_interface[0].access_config[0].nat_ip
}
```

**De module gebruiken:**

```hcl
# main.tf (in je projectmap)

# Dezelfde module twee keer gebruiken, met andere waarden
module "test" {
  source         = "./modules/webserver"   # waar staat de module?
  name_prefix    = "test"
  instance_count = 1
}

module "productie" {
  source         = "./modules/webserver"
  name_prefix    = "prod"
  instance_count = 3
}

# De output van een module gebruiken: module.<naam>.<output>
output "productie_ips" {
  value = module.productie.ips
}
```

Resultaat: met één module krijg je 1 testserver (`test-web-0`) en 3 productieservers (`prod-web-0` tot `prod-web-2`), zonder dezelfde code twee keer te schrijven.

**Goed om te weten:**
- Na het toevoegen van een module voer je opnieuw `tofu init` uit. Anders krijg je de fout "Module not installed".
- Daarom de input `name_prefix`: gebruik je een module meerdere keren, dan moeten de namen in de cloud verschillend zijn.
- Je kan ook kant-en-klare modules van anderen gebruiken uit de [Terraform Registry](https://registry.terraform.io/browse/modules). Dan verwijst `source` naar de registry in plaats van naar een map.

#### 2. Data Sources

**Wat is een data source?**

Met een `resource` blok **maakt** Terraform iets aan en beheert het. Met een `data` blok **zoekt** Terraform iets op dat **al bestaat**, om die informatie te gebruiken. Een data source maakt niets aan, wijzigt niets en wordt bij `tofu destroy` ook niet verwijderd.

| | `resource` | `data` |
|-|------------|--------|
| Wat doet het? | Aanmaken, wijzigen, verwijderen | Enkel **lezen** |
| Voorbeeld | Een nieuwe VM | De nieuwste Ubuntu image, een bestaand netwerk |
| Verwijzen | `google_compute_instance.vm.name` | `data.google_compute_image.ubuntu.self_link` |

**Voorbeeld:** in plaats van zelf de exacte naam van een Ubuntu image op te zoeken (die namen veranderen bij elke update), vraag je Terraform om de **nieuwste** image uit de Ubuntu 22.04 familie op te zoeken. En je gebruikt het netwerk `default` dat al bestaat in je GCP project.

```hcl
# Data source: zoek de nieuwste Ubuntu 22.04 image op (enkel lezen)
data "google_compute_image" "ubuntu" {
  family  = "ubuntu-2204-lts"
  project = "ubuntu-os-cloud"
}

# Data source: het bestaande "default" netwerk opzoeken
data "google_compute_network" "default" {
  name = "default"
}

resource "google_compute_instance" "vm" {
  name         = "mijn-vm"
  machine_type = "e2-micro"

  boot_disk {
    initialize_params {
      # gebruik wat de data source gevonden heeft
      image = data.google_compute_image.ubuntu.self_link
    }
  }

  network_interface {
    network = data.google_compute_network.default.self_link
    access_config {}
  }
}
```

**Goed om te weten:**
- Je verwijst naar een data source met het woord `data` ervoor: `data.<type>.<naam>.<attribuut>`.
- Bestaat wat je opzoekt niet (bv. een tikfout in de netwerknaam), dan stopt `tofu plan` met een foutmelding.
- Welke data sources er zijn en welke attributen ze teruggeven, vind je in de documentatie van de provider in de [Terraform Registry](https://registry.terraform.io/providers/hashicorp/google/latest/docs).

#### 3. Provisioners

**Wat is een provisioner?**

Terraform **maakt** infrastructuur aan (bv. een VM), maar installeert er niets op. Een **provisioner** is een extra actie die Terraform uitvoert **net nadat** een resource aangemaakt is. Bijvoorbeeld: een script naar de nieuwe VM kopiëren en uitvoeren.

Er zijn drie soorten:

| Provisioner | Waar wordt het uitgevoerd? | Voorbeeld |
|-------------|----------------------------|-----------|
| `file` | Kopieert van **je laptop** naar **de nieuwe VM** (via SSH) | `script.sh` naar de VM kopiëren |
| `remote-exec` | Op **de nieuwe VM** (via SSH) | Het script uitvoeren |
| `local-exec` | Op **je eigen laptop** | Het IP van de nieuwe VM in een Ansible `hosts` bestand schrijven |

Voor `file` en `remote-exec` moet Terraform kunnen inloggen op de VM. Dat beschrijf je in een `connection` blok. `self` betekent hier "deze resource zelf", dus de VM die net aangemaakt is.

```hcl
resource "google_compute_instance" "web" {
  # ... instance configuratie (naam, machine type, disk, netwerk)

  # Hoe moet Terraform inloggen op deze VM? (geldt voor alle provisioners hieronder)
  connection {
    type        = "ssh"
    user        = var.ssh_user
    private_key = file("~/.ssh/id_rsa")
    host        = self.network_interface[0].access_config[0].nat_ip
  }

  # 1. Kopieer script.sh van je laptop naar de nieuwe VM
  provisioner "file" {
    source      = "script.sh"
    destination = "/tmp/script.sh"
  }

  # 2. Voer het script uit OP de nieuwe VM
  provisioner "remote-exec" {
    inline = [
      "chmod +x /tmp/script.sh",
      "/tmp/script.sh",
    ]
  }

  # 3. Voer een commando uit op JE EIGEN laptop: schrijf het IP naar een Ansible inventory
  provisioner "local-exec" {
    command = "echo ${self.network_interface[0].access_config[0].nat_ip} > hosts"
  }
}
```

**Goed om te weten:**
- Provisioners draaien **enkel bij het aanmaken** van de resource. Pas je later `script.sh` aan en doe je opnieuw `tofu apply`, dan gebeurt er **niets** op de bestaande VM.
- Faalt een provisioner, dan markeert Terraform de VM als "tainted" (beschadigd). Bij de volgende `apply` wordt hij verwijderd en opnieuw aangemaakt.
- Terraform zelf raadt provisioners aan als **laatste redmiddel**. Voor software installeren zijn er betere opties:
  - een **startup script** dat de VM zelf uitvoert bij het opstarten (bij GCP: `metadata_startup_script`)
  - **Ansible**, zoals in [Deel 3: Ansible + Terraform Integratie](#deel-3-ansible--terraform-integratie): Terraform maakt de VM, Ansible configureert hem

#### 4. Conditionals en Functions

**Conditionals: als ... dan ... anders ...**

Terraform heeft geen `if` blokken zoals een programmeertaal. Je gebruikt een korte vorm:

```hcl
voorwaarde ? waarde_als_waar : waarde_als_onwaar
```

Lees het als: "**is** de voorwaarde waar? **dan** dit, **anders** dat". Bijvoorbeeld:

```hcl
variable "environment" {
  description = "test of production"
  default     = "test"
}

resource "google_compute_instance" "web" {
  # In productie 3 servers, anders 1
  count        = var.environment == "production" ? 3 : 1
  # In productie een grotere machine, anders de kleinste
  machine_type = var.environment == "production" ? "e2-medium" : "e2-micro"
  name         = "web-${count.index}"
  # ... rest van de configuratie
}
```

Met `tofu apply` krijg je 1 kleine server. Met `tofu apply -var="environment=production"` krijg je er 3 grotere, met **dezelfde code**.

Een veelgebruikte truc is een resource **aan- of uitzetten** met `count = 1` of `count = 0`:

```hcl
variable "create_static_ip" {
  description = "Een vast IP adres aanmaken?"
  type        = bool
  default     = false
}

resource "google_compute_address" "static" {
  # 1 = aanmaken, 0 = niet aanmaken
  count = var.create_static_ip ? 1 : 0
  name  = "web-ip"
}
```

**Functions: ingebouwde hulpjes**

Terraform heeft heel wat **ingebouwde functies** om met tekst, getallen en lijsten te werken. Je kan geen eigen functies schrijven, enkel deze gebruiken. Eén ken je al: `file("~/.ssh/id_rsa.pub")` uit het GCP voorbeeld leest een bestand in.

| Functie | Resultaat | Wat doet het? |
|---------|-----------|---------------|
| `upper("hallo")` | `"HALLO"` | Naar hoofdletters |
| `lower("Web-Server")` | `"web-server"` | Naar kleine letters |
| `replace("mijn server", " ", "-")` | `"mijn-server"` | Tekst vervangen |
| `length(["web1", "web2", "web3"])` | `3` | Aantal elementen in een lijst |
| `join(", ", ["web1", "web2"])` | `"web1, web2"` | Lijst samenvoegen tot tekst |
| `max(2, 7, 4)` | `7` | Grootste getal |
| `file("~/.ssh/id_rsa.pub")` | inhoud van het bestand | Bestand inlezen |

> **💡 Zelf uitproberen met `tofu console`:** in je projectmap start `tofu console` een interactieve prompt waarin je functies kan testen zonder iets aan te maken. Typ bv. `upper("hallo")` en druk Enter. Stoppen doe je met `exit`.

Alle functies vind je in de [OpenTofu documentatie](https://opentofu.org/docs/language/functions/).

**Locals: een waarde een naam geven**

Gebruik je dezelfde (berekende) waarde op meerdere plaatsen? Geef ze dan één keer een naam in een `locals` blok, en verwijs ernaar met `local.<naam>`. Hier wordt een functie gebruikt om van een projectnaam een geldige servernaam te maken:

```hcl
variable "project_name" {
  default = "Mijn Webshop"
}

locals {
  # "Mijn Webshop" wordt "mijn-webshop" (GCP namen: kleine letters, geen spaties)
  name_prefix = lower(replace(var.project_name, " ", "-"))

  # Labels die we op elke resource willen zetten
  common_labels = {
    environment = var.environment
    project     = local.name_prefix
  }
}

resource "google_compute_instance" "web" {
  name   = "${local.name_prefix}-web"   # wordt: mijn-webshop-web
  labels = local.common_labels
  # ... rest van de configuratie
}
```

| | `variable` | `local` |
|-|------------|---------|
| Wie bepaalt de waarde? | De **gebruiker** (via `terraform.tfvars` of `-var`) | De **code** zelf (berekend) |
| Verwijzen | `var.<naam>` | `local.<naam>` (zonder s!) |

> **💡** GCP labels moeten in **kleine letters**. `Environment = "test"` geeft een fout, `environment = "test"` werkt.

---

## Deel 3: Ansible + Terraform Integratie

### Waarom beide tools combineren?

1. **Terraform**: Maakt infrastructuur aan (VMs, netwerken, load balancers)
2. **Ansible**: Configureert de infrastructuur (software, services, users)

### Workflow voorbeeld

#### Stap 1: Infrastructuur met Terraform
```hcl
# main.tf - Create multiple VMs
resource "google_compute_instance" "web_servers" {
  count        = 3
  name         = "web-server-${count.index}"
  machine_type = "e2-micro"
  
  metadata = {
    sshKeys = "${var.ssh_user}:${file(var.ssh_public_key)}"
  }
  
  tags = ["web-server"]
}

# Output IP addresses for Ansible
output "web_server_ips" {
  value = google_compute_instance.web_servers[*].network_interface.0.access_config.0.nat_ip
}
```

#### Stap 2: Dynamic Inventory voor Ansible
```bash
# Get IPs from Terraform output
tofu output -json web_server_ips | jq -r '.[]' > ansible_hosts.txt
```

Het resultaat is gewoon een inventory bestand met één IP adres per regel. Omdat het niet op de standaard locatie (`/etc/ansible/hosts`) staat, geef je het mee met `-i ansible_hosts.txt`.

#### Stap 3: Configuratie met Ansible
```yaml
# playbook.yml
---
- name: Configure web servers
  hosts: all
  become: yes
  tasks:
    - name: Install nginx
      apt:
        name: nginx
        state: present
        
    - name: Start nginx
      systemd:
        name: nginx
        state: started
        enabled: yes
```

#### Stap 4: Uitvoering
```bash
# 1. Create infrastructure
tofu apply

# 2. Configure with Ansible
ansible-playbook -i ansible_hosts.txt playbook.yml
```

### 🔍 Deep Dive: Terraform Ansible Provider

> **🔍 Deep Dive (optioneel):** Deze sectie gaat verder dan de basis. Je hebt dit niet nodig voor de les of de labo's.

```hcl
# Using Ansible provider in Terraform
resource "ansible_playbook" "configure_servers" {
  playbook   = "playbook.yml"
  name       = google_compute_instance.web_servers[*].network_interface.0.access_config.0.nat_ip
  
  depends_on = [google_compute_instance.web_servers]
}
```

---

## Deel 4: Hands-on Oefeningen

### Oefening 1: Ansible Basics

#### Setup

1. Ga naar de map met de Ansible bestanden
2. Pas het bestand `hosts` aan: vervang de IP adressen door die van **jouw eigen** server(s)
3. Zet je SSH key op je server(s) met `ssh-copy-id` (zie [Stappenplan](#stappenplan-van-installatie-tot-eerste-ping))

```bash
cd 05-IaC/iac-files/ansible

# Controleer of Ansible je hosts ziet (let op de -i: de inventory staat in deze map!)
ansible all -i hosts --list-hosts

# Test connectivity
ansible all -i hosts -m ping

# Check OS version
ansible mycloudvms -i hosts -a "cat /etc/os-release"
```

#### Taken
1. **Systeem updates uitvoeren**
```bash
ansible all -i hosts -m apt -a "update_cache=yes upgrade=dist" --become
```

2. **Packages installeren**
```bash
ansible all -i hosts -m apt -a "name=htop,curl,git state=present" --become
```

3. **User aanmaken**
```bash
ansible all -i hosts -m user -a "name=student shell=/bin/bash groups=sudo" --become
```

4. **File kopiëren**
```bash
ansible all -i hosts -m copy -a "content='Hello Ansible!' dest=/tmp/hello.txt"
```

### Oefening 2: Ansible Playbook

Maak een playbook voor LAMP stack installatie:

```yaml
# lamp-stack.yml
---
- name: LAMP Stack Installation
  hosts: ubuntu-servers
  become: yes
  vars:
    mysql_root_password: "secure123"
    
  tasks:
    - name: Update apt cache
      apt:
        update_cache: yes
        
    - name: Install LAMP packages
      apt:
        name:
          - apache2
          - mysql-server
          - php
          - php-mysql
          - libapache2-mod-php
        state: present
        
    - name: Start Apache
      systemd:
        name: apache2
        state: started
        enabled: yes
        
    - name: Start MySQL
      systemd:
        name: mysql
        state: started
        enabled: yes
        
    - name: Create test PHP file
      copy:
        content: |
          <?php
          phpinfo();
          ?>
        dest: /var/www/html/info.php
        
    - name: Set MySQL root password
      mysql_user:
        name: root
        password: "{{ mysql_root_password }}"
        login_unix_socket: /var/run/mysqld/mysqld.sock
```

### Oefening 3: Terraform GCP Setup

#### Voorbereiding
1. **GCP Account en Project**
2. **Service Account Key** (JSON file)
3. **SSH Key Pair**

```bash
# SSH key genereren
ssh-keygen -t rsa -b 4096 -f ~/.ssh/gcp_key
```

#### Terraform configuratie
```bash
cd 05-IaC/iac-files/opentofu/demoGCE

# Variabelen file aanmaken
cat > terraform.tfvars << EOF
gce_ssh_user         = "ubuntu"
gce_ssh_pub_key_file = "~/.ssh/gcp_key.pub"
gcp_project          = "your-project-id"
gcp_region           = "europe-west1"
gcp_zone             = "europe-west1-b"
gcp_key_file         = "path/to/service-account.json"
EOF

# Initialiseren
tofu init

# Plan
tofu plan

# Apply
tofu apply

# IP adres van je nieuwe VM opvragen
tofu output ip

# Inloggen op je VM (met de gebruiker uit terraform.tfvars)
ssh -i ~/.ssh/gcp_key ubuntu@<IP-ADRES>

# Klaar? Ruim alles op, anders blijft het geld kosten!
tofu destroy
```

> **💡 Combineer met Ansible:** zet het IP adres van je nieuwe VM in een inventory bestand en voer een playbook uit op je VM. Zo heb je Terraform (aanmaken) en Ansible (configureren) samen gebruikt.

### 🔍 Deep Dive - Oefening 4: Multi-tier Applicatie

> **🔍 Deep Dive (optioneel):** Een uitbreidingsoefening voor wie verder wil. De code is een schets (`# ... configuration`) en werkt niet zonder aanvulling.

#### Terraform: Infrastructuur
```hcl
# multi-tier.tf
variable "instance_count" {
  default = {
    web = 2
    app = 2
    db  = 1
  }
}

# Web tier
resource "google_compute_instance" "web_tier" {
  count        = var.instance_count.web
  name         = "web-${count.index}"
  machine_type = "e2-micro"
  tags         = ["web-tier", "http-server"]
  
  # ... configuration
}

# App tier
resource "google_compute_instance" "app_tier" {
  count        = var.instance_count.app
  name         = "app-${count.index}"
  machine_type = "e2-micro"
  tags         = ["app-tier"]
  
  # ... configuration
}

# Database tier
resource "google_compute_instance" "db_tier" {
  count        = var.instance_count.db
  name         = "db-${count.index}"
  machine_type = "n1-standard-1"
  tags         = ["db-tier"]
  
  # ... configuration
}

# Load balancer
resource "google_compute_http_health_check" "web_health" {
  name = "web-health-check"
}

resource "google_compute_target_pool" "web_pool" {
  name      = "web-pool"
  instances = google_compute_instance.web_tier[*].self_link
  
  health_checks = [
    google_compute_http_health_check.web_health.name,
  ]
}
```

#### Ansible: Configuratie per tier
```yaml
# site.yml
---
- import_playbook: web-tier.yml
- import_playbook: app-tier.yml
- import_playbook: db-tier.yml

# web-tier.yml
---
- name: Configure Web Tier
  hosts: web_tier
  become: yes
  roles:
    - nginx
    - ssl_certificates

# app-tier.yml  
---
- name: Configure App Tier
  hosts: app_tier
  become: yes
  roles:
    - nodejs
    - application_code

# db-tier.yml
---
- name: Configure Database Tier
  hosts: db_tier
  become: yes
  roles:
    - mysql
    - database_setup
```

### 🔍 Deep Dive - Oefening 5: Declaratief vs Imperatief - Hands-on Vergelijking

> **🔍 Deep Dive (optioneel):** Deze sectie gaat verder dan de basis. Je hebt dit niet nodig voor de les of de labo's.

Deze oefening demonstreert het verschil tussen declaratieve en imperatieve benaderingen met een praktische server setup.

#### **Scenario: Web Server met Database Setup**

We gaan een web server met database opzetten op **twee manieren** om het verschil te ervaren.

#### **Deel A: Terraform (Declaratief) - "WAT je wilt"**

```hcl
# infrastructure.tf
variable "server_count" {
  description = "Number of web servers"
  default     = 2
}

# Declaratief: "Ik wil 2 web servers met deze specificaties"
resource "google_compute_instance" "web_servers" {
  count        = var.server_count
  name         = "web-server-${count.index + 1}"
  machine_type = "e2-micro"
  zone         = "europe-west1-b"

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
    }
  }

  network_interface {
    network = google_compute_network.vpc.self_link
    access_config {}
  }

  tags = ["web-server", "http-server"]

  metadata = {
    sshKeys = "${var.ssh_user}:${file(var.ssh_public_key)}"
  }
}

# Declaratief: "Ik wil een database server"
resource "google_compute_instance" "database" {
  name         = "database-server"
  machine_type = "n1-standard-1"
  zone         = "europe-west1-b"

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 50  # Bigger disk for database
    }
  }

  network_interface {
    network = google_compute_network.vpc.self_link
    access_config {}
  }

  tags = ["database-server"]
}

# Declaratief: "Ik wil een VPC netwerk"
resource "google_compute_network" "vpc" {
  name                    = "web-app-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "web-subnet"
  ip_cidr_range = "10.0.1.0/24"
  region        = "europe-west1"
  network       = google_compute_network.vpc.self_link
}

# Terraform figureert automatisch uit:
# - Welke volgorde (VPC → Subnet → VMs)
# - Welke dependencies
# - Wat al bestaat vs wat nieuw is
```

**Terraform Uitvoering:**
```bash
# Terraform kijkt naar gewenste state vs huidige state
tofu plan
# Plan: 4 to add, 0 to change, 0 to destroy

tofu apply
# Terraform maakt automatisch:
# 1. VPC network
# 2. Subnet (hangt af van VPC)
# 3. Web servers (hangen af van subnet)
# 4. Database server

# Als je later meer servers wilt:
# Wijzig variable server_count = 4
tofu plan
# Plan: 2 to add, 0 to change, 0 to destroy (alleen nieuwe servers!)

tofu apply
# Terraform maakt alleen de 2 nieuwe servers aan
```

#### **Deel B: Ansible (Imperatief) - "HOE je het doet"**

```yaml
# setup-infrastructure.yml
---
- name: Setup Complete Web Application Infrastructure
  hosts: localhost
  gather_facts: no
  vars:
    servers_to_create:
      - { name: "web-server-1", type: "web" }
      - { name: "web-server-2", type: "web" }
      - { name: "database-server", type: "db" }

  tasks:
    # Stap 1: Check if VPC exists
    - name: Check if VPC network exists
      google.cloud.gcp_compute_network_info:
        filters:
          - name = "web-app-network"
      register: vpc_result

    # Stap 2: Create VPC if it doesn't exist
    - name: Create VPC network
      google.cloud.gcp_compute_network:
        name: "web-app-network"
        auto_create_subnetworks: false
        state: present
      when: vpc_result.resources | length == 0

    # Stap 3: Check if subnet exists
    - name: Check if subnet exists
      google.cloud.gcp_compute_subnetwork_info:
        region: "europe-west1"
        filters:
          - name = "web-subnet"
      register: subnet_result

    # Stap 4: Create subnet if it doesn't exist
    - name: Create subnet
      google.cloud.gcp_compute_subnetwork:
        name: "web-subnet"
        ip_cidr_range: "10.0.1.0/24"
        region: "europe-west1"
        network:
          selfLink: "projects/{{ gcp_project }}/global/networks/web-app-network"
        state: present
      when: subnet_result.resources | length == 0

    # Stap 5: Check which servers already exist
    - name: Get existing instances
      google.cloud.gcp_compute_instance_info:
        zone: "europe-west1-b"
      register: existing_instances

    # Stap 6: Create servers that don't exist yet
    - name: Create web and database servers
      google.cloud.gcp_compute_instance:
        name: "{{ item.name }}"
        machine_type: "{{ 'e2-micro' if item.type == 'web' else 'n1-standard-1' }}"
        zone: "europe-west1-b"
        disks:
          - auto_delete: true
            boot: true
            initialize_params:
              source_image: "projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts"
              disk_size_gb: "{{ 10 if item.type == 'web' else 50 }}"
        network_interfaces:
          - network:
              selfLink: "projects/{{ gcp_project }}/global/networks/web-app-network"
            subnetwork:
              selfLink: "projects/{{ gcp_project }}/regions/europe-west1/subnetworks/web-subnet"
            access_configs:
              - name: External NAT
                type: ONE_TO_ONE_NAT
        tags:
          items:
            - "{{ item.type }}-server"
            - "{{ 'http-server' if item.type == 'web' else 'database-server' }}"
        state: present
      loop: "{{ servers_to_create }}"
      when: item.name not in (existing_instances.resources | map(attribute='name') | list)

    # Stap 7: Configure web servers after they're created
    - name: Wait for SSH to be available
      wait_for:
        port: 22
        host: "{{ hostvars[item.name]['ansible_host'] }}"
        delay: 30
        timeout: 300
      loop: "{{ servers_to_create }}"
      when: item.type == 'web'

    # Stap 8: Install web server software
    - name: Install nginx on web servers
      apt:
        name: nginx
        state: present
        update_cache: yes
      delegate_to: "{{ item.name }}"
      become: yes
      loop: "{{ servers_to_create }}"
      when: item.type == 'web'

    # Stap 9: Configure database server
    - name: Install MySQL on database server
      apt:
        name: mysql-server
        state: present
        update_cache: yes
      delegate_to: "database-server"
      become: yes

# Ansible vereist dat je elke stap expliciet beschrijft
```

**Ansible Uitvoering:**
```bash
# Ansible voert elke stap uit in volgorde
ansible-playbook setup-infrastructure.yml

# Als je later meer servers wilt:
# Wijzig de servers_to_create lijst
# Ansible controleert weer alle stappen
ansible-playbook setup-infrastructure.yml
# Alle checks worden opnieuw uitgevoerd, alleen nieuwe servers worden toegevoegd
```

#### **Deel C: Cleanup Vergelijking**

**Terraform Cleanup (Declaratief):**
```bash
# Terraform weet exact wat het heeft gemaakt
tofu plan -destroy
# Plan: 0 to add, 0 to change, 4 to destroy.
#   - google_compute_instance.database
#   - google_compute_instance.web_servers[0]
#   - google_compute_instance.web_servers[1]
#   - google_compute_network.vpc

tofu destroy
# Verwijdert alles in reverse dependency volgorde:
# 1. VMs eerst (afhankelijk van subnet)
# 2. Subnet (afhankelijk van VPC)
# 3. VPC als laatste
```

**Ansible Cleanup (Imperatief):**
```yaml
# cleanup-infrastructure.yml
---
- name: Cleanup Complete Infrastructure
  hosts: localhost
  tasks:
    # Stap 1: Stop all services first
    - name: Stop nginx on web servers
      systemd:
        name: nginx
        state: stopped
      delegate_to: "{{ item }}"
      become: yes
      loop:
        - web-server-1
        - web-server-2
      ignore_errors: yes

    # Stap 2: Delete instances in correct order
    - name: Delete web servers first
      google.cloud.gcp_compute_instance:
        name: "{{ item }}"
        zone: "europe-west1-b"
        state: absent
      loop:
        - web-server-1
        - web-server-2

    # Stap 3: Delete database server
    - name: Delete database server
      google.cloud.gcp_compute_instance:
        name: "database-server"
        zone: "europe-west1-b"
        state: absent

    # Stap 4: Wait for instances to be fully deleted
    - name: Wait for instances to be deleted
      pause:
        seconds: 30

    # Stap 5: Delete subnet
    - name: Delete subnet
      google.cloud.gcp_compute_subnetwork:
        name: "web-subnet"
        region: "europe-west1"
        state: absent

    # Stap 6: Delete VPC
    - name: Delete VPC network
      google.cloud.gcp_compute_network:
        name: "web-app-network"
        state: absent

# Je moet handmatig de juiste volgorde bepalen!
```

#### **Praktische Opdrachten**

**1. Terraform Oefening:**
```bash
# Maak de infrastructuur
cd terraform-declarative/
tofu init
tofu plan
tofu apply

# Schaal op (wijzig server_count naar 4)
tofu plan  # Bekijk wat er wijzigt
tofu apply

# Schaal af (wijzig server_count naar 1)
tofu plan  # Bekijk wat er verwijderd wordt
tofu apply

# Volledige cleanup
tofu destroy
```

**2. Ansible Oefening:**
```bash
# Maak de infrastructuur
cd ansible-imperative/
ansible-playbook setup-infrastructure.yml

# Voeg servers toe (wijzig servers_to_create lijst)
ansible-playbook setup-infrastructure.yml

# Cleanup
ansible-playbook cleanup-infrastructure.yml
```

**3. Vergelijkings-analyse:**

| Aspect | Terraform (Declaratief) | Ansible (Imperatief) |
|--------|--------------------------|----------------------|
| **Code lengte** | ±50 regels | ±150+ regels |
| **Dependency management** | Automatisch | Handmatig in juiste volgorde |
| **State awareness** | Weet wat bestaat | Moet elke keer checken |
| **Scaling up** | Wijzig getal → apply | Wijzig lijst → veel checks |
| **Scaling down** | Wijzig getal → apply | Expliciete delete stappen |
| **Cleanup** | 1 commando | Multi-step playbook |
| **Error handling** | Built-in rollback | Handmatige error handling |

#### **Leeruitkomsten**

Na deze oefening begrijp je:
- ✅ **Waarom declaratief efficiënter is** voor infrastructuur
- ✅ **Hoe Terraform dependencies automatisch oplost**
- ✅ **Waarom cleanup met Terraform veiliger is**
- ✅ **Wanneer imperative benadering nuttig is**
- ✅ **Hoe beide tools complementair zijn**

**🎯 Conclusie: Terraform voor "WAT", Ansible voor "HOE"!**

---

## 🔍 Deep Dive - Deel 5: Best Practices en Productie

> **🔍 Deep Dive (optioneel):** Dit deel gaat over hoe IaC in grote bedrijven en productie omgevingen gebruikt wordt. Niet nodig voor de les of de labo's.

### Terraform Best Practices

#### 1. **Project structuur**
```
terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── production/
├── modules/
│   ├── networking/
│   ├── compute/
│   └── database/
└── policies/
    └── security.rego
```

#### 2. **State management**
```hcl
# Remote state
terraform {
  backend "gcs" {
    bucket = "company-terraform-state"
    prefix = "environments/production"
  }
  
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}
```

#### 3. **Resource naming**
```hcl
locals {
  name_prefix = "${var.environment}-${var.project}"
  
  common_tags = {
    environment = var.environment
    project     = var.project
    managed_by  = "terraform"
    team        = var.team
  }
}

resource "google_compute_instance" "web" {
  name = "${local.name_prefix}-web-${count.index}"
  
  labels = local.common_tags
}
```

#### 4. **Security**
```hcl
# Variables for sensitive data
variable "database_password" {
  description = "Database root password"
  type        = string
  sensitive   = true
}

# Use data sources for existing resources
data "google_secret_manager_secret_version" "db_password" {
  secret = "database-password"
}
```

### Ansible Best Practices

#### 1. **Role-based structuur**
```
ansible/
├── group_vars/
│   ├── all.yml
│   ├── web.yml
│   └── db.yml
├── host_vars/
├── inventories/
│   ├── production/
│   └── staging/
├── roles/
│   ├── common/
│   ├── webserver/
│   └── database/
├── playbooks/
│   ├── site.yml
│   └── deploy.yml
└── ansible.cfg
```

#### 2. **Security met Vault**
```bash
# Secrets encrypten
ansible-vault encrypt group_vars/all/vault.yml

# Playbook met vault
ansible-playbook site.yml --ask-vault-pass
```

#### 3. **Testing**
```yaml
# molecule/default/molecule.yml
---
dependency:
  name: galaxy
driver:
  name: docker
platforms:
  - name: instance
    image: ubuntu:20.04
provisioner:
  name: ansible
verifier:
  name: ansible
```

#### 4. **CI/CD Integratie**
```yaml
# .github/workflows/ansible.yml
name: Ansible CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run ansible-lint
        run: ansible-lint
      - name: Run molecule test
        run: molecule test
```

### Monitoring en Logging

#### 1. **Terraform State monitoring**
```bash
# State drift detection
terraform plan -detailed-exitcode

# State backup
terraform state pull > backup-$(date +%Y%m%d).tfstate
```

#### 2. **Ansible logging**
```ini
# ansible.cfg
[defaults]
log_path = /var/log/ansible.log
callback_whitelist = profile_tasks, timer

[callback_profile_tasks]
task_output_limit = 20
```

#### 3. **Infrastructure monitoring**
```hcl
# Monitoring resources
resource "google_monitoring_uptime_check_config" "web_check" {
  display_name = "Web server uptime check"
  timeout      = "10s"
  
  http_check {
    path = "/"
    port = "80"
  }
  
  monitored_resource {
    type = "uptime_url"
    labels = {
      host       = google_compute_instance.web.network_interface[0].access_config[0].nat_ip
      project_id = var.gcp_project
    }
  }
}
```

---

## Troubleshooting en Debug

> De Ansible debug tips (`-vvvv`, `ansible all -m ping`) zijn handig voor iedereen. De Terraform state commando's zijn eerder verdieping.

### Terraform Debugging

#### 1. **Logging levels**
```bash
export TF_LOG=DEBUG
export TF_LOG_PATH=terraform.log
tofu apply
```

#### 2. **State issues**
```bash
# State list
tofu state list

# State show
tofu state show google_compute_instance.web

# Remove from state (dangerous!)
tofu state rm google_compute_instance.web

# Import existing resource
tofu import google_compute_instance.web projects/PROJECT/zones/ZONE/instances/INSTANCE
```

#### 3. **Graph visualization**
```bash
# Dependency graph
tofu graph | dot -Tsvg > graph.svg
```

### Ansible Debugging

#### 1. **Verbosity levels**
```bash
# Basic verbosity
ansible-playbook playbook.yml -v

# Maximum verbosity
ansible-playbook playbook.yml -vvvv

# Debug specific task
- name: Debug task
  debug:
    var: ansible_facts
```

#### 2. **Connection issues**
```bash
# Test connectivity
ansible all -m ping -vvvv

# SSH debug
ansible all -m shell -a "whoami" --ssh-extra-args="-vvv"
```

#### 3. **Facts gathering**
```bash
# Gather all facts
ansible hostname -m setup

# Specific fact
ansible hostname -m setup -a "filter=ansible_distribution*"
```

---

## Conclusie

### Samenvatting

**Infrastructure as Code transformeert IT-beheer:**

#### **Ansible (Configuration Management)**
- ✅ **Agentless**: Geen software op doelservers
- ✅ **Idempotent**: Veilig meerdere keren uitvoeren
- ✅ **YAML syntax**: Gemakkelijk leesbaar
- ✅ **Uitgebreide modules**: Voor alle configuratie taken

#### **Terraform/OpenTofu (Infrastructure Provisioning)**
- ✅ **Multi-cloud**: AWS, Azure, GCP, VMware
- ✅ **State management**: Houdt infrastructuur bij
- ✅ **Dependency resolution**: Intelligente resource volgorde
- ✅ **Plan/Apply workflow**: Veilige infrastructuur wijzigingen

#### **Samen sterker**
1. **Terraform** → Infrastructuur aanmaken
2. **Ansible** → Infrastructuur configureren
3. **Beide** → Volledig geautomatiseerde omgevingen

### Next Steps

#### **Beginner level**
1. **Practice**: Gebruik de oefeningen in `05-IaC/iac-files/`
2. **Experiment**: Probeer verschillende modules en providers
3. **Document**: Maak eigen playbooks en terraform modules

#### **Intermediate level**
1. **CI/CD**: Integreer IAC in deployment pipelines
2. **Testing**: Gebruik tools zoals Molecule en Terratest
3. **Security**: Implementeer vault en secrets management

#### **Advanced level**
1. **Multi-environment**: Dev/Staging/Production workflows
2. **Compliance**: Policy as Code met OPA/Sentinel
3. **GitOps**: Full GitOps workflows met ArgoCD/Flux

### Handige Resources

#### **Documentatie**
- [Ansible Documentation](https://docs.ansible.com/)
- [Terraform Documentation](https://www.terraform.io/docs)
- [OpenTofu Documentation](https://opentofu.org/docs/)

#### **Community**
- [Ansible Galaxy](https://galaxy.ansible.com/) - Roles en collections
- [Terraform Registry](https://registry.terraform.io/) - Modules en providers
- [OpenTofu Registry](https://github.com/opentofu/registry) - Open source registry

#### **Tools**
- [Ansible Lint](https://ansible-lint.readthedocs.io/) - Playbook linting
- [Terraform fmt](https://www.terraform.io/docs/commands/fmt.html) - Code formatting
- [Checkov](https://www.checkov.io/) - Security scanning

**🚀 De toekomst is Infrastructure as Code - start vandaag!**