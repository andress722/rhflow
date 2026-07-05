# Recursos Offline PWA e Sincronização de Dados

Este documento descreve os recursos offline, o ciclo de vida do Service Worker (PWA Shell) e a fila offline baseada em IndexedDB para controle de presença no PresençaFlow RH.

---

## 1. PWA Shell
O aplicativo foi estruturado utilizando princípios de Progressive Web App (PWA) para garantir resiliência visual e de navegação mesmo sob instabilidade total de rede:
* **Manifesto PWA**: Localizado em `frontend/public/manifest.json`, define as cores, ícones, orientação e modo de exibição standalone.
* **Service Worker**: Cacheia os assets estáticos da aplicação (código compilado do Next.js, arquivos públicos e fontes) permitindo o carregamento instantâneo do shell sem conexão com a internet.
* **Detecção de Estado**: O estado de conectividade (`isOnline`) é monitorado continuamente no frontend através dos eventos nativos do navegador (`window.online` e `window.offline`).

---

## 2. Operações de Negócio Offline (Fila IndexedDB)
Quando a aplicação detecta que o usuário está desconectado, o registro de check-in remoto real não é bloqueado, sendo redirecionado para a fila segura armazenada localmente no IndexedDB do navegador.

### Fluxo de Funcionamento:
1. **Registro do Evento**: O usuário inicia o registro de presença offline.
2. **Armazenamento no IndexedDB**:
   - Gera um `offlineEventId` determinístico (UUID) para fins de rastreabilidade e replay protection.
   - Incrementa o `offlineSequence` do dispositivo (garantindo ordem cronológica estrita).
   - Armazena o hash do evento anterior (`previousEventHash`), gerando uma cadeia sequencial imutável.
   - Computa o `payloadHash` (SHA-256 do payload) para detecção física de integridade.
3. **Reconexão de Rede**: O evento `online` do navegador dispara o sync da fila.
4. **Sincronização Sequencial**: A fila local é lida e enviada sequencialmente ao backend (`POST /api/presence/:id/simulate-response`). O item só é removido do IndexedDB após confirmação bem-sucedida do servidor (200 OK).

---

## 3. Limitações de Criptografia do `payloadHash`
> [!WARNING]
> O `payloadHash` (gerado localmente com SHA-256) fornece apenas a verificação de integridade básica e detecção de inconsistências de conteúdo durante o transporte. Ele **não** substitui a autenticação criptográfica de ponta a ponta, HMAC de canal seguro, assinatura digital com chaves assimétricas privadas ou chaves de hardware vinculadas ao dispositivo do colaborador.
