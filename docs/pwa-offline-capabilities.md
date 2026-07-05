# PWA Shell e Recursos Offline - Status Report

Esta documentação detalha a maturidade real de PWA (Progressive Web App) e operações offline do PresençaFlow RH.

---

## 1. PWA Shell Status

O PWA Shell garante a carregabilidade e a resiliência visual da interface do usuário mesmo na ausência completa de rede.

| Item | Status | Observações / Evidências |
| :--- | :--- | :--- |
| **manifest** | COMPLETE | Arquivo `manifest.json` presente em `frontend/public/manifest.json`. |
| **service worker** | COMPLETE | Registro e ativação do Service Worker em `frontend/src/app/layout.tsx`. |
| **installability** | COMPLETE | Atende aos critérios do Chrome/Lighthouse para instalação standalone no desktop e mobile. |
| **cache** | COMPLETE | Caching de assets estáticos compilados do Next.js e recursos de UI. |
| **fallback offline** | COMPLETE | Exibição de telas e componentes amigáveis quando o usuário está sem conectividade. |

---

## 2. Offline Business Operation Status

O Offline Business Operation refere-se ao motor de tolerância a falhas para batidas de ponto sem rede.

| Item | Status | Observações / Evidências |
| :--- | :--- | :--- |
| **IndexedDB** | COMPLETE | Fila local implementada usando a biblioteca `indexedDB` nativa em `frontend/src/lib/offline-db.ts`. |
| **offlineEventId** | COMPLETE | UUID gerado localmente e propagado no payload para identificação única do evento. |
| **sequence** | COMPLETE | Sequenciador cronológico incremental local. |
| **previousEventHash**| COMPLETE | Hash encadeado para garantir a integridade da sequência de eventos. |
| **payloadHash** | COMPLETE | SHA-256 gerado localmente sobre os dados da batida para validar integridade do conteúdo. |
| **sync** | COMPLETE | Mecanismo de sincronização em background ativado ao disparar o evento `online`. |
| **idempotência** | COMPLETE | Travas contra re-execução baseadas no `offlineEventId` único. |
| **replay protection** | COMPLETE | Backend rejeita transações repetidas com o mesmo `offlineEventId` retornando status 409 (Conflict). |
| **persistência** | COMPLETE | Dados permanecem guardados no IndexedDB até que o sync seja completado com sucesso. |

---

## 3. Arquitetura Operacional Real e Limitações

### Fluxo Real de Produção
As batidas de ponto em produção são originadas primariamente via **WhatsApp webhook** integrados a parceiros oficiais de comunicação da empresa. O colaborador realiza a marcação de presença respondendo às interações do bot no WhatsApp, e o sistema recebe essa batida de forma assíncrona.

### IndexedDB Queue
A fila IndexedDB e as batidas offline no frontend são utilizadas **exclusivamente no Simulador de Batida de Ponto e em Demonstrações** do sistema. Elas não fazem parte do fluxo oficial de produção das marcações de presença reais.

Por esse motivo, o status final de **Offline Business Operation** é classificado como **PARTIAL**.

### Pendência de Decisão de Negócio (Residual Pending Item)
* **BUSINESS_DECISION_PENDING**: Definir se a PWA será promovida futuramente a canal oficial de marcação de ponto direta dos colaboradores, estendendo a fila offline baseada em IndexedDB para o fluxo de produção.
