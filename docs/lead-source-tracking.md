# Rastreamento de Origem de Leads (UTM) — PresençaFlow RH

Este documento orienta sobre a utilização de parâmetros UTM para rastrear a eficácia das campanhas de marketing e aquisição de leads do PresençaFlow RH.

---

## 1. Parâmetros Aceitos

O formulário público de piloto (`/pilot`) e o backend estão preparados para capturar, sanitizar e salvar os seguintes parâmetros de campanha a partir da URL:

| Parâmetro URL | Campo Salvo no Banco | Descrição / Objetivo |
| :--- | :--- | :--- |
| `utm_source` | `utmSource` | Origem do tráfego (ex: google, linkedin, whatsapp, newsletter). |
| `utm_medium` | `utmMedium` | Mídia/canal de anúncio (ex: cpc, social, email, direct). |
| `utm_campaign` | `utmCampaign` | Nome da campanha comercial (ex: piloto_clinicas, rh_pmes). |
| `utm_content` | `utmContent` | Diferenciação de anúncios/links (ex: banner_topo, link_rodape). |
| `utm_term` | `utmTerm` | Palavra-chave paga ou termo de busca (ex: controle_ponto_whatsapp). |
| `source` | `source` | Identificador geral alternativo de canal ou campanha. |
| *Automático* | `referrer` | Endereço da página anterior que indicou o link (`document.referrer`). |
| *Automático* | `landingPath` | O caminho da URL onde o lead converteu (ex: `/pilot`). |

---

## 2. Exemplos de Links de Campanha

Use as estruturas de URLs parametrizadas abaixo para suas campanhas de captação de leads. Substitua os valores conforme o canal e o público-alvo desejado:

### Campanha de WhatsApp Direto (Envio direto ou grupos)
Ideal para divulgar para contatos frios ou parcerias:
```url
https://presencaflow.com/pilot?utm_source=whatsapp&utm_medium=direct&utm_campaign=piloto_clinicas
```

### Anúncios/Posts no LinkedIn
Ideal para postagens orgânicas ou campanhas pagas direcionadas a gestores de RH:
```url
https://presencaflow.com/pilot?utm_source=linkedin&utm_medium=social&utm_campaign=rh_pmes
```

### Campanhas de E-mail Marketing / Outbound
Ideal para acompanhamento de leads frios ou fluxos de nutrição:
```url
https://presencaflow.com/pilot?utm_source=email&utm_medium=outbound&utm_campaign=primeiro_contato
```

---

## 3. Como Visualizar no Painel de Leads

Os administradores de nível `SUPER_ADMIN` podem inspecionar a origem de cada lead diretamente na plataforma.

1. Acesse a área de administração em `/app/admin/leads`.
2. Você pode filtrar a lista pelo campo **Canal (Source)**, **Campanha (utm_campaign)** ou **Origem (utm_source)** para segmentar seus contatos.
3. Ao clicar no botão **Ver / Editar (ícone de lápis)** em qualquer linha da lista, o modal de detalhes exibirá o card **Rastreamento de Origem** contendo todas as variáveis capturadas.

---

## 4. Boas Práticas de Rastreamento

Para manter a consistência e a utilidade dos relatórios analíticos, siga estas diretrizes:

- **Use Letras Minúsculas**: Os parâmetros UTM diferenciam maiúsculas de minúsculas. Prefira sempre usar termos em minúsculo (ex: use `utm_source=linkedin` em vez de `utm_source=LinkedIn`).
- **Substitua Espaços por Sublinhados (`_`)**: Nunca utilize espaços em branco nas URLs de UTM. Substitua-os por sublinhados (ex: `piloto_rh_2026`).
- **Validação de Tamanhos**: O backend impõe limites estritos de segurança nas strings (100 caracteres para UTMs, 512 para caminho, 1024 para referrer). Evite criar UTMs excessivamente longas para impedir cortes nos caracteres finais.
- **Referrer Direto**: Se um usuário digitar a URL diretamente no navegador ou vier de abas anônimas, o campo `referrer` ficará em branco e será exibido como `Direto / Sem Referrer`.
