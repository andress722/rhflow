# PresençaFlow RH — Frontend App

Este é o aplicativo frontend do **PresençaFlow RH**, desenvolvido em React e Next.js. Ele fornece o painel operacional para gestores, administradores e analistas de RH.

---

## ⚙️ Variáveis de Ambiente

Para o correto funcionamento do frontend, crie um arquivo `.env` ou `.env.local` na pasta raiz do frontend contendo:

```ini
# URL base da API REST do backend
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## 🚀 Como Rodar o Projeto

### Modo de Desenvolvimento
Para rodar localmente com hot-reload ativo:
```bash
npm run dev
```
O aplicativo estará disponível em [http://localhost:3000](http://localhost:3000).

### Build e Inicialização de Produção
Para compilar a aplicação otimizada para produção:
```bash
npm run build
```

Para iniciar o servidor Next.js com a build otimizada gerada:
```bash
npm run start
```

---

## 🐳 Docker (Produção)

O projeto possui um Dockerfile de produção multi-stage. Para criar e rodar a imagem Docker:

```bash
# Build da imagem (pode passar a API URL via build arg se necessário)
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.presencaflow.com/api -t presencaflow-frontend .

# Inicialização do contêiner
docker run -p 3000:3000 presencaflow-frontend
```
