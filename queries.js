// ==========================================
// Partie 1 - Installation et import du dataset
// ==========================================

// Question 1.1.1
// Création / sélection de la base fraudshield_banking
use("fraudshield_banking");

// Question 1.1.2
// Import CSV réalisé avec mongoimport depuis le conteneur Docker MongoDB
// car mongoimport n'était pas installé localement sur macOS.
//
// Paramètres essentiels :
// - --db : nom de la base de données
// - --collection : nom de la collection cible
// - --type csv : précise que le fichier importé est un CSV
// - --headerline : utilise la première ligne du CSV comme noms de colonnes
// - --file : chemin du fichier à importer
// - -u / -p / --authenticationDatabase : nécessaires ici car MongoDB est protégé par authentification
//
// Commande utilisée :
// docker exec -it mongo-docker-mongo-1 mongoimport \
//   -u root \
//   -p example \
//   --authenticationDatabase admin \
//   --db fraudshield_banking \
//   --collection transactions \
//   --type csv \
//   --headerline \
//   --file /FraudShield_Banking_Data.csv

// Question 1.1.3
// Vérification du nombre total de documents importés
db.transactions.countDocuments();
// Résultat : 50000 documents importés

// Vérification des types des champs après import
db.transactions.aggregate([
  { $limit: 1 },
  {
    $project: {
      _id: 0,
      Transaction_ID_type: { $type: "$Transaction_ID" },
      Customer_ID_type: { $type: "$Customer_ID" },
      Transaction_Amount_type: { $type: "$Transaction_Amount (in Million)" },
      Transaction_Time_type: { $type: "$Transaction_Time" },
      Transaction_Date_type: { $type: "$Transaction_Date" },
      Transaction_Type_type: { $type: "$Transaction_Type" },
      Merchant_ID_type: { $type: "$Merchant_ID" },
      Merchant_Category_type: { $type: "$Merchant_Category" },
      Transaction_Location_type: { $type: "$Transaction_Location" },
      Customer_Home_Location_type: { $type: "$Customer_Home_Location" },
      Distance_From_Home_type: { $type: "$Distance_From_Home" },
      Device_ID_type: { $type: "$Device_ID" },
      IP_Address_type: { $type: "$IP_Address" },
      Card_Type_type: { $type: "$Card_Type" },
      Account_Balance_type: { $type: "$Account_Balance (in Million)" },
      Daily_Transaction_Count_type: { $type: "$Daily_Transaction_Count" },
      Weekly_Transaction_Count_type: { $type: "$Weekly_Transaction_Count" },
      Avg_Transaction_Amount_type: { $type: "$Avg_Transaction_Amount (in Million)" },
      Max_Transaction_Last_24h_type: { $type: "$Max_Transaction_Last_24h (in Million)" },
      Is_International_Transaction_type: { $type: "$Is_International_Transaction" },
      Is_New_Merchant_type: { $type: "$Is_New_Merchant" },
      Failed_Transaction_Count_type: { $type: "$Failed_Transaction_Count" },
      Unusual_Time_Transaction_type: { $type: "$Unusual_Time_Transaction" },
      Previous_Fraud_Count_type: { $type: "$Previous_Fraud_Count" },
      Fraud_Label_type: { $type: "$Fraud_Label" }
    }
  }
]);

// Analyse des types observés juste après l'import :
// - de nombreux champs numériques sont déjà importés en int (Transaction_ID, Customer_ID, etc.)
// - Transaction_Date est importé comme string → nécessite une conversion en date
// - les champs Yes/No (Is_International_Transaction, etc.) sont importés comme strings
// - les champs texte (localisation, catégorie, type de carte, IP, etc.) sont en string
//
// Pourquoi certains champs numériques pourraient être importés comme des strings ?
// Un fichier CSV est un format texte brut : toutes les valeurs sont des chaînes de caractères.
// mongoimport fait une inférence automatique des types, mais si une colonne contient
// des valeurs mixtes (ex : un nombre et une cellule vide), MongoDB peut stocker
// le champ comme string au lieu de number.
// Pour corriger cela, on peut convertir les champs après import avec updateMany
// et les opérateurs $toInt, $toDouble ou $toDate.

