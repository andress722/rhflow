# Runbook de Teste de Escala e Carga Leve (Sprint 32)

Este guia orienta o time de engenharia e QA na execução de testes de escala, semeadura de dados sintéticos e auditoria de carga do PresençaFlow RH.

---

## 1. Semeadura de Dados Sintéticos

O script `scripts/seed-scale.ts` popula o banco de dados com empresas, funcionários e histórico de check-ins para simular volume real.

### Execução em Desenvolvimento:
```bash
npx ts-node scripts/seed-scale.ts --companies 20 --employees 100 --managers 5
```

### Parâmetros Suportados:
- `--companies <N>`: Número de empresas (default 20, com prefixo `SCALE_TEST_`).
- `--employees <N>`: Número de funcionários por empresa (default 100).
- `--managers <N>`: Número de gestores por empresa (default 5).

### Execução em Produção/Staging:
Por segurança, a execução é bloqueada em produção. Para forçar, configure a variável de ambiente:
```bash
ALLOW_SCALE_SEED=true npx ts-node scripts/seed-scale.ts --companies 5 --employees 50
```

---

## 2. Limpeza Segura de Dados de Teste

Para remover toda a massa de teste gerada sem afetar dados reais de clientes:

```bash
npx ts-node scripts/cleanup-scale-seed.ts --confirm
```

> [!WARNING]
> **Parâmetro de Confirmação:**
> O argumento `--confirm` é obrigatório. Em ambientes de produção, a variável `ALLOW_SCALE_SEED=true` também deve estar presente.

---

## 3. Teste de Carga Leve (Light Load Test)

O script `scripts/light-load-test.ts` simula acessos concorrentes rápidos nas rotas críticas de plataforma e empresa:

1. Certifique-se de que a API local está rodando:
   ```bash
   npm run dev
   ```
2. Execute o teste de carga:
   ```bash
   npx ts-node scripts/light-load-test.ts
   ```

### Thresholds e Objetivos de Latência (SLA):
- **Rotas Simples (p95):** < 500ms
- **Dashboards Agregados (p95):** < 1500ms
- **Falhas de Conexão ou Respostas 5xx:** 0%

---

## 4. Evolução para Ferramentas Robustas (k6)

Para testes mais profundos com milhares de conexões HTTP simultâneas simuladas por múltiplos nós, configure cenários no **k6**:
```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '30s',
};

export default function () {
  http.get('http://localhost:3001/api/admin/command-center/overview');
  sleep(1);
}
```
