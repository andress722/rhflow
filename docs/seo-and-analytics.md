# Guia de SEO e Analytics — PresençaFlow RH

Este documento orienta os desenvolvedores e a equipe de marketing sobre como gerenciar as configurações de SEO, indexação por robôs, e o rastreamento analítico (analytics) da presença pública do PresençaFlow RH.

---

## 1. Customização de Títulos e Descrições (SEO)

As páginas públicas utilizam a infraestrutura do **Next.js App Router** para definição de metadados estáticos de SEO. Isso garante excelente indexação por buscadores e renderização no servidor (SSR) sem atrasos.

### Como editar metadados de uma página
Para alterar o título, descrição ou metadados de compartilhamento de redes sociais (Open Graph/Twitter) de qualquer página pública, edite a constante `metadata` exportada no arquivo `page.tsx` correspondente.

Exemplo (`frontend/src/app/pilot/page.tsx`):
```typescript
export const metadata: Metadata = {
  title: 'Solicitar piloto — PresençaFlow RH',
  description: 'Solicite um piloto do PresençaFlow RH e veja como organizar faltas, atrasos...',
  alternates: {
    canonical: 'https://presencaflow.com/pilot',
  },
  openGraph: {
    title: 'Solicitar piloto — PresençaFlow RH',
    description: 'Solicite um piloto do PresençaFlow...',
    url: 'https://presencaflow.com/pilot',
    type: 'website',
  },
};
```

> [!IMPORTANT]
> **Linguagem Sóbria**: Evite termos de marketing exagerados ou promessas de conformidade legal infundadas (ex: "100% blindado legalmente" ou "100% livre de LGPD"). A comunicação deve ser profissional e focada nas dores reais do RH.

---

## 2. Robots e Sitemap

A plataforma gera dinamicamente os arquivos de indexação para motores de busca sob a raiz do projeto Next.js.

### Sitemap (`/sitemap.xml`)
Implementado em [sitemap.ts](file:///c:/Users/Benyamin/Downloads/presencaflow_agent_base%20%281%29/presencaflow_agent_base/frontend/src/app/sitemap.ts), o gerador mapeia as rotas públicas que devem ser indexadas:
- `/` (Home)
- `/pilot` (Formulário de Piloto)
- `/privacy` (Política de Privacidade)
- `/terms` (Termos de Uso)

As rotas autenticadas da área do cliente `/app` e endpoints internos `/api` são excluídas para proteger a integridade e segurança dos dados dos clientes.

### Robots (`/robots.txt`)
Implementado em [robots.ts](file:///c:/Users/Benyamin/Downloads/presencaflow_agent_base%20%281%29/presencaflow_agent_base/frontend/src/app/robots.ts):
- **Permite**: Indexação de todas as páginas públicas listadas no sitemap.
- **Bloqueia**: `/app/` e rotas de `/api/`.

---

## 3. Configuração de Analytics por Env

O PresençaFlow RH possui uma estrutura integrada e modular em [analytics.ts](file:///c:/Users/Benyamin/Downloads/presencaflow_agent_base%20%281%29/presencaflow_agent_base/frontend/src/lib/analytics.ts) para disparar eventos analíticos de forma controlada por variáveis de ambiente.

### Variáveis de ambiente configuráveis (Frontend)
Configure as seguintes variáveis no arquivo `.env` ou nas configurações do seu servidor de deploy:

```env
# Define se o rastreamento analítico está ativo
NEXT_PUBLIC_ANALYTICS_ENABLED=true

# Especifica o provedor de analytics: 'console' (desenvolvimento), 'plausible' ou 'umami'
NEXT_PUBLIC_ANALYTICS_PROVIDER=console

# ID/Domínio do site de acompanhamento configurado no provedor
NEXT_PUBLIC_ANALYTICS_SITE_ID=presencaflow.com
```

> [!NOTE]
> Se `NEXT_PUBLIC_ANALYTICS_ENABLED` não estiver definido como `true`, nenhum script de acompanhamento externo será carregado ou executado, garantindo conformidade com a privacidade de dados e prevenindo erros no build.

---

## 4. Eventos Analíticos Rastreados

A plataforma dispara os seguintes eventos analíticos mínimos mapeados para acompanhar a conversão do funil de marketing:

| Evento | Gatilho | Propriedades Opcionais |
| :--- | :--- | :--- |
| `landing_viewed` | Quando um visitante acessa as páginas `/` ou `/pilot`. | `path` |
| `pilot_cta_clicked` | Quando o usuário clica no botão de enviar o formulário de piloto. | - |
| `pilot_form_started` | Quando o usuário interage/escreve no primeiro campo do formulário. | - |
| `pilot_form_submitted` | Quando o envio do formulário é acionado. | `companyName` |
| `lead_created_success` | Quando o lead é cadastrado com sucesso no banco de dados. | `companyName` |
| `lead_created_error` | Quando há um erro de validação ou de rede no envio. | `code` |

---

## 5. Cuidados de Privacidade de Dados (LGPD)

Em respeito à Lei Geral de Proteção de Dados (LGPD) e à privacidade do usuário:
1. **Sem IDs Pessoais nos Eventos**: Nunca envie dados pessoais de identificação (como e-mail do lead, número de WhatsApp ou CPF) para os providers de Analytics. Passe apenas identificadores genéricos ou informações corporativas agregadas (ex: `companyName`).
2. **Armazenamento de IP**: O backend não salva o endereço IP real do lead. Ele gera um hash SHA-256 irreversível do IP para proteção de privacidade contra rastreamento invasivo.
3. **Bloqueio de scripts**: Caso o usuário tenha optado por não receber cookies ou scripts no navegador, os mecanismos de proteção garantem o funcionamento correto das páginas de captura de lead sem erros de carregamento técnico.