// Sauvegarde avant modifications (bonne pratique)
db.transactions.aggregate([
  { $match: {} },
  { $out: "transactions_backup" }
]);
db.transactions_backup.countDocuments();


// Partie 1.2 - Validation de l'import

// Question 1.2.1
// Affichage des 5 premières transactions pour analyser la structure
db.transactions.find({}, { _id: 0 }).limit(5);

// Analyse de la structure :
// - chaque transaction est un document BSON avec une structure plate (pas de sous-documents)
// - les noms de certains champs contiennent des espaces et des parenthèses
//   (ex : "Transaction_Amount (in Million)"), ce qui oblige à utiliser des guillemets
// - les champs Yes/No sont encore des strings après import
// - Transaction_Date doit être converti en date pour les filtres temporels

// Question 1.2.2
// Stratégie : convertir les champs Yes/No en booléens avec updateMany et $cond
// On choisit 3 champs pertinents pour l'analyse de fraude :
// - Is_International_Transaction
// - Is_New_Merchant
// - Unusual_Time_Transaction

db.transactions.updateMany(
  {},
  [
    {
      $set: {
        Is_International_Transaction: {
          $cond: [{ $eq: ["$Is_International_Transaction", "Yes"] }, true, false]
        },
        Is_New_Merchant: {
          $cond: [{ $eq: ["$Is_New_Merchant", "Yes"] }, true, false]
        },
        Unusual_Time_Transaction: {
          $cond: [{ $eq: ["$Unusual_Time_Transaction", "Yes"] }, true, false]
        }
      }
    }
  ]
);

// Vérification de la conversion
db.transactions.findOne(
  {},
  {
    _id: 0,
    Is_International_Transaction: 1,
    Is_New_Merchant: 1,
    Unusual_Time_Transaction: 1
  }
);

// Conversion du champ Transaction_Date en type date
db.transactions.updateMany(
  { Transaction_Date: { $type: "string" } },
  [
    {
      $set: {
        Transaction_Date: {
          $dateFromString: {
            dateString: "$Transaction_Date",
            format: "%Y-%m-%d",
            onError: "$Transaction_Date",
            onNull: "$Transaction_Date"
          }
        }
      }
    }
  ]
);

// Vérification finale des conversions
db.transactions.findOne(
  {},
  {
    _id: 0,
    Transaction_Date: 1,
    Is_International_Transaction: 1,
    Is_New_Merchant: 1,
    Unusual_Time_Transaction: 1
  }
);
// Transaction_Date est bien en type date
// Les 3 champs booléens sont bien en true/false

// Partie 2 - Exploration et CRUD

// 2.1 Opérations de lecture basiques 

// Question 2.1.1
// Nombre total de transactions
db.transactions.countDocuments();
// Résultat : 50000

// Nombre de transactions frauduleuses
db.transactions.countDocuments({ Fraud_Label: "Fraud" });
// Résultat : 2423

// Taux de fraude : (2423 / 50000) * 100 = 4.85%
// Environ 1 transaction sur 20 est frauduleuse

// Question 2.1.2
// Transaction avec le montant le plus élevé
// Note : on filtre par $type "number" car certains champs contiennent des valeurs vides ("")
// qui seraient triées avant les nombres en ordre décroissant (ordre BSON)
db.transactions.find(
  { "Transaction_Amount (in Million)": { $type: "number" } },
  { _id: 0 }
).sort({ "Transaction_Amount (in Million)": -1 }).limit(1);

// Résultat : Transaction_ID 902451, montant de 9 millions
// Fraud_Label : "Normal" → cette transaction n'est PAS frauduleuse
// Détails notables : transaction ATM internationale (Singapore),
// client basé à Lahore, nouveau marchand, 1 fraude antérieure

// Question 2.1.3
// Les 10 clients ayant effectué le plus de transactions
db.transactions.aggregate([
  { $group: { _id: "$Customer_ID", nb_transactions: { $sum: 1 } } },
  { $sort: { nb_transactions: -1 } },
  { $limit: 10 },
  { $project: { _id: 0, Customer_ID: "$_id", nb_transactions: 1 } }
]);

// Résultat : les 10 clients les plus actifs ont entre 5 et 6 transactions
// La répartition est assez uniforme, pas de client avec un volume anormalement élevé

