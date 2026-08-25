# Bússola Saúde 🧭

Aplicação web (PWA) para ajudar um familiar a organizar-se com as consultas médicas, os documentos e os medicamentos — sem se perder no meio dos papéis.

## Dois modos

- **Modo principal** (para a pessoa a ser ajudada): 3 botões grandes, texto grande, nenhuma opção escondida. Um "bilhete" mostra sempre a próxima consulta num relance.
- **Área do cuidador** (protegida por um código de 4 dígitos, `1234` por defeito): adicionar/editar consultas, medicamentos e respetivos horários, gerir notificações e exportar os dados.

## Funcionalidades (etapa 2)

- Adicionar consultas: médico, motivo, data, hora, local, foto do documento principal (convocatória, receita...)
- **Exames anexados a cada consulta**: podes juntar várias fotos ou PDFs de exames diretamente ligados a essa consulta
- **Bloco de perguntas para o médico**: nota de texto livre por consulta, para não esquecer o que perguntar
- **Documentos avulsos**: botão "Adicionar documento" no ecrã Documentos para fotografar ou carregar receitas/resultados que não pertencem a nenhuma consulta específica (foto da câmara ou ficheiro do telemóvel)
- Biblioteca de documentos unificada (avulsos + documentos de consultas + exames), organizada por data
- Gestão de medicamentos com vários horários de toma por dia
- **Foto da caixa do medicamento**: ajuda a reconhecer visualmente qual medicamento tomar, mostrada nos lembretes do dia e na lista de medicamentos
- **Suivi des médicaments à 3 états** : à chaque rappel, ton père choisit « Saltar » / « Tomado à l'heure prévue » / « Tomado agora » (avec l'heure réelle affichée). Le rendez-vous devient vert dès validation ; s'il ne répond pas 30 minutes après l'heure, la carte passe en rouge « esquecido »
- **Historique des 7 derniers jours** consultable dans l'espace aidant (onglet « Histórico »), avec code couleur : vert = pris, gris = sauté, rouge = oublié
- **Partager et imprimer chaque document** depuis l'écran Documentos (bouton de partage natif du téléphone, ou impression directe)
- **Perfil do paciente** : nome, sexo, idade e peso, éditáveis na área do cuidador — o nome aparece como saudação personalizada no ecrã principal ("Olá, José 👋")
- **Indicação de cada medicamento** : campo "Para que serve" (ex.: Diabetes, Tensão arterial), visível na lista de medicamentos
- **Ficha de informação por medicamento** (ícone "ℹ️") : para que serve + precauções — preenchidas por ti a partir da bula ou do farmacêutico, a app nunca gera informação médica sozinha
- **Itinerário clicável** : a morada de cada consulta abre diretamente o Google Maps
- **Ecrã "Medicamentos a tomar hoje"** dedicado (novo botão no ecrã principal) — o ecrã principal em si só mostra os medicamentos esquecidos, em pequeno, para não sobrecarregar
- **Botão vermelho de emergência** no ecrã principal, para ligar diretamente a um familiar (números configuráveis em Definições → Contactos de emergência)
- **Zoom de texto** : botão "Aa" no ecrã principal, alterna entre 3 tamanhos (normal / grande / muito grande), memorizado neste aparelho
- **Synchronisation multi-appareils (Firebase)** : les données sont partagées en temps réel entre les téléphones du Papa et des enfants, via un « code de famille » à 6 caractères (voir section dédiée ci-dessous)
- **État de la famille** : chaque appareil affiche la dernière activité des autres (ex. « Telemóvel do Papa — há 5 min »)
- **Alerte discrète pour les aidants** : si une prise n'est pas confirmée 30 minutes après l'heure prévue, les appareils déjà entrés dans l'espace aidant reçoivent une notification locale
- Notificações locais: 1h antes de cada consulta, na véspera às 18h, e à hora de cada medicamento
- Instalável como uma aplicação real (PWA), funciona sem ligação à internet
- Todos os dados ficam **no dispositivo** (sem servidor, sem conta)

## Synchronisation entre les 3 téléphones (code de famille)

L'app utilise Firebase (Firestore) pour partager les données en temps réel entre plusieurs appareils, gratuitement.

**Comment ça marche :** au premier lancement, l'app génère automatiquement un code à 6 caractères (visible dans Espace aidant → Definições → Família). C'est ce code qui relie les appareils entre eux — deux téléphones avec le même code voient exactement les mêmes rendez-vous, médicaments et documents, mis à jour en direct.

**Pour relier les 3 téléphones :**
1. Sur le premier téléphone configuré, ouvre Definições → Família et note le code affiché (ou utilise "Copiar")
2. Sur les 2 autres téléphones, va dans Definições → Família → "Ligar a outro código", colle le même code, valide
3. Les 3 appareils partagent désormais les mêmes données automatiquement

⚠️ **Étape obligatoire côté Firebase (une seule fois) :** les règles de sécurité Firestore doivent être configurées, sinon l'app ne pourra ni lire ni écrire de données. Dans la console Firebase → Firestore Database → onglet "Rules", remplace le contenu par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{familyCode}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Il faut aussi activer l'authentification anonyme : Authentication → Sign-in method → active le fournisseur "Anónimo". Personne n'a besoin de créer de compte ni de mot de passe — c'est automatique et invisible pour l'utilisateur.

## ⚠️ Limitação atual das notificações

Os lembretes funcionam enquanto a aplicação tiver sido aberta recentemente no dispositivo (verifica a cada 30 segundos). Para notificações garantidas mesmo que o telemóvel não abra a app há muito tempo, será preciso adicionar numa etapa seguinte um pequeno servidor de envio (notificações push clássicas). Está previsto como próxima etapa do projeto.

## Instalar no telemóvel

1. Hospedar estes ficheiros (ver abaixo)
2. Abrir o link no Chrome (Android) ou Safari (iPhone)
3. Menu do navegador → **"Adicionar ao ecrã principal"**
4. O ícone Bússola Saúde aparece como uma aplicação real

## Hospedar gratuitamente no GitHub Pages

1. Criar um novo repositório no GitHub e colocar lá todos os ficheiros desta pasta
2. No repositório: **Settings → Pages → Source → Deploy from branch → main / (root)**
3. O GitHub dá um endereço do tipo `https://o-teu-utilizador.github.io/nome-do-repositorio/`
4. Abrir esse endereço no telemóvel da pessoa em causa e adicioná-lo ao ecrã principal

## Estrutura do projeto

```
index.html      → estrutura dos dois modos (principal / cuidador)
style.css       → design (paleta, tipografia, layout)
app.js          → toda a lógica (dados, navegação, lembretes)
manifest.json   → configuração da app instalável
sw.js           → service worker (modo offline + exibição das notificações)
icon-192.png / icon-512.png → ícones da aplicação
```

## Próximas etapas possíveis

- Reconhecimento automático de texto nas fotos dos documentos (OCR) para preencher automaticamente médico/data/motivo
- Conta de cuidador partilhada entre vários familiares, sincronizada (requer um pequeno servidor)
- Notificações push reais mesmo com a app fechada há muito tempo
- Histórico de acompanhamento das tomas de medicamentos ao longo de várias semanas
