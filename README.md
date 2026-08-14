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
- Lembretes do dia com botão "Marcar tomado"
- Notificações locais: 1h antes de cada consulta, na véspera às 18h, e à hora de cada medicamento
- Instalável como uma aplicação real (PWA), funciona sem ligação à internet
- Todos os dados ficam **no dispositivo** (sem servidor, sem conta)

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