// ---- 2.2 Filtrage avancé ----

// Question 2.2.1
// Transactions remplissant simultanément les 4 critères :
// montant > 5M, internationale, carte de crédit, historique de fraude
// Note : Is_International_Transaction est un booléen (converti en Partie 1.2.2)
db.transactions.countDocuments({
  "Transaction_Amount (in Million)": { $gt: 5 },
  Is_International_Transaction: true,
  Card_Type: "Credit",
  Previous_Fraud_Count: { $gt: 0 }
});
// Résultat : 2667 transactions

// Nombre de fraudes parmi ces transactions
db.transactions.countDocuments({
  "Transaction_Amount (in Million)": { $gt: 5 },
  Is_International_Transaction: true,
  Card_Type: "Credit",
  Previous_Fraud_Count: { $gt: 0 },
  Fraud_Label: "Fraud"
});
// Résultat : 173 fraudes

// Taux de fraude : (173 / 2667) * 100 ≈ 6.49%
// Ce taux est supérieur au taux global (4.85%), ce qui confirme
// que cette combinaison de facteurs est un indicateur de risque accru

// Question 2.2.2
// Transactions à heure inhabituelle ET à plus de 100 km du domicile
db.transactions.countDocuments({
    Unusual_Time_Transaction: true,
    Distance_From_Home: { $gt: 100 }
  });
  // Résultat : 20734 transactions
  
  // Nombre de fraudes parmi celles-ci
  db.transactions.countDocuments({
    Unusual_Time_Transaction: true,
    Distance_From_Home: { $gt: 100 },
    Fraud_Label: "Fraud"
  });
  // Résultat : 1231 fraudes
  
  // Taux de fraude : (1231 / 20734) * 100 ≈ 5.94%
  // Supérieur au taux global (4.85%), la combinaison heure inhabituelle
  // + distance élevée est un indicateur de risque

  // Question 2.2.3
// Transactions dans les catégories Electronics, Jewelry et Luxury Goods
// Utilisation de $in pour chercher parmi une liste de valeurs
db.transactions.countDocuments(
    {
      Merchant_Category: { $in: ["Electronics", "Jewelry", "Luxury Goods"] }
    },
    {
      _id: 0,
      Transaction_ID: 1,
      "Transaction_Amount (in Million)": 1,
      Merchant_Category: 1,
      Fraud_Label: 1
    }
  );
  // Résultat : 8216 transactions dans ces 3 catégories

  // Question 2.3.1
// Le système a incorrectement marqué des transactions comme frauduleuses
// pour le client 67961 le 24/03/2025. On corrige en les passant en "Normal".
db.transactions.updateMany(
    {
      Customer_ID: 67961,
      Transaction_Date: {
        $gte: ISODate("2025-03-24T00:00:00Z"),
        $lt: ISODate("2025-03-25T00:00:00Z")
      },
      Fraud_Label: "Fraud"
    },
    { $set: { Fraud_Label: "Normal" } }
  );
  
  // Résultat : matchedCount = 1, modifiedCount = 1
  // 1 transaction a été corrigée de "Fraud" à "Normal"

  // Question 2.3.2
// Ajout du champ risk_level en 3 étapes (LOW → MEDIUM → HIGH)
// L'ordre est important : les niveaux les plus sévères écrasent les moins sévères

// Étape 1 : initialisation de tous les documents à LOW
db.transactions.updateMany(
    {},
    { $set: { risk_level: "LOW" } }
  );
  // Résultat : modifiedCount = 50000
  
  // Étape 2 : passage en MEDIUM selon les critères du sujet
  db.transactions.updateMany(
    {
      $or: [
        { "Transaction_Amount (in Million)": { $gt: 5 } },
        { Is_International_Transaction: true },
        { Failed_Transaction_Count: { $gt: 3 } }
      ]
    },
    { $set: { risk_level: "MEDIUM" } }
  );
  // Résultat : modifiedCount = 36263
  
  // Étape 3 : passage en HIGH (écrase MEDIUM si les critères sont remplis)
  db.transactions.updateMany(
    {
      $or: [
        { "Transaction_Amount (in Million)": { $gt: 10 } },
        { Previous_Fraud_Count: { $gt: 2 } },
        { Distance_From_Home: { $gt: 500 } }
      ]
    },
    { $set: { risk_level: "HIGH" } }
  );
  // Résultat : modifiedCount = 8185
  
  // Répartition finale : LOW = 5552, MEDIUM = 36263, HIGH = 8185

  // Question 2.3.3
