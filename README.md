# TP MongoDB - FraudShield Banking

## Description

Analyse de transactions bancaires pour la détection de fraude avec MongoDB. Ce TP couvre l'exploration d'un dataset de 50 000 transactions, l'identification de patterns de fraude, l'optimisation des performances via l'indexation, et la mise en place de pipelines d'agrégation avancés.

## Contexte métier

En tant que data analyst chez FraudShield (fintech spécialisée dans la détection de fraudes bancaires), l'objectif est d'analyser les transactions financières pour identifier les tendances de fraude et proposer des insights actionnables.

## Prérequis

- Docker avec MongoDB
- mongoimport (disponible dans le conteneur Docker)
- Dataset : `FraudShield_Banking_Data.csv`

## Installation

### 1. Lancer l'environnement Docker

```bash
docker compose up -d
```

### 2. Importer le dataset

```bash
docker exec -it mongo-docker-mongo-1 mongoimport \
  -u root \
  -p example \
  --authenticationDatabase admin \
  --db fraudshield_banking \
  --collection transactions \
  --type csv \
  --headerline \
  --file /FraudShield_Banking_Data.csv
```

## Structure du projet

```
FraudShield_tp/
├── queries.js          # Requêtes MongoDB commentées (Parties 1 à 6)
└── README.md
```

## Contenu du TP

### Partie 1 - Installation et import

Import du CSV, validation des données, conversion des types (booléens, dates).

### Partie 2 - Exploration et CRUD

Opérations de lecture, filtrage avancé, mises à jour (risk_level, RGPD), archivage.

### Partie 3 - Patterns de fraude

Analyse temporelle, géographique, comportementale et par marchands.

### Partie 4 - Indexation et performance

Analyse avec `explain()`, index simples, composés (règle ESR), partiels, sparse et couvrants.

### Partie 5 - Agrégation avancée

Pipelines d'agrégation, `$lookup` avec collections merchants/customers, score de suspicion, vue matérialisée.

### Partie 6 - Requêtes expertes

Détection de fraudes en série, optimisation temps réel (< 10ms), vues sécurisées.

## Principaux résultats

- **Taux de fraude global** : 4.85% (2423 fraudes / 50000 transactions)
- **Heures les plus à risque** : 13h (4.14%) et 21h (4.08%)
- **Constat principal** : les fraudes sont distribuées de manière relativement aléatoire dans ce dataset, les indicateurs comportementaux classiques (distance, heure, nouveau marchand) ne sont pas des prédicteurs forts
- **Performance** : temps de réponse optimisé de 666ms à 5ms grâce à l'indexation

## Technologies

- MongoDB 7+
- Docker / Docker Compose
- mongoimport