// Anonymisation RGPD : remplacer les IP des transactions de plus de 2 ans
// On utilise new Date() pour calculer dynamiquement la date d'il y a 2 ans
db.transactions.updateMany(
    {
      Transaction_Date: {
        $lt: new Date(new Date().setFullYear(new Date().getFullYear() - 2))
      }
    },
    { $set: { IP_Address: "ANONYMIZED" } }
  );
  
  // Résultat : modifiedCount = 0
  // Aucune transaction de plus de 2 ans dans le dataset (données de 2025)
  // La requête est néanmoins correcte et fonctionnerait sur des données plus anciennes

  // Question 2.4.1
// Archivage des transactions frauduleuses avec Failed_Transaction_Count élevé
// Note : le sujet demande >= 3, mais le max dans nos données est 2
// On adapte donc le seuil à >= 2 pour que la requête ait du sens

// Étape 1 : copie vers la collection archive_transactions
db.transactions.aggregate([
    {
      $match: {
        Fraud_Label: "Fraud",
        Failed_Transaction_Count: { $gte: 2 }
      }
    },
    { $out: "archive_transactions" }
  ]);
  
  // Étape 2 : vérification du nombre de documents archivés
  db.archive_transactions.countDocuments();
  // Résultat : 772 documents archivés
  
  // Étape 3 : suppression de la collection principale après vérification
  db.transactions.deleteMany({
    Fraud_Label: "Fraud",
    Failed_Transaction_Count: { $gte: 2 }
  });
  // Résultat : deletedCount = 772
  // Les 772 transactions ont bien été déplacées de transactions vers archive_transactions

  // Question 3.1.1
// Heures de la journée avec le plus de fraudes
db.transactions.aggregate([
    { $match: { Fraud_Label: "Fraud" } },
    {
      $project: {
        heure: { $toInt: { $substr: ["$Transaction_Time", 0, 2] } }
      }
    },
    {
      $group: {
        _id: "$heure",
        nb_fraudes: { $sum: 1 }
      }
    },
    { $sort: { nb_fraudes: -1 } },
    { $project: { _id: 0, heure: "$_id", nb_fraudes: 1 } }
  ]);
  
  // Résultat (top 5) :
  // 13h : 85 fraudes
  // 21h : 82 fraudes
  // 2h  : 79 fraudes
  // 23h : 76 fraudes
  // 18h : 74 fraudes
  // Les fraudes sont réparties sur toute la journée, mais on note
  // une légère surreprésentation en début d'après-midi et en soirée/nuit

  // Question 3.1.2
// Clients ayant effectué plus de 10 transactions en une journée
// avec au moins une fraude
db.transactions.aggregate([
    { $match: { Transaction_Date: { $type: "date" } } },
    {
      $group: {
        _id: {
          customer: "$Customer_ID",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$Transaction_Date" } }
        },
        nb_transactions: { $sum: 1 },
        nb_fraudes: { $sum: { $cond: [{ $eq: ["$Fraud_Label", "Fraud"] }, 1, 0] } }
      }
    },
    {
      $match: {
        nb_transactions: { $gt: 10 },
        nb_fraudes: { $gte: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        Customer_ID: "$_id.customer",
        date: "$_id.date",
        nb_transactions: 1
      }
    },
    { $sort: { nb_transactions: -1 } }
  ]);
  
  // Résultat : aucun client ne correspond
  // C'est cohérent car les clients les plus actifs ont au maximum
  // 5-6 transactions au total dans le dataset, donc impossible
  // d'en avoir plus de 10 en une seule journée

  // Question 3.2.1
// Les 5 localisations avec le taux de fraude le plus élevé
db.transactions.aggregate([
    {
      $group: {
        _id: "$Transaction_Location",
        total: { $sum: 1 },
        nb_fraudes: { $sum: { $cond: [{ $eq: ["$Fraud_Label", "Fraud"] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        localisation: "$_id",
        total: 1,
        nb_fraudes: 1,
        taux_fraude_pct: {
          $round: [{ $multiply: [{ $divide: ["$nb_fraudes", "$total"] }, 100] }, 2]
        }
      }
    },
    { $sort: { taux_fraude_pct: -1 } },
    { $limit: 5 }
  ]);
  
  // Résultats :
  // 1. Singapore : 188 fraudes / 4958 transactions (3.79%)
  // 2. London :  174 fraudes / 4829 transactions (3.60%)
  // 3. Bangkok : 171 fraudes / 4904 transactions (3.49%)
  // 4. Multan : 171 fraudes / 5010 transactions (3.41%)
  // 5. Dubai : 162 fraudes / 4840 transactions (3.35%)
  // Les taux sont relativement proches, pas de localisation qui se démarque fortement

  // Question 3.2.2
// Transactions "à distance" : localisation ≠ domicile et distance > 200 km
db.transactions.aggregate([
    {
      $match: {
        $expr: { $ne: ["$Transaction_Location", "$Customer_Home_Location"] },
        Distance_From_Home: { $gt: 200 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        nb_fraudes: { $sum: { $cond: [{ $eq: ["$Fraud_Label", "Fraud"] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        nb_fraudes: 1,
        taux_fraude_pct: {
          $round: [{ $multiply: [{ $divide: ["$nb_fraudes", "$total"] }, 100] }, 2]
        }
      }
    }
  ]);
  
  // Résultat : 29590 transactions, 988 fraudes, taux = 3.34%
  // Étonnamment, ce taux est inférieur au taux global (4.85%)
  // La distance seule n'est donc pas un indicateur fort de fraude

  // Question 3.3.1
// Les 10 marchands avec le montant total de fraudes le plus élevé
db.transactions.aggregate([
    {
      $match: {
        Fraud_Label: "Fraud",
        "Transaction_Amount (in Million)": { $type: "number" }
      }
    },
    {
      $group: {
        _id: "$Merchant_ID",
        montant_total_fraudes: { $sum: "$Transaction_Amount (in Million)" },
        nb_fraudes: { $sum: 1 },
        montant_moyen: { $avg: "$Transaction_Amount (in Million)" }
      }
    },
    { $sort: { montant_total_fraudes: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        Merchant_ID: "$_id",
        montant_total_fraudes: 1,
        nb_fraudes: 1,
        montant_moyen: { $round: ["$montant_moyen", 2] }
      }
    }
  ]);
  
  // Résultat (top 5) :
  // Merchant 65819 : 14M total, 2 fraudes, moyenne 7M
  // Merchant 28999 : 12M total, 2 fraudes, moyenne 6M
  // Merchant 95335 : 12M total, 2 fraudes, moyenne 6M
  // Merchant 71892 : 10M total, 2 fraudes, moyenne 5M
  // Merchant 82108 : 10M total, 2 fraudes, moyenne 5M
  // Les marchands les plus touchés ont peu de fraudes (1-2) mais avec des montants élevés

  // Question 3.3.2
// Ratio crédit/débit par catégorie de marchand
db.transactions.aggregate([
    {
      $group: {
        _id: "$Merchant_Category",
        nb_credit: {
          $sum: { $cond: [{ $eq: ["$Card_Type", "Credit"] }, 1, 0] }
        },
        nb_debit: {
          $sum: { $cond: [{ $eq: ["$Card_Type", "Debit"] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        categorie: "$_id",
        nb_credit: 1,
        nb_debit: 1,
        ratio_credit_debit: {
          $round: [{ $divide: ["$nb_credit", { $max: ["$nb_debit", 1] }] }, 2]
        }
      }
    },
    { $sort: { ratio_credit_debit: -1 } }
  ]);
  
  // Résultat :
  // Grocery : ratio 1.01 (légèrement plus de crédit)
  // Electronics : ratio 1.00
  // Clothing :  ratio 0.99
  // Fuel :  ratio 0.99
  // Restaurant : ratio 0.99
  // ATM : ratio 0.97 (légèrement plus de débit)
  // Les ratios sont très proches de 1 pour toutes les catégories,
  // il n'y a pas de préférence marquée crédit vs débit selon la catégorie
  // Note : une catégorie vide ("") avec 8 transactions existe (données incomplètes)

  // Question 3.4.1
// Transactions dont le montant dépasse 300% de la moyenne du client
db.transactions.aggregate([
    {
      $match: {
        "Transaction_Amount (in Million)": { $type: "number" },
        "Avg_Transaction_Amount (in Million)": { $type: "number" }
      }
    },
    {
      $match: {
        $expr: {
          $gt: [
            "$Transaction_Amount (in Million)",
            { $multiply: ["$Avg_Transaction_Amount (in Million)", 3] }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        nb_fraudes: { $sum: { $cond: [{ $eq: ["$Fraud_Label", "Fraud"] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        nb_fraudes: 1,
        taux_fraude_pct: {
          $round: [{ $multiply: [{ $divide: ["$nb_fraudes", "$total"] }, 100] }, 2]
        }
      }
    }
  ]);
  
  // Résultat : 9937 transactions exceptionnelles, 354 fraudes, taux = 3.56%
  // Ce taux est inférieur au taux global (4.85%)
  // Un montant élevé par rapport à la moyenne du client n'est donc pas
  // un indicateur fort de fraude dans ce dataset


  // Question 3.4.2
// Transactions avec nouveau marchand ET internationale
db.transactions.aggregate([
    {
      $match: {
        Is_New_Merchant: true,
        Is_International_Transaction: true
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        nb_fraudes: { $sum: { $cond: [{ $eq: ["$Fraud_Label", "Fraud"] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        nb_fraudes: 1,
        taux_fraude_pct: {
          $round: [{ $multiply: [{ $divide: ["$nb_fraudes", "$total"] }, 100] }, 2]
        }
      }
    }
  ]);
  
  // Résultat : 12356 transactions, 561 fraudes, taux = 4.54%
  // Proche du taux global (4.85%), la combinaison nouveau marchand +
  // transaction internationale n'est pas un indicateur fort de fraude

  // Question 3.4.3
// Transactions "suspectes" : au moins 3 critères sur 6 sont vrais
// Critères : montant > 2x moyenne, heure inhabituelle, nouveau marchand,
// internationale, distance > 100 km, plus de 5 transactions/jour
db.transactions.aggregate([
    {
      $match: {
        "Transaction_Amount (in Million)": { $type: "number" },
        "Avg_Transaction_Amount (in Million)": { $type: "number" }
      }
    },
    {
      $addFields: {
        suspicion_score: {
          $sum: [
            { $cond: [{ $gt: ["$Transaction_Amount (in Million)", { $multiply: ["$Avg_Transaction_Amount (in Million)", 2] }] }, 1, 0] },
            { $cond: ["$Unusual_Time_Transaction", 1, 0] },
            { $cond: ["$Is_New_Merchant", 1, 0] },
            { $cond: ["$Is_International_Transaction", 1, 0] },
            { $cond: [{ $gt: ["$Distance_From_Home", 100] }, 1, 0] },
            { $cond: [{ $gt: ["$Daily_Transaction_Count", 5] }, 1, 0] }
          ]
        }
      }
    },
    { $match: { suspicion_score: { $gte: 3 } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        nb_fraudes: { $sum: { $cond: [{ $eq: ["$Fraud_Label", "Fraud"] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        nb_fraudes: 1,
        taux_fraude_pct: {
          $round: [{ $multiply: [{ $divide: ["$nb_fraudes", "$total"] }, 100] }, 2]
        }
      }
    }
  ]);
  
  // Résultat : 32219 transactions suspectes, 1228 fraudes, taux = 3.81%
  // Le taux est inférieur au taux global (4.85%)
  // Les critères combinés ne semblent pas être des indicateurs forts de fraude
  // dans ce dataset, ce qui suggère que les fraudes sont distribuées
  // de manière relativement aléatoire parmi les transactions

  // Question 4.1.1
// Analyse des performances sans index
// Note : Is_International_Transaction adapté en true (converti en booléen en Partie 1.2.2)
db.transactions.find({
    "Transaction_Amount (in Million)": { $gt: 5 },
    Fraud_Label: "Fraud",
    Is_International_Transaction: true
  }).explain("executionStats");
  
  // Résultat :
  // - executionTimeMillis : 666 ms
  // - totalDocsExamined : 49228
  // - nReturned : 470
  // - stage : COLLSCAN (scan complet de la collection, aucun index utilisé)
  // MongoDB parcourt les 49228 documents pour n'en retourner que 470,
  // ce qui est très inefficace (ratio examinés/retournés ≈ 105:1)

  // Question 4.1.2
// 3 requêtes fréquentes pour un système de détection de fraude en temps réel
// Analyse des performances SANS index

// Requête 1 : vérifier les fraudes d'un client spécifique
db.transactions.find({
    Customer_ID: 67961,
    Fraud_Label: "Fraud"
  }).explain("executionStats");
  // executionTimeMillis : 816 ms | totalDocsExamined : 49228
  // nReturned : 0 | stage : COLLSCAN
  
  // Requête 2 : transactions à haut risque frauduleuses
  db.transactions.find({
    risk_level: "HIGH",
    Fraud_Label: "Fraud"
  }).explain("executionStats");
  // executionTimeMillis : 60 ms | totalDocsExamined : 49228
  // nReturned : 269 | stage : COLLSCAN
  
  // Requête 3 : fraudes internationales dans la catégorie Electronics
  db.transactions.find({
    Is_International_Transaction: true,
    Fraud_Label: "Fraud",
    Merchant_Category: "Electronics"
  }).explain("executionStats");
  // executionTimeMillis : 83 ms | totalDocsExamined : 49228
  // nReturned : 145 | stage : COLLSCAN
  
  // Constat : les 3 requêtes font un COLLSCAN (scan complet de 49228 docs)
  // même quand elles ne retournent que peu ou pas de résultats
  // C'est inacceptable pour un système temps réel qui doit répondre en < 10ms

  // Question 4.2.1
// Création d'un index sur Fraud_Label
db.transactions.createIndex({ Fraud_Label: 1 });

// Ré-exécution de la requête 4.1.1 avec explain
db.transactions.find({
  "Transaction_Amount (in Million)": { $gt: 5 },
  Fraud_Label: "Fraud",
  Is_International_Transaction: true
}).explain("executionStats");

// Résultat APRÈS index :
// - executionTimeMillis : 54 ms (avant : 666 ms → ÷12)
// - totalDocsExamined : 1650 (avant : 49228 → ÷30)
// - nReturned : 470
// - stage : FETCH (utilise l'index IXSCAN sur Fraud_Label puis FETCH des documents)
//
// L'index sur Fraud_Label permet à MongoDB de ne scanner que les documents
// frauduleux au lieu de toute la collection, d'où l'amélioration significative

// Question 4.2.2
// Index composé selon la règle ESR (Equality, Sort, Range)
// Requête cible :
// db.transactions.find({
//   Customer_ID: "CUST0012345",
//   "Transaction_Amount (in Million)": { $gte: 1, $lte: 10 }
// }).sort({ Transaction_Date: -1 })
//
// Application de la règle ESR :
// 1. Equality : Customer_ID (recherche exacte avec =)
// 2. Sort : Transaction_Date (tri décroissant)
// 3. Range : Transaction_Amount (plage $gte/$lte)
// L'ordre est important : placer le champ de tri AVANT le range
// permet à MongoDB d'éviter un tri en mémoire

db.transactions.createIndex({
    Customer_ID: 1,
    Transaction_Date: -1,
    "Transaction_Amount (in Million)": 1
  });

  // Question 4.2.3
// Index pour recherches par localisation et catégorie de marchand
db.transactions.createIndex({
    Transaction_Location: 1,
    Merchant_Category: 1
  });
  
  // Test d'efficacité
  db.transactions.find({
    Transaction_Location: "Dubai",
    Merchant_Category: "Electronics"
  }).explain("executionStats");
  
  // Résultat :
  // - executionTimeMillis : 35 ms
  // - totalDocsExamined : 782
  // - nReturned : 782
  // - stage : FETCH
  // Ratio examinés/retournés = 1:1, l'index est parfaitement optimal
  // MongoDB ne parcourt que les documents correspondant aux critères